import type { Server, Socket } from 'socket.io';
import {
  type ClientToServerEvents, type ServerToClientEvents, type SocketData, type Ack,
  joinSchema, slugOnlySchema, voteSchema, cardPackSchema, nameSchema, labelSchema, toggleSchema, ejectSchema,
  facilitatorPassSchema, roomsStatusSchema,
  generateSlug,
} from '@hmpp/shared';
import { RoomStore } from './store/roomStore.js';
import * as room from './domain/room.js';
import { logger } from './logger.js';
import { createRateLimiter } from './rateLimit.js';
import { RATE_LIMITS, EJECT_GRACE_MS } from './config.js';

type IO = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type IOSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

export function registerHandlers(io: IO, store: RoomStore, ejectGraceMs = EJECT_GRACE_MS): void {
  const broadcast = async (slug: string) => {
    const state = await store.load(slug);
    if (state) io.to(slug).emit('room:update', room.publicView(state));
  };

  // Deferred half of eject-on-leave: once the grace window elapses, drop the participant if
  // they never came back. evict() is a no-op if they reconnected, so a wifi blip / redeploy
  // reconnect keeps their seat and vote.
  const reap = async (slug: string, sessionId: string) => {
    const state = await store.load(slug);
    if (!state || !state.ejectOnLeave) return;
    const next = room.evict(state, sessionId);
    if (next === state) return; // reconnected during grace — leave them be
    if (room.clientCount(next) === 0) await store.delete(slug);
    else { await store.save(next); io.to(slug).emit('room:update', room.publicView(next)); }
  };

  io.on('connection', (socket: IOSocket) => {
    const limit = createRateLimiter(RATE_LIMITS);

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
      if (!limit('room:info')) return cb({ error: 'Too many requests, slow down' });
      const parsed = slugOnlySchema.safeParse(data);
      if (!parsed.success) return cb({ error: 'Invalid payload' });
      const state = await store.load(parsed.data.slug);
      if (!state) return cb({ error: 'Sorry, this room no longer exists ...' });
      cb(room.publicView(state));
    });

    socket.on('rooms:status', async (data, cb) => {
      if (!limit('rooms:status')) return cb({ error: 'Too many requests, slow down' });
      const parsed = roomsStatusSchema.safeParse(data);
      if (!parsed.success) return cb({ error: 'Invalid payload' });
      const { sessionId, slugs } = parsed.data;
      const results: import('@hmpp/shared').RoomStatus[] = [];
      for (const slug of slugs.slice(0, 25)) {
        const state = await store.load(slug);
        results.push(state ? room.statusFor(state, sessionId) : { slug, active: false });
      }
      cb(results);
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

    // Reset is universal — anyone can start a new round so a room never gets stuck.
    socket.on('vote:reset', (data, cb) => {
      const p = slugOnlySchema.safeParse(data);
      if (!p.success) return cb({ error: 'Invalid payload' });
      mutate(p.data.slug, cb, (s) => room.resetVotes(s));
    });

    // Manual reveal is universal too, but gated by a short post-round-start cooldown so a
    // hasty reveal can't sweep still-voting people into observers.
    socket.on('reveal:force', (data, cb) => {
      const p = slugOnlySchema.safeParse(data);
      if (!p.success) return cb({ error: 'Invalid payload' });
      mutate(p.data.slug, cb, (s) => {
        if (!room.hasAnyVote(s)) return { error: 'There are no votes to reveal yet' };
        if (room.manualRevealBlocked(s, Date.now())) {
          return { error: 'Hold on — give everyone a moment to vote before revealing' };
        }
        return room.forceReveal(s);
      });
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
        if (!isSelf && !room.isFacilitator(s, socket.data.sessionId)) {
          return { error: 'Only the facilitator can change someone else’s voter status' };
        }
        return room.toggleVoter(s, p.data.targetSessionId, p.data.voter);
      });
    });

    socket.on('eject:set', (data, cb) => {
      const p = ejectSchema.safeParse(data);
      if (!p.success) return cb({ error: 'Invalid payload' });
      mutate(p.data.slug, cb, (s) =>
        room.isFacilitator(s, socket.data.sessionId)
          ? room.setEjectOnLeave(s, p.data.ejectOnLeave)
          : { error: 'Only the facilitator can change this' });
    });

    socket.on('facilitator:claim', (data, cb) => {
      const p = slugOnlySchema.safeParse(data);
      if (!p.success) return cb({ error: 'Invalid payload' });
      mutate(p.data.slug, cb, (s) =>
        room.facilitatorClaimable(s)
          ? room.claimFacilitator(s, socket.data.sessionId)
          : { error: 'Someone is already facilitating this room' });
    });

    socket.on('facilitator:pass', (data, cb) => {
      const p = facilitatorPassSchema.safeParse(data);
      if (!p.success) return cb({ error: 'Invalid payload' });
      mutate(p.data.slug, cb, (s) => {
        if (!room.isFacilitator(s, socket.data.sessionId)) {
          return { error: 'Only the facilitator can pass the role' };
        }
        const target = s.connections[p.data.targetSessionId];
        if (!target || target.socketIds.length === 0) {
          return { error: 'Pick someone who is currently in the room' };
        }
        return room.passFacilitator(s, p.data.targetSessionId);
      });
    });

    socket.on('disconnecting', async () => {
      const slug = socket.data.slug;
      const sessionId = socket.data.sessionId;
      if (!slug) return;
      const state = await store.load(slug);
      if (!state) return;
      // Drop just this socket but keep the seat on the roster — even in eject mode — so a
      // reconnecting tab (wifi blip, redeploy) re-registers and keeps its vote. The actual
      // eject is deferred to reap() after a grace window; a reconnect cancels it implicitly.
      const next = room.leave(state, socket.id, false);
      await store.save(next);
      io.to(slug).emit('room:update', room.publicView(next));
      if (state.ejectOnLeave) setTimeout(() => { void reap(slug, sessionId); }, ejectGraceMs);
      logger.debug('socket disconnecting', { id: socket.id, slug });
    });
  });
}
