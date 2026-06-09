import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { io as ioc, type Socket } from 'socket.io-client';
import { RoomStore } from './store/roomStore';
import { registerHandlers } from './sockets';
import type { PublicRoom } from '@hmpp/shared';

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
