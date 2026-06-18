const KEY = 'hmpp:sessionId';
const NAME = 'hmpp:name';
const ROLE = 'hmpp:role';

export function getSessionId(): string {
  let id = localStorage.getItem(KEY);
  if (!id) { id = crypto.randomUUID(); localStorage.setItem(KEY, id); }
  return id;
}

/** Remembered display name (so a returning user keeps their name across refreshes). */
export function getStoredName(): string | undefined {
  return localStorage.getItem(NAME) ?? undefined;
}
export function setStoredName(name: string): void {
  localStorage.setItem(NAME, name);
}

/** Remembered voter/observer choice, so refresh doesn't re-prompt. null = not chosen yet. */
export function getStoredRole(): boolean | null {
  const v = localStorage.getItem(ROLE);
  return v === null ? null : v === 'true';
}
export function setStoredRole(voter: boolean): void {
  localStorage.setItem(ROLE, String(voter));
}

const ROOMS = 'hmpp:rooms';
const ROOMS_CAP = 12;

export interface RecentRoom { slug: string; lastJoinedAt: number }

/** Rooms this browser has joined, most-recent first. Tolerant of corrupt storage. */
export function getRecentRooms(): RecentRoom[] {
  try {
    const raw = localStorage.getItem(ROOMS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((r) => r && typeof r.slug === 'string');
  } catch {
    return [];
  }
}

/** Record a join: move/insert the slug at the front, dedupe, cap at 12. */
export function rememberRoom(slug: string): void {
  const next = [{ slug, lastJoinedAt: Date.now() }, ...getRecentRooms().filter((r) => r.slug !== slug)]
    .slice(0, ROOMS_CAP);
  localStorage.setItem(ROOMS, JSON.stringify(next));
}

export function forgetRoom(slug: string): void {
  localStorage.setItem(ROOMS, JSON.stringify(getRecentRooms().filter((r) => r.slug !== slug)));
}

export function clearRecentRooms(): void {
  localStorage.removeItem(ROOMS);
}
