import {
  type RoomState, type Connection, type PublicRoom, type Vote,
  colorForSession, generateName, uniquifyName,
} from '@hmpp/shared';

const clone = (s: RoomState): RoomState => structuredClone(s);

export function createRoom(slug: string): RoomState {
  return {
    slug, mode: 'live', createdAt: Date.now(), adminSessionId: null,
    cardPack: '135 set', forcedReveal: false, roundLabel: '', history: [], connections: {},
  };
}

const activeConnections = (s: RoomState): Connection[] =>
  Object.values(s.connections).filter((c) => c.socketIds.length > 0);

const takenNames = (s: RoomState, excludeSessionId?: string): Set<string> =>
  new Set(activeConnections(s).filter((c) => c.sessionId !== excludeSessionId).map((c) => c.name));

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
  if (!next.adminSessionId) next.adminSessionId = opts.sessionId;
  return next;
}

export function leave(s: RoomState, socketId: string): RoomState {
  const next = clone(s);
  const conn = Object.values(next.connections).find((c) => c.socketIds.includes(socketId));
  if (!conn) return next;
  conn.socketIds = conn.socketIds.filter((id) => id !== socketId);
  if (conn.socketIds.length === 0) {
    delete next.connections[conn.sessionId];
    if (next.adminSessionId === conn.sessionId) {
      const nextAdmin = activeConnections(next)[0];
      next.adminSessionId = nextAdmin ? nextAdmin.sessionId : null;
    }
  }
  return next;
}

export function recordVote(s: RoomState, sessionId: string, vote: Vote): RoomState {
  const next = clone(s);
  const conn = next.connections[sessionId];
  if (conn) conn.vote = vote;
  return next;
}

export function clearVote(s: RoomState, sessionId: string): RoomState {
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
  for (const c of Object.values(next.connections)) c.vote = null;
  next.forcedReveal = false;
  return next;
}

export function forceReveal(s: RoomState): RoomState {
  const next = clone(s);
  next.forcedReveal = true;
  return next;
}

export function toggleVoter(s: RoomState, sessionId: string, voter: boolean): RoomState {
  const next = clone(s);
  const conn = next.connections[sessionId];
  if (conn) {
    conn.voter = voter;
    if (!voter) conn.vote = null;
  }
  return next;
}

export function setName(s: RoomState, sessionId: string, name: string): RoomState {
  const next = clone(s);
  const conn = next.connections[sessionId];
  if (conn) conn.name = uniquifyName(name, takenNames(next, sessionId));
  return next;
}

export function setCardPack(s: RoomState, cardPack: string): RoomState {
  const next = clone(s); next.cardPack = cardPack; return next;
}

export function setRoundLabel(s: RoomState, label: string): RoomState {
  const next = clone(s); next.roundLabel = label; return next;
}

export function votingFinished(s: RoomState): boolean {
  if (s.forcedReveal) return true;
  const voters = activeConnections(s).filter((c) => c.voter);
  if (voters.length === 0) return false;
  return voters.every((v) => v.vote !== null && v.vote !== undefined);
}

export function clientCount(s: RoomState): number {
  return activeConnections(s).length;
}

export function isAdmin(s: RoomState, sessionId: string | undefined): boolean {
  return !!sessionId && s.adminSessionId === sessionId;
}

export function publicView(s: RoomState): PublicRoom {
  const revealed = votingFinished(s);
  const active = activeConnections(s);

  // Anonymous reveal: a sorted multiset of votes, decoupled from who cast them.
  // Sorting (not participant order) is what prevents positional re-identification.
  const votes = revealed
    ? active
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
    slug: s.slug, mode: s.mode, adminSessionId: s.adminSessionId, cardPack: s.cardPack,
    forcedReveal: s.forcedReveal, revealed, roundLabel: s.roundLabel, history: s.history,
    votes,
    connections: active.map((c) => ({
      sessionId: c.sessionId, name: c.name, color: c.color, voter: c.voter,
      hasVoted: c.vote !== null && c.vote !== undefined,
    })),
  };
}
