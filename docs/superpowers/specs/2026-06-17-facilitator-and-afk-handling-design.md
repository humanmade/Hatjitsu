# Facilitator role + AFK voter handling

**Date:** 2026-06-17
**Status:** Approved — implementing
**Context:** Planning Poker rewrite (`rewrite` branch). Replaces the implicit, silently
reassigned "admin" with an explicit **facilitator** role, and fixes the historical
"stuck room" failure mode where an AFK voter or an absent admin made it impossible to
reveal or reset.

## Problem

In the old app, control of a room hinged on a single "admin" that was:

1. **Assigned silently and arbitrarily** — first joiner became admin, and on disconnect
   the role auto-reassigned (often to an observer) with no notification. People held
   control without knowing it.
2. **A single point of failure** — if the admin left and a voter was AFK (tab lost, or
   away due to an emergency), the round could neither auto-reveal (the AFK voter never
   voted) nor be force-revealed/reset (no admin present). The room was stuck.

Past patches (let anyone reveal/reset, de-emphasise admin UI, highlight admin status)
treated symptoms. This design fixes the roots: **who is the facilitator, how is it
handed off, and how are AFK voters resolved.**

## Design

### 1. Facilitator identity & lifecycle (replaces "admin")

- Rename `admin` → **`facilitator`** throughout: `facilitatorSessionId`,
  `isFacilitator`, socket events, UI copy, toasts.
- **Creator is the facilitator** at room creation. The seat persists with their session
  across reconnects.
- **No silent auto-reassign on disconnect.** Remove the reassignment in `room.leave`. A
  disconnected facilitator's seat stays assigned to their session but, because that
  session is disconnected, the room shows **"Facilitator away — Take control,"** claimable
  by anyone.
- **Claim** (`facilitator:claim`): allowed only when the seat is vacant *or* its current
  holder is disconnected. **Pass** (`facilitator:pass` → targetSessionId): allowed only by
  the current facilitator.
- **Return:** if still unclaimed, the original holder **silently auto-reclaims** on
  reconnect (their session still holds the seat); room toast "X resumed facilitating." If
  someone claimed it meanwhile, the returner is an ordinary participant.
- The two axes are independent: an AFK facilitator can return as an *observer* (from the
  reveal sweep, below) *and* reclaim the facilitator seat.
- **Facilitator's only privileged powers:** eject, and manual voter/observer override of
  others. **Reveal and reset are universal** — any connected user, any time. This is the
  root fix for stuck rooms: the dangerous actions are never gated on one person.

### 2. Surfacing

- A small **colored dot immediately before the facilitator's name** in the roster.
  Tooltip (`title`) **"Room Facilitator"**, plus an `aria-label` so it is reachable for
  keyboard / touch / screen readers. **No emoji.**
- **Toast on every facilitator change** — claim, pass, and silent resume. The new holder
  also gets a "you're facilitating" cue.
- The **"Take control"** prompt is quiet in normal use; it only becomes prominent when the
  seat is unclaimed *and* a facilitator-only action is wanted (in practice: ejecting a
  ghost/disruptor). Quiet-by-default is intentional — the role rarely matters.

### 3. AFK voters — reveal-time sweep + reveal cooldown

- Reveal gate unchanged: **auto-reveal** fires when all *connected* voters have voted
  (disconnected voters are already excluded via `activeConnections`); anyone may
  **manually reveal**.
- **At reveal (auto or manual): every voter without a vote is switched to observer**,
  their (empty) vote cleared, and tagged `autoDemoted` (transient flag).
- The demoted user gets a **nudge** when they return / next view it:
  *"The round was revealed while you were away — you're now an observer. Rejoin voting?"*
  → `[Rejoin voting]` / `[Stay observer]`. Either choice clears the flag.
- Everyone else gets **one combined toast**:
  *"Sam and Priya were set to observer (didn't vote this round)."*
- **Net effect:** a manual reveal is needed at most once; from the next round on the AFK
  people are observers, so it auto-reveals smoothly, and they rejoin on their own terms.
- **No Page Visibility / idle-timer machinery** — the reveal event is the only trigger.

**Reveal cooldown (anti-spam safeguard):**

- The user-clickable **manual reveal button is disabled for the first 10s of each round**
  (round start = creation or last reset). This window is exactly when people are still
  casting, so it prevents a premature manual reveal from sweeping stragglers into
  observers.
- **Auto-reveal is exempt** — if the whole team votes in 4s, the round flips immediately
  (nobody is demoted when everyone has voted).
- **Server-enforced:** the server tracks round-start time and rejects an early manual
  reveal with an ack error; the client mirrors it with a disabled button + countdown.

### 4. Button affordance rules (client)

- **Reveal button:** always visible; disabled with a countdown during the 10s round-start
  window; enabled after. Auto-reveal still flips on its own.
- **Reset button:** **hidden** when `!hasAnyVote && !revealed` (nothing to reset); visible
  otherwise. Pure display rule; the server reset handler stays idempotent.

### 5. Out of scope (unchanged)

Deck / round-label permissions, `name:set`, eject-on-leave room mode, storage, TTL, vote
math.

## Touch points

- **`packages/shared`:** rename `adminSessionId` → `facilitatorSessionId`; add
  `autoDemoted` to `PublicConnection`; add a `roundStartedAt` (or equivalent) to room
  state and public view for the cooldown; Zod schemas for `facilitator:claim` and
  `facilitator:pass`.
- **`apps/server/src/domain/room.ts`:** rename; remove auto-reassign in `leave`; add
  `claimFacilitator` / `passFacilitator` / auto-reclaim on rejoin; sweep non-voters to
  observer inside the reveal transition; stamp `roundStartedAt` on create + reset; expose
  the cooldown check.
- **`apps/server/src/sockets.ts`:** handlers for `facilitator:claim` / `facilitator:pass`;
  drop the facilitator gate on `reveal:force` and `vote:reset`; enforce the reveal
  cooldown on manual reveal.
- **`apps/client`:** rename; facilitator dot + tooltip/aria; "Take control" / "Facilitator
  away" UI; rejoin nudge; combined demotion toast; facilitator-change toasts; reveal
  button cooldown/countdown; reset button hide rule.

## Testing

- **Domain unit (pure):** claim / pass / claim-while-away / return-reclaim-if-unclaimed /
  no-reclaim-if-taken; `leave` no longer reassigns; reveal sweep demotes every non-voter
  and clears votes; `roundStartedAt` stamped on create + reset; cooldown predicate.
- **Socket integration (`:memory:` SQLite):** reject claim when held by a *connected*
  holder; reject pass by a non-facilitator; reject manual reveal inside the cooldown;
  assert broadcast payloads.
- **Client:** facilitator dot tooltip + aria; rejoin nudge flow; demotion + facilitator
  toasts; reveal button disabled/countdown; reset button hidden when nothing to reset.
