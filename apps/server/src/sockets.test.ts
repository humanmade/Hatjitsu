import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { io as ioc, type Socket } from 'socket.io-client';
import { RoomStore } from './store/roomStore';
import { registerHandlers } from './sockets';
import type { PublicRoom, RoomStatus } from '@hmpp/shared';

let httpServer: ReturnType<typeof createServer>;
let url: string;

beforeEach(async () => {
  httpServer = createServer();
  const io = new Server(httpServer);
  const store = new RoomStore(':memory:', 100);
  registerHandlers(io, store);
  await new Promise<void>((r) => httpServer.listen(0, r));
  const { port } = httpServer.address() as { port: number };
  url = `http://localhost:${port}`;
});
afterEach(() => { httpServer.close(); });

const connect = () => ioc(url, { transports: ['websocket'], forceNew: true });
const join = (s: Socket, slug: string, sessionId: string, voter = true) =>
  new Promise<PublicRoom>((res) => s.emit('room:join', { slug, sessionId, voter }, res as never));
const status = (s: Socket, sessionId: string, slugs: string[]) =>
  new Promise<RoomStatus[] | { error: string }>((res) =>
    s.emit('rooms:status', { sessionId, slugs }, res as never));

describe('socket handlers', () => {
  it('first joiner becomes admin and gets a public room', async () => {
    const a = connect();
    const room = await join(a, 'happy-otter', 'sess-a');
    expect(room.adminSessionId).toBe('sess-a');
    a.close();
  });

  it('hides votes until all voters have voted', async () => {
    const a = connect(); const b = connect();
    await join(a, 'r', 'sa'); await join(b, 'r', 'sb');
    const afterB: PublicRoom = await new Promise((res) => {
      b.on('room:update', res);
      a.emit('vote', { slug: 'r', vote: '5' }, () => {});
    });
    expect(afterB.revealed).toBe(false);
    expect(afterB.votes).toEqual([]); // no votes exposed before reveal
    expect(afterB.connections.find((c) => c.sessionId === 'sa')!.hasVoted).toBe(true);
    a.close(); b.close();
  });

  it('rejects force-reveal from a non-admin', async () => {
    const a = connect(); const b = connect();
    await join(a, 'r', 'sa'); await join(b, 'r', 'sb');
    const res: { ok: true } | { error: string } = await new Promise((resolve) =>
      b.emit('reveal:force', { slug: 'r' }, resolve as never));
    expect('error' in res).toBe(true);
    a.close(); b.close();
  });
});

describe('rooms:status', () => {
  it('returns standing for a room the caller is in', async () => {
    const a = connect();
    await join(a, 'happy-otter', 'sa');
    const res = await status(a, 'sa', ['happy-otter']);
    expect(res).toEqual([
      { slug: 'happy-otter', active: true, voter: true, hasVoted: false,
        revealed: false, roundLabel: '', count: 1 },
    ]);
    a.close();
  });

  it('hides rooms the caller is not a member of (membership gate)', async () => {
    const a = connect(); const b = connect();
    await join(a, 'happy-otter', 'sa');
    const res = await status(b, 'sb', ['happy-otter']); // b never joined
    expect(res).toEqual([{ slug: 'happy-otter', active: false }]);
    a.close(); b.close();
  });

  it('returns active:false for a non-existent slug', async () => {
    const a = connect();
    const res = await status(a, 'sa', ['no-such-room']);
    expect(res).toEqual([{ slug: 'no-such-room', active: false }]);
    a.close();
  });

  it('truncates the slug list to 25', async () => {
    const a = connect();
    const slugs = Array.from({ length: 30 }, (_, i) => `r${i}`);
    const res = await status(a, 'sa', slugs) as RoomStatus[];
    expect(res).toHaveLength(25);
    a.close();
  });

  it('does not subscribe the caller to room broadcasts', async () => {
    const a = connect(); const b = connect();
    await join(a, 'happy-otter', 'sa');
    await status(b, 'sb', ['happy-otter']); // b only checks status, never joins
    let leaked = false;
    b.on('room:update', () => { leaked = true; });
    await new Promise<void>((res) => a.emit('vote', { slug: 'happy-otter', vote: '5' }, () => res()));
    await new Promise((r) => setTimeout(r, 50));
    expect(leaked).toBe(false);
    a.close(); b.close();
  });

  it('rate-limits bursts with an error ack but keeps the socket connected', async () => {
    const a = connect();
    // capacity is 5; the 6th rapid call in the same window is rejected.
    const results: Array<RoomStatus[] | { error: string }> = [];
    for (let i = 0; i < 6; i++) results.push(await status(a, 'sa', ['x']));
    expect('error' in results[5]).toBe(true);
    expect(a.connected).toBe(true);
    a.close();
  });
});
