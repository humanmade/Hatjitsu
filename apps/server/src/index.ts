import { createServer } from 'node:http';
import fs from 'node:fs';
import { Server } from 'socket.io';
import { createApp } from './http.js';
import { registerHandlers } from './sockets.js';
import { RoomStore } from './store/roomStore.js';
import { PORT, DATA_DIR, DB_PATH } from './config.js';
import { logger } from './logger.js';
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from '@hmpp/shared';

function main() {
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

  const app = createApp();
  const httpServer = createServer(app);
  const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(httpServer);
  registerHandlers(io, store);

  httpServer.listen(PORT, () => logger.info('server listening', { port: PORT }));
}

main();
