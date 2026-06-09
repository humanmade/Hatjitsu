import type { Server, Socket } from 'socket.io';
import {
  type ClientToServerEvents, type ServerToClientEvents, type SocketData, type Ack,
  joinSchema, slugOnlySchema, voteSchema, cardPackSchema, nameSchema, labelSchema, toggleSchema, ejectSchema,
  generateSlug,
} from '@hmpp/shared';
import { RoomStore } from './store/roomStore.js';
import * as room from './domain/room.js';
import { logger } from './logger.js';

type IO = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type IOSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

export function registerHandlers(io: IO, store: RoomStore): void {
  const broadcast = async (slug: string) => {
    const state = await store.load(slug);
    if (state) io.to(slug).emit('room:update', room.publicView(state));
  };

  io.on('connection', (socket: IOSocket) => {
    socket.on('room:create', async (cb) => {
      let slug = generateSlug();
      for (let i = 0; i < 10 && (await store.exists(slug)); i++) slug = generateSlug();
      await store.save(room.createRoom(slug));
      cb({ slug });
    });

    socket.on('room:join', async (data, cb) => {
      const parsed = joinSchema.safeParse(data);
      if (!parsed.success) return cb({ error: 'Invalid join payload' });
      const { slug, sessionId, name, voter } = parsed.data;
      let state = (await store.load(slug)) ?? room.createRoom(slug);
      state = room.enter(state, { sessionId, socketId: socket.id, name, voter });
      await store.save(state);
      socket.data.sessionId = sessionId;
      socket.data.slug = slug;
      await socket.join(slug);
      socket.to(slug).emit('room:update', room.publicView(state));
      // yourVote is sent only in this caller's ack (never broadcast), so anonymity holds
      // while letting a returning tab restore its own highlighted selection.
      const yourVote = state.connections[sessionId]?.vote ?? null;
      cb({ ...room.publicView(state), yourVote });
    });

    socket.on('room:info', async (data, cb) => {
      const parsed = slugOnlySchema.safeParse(data);
      if (!parsed.success) return cb({ error: 'Invalid payload' });
      const state = await store.load(parsed.data.slug);
      if (!state) return cb({ error: 'Sorry, this room no longer exists ...' });
      cb(room.publicView(state));
    });

    const mutate = async (
      slug: string,
      cb: (res: Ack) => void,
      apply: (state: import('@hmpp/shared').RoomState) => import('@hmpp/shared').RoomState | { error: string },
    ) => {
      const state = await store.load(slug);
      if (!state) return cb({ error: 'Sorry, this room no longer exists ...' });
      const result = apply(state);
      if ('error' in result) return cb(result);
      await store.save(result);
      await broadcast(slug);
      cb({ ok: true });
    };

    socket.on('vote', (data, cb) => {
      const p = voteSchema.safeParse(data);
      if (!p.success) return cb({ error: 'Invalid vote' });
      mutate(p.data.slug, cb, (s) => room.recordVote(s, socket.data.sessionId, p.data.vote));
    });

    socket.on('unvote', (data, cb) => {
      const p = slugOnlySchema.safeParse(data);
      if (!p.success) return cb({ error: 'Invalid payload' });
      mutate(p.data.slug, cb, (s) => room.clearVote(s, socket.data.sessionId));
    });

    socket.on('vote:reset', (data, cb) => {
      const p = slugOnlySchema.safeParse(data);
      if (!p.success) return cb({ error: 'Invalid payload' });
      mutate(p.data.slug, cb, (s) =>
        room.isAdmin(s, socket.data.sessionId) || room.votingFinished(s)
          ? room.resetVotes(s)
          : { error: 'Only the room admin can reset votes' });
    });

    socket.on('reveal:force', (data, cb) => {
      const p = slugOnlySchema.safeParse(data);
      if (!p.success) return cb({ error: 'Invalid payload' });
      mutate(p.data.slug, cb, (s) =>
        room.isAdmin(s, socket.data.sessionId) ? room.forceReveal(s) : { error: 'Only the room admin can force reveal' });
    });

    socket.on('name:set', (data, cb) => {
      const p = nameSchema.safeParse(data);
      if (!p.success) return cb({ error: 'Invalid name' });
      mutate(p.data.slug, cb, (s) => room.setName(s, socket.data.sessionId, p.data.name));
    });

    socket.on('round:label', (data, cb) => {
      const p = labelSchema.safeParse(data);
      if (!p.success) return cb({ error: 'Invalid label' });
      mutate(p.data.slug, cb, (s) => room.setRoundLabel(s, p.data.label));
    });

    socket.on('cardpack:set', (data, cb) => {
      const p = cardPackSchema.safeParse(data);
      if (!p.success) return cb({ error: 'Invalid card pack' });
      mutate(p.data.slug, cb, (s) => room.setCardPack(s, p.data.cardPack));
    });

    socket.on('voter:toggle', (data, cb) => {
      const p = toggleSchema.safeParse(data);
      if (!p.success) return cb({ error: 'Invalid payload' });
      mutate(p.data.slug, cb, (s) => {
        const isSelf = socket.data.sessionId === p.data.targetSessionId;
        if (!isSelf && !room.isAdmin(s, socket.data.sessionId)) {
          return { error: 'Only the room admin can toggle voter status' };
        }
        return room.toggleVoter(s, p.data.targetSessionId, p.data.voter);
      });
    });

    socket.on('eject:set', (data, cb) => {
      const p = ejectSchema.safeParse(data);
      if (!p.success) return cb({ error: 'Invalid payload' });
      mutate(p.data.slug, cb, (s) =>
        room.isAdmin(s, socket.data.sessionId)
          ? room.setEjectOnLeave(s, p.data.ejectOnLeave)
          : { error: 'Only the room admin can change this' });
    });

    socket.on('disconnecting', async () => {
      const slug = socket.data.slug;
      if (!slug) return;
      const state = await store.load(slug);
      if (!state) return;
      const next = room.leave(state, socket.id, state.ejectOnLeave);
      // Eject mode tidies up empty rooms immediately; keep mode lets them persist (TTL).
      if (state.ejectOnLeave && room.clientCount(next) === 0) await store.delete(slug);
      else { await store.save(next); io.to(slug).emit('room:update', room.publicView(next)); }
      logger.debug('socket disconnecting', { id: socket.id, slug });
    });
  });
}
