import { describe, it, expect } from 'vitest';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { io as ioc } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from '@hmpp/shared';
import { gracefulShutdown } from './shutdown';

describe('gracefulShutdown', () => {
  it('notifies connected clients before the server closes', async () => {
    const httpServer = createServer();
    const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(httpServer);
    await new Promise<void>((r) => httpServer.listen(0, r));
    const { port } = httpServer.address() as { port: number };
    const client = ioc(`http://localhost:${port}`, { transports: ['websocket'], forceNew: true });
    await new Promise<void>((res) => client.on('connect', () => res()));

    const notified = new Promise<boolean>((res) => client.on('server:maintenance', () => res(true)));
    let storeClosed = false;
    await gracefulShutdown(io, { close: () => { storeClosed = true; } }, 20);

    expect(await notified).toBe(true);
    expect(storeClosed).toBe(true); // resources are released after notifying
    client.close();
  });
});
