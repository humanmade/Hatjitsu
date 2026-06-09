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
