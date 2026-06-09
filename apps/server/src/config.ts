import path from 'node:path';
export const PORT = Number(process.env.PORT) || 5099;
export const DATA_DIR = process.env.DATA_DIR || './data';
export const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'rooms.db');
export const LIVE_TTL_SECONDS = 14400; // 4h
