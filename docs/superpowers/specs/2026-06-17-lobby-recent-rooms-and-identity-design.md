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
      inRoster: boolean;     // is this sessionId currently a connection?
      voter: boolean;
      hasVoted: boolean;
      revealed: boolean;
      roundLabel: string;
      count: number;         // participant count
    };
```

- **Read-only.** Must not create rooms, add the session to a roster, or mutate
  state. Loading via `roomStore` is fine (its normal TTL sweep is acceptable);
  do not extend or refresh a room's TTL on a status check.
- Missing/expired room → `{ slug, active: false }`.
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
  (**Voted** / **No vote yet**). When `inRoster: false` (you left an eject-mode
  room that is still alive), a subtle "not in this room — rejoin" note. Still
  clickable to rejoin.
- **Greyed rows** (`active: false`), after the active ones: dimmed, with an
  **×** to dismiss (calls `forget(slug)`).
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

## Accessibility

- Room rows are real links/buttons with visible text (slug as accessible name);
  the dismiss **×** has an accessible label (e.g. "Remove <slug>").
- Identity name input keeps a visible/associated label.
- Vote badge conveys state by text, not colour alone.

## Testing

**Server (`rooms:status`):**
- Missing/expired slug → `active: false`.
- In-roster, voted → `active: true, inRoster: true, hasVoted: true`.
- In-roster, not voted → `hasVoted: false`.
- Revealed round → `revealed: true`.
- Eject-mode room the session left but still alive → `active: true,
  inRoster: false`.
- Slug list over the 25 cap is rejected/truncated (pick one; truncate).

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
