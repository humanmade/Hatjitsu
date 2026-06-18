import path from 'node:path';
export const PORT = Number(process.env.PORT) || 5099;
export const DATA_DIR = process.env.DATA_DIR || './data';
export const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'rooms.db');
export const LIVE_TTL_SECONDS = 14400; // 4h

// Grace window after a socket drops before an eject-mode participant is actually removed.
// Long enough to absorb a wifi blip or a redeploy reconnect (which keeps their vote);
// short enough that a genuine leaver disappears promptly.
export const EJECT_GRACE_MS = Number(process.env.EJECT_GRACE_MS) || 30000;

// Read-only endpoints get a per-socket cap (defense-in-depth against slug enumeration).
// Chosen so normal use never trips: the lobby fires rooms:status once on mount.
export const RATE_LIMITS = {
  'rooms:status': { capacity: 5, refillPerSec: 0.5 }, // ~5 per 10s
  'room:info': { capacity: 20, refillPerSec: 2 },     // ~20 per 10s
};
