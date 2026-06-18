# HM Planning Poker — Full Rewrite Design

**Date:** 2026-06-08
**Status:** Approved design, pre-implementation
**Author:** Tom J Nowell (with Claude)

## Goal

Replace the current AngularJS 1.8.3 + in-memory Express/Socket.io app (a Hatjitsu
derivative) with a modern, maintainable rewrite at **feature parity**, hosted on a
managed git-push platform off Heroku. The existing codebase is discarded; only proven
data and pure logic are ported.

## Motivation

1. **AngularJS 1.x is end-of-life (Jan 2022)** — no security patches. This, not Heroku,
   is the primary debt driving a rewrite.
2. **Heroku is in a poor state and may be retired** — need a modern, expensable,
   git-push-to-deploy host with no VPS upkeep.
3. **State is 100% in-memory today** — every deploy/restart wipes all live rooms. The
   rewrite deliberately fixes this with durable storage.

## Decisions (locked)

| Area | Decision | Rationale |
|------|----------|-----------|
| Scope | Full rewrite, both ends; discard existing code | EOL framework + chance to fix state model |
| Host (compute) | **Render** (Railway as fallback) for real/public production | Heroku-like git-push auto-deploy, always-on paid tier, native websockets, same-origin serving, attachable persistent disk |
| Pre-launch testing | **HM internal tools platform** (`tools.hmn.md`), TEMPORARY only | SSO-gated (humanmade.com) ECS Fargate, git-push via GitHub Actions → ghcr.io, persistent `/data` EFS volume. Used to let HM colleagues test before launch. NOT the production home — real users have no SSO access. Optional; jettison if it adds friction. |
| Stack | **React (Vite SPA) + Express 5 + Socket.io 4**, TypeScript end-to-end, npm-workspaces monorepo | Mainstream/hireable; mirrors current client/server split; type-safety across the wire |
| UI / styling | **Tailwind + shadcn/ui** (Radix primitives), customised to the HM design ethos | Owned-in-repo components (no vendor lock / no repeat of the unmaintained juniper framework); CSS-variable theming doubles as the Light/Dark token system; Radix gives a11y for free |
| Realtime | **Keep Socket.io** (self-hosted library) | Exact match for the 4 primitives used: rooms, request→ack, auto-reconnect, scaling adapter. Not inertia — feature fit. |
| Store | **SQLite on a persistent volume** (better-sqlite3), single instance | Durable room JSON keyed by slug; TTL via `updated_at` + lazy sweep; sub-ms sync writes; no external service; ~$10/mo cheaper than managed Redis on Render |
| Store portability | Runs from one image on every target's volume | Render disk, Railway volume, and `tools.hmn.md` `/data` EFS all mount a writable dir; `RoomStore` opens a DB file at `DATA_DIR` |

### Explicitly deferred (YAGNI)

- **Multi-instance / horizontal scaling.** Single always-on instance handles the real
  load (dozens of internal users). A SQLite-on-volume store pins to one instance by
  design; horizontal scaling would mean moving to a networked store (e.g. managed Redis +
  `@socket.io/redis-adapter`). Recorded, not built — deliberately deferred.
- Long-lived/queryable analytics across sessions (would argue for Postgres). Not a goal.
- **Asynchronous voting** — its own spec/plan cycle as a fast-follow (see "Planned
  extension" below). Not built in this rewrite, but the data model is shaped to admit it
  without a migration.

## Architecture

```
monorepo/  (npm workspaces, TypeScript end-to-end)
├── packages/shared/      # imported by BOTH client and server
│   ├── events.ts         # typed Socket.io event map (client→server, server→client)
│   ├── schemas.ts        # Zod schemas (one source of truth for validation both ends)
│   ├── decks.ts          # DECKS table (ported as-is) + custom comma-list parsing
│   ├── vote-math.ts      # computeVoteResults (ported; underscore → plain TS)
│   └── names.ts          # adjective/animal dictionaries + forbidden-words generator
├── apps/server/          # Express 5 + Socket.io 4 (persistent process)
│   ├── index.ts          # boot: fail loud if data dir not writable
│   ├── http.ts           # serves built client, /room/:slug, /healthz
│   ├── sockets.ts        # handlers: validate(Zod) → load → domain → save → broadcast → ack
│   ├── domain/room.ts    # PURE Room logic, no I/O — unit-testable in isolation
│   └── store/roomStore.ts # RoomStore: load/save room JSON in SQLite + TTL sweep
└── apps/client/          # React + Vite SPA
    ├── socket.ts         # typed socket client; stable sessionId (localStorage UUID)
    ├── store.ts          # zustand store holding server-pushed room state
    └── components/       # Lobby, Room, Deck, Card, Participant, Results,
                          #   History, Toasts, Fireworks
```

### Async-aware data shape (built now, only `live` used)

To admit asynchronous voting later without a data migration, room state is stored under a
**`Session` envelope** rather than a bare room object:

```
Session {
  slug, createdAt, color/name data, connections (sessionId → {socketIds[], name, ...}),
  mode: 'live'        // only 'live' is implemented in this rewrite; 'async' added later
  // live mode carries today's fields: cardPack, votes, forcedReveal, roundLabel, history
}
```

- TTL is **per-mode**: `live` → 4h (refreshed on activity); `async` (future) → longer /
  explicit lifecycle.
- Only `mode: 'live'` ships now. The envelope + `mode` field mean async voting slots in
  as new fields/states, not a schema rewrite.

### Key structural principle

`Room` is **pure domain logic** with no I/O. The socket handler orchestrates:

```
client emit('vote', {slug, vote}, ack)
  → validate(payload)                      # Zod schema from packages/shared
  → state = RoomStore.load(slug)           # from SQLite (auto-create if absent)
  → state = room.recordVote(state, sessionId, vote)   # pure transition
  → RoomStore.save(slug, state)            # + refresh TTL
  → io.to(slug).emit('room:update', publicView(state))
  → ack({ ok: true })
```

This mirrors today's `room.js` semantics but makes every transition testable without a
a running store — the current in-memory version cannot do this cleanly.

## Identity & sessions

- Client generates a UUID once, stored in `localStorage` (replaces today's fragile
  cookie + `socket.id` mix). Sent on `join`.
- Server maps `sessionId → socketIds[]`, so multiple tabs and reconnections re-attach to
  the same participant.
- On `disconnecting`, remove that `socketId` from the session in the stored room state.
- When a room's last socket leaves it is deleted from the store; stale rooms that linger
  (e.g. crash) are reaped by the TTL sweep (`updated_at` older than 4h) on next access.

## UI & component system

- **Tailwind + shadcn/ui** (Radix primitives), replacing the unmaintained `juniper`
  framework. shadcn components are **copied into the repo** (not an installed dependency)
  and customised to the HM design ethos — we own and edit them.
- **HM brand as tokens:** brand colors, radius, and typography are defined as the
  Tailwind/CSS-variable theme values. Light and Dark are two value sets of the *same*
  tokens (see Theming) — one system, not two.
- **Tailwind version:** v4 preferred (greenfield, CSS-first config; shadcn supports it);
  v3 acceptable fallback. Pin at plan time.
- **Brand tokens authored fresh:** HM colors/fonts/radii are defined new against HM's
  current brand — nothing extracted from the discarded juniper framework.

## Theming (new requirement, beyond parity)

Light + dark themes with an **Auto** mode that follows the OS. Built on the same
CSS-variable token system as shadcn/ui above — one token set, two value sets.

- **Control:** three-way — Light / Dark / Auto. **Auto is the default** (first visit
  follows the OS via `prefers-color-scheme`, and reacts live if the OS preference flips
  mid-session).
- **Mechanism:** colors are CSS custom properties; a class/data-attribute on `<html>`
  (shadcn's convention) selects the active value set. Components reference `var(--…)` /
  Tailwind theme tokens only — no per-component theme logic.
- **Precedence:** an explicit Light/Dark choice overrides the OS; Auto defers to the media
  query. Choice persisted in `localStorage`.
- **No flash (FOUC):** a tiny inline script applies the saved/resolved theme to `<html>`
  *before* React hydrates.
- **Authored fresh:** both light and dark value sets are designed new (no old palette
  reused). Per-user participant colors are a fresh set, contrast-checked in both themes.

## Feature parity checklist (definition of done)

```
Rooms        disposable rooms; human-readable slugs (adjective-animal, forbidden filter)
             create via button OR by visiting /room/:slug (auto-create on first visit)
             rooms deleted when empty; stale rooms swept after ~4h (TTL)
Identity     no login; stable client UUID in localStorage
             multi-tab + reconnect re-attach to same session
             editable display name; server-side unique-name enforcement; per-user color
Roles        voter vs observer; toggle self; admin can toggle others
Admin        first joiner = admin; auto-reassign on disconnect
             server-validated: force-reveal, reset, toggle-others (reject non-admin)
Voting       multiple decks (ported DECKS table incl. custom comma-list)
             votes hidden until all voters cast OR admin force-reveal
             vote / change vote / unvote
             stats: average, total, stddev, unanimous/problem detection
             round labels; voting history; history export
UX           fireworks on unanimous; toast notifications; responsive; reconnect status
Theming      (NEW, not parity) light + dark themes with Auto (follow OS); see below
```

## Error handling & edge cases

- Every socket event keeps a validation layer, ported to **Zod schemas** in
  `packages/shared` — the same schema validates client-side before emit and server-side
  on receipt (no drift).
- Every client `emit` uses ack callbacks → server errors surface as toasts.
- **Reconnect:** client re-emits `join` with stored UUID; server reconciles `socketIds`.
- **Data volume not writable at boot:** fail loud — refuse to start and log, rather than
  silently running with an unreachable store. Transient store error mid-op → ack error +
  toast, no crash.
- **Join race / room just expired:** recreate the room (matches current auto-create).
- **Admin disconnects, room empty:** left to TTL expiry.

## Testing strategy

```
shared/   unit: vote-math parity cases (unanimous/problem/stddev), deck parsing,
          name generator (forbidden-word exclusion, uniquify)
server/   unit: pure Room domain transitions (vote/reveal/reset/reassign/toggle perms)
          integration: socket handlers against an in-memory SQLite store (`:memory:`)
          — assert broadcast payloads + permission rejections
client/   component tests (Vitest + Testing Library): Deck / Results / Participant
          one e2e smoke (Playwright): two browser contexts → join, vote, reveal, reset
```

TDD: `vote-math` and `Room` domain are pure → write tests first (port the current math's
behavior as the spec), implement to green.

## Clean-room rebuild (nothing carried forward as code)

No code, CSS, or assets come from the old repo. Feature *parity* = identical observable
behavior, re-derived fresh via TDD — not ported.

```
RE-CREATED FRESH (clean-room, parity by behavior):
  vote math + unanimous/problem thresholds; room/session logic; identity; all UI.
  TDD reproduces the behavior from tests, not from the old implementation.
RE-ENTERED AS PRODUCT DATA (content, re-typed — not imported):
  deck card values; the curated joke name-word list; the forbidden-words filter.
  These are product content/personality, re-keyed into packages/shared, not lifted as code.
DISCARDED ENTIRELY:
  AngularJS app; EJS shell; in-memory lobby/room I/O; cookie+socket.id identity; the
  juniper framework. HM brand tokens are authored FRESH against HM's current brand.
```

## Deploy config (git-push parity with Heroku)

```
render.yaml (Blueprint, committed to repo):
  - web service: Node
      build = npm ci && npm run build      # builds client + server
      start = node apps/server/dist/index.js
      health check path = /healthz
  - persistent disk mounted at /data (DATA_DIR=/data); SQLite DB lives there
GitHub → Render auto-deploy on push to main   (replaces `heroku git push`)
Server serves the built React SPA statically AND hosts Socket.io on the SAME ORIGIN
  → no CORS, no cross-origin websocket headaches (preserves current behavior)
```

## Planned extension: asynchronous voting (separate spec, fast-follow)

Not built in this rewrite — recorded so the parity build doesn't preclude it. Durable
storage is the enabler; the hard part is **not** persistence but the design knots below.

- **Roster is the real feature.** Async breaks the "reveal when all *connected* voters
  have voted" rule — nobody is connected. Async needs an *explicit roster* of expected
  voters per ticket, defined by the admin.
- **Lifecycle.** A `Session` switches/starts in `mode: 'async'`, outlives the call
  (days), holds `Tickets[]` (each a votable item) with `status: open | closed` and
  `votes: sessionId → vote`. Reveal = all roster voters voted OR admin closes the ticket.
- **Notifications: link-revisit only** (confirmed). App stays login-free; admin shares
  the durable session link, people return to vote and to view results. No email/push.
  Push notifications would require optional identity/contact capture — a separate future
  concern, out of scope even for the async spec's first cut.

## Deployment portability

A `Dockerfile` is the build contract, so the application image is identical across hosts
(Render, Railway, or a future move). This is deliberate insurance against another
Heroku-style retirement.

**Shared / provider-agnostic (the image + app code):**
- One `Dockerfile` builds the same image everywhere.
- Server binds to `process.env.PORT` (never hardcoded) — Render injects `PORT`;
  `tools.hmn.md` expects port 80 (image default).
- SQLite DB lives at `process.env.DATA_DIR` (default `/data`) — every target mounts a
  writable volume there.

**Provider-specific (the only per-host work, beyond secrets + CI):**
- **Config-as-code file:** `render.yaml` (Render) vs `railway.toml`/`.json` (Railway) —
  declares the web service, build/start, health-check path, and the mounted volume.
- **Volume wiring:** Render attaches a disk at `/data`; Railway attaches a volume at
  `/data`; `tools.hmn.md` mounts `/data` (EFS) automatically. All set `DATA_DIR=/data`.
- **CI/secrets:** all auto-deploy from GitHub on push; secrets are dashboard/CLI env vars
  (on `tools.hmn.md`, via the `/_status` secrets manager).
- **`tools.hmn.md` (temporary test only):** a `.github/workflows/deploy.yml` builds and
  pushes to `ghcr.io/humanmade/<repo>` and the app is provisioned via the `humanmade/it`
  `request-app.yml` workflow. Websockets traverse the SSO/ALB proxy; Socket.io falls back
  to long-polling if the WS upgrade is blocked, so it works regardless.

## Out of scope

- User accounts / authentication (app is intentionally login-free).
- Multi-instance scaling (deferred; SQLite-on-volume pins to one instance by design).
- Cross-session analytics / long-lived data warehousing.
- Push notifications (email/Slack) — see async extension note.
- Any feature not in the parity checklist (async voting included — its own spec).
