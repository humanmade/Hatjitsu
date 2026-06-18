import {
  type RoomState, type Connection, type PublicRoom, type Vote, type RoomStatus,
  REVEAL_COOLDOWN_MS, colorForSession, generateName, uniquifyName,
} from '@hmpp/shared';

const clone = (s: RoomState): RoomState => structuredClone(s);

export function createRoom(slug: string): RoomState {
  const now = Date.now();
  return {
    slug, mode: 'live', createdAt: now, facilitatorSessionId: null, roundStartedAt: now,
    cardPack: '135 set', revealed: false, roundLabel: '', history: [], connections: {},
    ejectOnLeave: true,
  };
}

const activeConnections = (s: RoomState): Connection[] =>
  Object.values(s.connections).filter((c) => c.socketIds.length > 0);

const takenNames = (s: RoomState, excludeSessionId?: string): Set<string> =>
  new Set(activeConnections(s).filter((c) => c.sessionId !== excludeSessionId).map((c) => c.name));

const allVotersVoted = (s: RoomState): boolean => {
  const voters = activeConnections(s).filter((c) => c.voter);
  return voters.length > 0 && voters.every((v) => v.vote !== null && v.vote !== undefined);
};

/** On reveal, switch any voter who didn't cast a vote to an observer, flagged so the client
 * can nudge them to rejoin. Generalises "disconnected voters don't block" to "absent/idle
 * voters become observers", so the next round auto-reveals cleanly. Mutates the clone. */
const sweepNonVoters = (next: RoomState): void => {
  for (const c of Object.values(next.connections)) {
    if (c.voter && (c.vote === null || c.vote === undefined)) {
      c.voter = false;
      c.vote = null;
      c.autoDemoted = true;
    }
  }
};

/** Latch the round to revealed once every connected voter has voted. Mutates the clone. */
const maybeReveal = (next: RoomState): RoomState => {
  if (!next.revealed && allVotersVoted(next)) {
    next.revealed = true;
    sweepNonVoters(next);
  }
  return next;
};

/** Has at least one connected voter cast a vote? (Gates "force reveal".) */
export function hasAnyVote(s: RoomState): boolean {
  return activeConnections(s).some((c) => c.voter && c.vote !== null && c.vote !== undefined);
}

export function enter(
  s: RoomState,
  opts: { sessionId: string; socketId: string; name?: string; voter?: boolean },
): RoomState {
  const next = clone(s);
  const existing = next.connections[opts.sessionId];
  if (existing) {
    if (!existing.socketIds.includes(opts.socketId)) existing.socketIds.push(opts.socketId);
    if (opts.name) existing.name = uniquifyName(opts.name, takenNames(next, opts.sessionId));
  } else {
    const proposed = opts.name || generateName();
    next.connections[opts.sessionId] = {
      sessionId: opts.sessionId,
      name: uniquifyName(proposed, takenNames(next, opts.sessionId)),
      color: colorForSession(opts.sessionId),
      voter: opts.voter !== undefined ? opts.voter : true,
      vote: null,
      socketIds: [opts.socketId],
    };
  }
  // Only a genuinely vacant seat (fresh room) auto-fills — the creator becomes facilitator.
  // A seat held by a now-absent person is NOT auto-handed to a joiner; it must be claimed.
  if (!next.facilitatorSessionId) next.facilitatorSessionId = opts.sessionId;
  return next;
}

export function leave(s: RoomState, socketId: string, ejectOnLeave = true): RoomState {
  const next = clone(s);
  const conn = Object.values(next.connections).find((c) => c.socketIds.includes(socketId));
  if (!conn) return next;
  conn.socketIds = conn.socketIds.filter((id) => id !== socketId);
  if (conn.socketIds.length === 0) {
    // Eject: drop them from the roster. Keep: retain them as a disconnected participant.
    if (ejectOnLeave) delete next.connections[conn.sessionId];
    // The facilitator seat is deliberately NOT reassigned here: while its holder is gone it
    // simply becomes claimable (see facilitatorClaimable), and they reclaim it on return.
  }
  // A voter leaving may complete the round for everyone who remains.
  return maybeReveal(next);
}

/** The deferred half of eject-on-leave: drop a participant who still has no live sockets.
 * A no-op (returns the same state) once they've reconnected, so a brief drop — wifi blip or
 * a redeploy — keeps their seat and vote. Like `leave`, removing an away voter may complete
 * the round for whoever remains. */
export function evict(s: RoomState, sessionId: string): RoomState {
  const conn = s.connections[sessionId];
  if (!conn || conn.socketIds.length > 0) return s;
  const next = clone(s);
  delete next.connections[sessionId];
  return maybeReveal(next);
}

export function recordVote(s: RoomState, sessionId: string, vote: Vote): RoomState {
  if (s.revealed) return s; // votes are locked once the round is revealed
  const next = clone(s);
  const conn = next.connections[sessionId];
  if (conn) conn.vote = vote;
  return maybeReveal(next);
}

export function clearVote(s: RoomState, sessionId: string): RoomState {
  if (s.revealed) return s;
  const next = clone(s);
  const conn = next.connections[sessionId];
  if (conn) conn.vote = null;
  return next;
}

export function resetVotes(s: RoomState): RoomState {
  const next = clone(s);
  const cast = activeConnections(next).filter((c) => c.voter && c.vote !== null).map((c) => ({ vote: c.vote }));
  if (cast.length > 0) {
    next.history.push({
      label: next.roundLabel || `Round ${next.history.length + 1}`,
      cardPack: next.cardPack,
      votes: cast,
      timestamp: Date.now(),
    });
  }
  next.roundLabel = '';
  for (const c of Object.values(next.connections)) { c.vote = null; c.autoDemoted = false; }
  next.revealed = false;
  next.roundStartedAt = Date.now();
  return next;
}

export function forceReveal(s: RoomState): RoomState {
  const next = clone(s);
  next.revealed = true;
  sweepNonVoters(next);
  return next;
}

export function toggleVoter(s: RoomState, sessionId: string, voter: boolean): RoomState {
  const next = clone(s);
  const conn = next.connections[sessionId];
  if (conn) {
    conn.voter = voter;
    if (!voter) conn.vote = null;
    conn.autoDemoted = false; // an explicit voter/observer choice resolves the rejoin nudge
  }
  // Making the last non-voter an observer can complete the round.
  return maybeReveal(next);
}

export function setName(s: RoomState, sessionId: string, name: string): RoomState {
  const next = clone(s);
  const conn = next.connections[sessionId];
  if (conn) conn.name = uniquifyName(name, takenNames(next, sessionId));
  return next;
}

export function setCardPack(s: RoomState, cardPack: string): RoomState {
  const next = clone(s);
  next.cardPack = cardPack;
  // A new deck invalidates the current votes (e.g. a "banana" vote can't carry into a
  // numeric deck), so changing the pack clears the round.
  for (const c of Object.values(next.connections)) { c.vote = null; c.autoDemoted = false; }
  next.revealed = false;
  next.roundStartedAt = Date.now();
  return next;
}

export function setRoundLabel(s: RoomState, label: string): RoomState {
  const next = clone(s); next.roundLabel = label; return next;
}

export function setEjectOnLeave(s: RoomState, ejectOnLeave: boolean): RoomState {
  const next = clone(s);
  next.ejectOnLeave = ejectOnLeave;
  if (ejectOnLeave) {
    // Switching to eject also clears anyone who's currently absent (no live sockets).
    for (const [sid, c] of Object.entries(next.connections)) {
      if (c.socketIds.length === 0) delete next.connections[sid];
    }
    // If the facilitator was one of the purged absentees, the seat goes vacant (claimable),
    // not silently to whoever happens to be online.
    if (next.facilitatorSessionId && !next.connections[next.facilitatorSessionId]) {
      next.facilitatorSessionId = null;
    }
  }
  return next;
}

/** Drop process-local socket ids (stale after a restart) and, in eject rooms, the now-empty
 * roster. Run once at boot so a returning client doesn't leave a phantom behind. */
export function purgeStalePresence(s: RoomState): RoomState {
  const next = clone(s);
  for (const c of Object.values(next.connections)) c.socketIds = [];
  if (next.ejectOnLeave) {
    next.connections = {};
    next.facilitatorSessionId = null;
  }
  return next;
}

export function votingFinished(s: RoomState): boolean {
  return s.revealed;
}

export function clientCount(s: RoomState): number {
  return activeConnections(s).length;
}

export function isFacilitator(s: RoomState, sessionId: string | undefined): boolean {
  return !!sessionId && s.facilitatorSessionId === sessionId;
}

/** The seat may be taken when it's vacant, or when its holder has left the roster, or when
 * they're present but have no live tab open (disconnected). A connected holder keeps it. */
export function facilitatorClaimable(s: RoomState): boolean {
  const holderId = s.facilitatorSessionId;
  if (!holderId) return true;
  const holder = s.connections[holderId];
  return !holder || holder.socketIds.length === 0;
}

/** Take the facilitator seat. The caller must first check `facilitatorClaimable`. */
export function claimFacilitator(s: RoomState, sessionId: string): RoomState {
  const next = clone(s);
  next.facilitatorSessionId = sessionId;
  return next;
}

/** Hand the seat to another participant. The caller must verify the passer currently holds
 * it and the target is a present participant. */
export function passFacilitator(s: RoomState, targetSessionId: string): RoomState {
  const next = clone(s);
  next.facilitatorSessionId = targetSessionId;
  return next;
}

/** True while a manual reveal is still on cooldown (the opening window of a round, when
 * people are still casting). Auto-reveal is never subject to this. */
export function manualRevealBlocked(s: RoomState, now: number): boolean {
  return now - s.roundStartedAt < REVEAL_COOLDOWN_MS;
}

export function publicView(s: RoomState): PublicRoom {
  const revealed = s.revealed;
  const roster = Object.values(s.connections); // includes kept-but-disconnected participants

  // Anonymous reveal: a sorted multiset of votes, decoupled from who cast them.
  // Sorting (not participant order) is what prevents positional re-identification.
  const votes = revealed
    ? roster
        .filter((c) => c.voter && c.vote !== null && c.vote !== undefined)
        .map((c) => c.vote as Vote)
        .sort((a, b) => {
          const na = parseFloat(String(a));
          const nb = parseFloat(String(b));
          if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
          return String(a).localeCompare(String(b));
        })
    : [];

  return {
    slug: s.slug, mode: s.mode, facilitatorSessionId: s.facilitatorSessionId,
    roundStartedAt: s.roundStartedAt, cardPack: s.cardPack,
    revealed, roundLabel: s.roundLabel, history: s.history,
    votes, ejectOnLeave: s.ejectOnLeave,
    connections: roster.map((c) => ({
      sessionId: c.sessionId, name: c.name, color: c.color, voter: c.voter,
      hasVoted: c.vote !== null && c.vote !== undefined,
      connected: c.socketIds.length > 0,
      autoDemoted: !!c.autoDemoted,
    })),
  };
}

/** Membership-gated standing for `rooms:status`. Returns `active:false` unless `sessionId`
 * is in the roster, so a non-member cannot distinguish it from a non-existent room. */
export function statusFor(s: RoomState, sessionId: string): RoomStatus {
  const conn = s.connections[sessionId];
  if (!conn) return { slug: s.slug, active: false };
  return {
    slug: s.slug,
    active: true,
    connected: conn.socketIds.length > 0,
    voter: conn.voter,
    hasVoted: conn.vote !== null && conn.vote !== undefined,
    revealed: s.revealed,
    roundLabel: s.roundLabel,
    count: Object.keys(s.connections).length,
    lastActivityAt: s.history.at(-1)?.timestamp ?? s.createdAt,
  };
}
