import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@hmpp/shared';

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
export const socket: AppSocket = io({ autoConnect: true });
