# Lobby: recent rooms + identity element

**Date:** 2026-06-17
**Status:** Approved design, ready for implementation plan
**Branch:** rewrite

## Summary

Two related enhancements to the lobby (`apps/client/src/pages/Lobby.tsx`), the
first screen a user sees:

- **Feature A — Recent rooms.** Show a list of rooms this browser has joined,
  with their live standing pulled from the server (still active? did you leave a
  vote? what round, how many people, are you still in the roster?).
- **Feature B — Identity element.** Surface the user's name and colour on the
  lobby, with the name editable before joining any room.

They share `Lobby.tsx` but are otherwise independent.

## Context & constraints

- **No login.** Identity is a per-browser `sessionId` (UUID) in localStorage
  (`apps/client/src/lib/session.ts`). The server only knows "your rooms" if the
  client tells it which slugs to check.
- **Identity is global.** Colour is deterministic from `sessionId`
  (`colorForSession` in `packages/shared/src/names.ts`); name is remembered in
  `hmpp:name`. The user expects the same name/colour everywhere.
  - *Known edge case, out of scope:* the server uniquifies a name that collides
    with another participant in a room (`apps/server/src/domain/room.ts`), so in
    that one case the per-room name can differ from the global one. Not changed
    here.
- **Rooms are server-side in SQLite** with a 4h TTL
  (`apps/server/src/store/roomStore.ts`). A room can vanish: TTL expiry, or
  eject-mode emptying when the last person leaves. The list must handle rooms
  that are no longer alive.
- **Tech:** React 19 + React Router 7, Zustand, socket.io-client (client);
  Express + socket.io + better-sqlite3 (server); shared TS types in
  `packages/shared`.

---

## Feature A — Recent rooms

### A1. Client storage (`hmpp:rooms`)

New localStorage key managed in `session.ts`:

```ts
type RecentRoom = { slug: string; lastJoinedAt: number };
```

- Most-recent-first, deduped by slug, capped at **12** (drop oldest beyond 12).
- Name is **not** stored — identity is global and shown by Feature B.
- Written on every successful `room:join` and on `room:create`.
- Helpers in `session.ts`: `getRecentRooms()`, `rememberRoom(slug)`,
  `forgetRoom(slug)`, `clearRecentRooms()`.

### A2. Server endpoint `rooms:status`

New socket handler (`apps/server/src/sockets.ts`). Request:

```ts
{ sessionId: string; slugs: string[] }   // server truncates to first 25 slugs
```

Response: `RoomStatus[]`, one per requested slug:

```ts
type RoomStatus =
  | { slug: string; active: false }
  | {
      slug: string;
      active: true;
      voter: boolean;
      hasVoted: boolean;
      revealed: boolean;
      roundLabel: string;
      count: number;         // participant count
    };
```

- **Membership gate (anti-enumeration).** Return `active: true` with standing
  **only when `sessionId` is present in `room.connections`** for that slug.
  Otherwise return `{ slug, active: false }`. Because `active: false` covers
  "doesn't exist", "expired", *and* "you're not a member", a caller throwing
  random slugs at the endpoint learns nothing — the response for a room they
  don't belong to is identical to a non-existent one. There is no `inRoster`
  field: an `active: true` response is by definition a room the caller is in.
- **Read-only.** Must not create rooms, add the session to a roster, or mutate
  state. Loading via `roomStore` is fine (its normal TTL sweep is acceptable);
  do not extend or refresh a room's TTL on a status check.
- **Non-subscribing.** This is a request/response (ack) call. It must NOT call
  `socket.join` — fetching status never subscribes the caller to a room's
  broadcasts (see Security invariant below).
- Missing/expired/not-a-member → `{ slug, active: false }`.
- `RoomStatus` type + the event request/response signatures live in
  `packages/shared`.

### A3. Client hook `useRecentRooms()`

- Reads the `hmpp:rooms` list, emits `rooms:status` **once on mount** with the
  slugs (no polling — the lobby is transient).
- Merges responses onto the stored list.
- Exposes `{ rooms, forget, clearAll }` where `rooms` carries each
  `RecentRoom` plus its merged `RoomStatus` (or a pending/loading marker until
  the response arrives).

### A4. Component `RecentRooms.tsx`

Rendered beneath the lobby Card. **Renders nothing when the list is empty** (keeps
the clean first-run screen intact). While the status request is in flight, show a
loading skeleton rather than a blank gap.

Row anatomy:

- **Active rows** (`active: true`), recent-first: slug (clickable →
  `/room/:slug`) · round label · participant count · vote badge
  (**Voted** / **No vote yet**).
- **Greyed rows** (`active: false`), after the active ones: dimmed, with an
  **×** to dismiss (calls `forget(slug)`). `active: false` means expired, gone,
  *or* a room you're no longer a member of (e.g. an eject-mode room you left) —
  the status call deliberately can't tell these apart. The row stays
  **clickable**: clicking attempts a normal `room:join`, whose ack is the
  authoritative answer — it rejoins if the room still exists, or surfaces the
  existing "no longer exists" error if not.
- A small **"Clear all"** affordance at the foot (calls `clearAll()`).

Clicking any row navigates to `/room/:slug`; the existing join flow restores
`hmpp:name` and role.

---

## Feature B — Identity element

A compact strip inside the lobby Card, **below the "Create a room" button**:

> You'll join as ● *Name* ✎

- **Colour swatch** — `colorForSession(getSessionId())`, read-only.
- **Editable name** — bound to `hmpp:name` via `getStoredName()` /
  `setStoredName()`. Reuse `NameEditor`'s input treatment and validation
  (trim, non-empty, the autofill-suppression attributes), but **persist locally
  only** — there is no slug on the lobby, so it does **not** emit `name:set`.
  The normal join flow already reads `hmpp:name`, so the edited name is used on
  the next join.
- No server change.

---

## Placement

- Identity strip: inside the existing `Card`, below the Create button.
- Recent rooms: a separate `<section>` beneath the Card.

## Security & abuse resistance

The user raised room enumeration as a concern. Findings and the response:

- **Pre-existing exposure (not introduced here).** `room:info` (`sockets.ts:45`)
  already returns the full `PublicRoom` for *any* guessed slug with no auth or
  membership check, and slugs are low-entropy (`adjective-animal`, order of a
  few hundred thousand combinations) with no rate limiting. This feature does
  not widen that; addressing it fully (slug entropy, trimming `room:info` for
  non-members) is **out of scope** — see Out of scope, flagged for a future
  ticket.

- **Membership gate on `rooms:status`** (see A2). The endpoint discloses standing
  only for rooms where `sessionId` is in `connections`, so it adds **zero** new
  enumeration surface even though it accepts batches of slugs.

- **Rate limiting (defense-in-depth).** Add a lightweight per-socket token-bucket
  limiter to the **read** endpoints `rooms:status` and `room:info`. Limits are
  chosen so normal use never trips them and are tunable in one place
  (`config.ts`). Suggested starting points: `rooms:status` ~5 calls / 10s
  (lobby fires once on mount); `room:info` ~20 calls / 10s. Over-limit calls
  return `{ error: 'Too many requests, slow down' }` via the ack — they do not
  disconnect the socket.
  - **`room:join` is explicitly exempt** from this limiter so joining rooms,
    following shared links, and creating rooms are never throttled. (A separate,
    much looser global guard could be considered later, but is out of scope.)

- **Event-scoping invariant (already true; must be preserved).** A client
  receives `room:update` only for rooms it has `room:join`-ed, because broadcasts
  go solely to `io.to(slug)` and a socket enters that socket.io room only on
  join (`sockets.ts:37`). `rooms:status` is request/response and must **not**
  call `socket.join`, so the lobby never subscribes to any room while checking
  status. A test asserts a socket that only calls `rooms:status` receives no
  `room:update`.

- **Note (pre-existing, out of scope):** `sessionId` is visible in
  `PublicConnection`/`PublicRoom`, so it functions as identity rather than a
  secret. The membership gate relies on the caller supplying *their own*
  sessionId; supplying someone else's only reveals what `room:info` already
  exposes. Treating sessionId as a bearer secret is a separate concern.

## Accessibility

- Room rows are real links/buttons with visible text (slug as accessible name);
  the dismiss **×** has an accessible label (e.g. "Remove <slug>").
- Identity name input keeps a visible/associated label.
- Vote badge conveys state by text, not colour alone.

## Testing

**Server (`rooms:status`):**
- Missing/expired slug → `active: false`.
- Member, voted → `active: true, hasVoted: true`.
- Member, not voted → `active: true, hasVoted: false`.
- Revealed round → `revealed: true`.
- **Membership gate:** a live room the session is *not* a member of →
  `active: false` (indistinguishable from non-existent).
- **Eject-mode room the session left** (removed from `connections`) →
  `active: false`.
- Slug list over the 25 cap is truncated to the first 25.
- **Non-subscribing:** a socket that calls only `rooms:status` (never
  `room:join`) receives no `room:update` broadcast for those slugs.

**Server (rate limiting):**
- Bursting `rooms:status` / `room:info` past the limit → `{ error: ... }` ack,
  socket stays connected.
- `room:join` is never throttled by the limiter.

**Client:**
- `hmpp:rooms` reducer: add, dedupe by slug, cap at 12, `forget`, `clearAll`.
- `RecentRooms` rendering: active / greyed / not-in-roster states; empty list
  renders nothing; loading skeleton while pending.
- Identity edit persists to `hmpp:name` and survives reload.

## Out of scope

- User-chosen colour (colour stays auto-derived).
- Cross-device / cross-browser room history (no accounts).
- Changing the server's name-uniquify-on-collision behaviour.
- Live polling/refresh of room status after mount.
- **Pre-existing enumeration hardening beyond this feature** (flag for a future
  ticket): raising slug entropy, trimming `room:info`'s payload for non-members,
  treating `sessionId` as a secret bearer token, and any global per-socket rate
  cap. This feature gates the new endpoint and rate-limits the read endpoints;
  the broader surface is deliberately left untouched.
