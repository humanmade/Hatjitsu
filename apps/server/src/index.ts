import { createServer } from 'node:http';
import fs from 'node:fs';
import { Server } from 'socket.io';
import { createApp } from './http.js';
import { registerHandlers } from './sockets.js';
import { gracefulShutdown } from './shutdown.js';
import { RoomStore } from './store/roomStore.js';
import * as room from './domain/room.js';
import { PORT, DATA_DIR, DB_PATH } from './config.js';
import { logger } from './logger.js';
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from '@hmpp/shared';

/** On a fresh process no sockets are connected, so any persisted socketIds are stale. */
async function purgeStalePresence(store: RoomStore) {
  for (const slug of await store.allSlugs()) {
    const state = await store.load(slug);
    if (state) await store.save(room.purgeStalePresence(state));
  }
}

async function main() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.accessSync(DATA_DIR, fs.constants.W_OK);
  } catch (err) {
    logger.error('Data dir not writable at boot — refusing to start', { dir: DATA_DIR, err: String(err) });
    process.exit(1);
  }

  let store: RoomStore;
  try {
    store = new RoomStore(DB_PATH);
  } catch (err) {
    logger.error('Could not open the room database — refusing to start', { db: DB_PATH, err: String(err) });
    process.exit(1);
  }

  await purgeStalePresence(store);

  const app = createApp();
  const httpServer = createServer(app);
  const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(httpServer);
  registerHandlers(io, store);

  httpServer.listen(PORT, () => logger.info('server listening', { port: PORT }));

  // On a redeploy the platform sends SIGTERM (SIGINT locally). Warn connected clients before
  // we close so they see a maintenance notice; the once-guard ignores a repeated signal.
  let shuttingDown = false;
  const shutdown = (signal: NodeJS.Signals) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info('shutting down', { signal });
    gracefulShutdown(io, store).then(() => process.exit(0), () => process.exit(1));
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main();
