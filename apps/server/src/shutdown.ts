import type { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from '@hmpp/shared';

type IO = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

const FLUSH_MS = 300;

/** Tell every connected client we're going down, give the event a beat to flush, then close
 * the socket server and release the store. Deliberately does NOT call process.exit so it stays
 * unit-testable — the caller exits once this resolves. */
export async function gracefulShutdown(
  io: IO,
  store: { close: () => void },
  flushMs: number = FLUSH_MS,
): Promise<void> {
  io.emit('server:maintenance');
  await new Promise((r) => setTimeout(r, flushMs));
  await new Promise<void>((res) => io.close(() => res()));
  store.close();
}
