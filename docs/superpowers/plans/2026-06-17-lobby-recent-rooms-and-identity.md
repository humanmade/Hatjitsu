# Lobby Recent Rooms + Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a recent-rooms list and an identity (name + colour) element to the lobby, backed by a new membership-gated, rate-limited `rooms:status` socket endpoint.

**Architecture:** The browser remembers joined room slugs in localStorage (`hmpp:rooms`). On lobby mount a single `rooms:status` request returns each room's live standing, but only for rooms whose roster contains the caller's `sessionId` (membership gate) — so the endpoint adds no enumeration surface. Read endpoints are rate-limited per socket. Identity colour is the existing deterministic `colorForSession`; name edits persist to `hmpp:name`.

**Tech Stack:** TypeScript monorepo — `@hmpp/shared` (zod + types), `@hmpp/server` (socket.io + better-sqlite3), `@hmpp/client` (React 19, React Router, Zustand, socket.io-client). Vitest everywhere; React Testing Library + jsdom on the client.

**Spec:** `docs/superpowers/specs/2026-06-17-lobby-recent-rooms-and-identity-design.md`

**Test command shape:** `npm test -w @hmpp/<shared|server|client> -- <path-or-filter>`

---

## File structure

- `packages/shared/src/types.ts` — add `RoomStatus` union (Task 1)
- `packages/shared/src/schemas.ts` — add `roomsStatusSchema` + `RoomsStatusPayload` (Task 1)
- `packages/shared/src/events.ts` — add `rooms:status` to `ClientToServerEvents` (Task 1)
- `apps/server/src/domain/room.ts` — add pure `statusFor(state, sessionId)` (Task 2)
- `apps/server/src/rateLimit.ts` — new per-socket token-bucket limiter (Task 3)
- `apps/server/src/config.ts` — add `RATE_LIMITS` (Task 3)
- `apps/server/src/sockets.ts` — `rooms:status` handler + rate-limit read endpoints (Task 4)
- `apps/client/src/lib/session.ts` — recent-rooms storage helpers (Task 5)
- `apps/client/src/lib/recentRooms.ts` — `RecentRoomView` type + pure `mergeRecent` (Task 6)
- `apps/client/src/lib/useRecentRooms.ts` — hook wiring socket → merged view (Task 7)
- `apps/client/src/components/RecentRooms.tsx` — presentational list (Task 8)
- `apps/client/src/components/LobbyIdentity.tsx` — name + colour strip (Task 9)
- `apps/client/src/pages/Lobby.tsx` — wire identity + list (Task 10)
- `apps/client/src/pages/Room.tsx` — `rememberRoom(slug)` on join (Task 10)

---

## Task 1: Shared types, schema, and event for `rooms:status`

**Files:**
- Modify: `packages/shared/src/types.ts`
- Modify: `packages/shared/src/schemas.ts`
- Modify: `packages/shared/src/events.ts`
- Test: `packages/shared/src/schemas.test.ts`

- [ ] **Step 1: Add the `RoomStatus` type**

In `packages/shared/src/types.ts`, append:

```ts
/** Per-room standing returned by `rooms:status`. `active:true` is only ever sent for a
 * room whose roster contains the requesting sessionId (membership gate), so a non-member
 * and a non-existent room are indistinguishable. */
export type RoomStatus =
  | { slug: string; active: false }
  | {
      slug: string;
      active: true;
      voter: boolean;
      hasVoted: boolean;
      revealed: boolean;
      roundLabel: string;
      count: number;
    };
```

- [ ] **Step 2: Add the request schema**

In `packages/shared/src/schemas.ts`, after the `ejectSchema` line add:

```ts
// `slugs` is bounded to keep payloads small; the handler further truncates to 25.
export const roomsStatusSchema = z.object({
  sessionId: z.string().min(1).max(100),
  slugs: z.array(slug).max(100),
});
```

and in the `z.infer` block append:

```ts
export type RoomsStatusPayload = z.infer<typeof roomsStatusSchema>;
```

- [ ] **Step 3: Add the event signature**

In `packages/shared/src/events.ts`:

Change the first import line to also pull `RoomStatus`:

```ts
import type { PublicRoom, JoinResult, Ack, RoomStatus } from './types.js';
```

Change the schema import line to also pull `RoomsStatusPayload`:

```ts
import type { JoinPayload, VotePayload, CardPackPayload, NamePayload, LabelPayload, TogglePayload, EjectPayload, RoomsStatusPayload } from './schemas.js';
```

Inside `ClientToServerEvents`, after the `'room:info'` line add:

```ts
  'rooms:status': (data: RoomsStatusPayload, cb: (res: RoomStatus[] | { error: string }) => void) => void;
```

- [ ] **Step 4: Write the failing schema test**

In `packages/shared/src/schemas.test.ts`, add (keep existing imports, extend them to include `roomsStatusSchema`):

```ts
import { roomsStatusSchema } from './schemas';

describe('roomsStatusSchema', () => {
  it('accepts a sessionId and a list of slugs', () => {
    const r = roomsStatusSchema.safeParse({ sessionId: 's1', slugs: ['happy-otter', 'quick-beaver'] });
    expect(r.success).toBe(true);
  });
  it('rejects a missing sessionId', () => {
    expect(roomsStatusSchema.safeParse({ slugs: ['a'] }).success).toBe(false);
  });
  it('rejects more than 100 slugs', () => {
    const slugs = Array.from({ length: 101 }, (_, i) => `s${i}`);
    expect(roomsStatusSchema.safeParse({ sessionId: 's', slugs }).success).toBe(false);
  });
});
```

- [ ] **Step 5: Run tests (shared)**

Run: `npm test -w @hmpp/shared -- schemas`
Expected: PASS (new `roomsStatusSchema` block green). If the existing file lacks a `describe` import, ensure the top of the file imports `{ describe, it, expect }` from `vitest`.

- [ ] **Step 6: Typecheck shared**

Run: `npm run lint -w @hmpp/shared`
Expected: no type errors.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/types.ts packages/shared/src/schemas.ts packages/shared/src/events.ts packages/shared/src/schemas.test.ts
git commit -m "feat(shared): add rooms:status type, schema, and event"
```

---

## Task 2: Pure `statusFor` domain function (membership gate)

**Files:**
- Modify: `apps/server/src/domain/room.ts`
- Test: `apps/server/src/domain/room.test.ts`

- [ ] **Step 1: Write the failing test**

In `apps/server/src/domain/room.test.ts`, add a new `describe` (reuse the file's existing imports of `room` helpers; import `statusFor` and `enter`/`recordVote`/`createRoom` as already used there). Add:

```ts
import { statusFor } from './room';

describe('statusFor', () => {
  const withMember = () => {
    let s = createRoom('happy-otter');
    s = enter(s, { sessionId: 'sa', socketId: 'x', voter: true });
    return s;
  };

  it('returns active:false when the session is not in the roster', () => {
    expect(statusFor(createRoom('r'), 'nobody')).toEqual({ slug: 'r', active: false });
  });

  it('returns standing for a member who has not voted', () => {
    expect(statusFor(withMember(), 'sa')).toEqual({
      slug: 'happy-otter', active: true, voter: true, hasVoted: false,
      revealed: false, roundLabel: '', count: 1,
    });
  });

  it('reports hasVoted once the member has voted', () => {
    const s = recordVote(withMember(), 'sa', '5');
    const r = statusFor(s, 'sa');
    expect(r).toMatchObject({ active: true, hasVoted: true, revealed: true }); // lone voter auto-reveals
  });
});
```

> Note: if `createRoom`, `enter`, `recordVote` are not already imported at the top of `room.test.ts`, add them to the existing `import { ... } from './room'` line rather than adding a second import.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w @hmpp/server -- domain/room`
Expected: FAIL — `statusFor` is not exported.

- [ ] **Step 3: Implement `statusFor`**

In `apps/server/src/domain/room.ts`, add `RoomStatus` to the shared import at the top:

```ts
import {
  type RoomState, type Connection, type PublicRoom, type Vote, type RoomStatus,
  colorForSession, generateName, uniquifyName,
} from '@hmpp/shared';
```

Then append the function at the end of the file:

```ts
/** Membership-gated standing for `rooms:status`. Returns `active:false` unless `sessionId`
 * is in the roster, so a non-member cannot distinguish it from a non-existent room. */
export function statusFor(s: RoomState, sessionId: string): RoomStatus {
  const conn = s.connections[sessionId];
  if (!conn) return { slug: s.slug, active: false };
  return {
    slug: s.slug,
    active: true,
    voter: conn.voter,
    hasVoted: conn.vote !== null && conn.vote !== undefined,
    revealed: s.revealed,
    roundLabel: s.roundLabel,
    count: Object.keys(s.connections).length,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -w @hmpp/server -- domain/room`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/domain/room.ts apps/server/src/domain/room.test.ts
git commit -m "feat(server): add membership-gated statusFor domain helper"
```

---

## Task 3: Per-socket rate limiter

**Files:**
- Create: `apps/server/src/rateLimit.ts`
- Modify: `apps/server/src/config.ts`
- Test: `apps/server/src/rateLimit.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/server/src/rateLimit.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createRateLimiter } from './rateLimit';

const limits = { 'rooms:status': { capacity: 3, refillPerSec: 1 } };

describe('createRateLimiter', () => {
  it('allows up to capacity then blocks', () => {
    let now = 0;
    const limit = createRateLimiter(limits, () => now);
    expect(limit('rooms:status')).toBe(true);
    expect(limit('rooms:status')).toBe(true);
    expect(limit('rooms:status')).toBe(true);
    expect(limit('rooms:status')).toBe(false); // 4th in the same instant
  });

  it('refills over time', () => {
    let now = 0;
    const limit = createRateLimiter(limits, () => now);
    limit('rooms:status'); limit('rooms:status'); limit('rooms:status');
    expect(limit('rooms:status')).toBe(false);
    now = 1000; // one second → +1 token
    expect(limit('rooms:status')).toBe(true);
  });

  it('treats unconfigured events as unlimited', () => {
    const limit = createRateLimiter(limits, () => 0);
    for (let i = 0; i < 100; i++) expect(limit('room:join')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w @hmpp/server -- rateLimit`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the limiter**

Create `apps/server/src/rateLimit.ts`:

```ts
type Bucket = { tokens: number; last: number };
export type Limits = Record<string, { capacity: number; refillPerSec: number }>;

/** Per-instance token-bucket limiter. Create one per socket connection; call with the event
 * name. Unconfigured events are always allowed. `now` is injectable for tests. */
export function createRateLimiter(limits: Limits, now: () => number = Date.now) {
  const buckets = new Map<string, Bucket>();
  return (event: string): boolean => {
    const cfg = limits[event];
    if (!cfg) return true;
    const t = now();
    let b = buckets.get(event);
    if (!b) { b = { tokens: cfg.capacity, last: t }; buckets.set(event, b); }
    b.tokens = Math.min(cfg.capacity, b.tokens + ((t - b.last) / 1000) * cfg.refillPerSec);
    b.last = t;
    if (b.tokens < 1) return false;
    b.tokens -= 1;
    return true;
  };
}
```

- [ ] **Step 4: Add limits to config**

In `apps/server/src/config.ts`, append:

```ts
// Read-only endpoints get a per-socket cap (defense-in-depth against slug enumeration).
// Chosen so normal use never trips: the lobby fires rooms:status once on mount.
export const RATE_LIMITS = {
  'rooms:status': { capacity: 5, refillPerSec: 0.5 }, // ~5 per 10s
  'room:info': { capacity: 20, refillPerSec: 2 },     // ~20 per 10s
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -w @hmpp/server -- rateLimit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/rateLimit.ts apps/server/src/rateLimit.test.ts apps/server/src/config.ts
git commit -m "feat(server): add per-socket token-bucket rate limiter"
```

---

## Task 4: `rooms:status` socket handler + rate-limit read endpoints

**Files:**
- Modify: `apps/server/src/sockets.ts`
- Test: `apps/server/src/sockets.test.ts`

- [ ] **Step 1: Write the failing tests**

In `apps/server/src/sockets.test.ts`, add a helper and a new `describe`. Add this `status` helper next to the existing `join` helper:

```ts
import type { PublicRoom, RoomStatus } from '@hmpp/shared';

const status = (s: Socket, sessionId: string, slugs: string[]) =>
  new Promise<RoomStatus[] | { error: string }>((res) =>
    s.emit('rooms:status', { sessionId, slugs }, res as never));
```

> The file already imports `PublicRoom`; extend that import to add `RoomStatus` rather than duplicating it.

Then add:

```ts
describe('rooms:status', () => {
  it('returns standing for a room the caller is in', async () => {
    const a = connect();
    await join(a, 'happy-otter', 'sa');
    const res = await status(a, 'sa', ['happy-otter']);
    expect(res).toEqual([
      { slug: 'happy-otter', active: true, voter: true, hasVoted: false,
        revealed: false, roundLabel: '', count: 1 },
    ]);
    a.close();
  });

  it('hides rooms the caller is not a member of (membership gate)', async () => {
    const a = connect(); const b = connect();
    await join(a, 'happy-otter', 'sa');
    const res = await status(b, 'sb', ['happy-otter']); // b never joined
    expect(res).toEqual([{ slug: 'happy-otter', active: false }]);
    a.close(); b.close();
  });

  it('returns active:false for a non-existent slug', async () => {
    const a = connect();
    const res = await status(a, 'sa', ['no-such-room']);
    expect(res).toEqual([{ slug: 'no-such-room', active: false }]);
    a.close();
  });

  it('truncates the slug list to 25', async () => {
    const a = connect();
    const slugs = Array.from({ length: 30 }, (_, i) => `r${i}`);
    const res = await status(a, 'sa', slugs) as RoomStatus[];
    expect(res).toHaveLength(25);
    a.close();
  });

  it('does not subscribe the caller to room broadcasts', async () => {
    const a = connect(); const b = connect();
    await join(a, 'happy-otter', 'sa');
    await status(b, 'sb', ['happy-otter']); // b only checks status, never joins
    let leaked = false;
    b.on('room:update', () => { leaked = true; });
    await new Promise<void>((res) => a.emit('vote', { slug: 'happy-otter', vote: '5' }, () => res()));
    await new Promise((r) => setTimeout(r, 50));
    expect(leaked).toBe(false);
    a.close(); b.close();
  });

  it('rate-limits bursts with an error ack but keeps the socket connected', async () => {
    const a = connect();
    // capacity is 5; the 6th rapid call in the same window is rejected.
    const results: Array<RoomStatus[] | { error: string }> = [];
    for (let i = 0; i < 6; i++) results.push(await status(a, 'sa', ['x']));
    expect('error' in results[5]).toBe(true);
    expect(a.connected).toBe(true);
    a.close();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -w @hmpp/server -- sockets`
Expected: FAIL — no `rooms:status` handler (calls time out or return undefined).

- [ ] **Step 3: Implement the handler + rate limiting**

In `apps/server/src/sockets.ts`:

Extend the schema import from `@hmpp/shared` to add `roomsStatusSchema`:

```ts
  joinSchema, slugOnlySchema, voteSchema, cardPackSchema, nameSchema, labelSchema, toggleSchema, ejectSchema,
  roomsStatusSchema,
  generateSlug,
```

Add two imports near the top (after the existing imports):

```ts
import { createRateLimiter } from './rateLimit.js';
import { RATE_LIMITS } from './config.js';
```

Inside `io.on('connection', (socket) => {`, as the first line of the callback, create a per-socket limiter:

```ts
    const limit = createRateLimiter(RATE_LIMITS);
```

Replace the existing `room:info` handler body's first line so it rate-limits. The handler becomes:

```ts
    socket.on('room:info', async (data, cb) => {
      if (!limit('room:info')) return cb({ error: 'Too many requests, slow down' });
      const parsed = slugOnlySchema.safeParse(data);
      if (!parsed.success) return cb({ error: 'Invalid payload' });
      const state = await store.load(parsed.data.slug);
      if (!state) return cb({ error: 'Sorry, this room no longer exists ...' });
      cb(room.publicView(state));
    });
```

Immediately after the `room:info` handler, add the new handler:

```ts
    socket.on('rooms:status', async (data, cb) => {
      if (!limit('rooms:status')) return cb({ error: 'Too many requests, slow down' });
      const parsed = roomsStatusSchema.safeParse(data);
      if (!parsed.success) return cb({ error: 'Invalid payload' });
      const { sessionId, slugs } = parsed.data;
      const results: import('@hmpp/shared').RoomStatus[] = [];
      for (const slug of slugs.slice(0, 25)) {
        const state = await store.load(slug);
        results.push(state ? room.statusFor(state, sessionId) : { slug, active: false });
      }
      cb(results);
    });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -w @hmpp/server -- sockets`
Expected: PASS (all five new cases).

- [ ] **Step 5: Run the full server suite + typecheck**

Run: `npm test -w @hmpp/server`
Run: `npm run lint -w @hmpp/server`
Expected: all green, no type errors.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/sockets.ts apps/server/src/sockets.test.ts
git commit -m "feat(server): add membership-gated rooms:status handler + rate-limited reads"
```

---

## Task 5: Recent-rooms localStorage helpers

**Files:**
- Modify: `apps/client/src/lib/session.ts`
- Test: `apps/client/src/lib/session.test.ts`

- [ ] **Step 1: Write the failing test**

In `apps/client/src/lib/session.test.ts`, extend the imports and add a `describe`:

```ts
import { getRecentRooms, rememberRoom, forgetRoom, clearRecentRooms } from './session';

describe('recent rooms', () => {
  it('remembers a room and returns it', () => {
    rememberRoom('happy-otter');
    expect(getRecentRooms().map((r) => r.slug)).toEqual(['happy-otter']);
  });

  it('dedupes by slug, most-recent first', () => {
    rememberRoom('a'); rememberRoom('b'); rememberRoom('a');
    expect(getRecentRooms().map((r) => r.slug)).toEqual(['a', 'b']);
  });

  it('caps the list at 12', () => {
    for (let i = 0; i < 15; i++) rememberRoom(`room-${i}`);
    const rooms = getRecentRooms();
    expect(rooms).toHaveLength(12);
    expect(rooms[0].slug).toBe('room-14'); // newest kept
    expect(rooms.some((r) => r.slug === 'room-0')).toBe(false); // oldest dropped
  });

  it('forgets a single room and clears all', () => {
    rememberRoom('a'); rememberRoom('b');
    forgetRoom('a');
    expect(getRecentRooms().map((r) => r.slug)).toEqual(['b']);
    clearRecentRooms();
    expect(getRecentRooms()).toEqual([]);
  });

  it('returns [] when storage is empty or corrupt', () => {
    localStorage.setItem('hmpp:rooms', 'not json');
    expect(getRecentRooms()).toEqual([]);
  });
});
```

> The file already has `beforeEach(() => localStorage.clear())`; keep it.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w @hmpp/client -- session`
Expected: FAIL — helpers not exported.

- [ ] **Step 3: Implement the helpers**

In `apps/client/src/lib/session.ts`, append:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -w @hmpp/client -- session`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/lib/session.ts apps/client/src/lib/session.test.ts
git commit -m "feat(client): add recent-rooms localStorage helpers"
```

---

## Task 6: Pure `mergeRecent` + view type

**Files:**
- Create: `apps/client/src/lib/recentRooms.ts`
- Test: `apps/client/src/lib/recentRooms.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/client/src/lib/recentRooms.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { mergeRecent } from './recentRooms';
import type { RoomStatus } from '@hmpp/shared';

const recent = [
  { slug: 'a', lastJoinedAt: 2 },
  { slug: 'b', lastJoinedAt: 1 },
];

describe('mergeRecent', () => {
  it('marks rooms pending until a status arrives', () => {
    const view = mergeRecent(recent, []);
    expect(view.map((v) => v.status)).toEqual([{ active: 'pending' }, { active: 'pending' }]);
  });

  it('merges status onto matching slugs', () => {
    const statuses: RoomStatus[] = [
      { slug: 'a', active: true, voter: true, hasVoted: true, revealed: false, roundLabel: 'PROJ-1', count: 3 },
      { slug: 'b', active: false },
    ];
    const view = mergeRecent(recent, statuses);
    expect(view[0]).toMatchObject({ slug: 'a', status: { active: true, hasVoted: true, count: 3 } });
    expect(view[1]).toMatchObject({ slug: 'b', status: { active: false } });
  });

  it('preserves recent order regardless of status order', () => {
    const statuses: RoomStatus[] = [{ slug: 'b', active: false }, { slug: 'a', active: false }];
    expect(mergeRecent(recent, statuses).map((v) => v.slug)).toEqual(['a', 'b']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w @hmpp/client -- recentRooms`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `apps/client/src/lib/recentRooms.ts`:

```ts
import type { RoomStatus } from '@hmpp/shared';
import type { RecentRoom } from './session';

/** A remembered room plus its merged status. `pending` = status request not yet answered. */
export type RecentRoomView = {
  slug: string;
  lastJoinedAt: number;
  status: { active: 'pending' } | RoomStatus;
};

/** Join the localStorage list with status responses, preserving the list's (recent-first) order. */
export function mergeRecent(recent: RecentRoom[], statuses: RoomStatus[]): RecentRoomView[] {
  const bySlug = new Map(statuses.map((s) => [s.slug, s]));
  return recent.map((r) => ({
    slug: r.slug,
    lastJoinedAt: r.lastJoinedAt,
    status: bySlug.get(r.slug) ?? { active: 'pending' as const },
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -w @hmpp/client -- recentRooms`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/lib/recentRooms.ts apps/client/src/lib/recentRooms.test.ts
git commit -m "feat(client): add mergeRecent and RecentRoomView"
```

---

## Task 7: `useRecentRooms` hook

**Files:**
- Create: `apps/client/src/lib/useRecentRooms.ts`
- Test: `apps/client/src/lib/useRecentRooms.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/client/src/lib/useRecentRooms.test.tsx`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Mock the socket so the hook's emit is observable and we control the response.
const handlers: Record<string, (...a: never[]) => void> = {};
vi.mock('@/lib/socket', () => ({
  socket: {
    connected: true,
    emit: (event: string, ...args: unknown[]) => {
      const cb = args[args.length - 1] as (res: unknown) => void;
      if (event === 'rooms:status') {
        const { slugs } = args[0] as { slugs: string[] };
        cb(slugs.map((slug) => ({ slug, active: false })));
      }
    },
    on: (e: string, h: (...a: never[]) => void) => { handlers[e] = h; },
    off: () => {},
  },
}));

import { useRecentRooms } from './useRecentRooms';
import { rememberRoom } from './session';

beforeEach(() => { localStorage.clear(); });

describe('useRecentRooms', () => {
  it('requests status for remembered slugs and exposes the merged view', async () => {
    rememberRoom('a'); rememberRoom('b');
    const { result } = renderHook(() => useRecentRooms());
    await waitFor(() => expect(result.current.rooms).toHaveLength(2));
    expect(result.current.rooms.every((r) => r.status.active === false)).toBe(true);
  });

  it('forget removes a room from the exposed view', async () => {
    rememberRoom('a'); rememberRoom('b');
    const { result } = renderHook(() => useRecentRooms());
    await waitFor(() => expect(result.current.rooms).toHaveLength(2));
    act(() => result.current.forget('a'));
    expect(result.current.rooms.map((r) => r.slug)).toEqual(['b']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w @hmpp/client -- useRecentRooms`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the hook**

Create `apps/client/src/lib/useRecentRooms.ts`:

```ts
import { useCallback, useEffect, useState } from 'react';
import type { RoomStatus } from '@hmpp/shared';
import { socket } from '@/lib/socket';
import { getRecentRooms, forgetRoom, clearRecentRooms } from '@/lib/session';
import { mergeRecent, type RecentRoomView } from '@/lib/recentRooms';

/** Reads the remembered rooms, fetches their live standing once, and exposes a merged view
 * plus forget/clear handlers. Fires a single rooms:status on mount (and on (re)connect). */
export function useRecentRooms(): {
  rooms: RecentRoomView[];
  forget: (slug: string) => void;
  clearAll: () => void;
} {
  const [recent, setRecent] = useState(() => getRecentRooms());
  const [statuses, setStatuses] = useState<RoomStatus[]>([]);

  useEffect(() => {
    const slugs = recent.map((r) => r.slug);
    if (slugs.length === 0) return;
    const fetchStatus = () => {
      socket.emit('rooms:status', { sessionId: getSessionId(), slugs }, (res) => {
        if (Array.isArray(res)) setStatuses(res);
      });
    };
    if (socket.connected) fetchStatus();
    socket.on('connect', fetchStatus);
    return () => { socket.off('connect', fetchStatus); };
    // recent is captured once on mount; forget/clear update it directly below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const forget = useCallback((slug: string) => {
    forgetRoom(slug);
    setRecent((rs) => rs.filter((r) => r.slug !== slug));
  }, []);

  const clearAll = useCallback(() => {
    clearRecentRooms();
    setRecent([]);
  }, []);

  return { rooms: mergeRecent(recent, statuses), forget, clearAll };
}
```

Add the missing import for `getSessionId` at the top:

```ts
import { getSessionId, getRecentRooms, forgetRoom, clearRecentRooms } from '@/lib/session';
```

(Replace the earlier `getRecentRooms` import line with this combined one — do not import twice.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -w @hmpp/client -- useRecentRooms`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/lib/useRecentRooms.ts apps/client/src/lib/useRecentRooms.test.tsx
git commit -m "feat(client): add useRecentRooms hook"
```

---

## Task 8: `RecentRooms` presentational component

**Files:**
- Create: `apps/client/src/components/RecentRooms.tsx`
- Test: `apps/client/src/components/RecentRooms.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/client/src/components/RecentRooms.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RecentRooms } from './RecentRooms';
import type { RecentRoomView } from '@/lib/recentRooms';

const view = (over: Partial<RecentRoomView> & { slug: string }): RecentRoomView => ({
  lastJoinedAt: 1, status: { active: 'pending' }, ...over,
});

const renderList = (rooms: RecentRoomView[], onForget = vi.fn(), onClearAll = vi.fn()) =>
  render(
    <MemoryRouter>
      <RecentRooms rooms={rooms} onForget={onForget} onClearAll={onClearAll} />
    </MemoryRouter>,
  );

describe('RecentRooms', () => {
  it('renders nothing when the list is empty', () => {
    const { container } = renderList([]);
    expect(container.firstChild).toBeNull();
  });

  it('shows an active room with its standing and a Voted badge', () => {
    renderList([
      view({ slug: 'happy-otter', status: { slug: 'happy-otter', active: true, voter: true, hasVoted: true, revealed: false, roundLabel: 'PROJ-1', count: 3 } }),
    ]);
    expect(screen.getByRole('link', { name: /happy-otter/ })).toHaveAttribute('href', '/room/happy-otter');
    expect(screen.getByText(/Voted/)).toBeInTheDocument();
    expect(screen.getByText(/PROJ-1/)).toBeInTheDocument();
  });

  it('greys inactive rooms and dismiss calls onForget', () => {
    const onForget = vi.fn();
    renderList([view({ slug: 'gone', status: { slug: 'gone', active: false } })], onForget);
    fireEvent.click(screen.getByRole('button', { name: /remove gone/i }));
    expect(onForget).toHaveBeenCalledWith('gone');
  });

  it('Clear all calls onClearAll', () => {
    const onClearAll = vi.fn();
    renderList([view({ slug: 'a' })], vi.fn(), onClearAll);
    fireEvent.click(screen.getByRole('button', { name: /clear all/i }));
    expect(onClearAll).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w @hmpp/client -- components/RecentRooms`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the component**

Create `apps/client/src/components/RecentRooms.tsx`:

```tsx
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import type { RecentRoomView } from '@/lib/recentRooms';

function Standing({ status }: { status: RecentRoomView['status'] }) {
  if (status.active === 'pending') return <span className="text-xs opacity-50">checking…</span>;
  if (status.active === false) return <span className="text-xs opacity-60">no longer available</span>;
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs opacity-70">
      {status.roundLabel && <span>{status.roundLabel}</span>}
      <span>{status.count} {status.count === 1 ? 'person' : 'people'}</span>
      <span>{status.hasVoted ? 'Voted' : 'No vote yet'}</span>
    </span>
  );
}

/** Recent rooms this browser has joined. Renders nothing when empty. Greyed rows are rooms
 * that are gone or that you're no longer a member of; clicking still attempts a rejoin. */
export function RecentRooms({
  rooms, onForget, onClearAll,
}: {
  rooms: RecentRoomView[];
  onForget: (slug: string) => void;
  onClearAll: () => void;
}) {
  if (rooms.length === 0) return null;
  return (
    <section className="mx-auto mt-6 w-full max-w-md" aria-label="Recent rooms">
      <h2 className="mb-2 text-sm font-medium opacity-70">Recent rooms</h2>
      <ul className="flex flex-col gap-2">
        {rooms.map((r) => {
          const gone = r.status.active === false;
          return (
            <li
              key={r.slug}
              className={`flex items-center justify-between gap-3 rounded-lg border p-3 ${gone ? 'opacity-50' : ''}`}
            >
              <Link to={`/room/${r.slug}`} className="min-w-0 flex-1">
                <span className="block truncate font-medium">{r.slug}</span>
                <Standing status={r.status} />
              </Link>
              <button
                type="button"
                onClick={() => onForget(r.slug)}
                aria-label={`Remove ${r.slug}`}
                className="rounded p-1 opacity-60 hover:opacity-100"
              >
                <X size={16} />
              </button>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={onClearAll}
        className="mt-2 text-xs opacity-60 hover:opacity-100"
      >
        Clear all
      </button>
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -w @hmpp/client -- components/RecentRooms`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/components/RecentRooms.tsx apps/client/src/components/RecentRooms.test.tsx
git commit -m "feat(client): add RecentRooms list component"
```

---

## Task 9: `LobbyIdentity` element

**Files:**
- Create: `apps/client/src/components/LobbyIdentity.tsx`
- Test: `apps/client/src/components/LobbyIdentity.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/client/src/components/LobbyIdentity.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LobbyIdentity } from './LobbyIdentity';
import { getStoredName } from '@/lib/session';

beforeEach(() => localStorage.clear());

describe('LobbyIdentity', () => {
  it('persists an edited name to localStorage on blur', () => {
    render(<LobbyIdentity />);
    const input = screen.getByLabelText(/your name/i);
    fireEvent.change(input, { target: { value: 'Tom' } });
    fireEvent.blur(input);
    expect(getStoredName()).toBe('Tom');
  });

  it('shows a colour swatch', () => {
    render(<LobbyIdentity />);
    expect(screen.getByTestId('identity-swatch')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w @hmpp/client -- components/LobbyIdentity`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `apps/client/src/components/LobbyIdentity.tsx`:

```tsx
import { useState } from 'react';
import { colorForSession } from '@hmpp/shared';
import { Input } from '@/components/ui/input';
import { getSessionId, getStoredName, setStoredName } from '@/lib/session';

/** Lobby identity strip: a read-only colour swatch (derived from the session id) and an
 * editable display name persisted locally to hmpp:name, used on the next join. */
export function LobbyIdentity() {
  const color = colorForSession(getSessionId());
  const [value, setValue] = useState(() => getStoredName() ?? '');
  return (
    <div className="flex items-center justify-center gap-2 text-sm opacity-80">
      <span>You'll join as</span>
      <span
        data-testid="identity-swatch"
        aria-hidden="true"
        className="inline-block size-3 rounded-full"
        style={{ backgroundColor: color }}
      />
      <Input
        className="w-44 font-medium"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => { const v = value.trim(); if (v) setStoredName(v); }}
        placeholder="Your name"
        aria-label="Your name"
        name="display-name"
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        data-1p-ignore
        data-lpignore="true"
        data-form-type="other"
      />
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -w @hmpp/client -- components/LobbyIdentity`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/components/LobbyIdentity.tsx apps/client/src/components/LobbyIdentity.test.tsx
git commit -m "feat(client): add LobbyIdentity name + colour strip"
```

---

## Task 10: Wire into the Lobby + remember rooms on join

**Files:**
- Modify: `apps/client/src/pages/Lobby.tsx`
- Modify: `apps/client/src/pages/Room.tsx`
- Test: `apps/client/src/pages/Lobby.test.tsx`

- [ ] **Step 1: Write the failing Lobby test**

Create `apps/client/src/pages/Lobby.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/lib/socket', () => ({
  socket: { connected: false, emit: vi.fn(), on: vi.fn(), off: vi.fn() },
}));

import { Lobby } from './Lobby';
import { rememberRoom } from '@/lib/session';

beforeEach(() => localStorage.clear());

const renderLobby = () => render(<MemoryRouter><Lobby /></MemoryRouter>);

describe('Lobby', () => {
  it('shows the create button and identity strip', () => {
    renderLobby();
    expect(screen.getByRole('button', { name: /create a room/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/your name/i)).toBeInTheDocument();
  });

  it('shows recent rooms once some are remembered', () => {
    rememberRoom('happy-otter');
    renderLobby();
    expect(screen.getByText('happy-otter')).toBeInTheDocument();
  });

  it('omits the recent-rooms section when none are remembered', () => {
    renderLobby();
    expect(screen.queryByRole('region', { name: /recent rooms/i })).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w @hmpp/client -- pages/Lobby`
Expected: FAIL — Lobby has no identity strip / recent rooms yet.

- [ ] **Step 3: Wire up the Lobby**

Replace `apps/client/src/pages/Lobby.tsx` entirely with:

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { socket } from '@/lib/socket';
import { LobbyIdentity } from '@/components/LobbyIdentity';
import { RecentRooms } from '@/components/RecentRooms';
import { useRecentRooms } from '@/lib/useRecentRooms';

export function Lobby() {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const { rooms, forget, clearAll } = useRecentRooms();
  const create = () => {
    if (creating) return;
    setCreating(true);
    socket.emit('room:create', ({ slug }) => {
      if (slug) navigate(`/room/${slug}`);
      else setCreating(false);
    });
  };
  return (
    <>
      <Card className="p-8 flex flex-col items-center gap-4">
        <h1 className="text-2xl font-bold">Start a planning session</h1>
        <p className="text-sm opacity-70">Disposable rooms. No login. Votes hidden until everyone's in.</p>
        <Button size="lg" onClick={create} disabled={creating}>{creating ? 'Creating…' : 'Create a room'}</Button>
        <LobbyIdentity />
      </Card>
      <RecentRooms rooms={rooms} onForget={forget} onClearAll={clearAll} />
    </>
  );
}
```

- [ ] **Step 4: Remember rooms on join in Room.tsx**

In `apps/client/src/pages/Room.tsx`:

Extend the session import (line 7) to add `rememberRoom`:

```ts
import { getSessionId, getStoredName, setStoredName, getStoredRole, setStoredRole, rememberRoom } from '@/lib/session';
```

In `doJoin` (inside the `useEffect`), in the success branch after `remember(res);` add `rememberRoom(slug);`:

```ts
      socket.emit('room:join', { slug, sessionId, voter: roleRef.current, name: getStoredName() }, (res) => {
        if ('error' in res) { toast.error(res.error); return; }
        remember(res);
        rememberRoom(slug);
        setMyVote(res.yourVote != null ? String(res.yourVote) : null); // restore own highlight
      });
```

In the `join` function's success branch, after `setStoredName(mine.name);` add `rememberRoom(slug);`:

```ts
    socket.emit('room:join', { slug, sessionId, voter, name: getStoredName() }, (res) => {
      if ('error' in res) { toast.error(res.error); return; }
      setRoom(res);
      const mine = res.connections.find((c) => c.sessionId === sessionId);
      if (mine) setStoredName(mine.name);
      rememberRoom(slug);
      setMyVote(res.yourVote != null ? String(res.yourVote) : null);
    });
```

- [ ] **Step 5: Run the Lobby test + full client suite**

Run: `npm test -w @hmpp/client -- pages/Lobby`
Expected: PASS.
Run: `npm test -w @hmpp/client`
Run: `npm run lint -w @hmpp/client`
Expected: all green, no type errors.

- [ ] **Step 6: Commit**

```bash
git add apps/client/src/pages/Lobby.tsx apps/client/src/pages/Room.tsx apps/client/src/pages/Lobby.test.tsx
git commit -m "feat(client): show recent rooms + identity on the lobby"
```

---

## Final verification

- [ ] **Run every workspace suite**

Run: `npm test`
Expected: shared, server, and client suites all pass.

- [ ] **Typecheck everything**

Run: `npm run lint`
Expected: no type errors in any workspace.

- [ ] **Manual smoke (optional, if a browser tool is available)**

Create a room, reload the lobby in the same browser, confirm the room appears under "Recent rooms" with a standing line; open a second room; edit the name in the identity strip and confirm it is used on the next join.

---

## Notes for the implementer

- **Do not** add `socket.join` to `rooms:status` — the non-subscription test in Task 4 guards this invariant.
- The membership gate means an eject-mode room you left reports `active:false` (greyed) — this is intended, not a bug.
- `Input` lives at `@/components/ui/input` (used by `NameEditor.tsx`); `Card`/`Button` at `@/components/ui/{card,button}`.
- Client test alias maps `@hmpp/shared` to source, so shared changes are picked up without a build.
