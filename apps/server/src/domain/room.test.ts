import { describe, it, expect } from 'vitest';
import {
  createRoom, enter, leave, recordVote, clearVote, resetVotes,
  forceReveal, toggleVoter, setCardPack, setEjectOnLeave, purgeStalePresence,
  isFacilitator, facilitatorClaimable, claimFacilitator, passFacilitator,
  manualRevealBlocked, votingFinished, clientCount, publicView, statusFor, evict,
} from './room';
import { REVEAL_COOLDOWN_MS } from '@hmpp/shared';

const join = (state: ReturnType<typeof createRoom>, sessionId: string, socketId: string, voter = true) =>
  enter(state, { sessionId, socketId, voter });

describe('Room domain', () => {
  it('makes the first joiner the facilitator', () => {
    let s = createRoom('happy-otter');
    s = join(s, 'a', 'sock-a');
    expect(s.facilitatorSessionId).toBe('a');
    expect(isFacilitator(s, 'a')).toBe(true);
    expect(clientCount(s)).toBe(1);
  });

  it('hides votes until everyone has voted, then reveals them anonymously', () => {
    let s = createRoom('r'); s = join(s, 'a', 'sa'); s = join(s, 'b', 'sb');
    s = recordVote(s, 'a', '5');
    expect(votingFinished(s)).toBe(false);
    let pv = publicView(s);
    expect(pv.revealed).toBe(false);
    expect(pv.votes).toEqual([]); // nothing revealed yet
    expect(pv.connections.find((c) => c.sessionId === 'a')!.hasVoted).toBe(true);
    expect(pv.connections[0]).not.toHaveProperty('vote'); // never attributed to a person
    s = recordVote(s, 'b', '8');
    pv = publicView(s);
    expect(votingFinished(s)).toBe(true);
    expect(pv.revealed).toBe(true);
    expect(pv.votes).toEqual(['5', '8']); // anonymous, sorted multiset
    expect(pv.connections[0]).not.toHaveProperty('vote');
  });

  it('changing the card pack clears the current votes and reveal', () => {
    let s = createRoom('r'); s = join(s, 'a', 'sa'); s = recordVote(s, 'a', 'banana'); s = forceReveal(s);
    s = setCardPack(s, 'Fibonacci');
    expect(s.cardPack).toBe('Fibonacci');
    expect(s.connections['a'].vote).toBeNull();
    expect(s.revealed).toBe(false);
  });

  it('stays revealed when a new voter joins after reveal, and locks votes', () => {
    let s = createRoom('r'); s = join(s, 'a', 'sa');
    s = recordVote(s, 'a', '5'); // sole voter -> auto-reveal latches
    expect(s.revealed).toBe(true);
    s = join(s, 'b', 'sb'); // late joiner must not un-reveal the round
    expect(s.revealed).toBe(true);
    s = recordVote(s, 'b', '8'); // votes are locked once revealed
    expect(s.connections['b'].vote).toBeNull();
  });

  it('force reveal exposes votes immediately', () => {
    let s = createRoom('r'); s = join(s, 'a', 'sa'); s = join(s, 'b', 'sb');
    s = recordVote(s, 'a', '5');
    s = forceReveal(s);
    expect(publicView(s).revealed).toBe(true);
  });

  it('reset snapshots history and clears votes + reveal', () => {
    let s = createRoom('r'); s = join(s, 'a', 'sa'); s = recordVote(s, 'a', '8'); s = forceReveal(s);
    s = resetVotes(s);
    expect(s.history).toHaveLength(1);
    expect(s.history[0].votes).toEqual([{ vote: '8' }]);
    expect(s.revealed).toBe(false);
    expect(s.connections['a'].vote).toBeNull();
  });

  it('toggling a voter to observer clears their vote', () => {
    let s = createRoom('r'); s = join(s, 'a', 'sa'); s = recordVote(s, 'a', '5');
    s = toggleVoter(s, 'a', false);
    expect(s.connections['a'].voter).toBe(false);
    expect(s.connections['a'].vote).toBeNull();
  });

  it('does NOT reassign the facilitator when they leave — the seat becomes claimable', () => {
    let s = createRoom('r'); s = join(s, 'a', 'sa'); s = join(s, 'b', 'sb');
    s = leave(s, 'sa', false); // keep mode: 'a' stays in the roster but disconnected
    expect(s.facilitatorSessionId).toBe('a'); // never silently handed to 'b'
    expect(isFacilitator(s, 'b')).toBe(false);
    expect(facilitatorClaimable(s)).toBe(true); // because the holder is disconnected
  });

  it('lets the facilitator silently reclaim on return while the seat is unclaimed', () => {
    let s = createRoom('r'); s = join(s, 'a', 'sa'); s = join(s, 'b', 'sb');
    s = leave(s, 'sa', false);
    s = enter(s, { sessionId: 'a', socketId: 'sa2' }); // they come back
    expect(s.facilitatorSessionId).toBe('a');
    expect(facilitatorClaimable(s)).toBe(false); // holder connected again
  });

  it('lets anyone claim a vacant or abandoned facilitator seat', () => {
    let s = createRoom('r'); s = join(s, 'a', 'sa'); s = join(s, 'b', 'sb');
    s = leave(s, 'sa', false); // facilitator 'a' disconnects
    s = claimFacilitator(s, 'b');
    expect(s.facilitatorSessionId).toBe('b');
    s = enter(s, { sessionId: 'a', socketId: 'sa2' }); // original returns AFTER it was claimed
    expect(s.facilitatorSessionId).toBe('b'); // claimer keeps it; returner is ordinary
  });

  it('the facilitator can pass the seat to another participant', () => {
    let s = createRoom('r'); s = join(s, 'a', 'sa'); s = join(s, 'b', 'sb');
    s = passFacilitator(s, 'b');
    expect(s.facilitatorSessionId).toBe('b');
  });

  it('is not claimable while a connected facilitator holds it', () => {
    let s = createRoom('r'); s = join(s, 'a', 'sa'); s = join(s, 'b', 'sb');
    expect(facilitatorClaimable(s)).toBe(false);
  });

  it('sweeps disconnected non-voters to observer when the round auto-reveals', () => {
    let s = createRoom('r'); s = join(s, 'a', 'sa'); s = join(s, 'b', 'sb');
    s = setEjectOnLeave(s, false);
    s = leave(s, 'sb', false); // 'b' is a voter but away (tab closed), never voted
    s = recordVote(s, 'a', '5'); // last connected voter votes -> auto-reveal
    expect(s.revealed).toBe(true);
    expect(s.connections['b'].voter).toBe(false); // swept to observer
    expect(s.connections['b'].autoDemoted).toBe(true);
  });

  it('sweeps every non-voter to observer on a manual reveal', () => {
    let s = createRoom('r'); s = join(s, 'a', 'sa'); s = join(s, 'b', 'sb'); s = join(s, 'c', 'sc');
    s = recordVote(s, 'a', '5'); // b and c are connected but haven't voted
    s = forceReveal(s);
    expect(s.connections['b'].voter).toBe(false);
    expect(s.connections['b'].autoDemoted).toBe(true);
    expect(s.connections['c'].voter).toBe(false);
    expect(s.connections['a'].voter).toBe(true); // the one who voted stays a voter
    expect(s.connections['a'].autoDemoted).toBeFalsy();
  });

  it('clears the autoDemoted flag when the person makes a voter choice or the round resets', () => {
    let s = createRoom('r'); s = join(s, 'a', 'sa'); s = join(s, 'b', 'sb');
    s = recordVote(s, 'a', '5'); s = forceReveal(s); // sweeps 'b'
    expect(s.connections['b'].autoDemoted).toBe(true);
    s = toggleVoter(s, 'b', true); // 'b' chooses "rejoin voting"
    expect(s.connections['b'].autoDemoted).toBeFalsy();
    expect(s.connections['b'].voter).toBe(true);
  });

  it('stamps roundStartedAt on create and on reset', () => {
    let s = createRoom('r');
    expect(s.roundStartedAt).toBe(s.createdAt);
    const firstStart = s.roundStartedAt;
    s = join(s, 'a', 'sa'); s = recordVote(s, 'a', '5'); s = forceReveal(s);
    s = resetVotes(s);
    expect(s.roundStartedAt).toBeGreaterThanOrEqual(firstStart);
  });

  it('blocks a manual reveal only within the cooldown window after a round starts', () => {
    const s = createRoom('r');
    expect(manualRevealBlocked(s, s.roundStartedAt + 1)).toBe(true);
    expect(manualRevealBlocked(s, s.roundStartedAt + REVEAL_COOLDOWN_MS)).toBe(false);
  });

  it('keeps a session alive across multiple sockets (tabs)', () => {
    let s = createRoom('r'); s = join(s, 'a', 'sa1'); s = enter(s, { sessionId: 'a', socketId: 'sa2' });
    s = leave(s, 'sa1');
    expect(clientCount(s)).toBe(1);
    s = leave(s, 'sa2');
    expect(clientCount(s)).toBe(0);
  });

  it('ejects a participant when their last tab closes (eject mode, default)', () => {
    let s = createRoom('r'); s = join(s, 'a', 'sa'); s = join(s, 'b', 'sb');
    s = leave(s, 'sb', true);
    expect(s.connections['b']).toBeUndefined();
    expect(clientCount(s)).toBe(1);
  });

  it('evict removes a participant who has no live sockets', () => {
    let s = createRoom('r'); s = join(s, 'a', 'sa'); s = join(s, 'b', 'sb');
    s = leave(s, 'sb', false); // b retained but disconnected (grace window)
    expect(s.connections['b']).toBeDefined();
    s = evict(s, 'b');
    expect(s.connections['b']).toBeUndefined();
    expect(s.connections['a']).toBeDefined();
  });

  it('evict is a no-op once the participant has reconnected', () => {
    let s = createRoom('r'); s = join(s, 'a', 'sa'); s = join(s, 'b', 'sb');
    s = leave(s, 'sb', false);                          // b drops...
    s = enter(s, { sessionId: 'b', socketId: 'sb2' });  // ...then reconnects within grace
    const before = s;
    s = evict(s, 'b');
    expect(s).toBe(before);                             // unchanged: still has a live socket
    expect(s.connections['b']!.socketIds).toContain('sb2');
  });

  it('keeps a disconnected participant in the roster (keep mode)', () => {
    let s = createRoom('r'); s = join(s, 'a', 'sa'); s = join(s, 'b', 'sb');
    s = setEjectOnLeave(s, false);
    s = leave(s, 'sb', false);
    expect(s.connections['b']).toBeDefined();
    expect(clientCount(s)).toBe(1); // away voters aren't counted as present
    expect(publicView(s).connections.find((c) => c.sessionId === 'b')!.connected).toBe(false);
  });

  it('switching to eject purges already-absent voters', () => {
    let s = createRoom('r'); s = join(s, 'a', 'sa'); s = join(s, 'b', 'sb');
    s = setEjectOnLeave(s, false);
    s = leave(s, 'sb', false);
    expect(s.connections['b']).toBeDefined();
    s = setEjectOnLeave(s, true);
    expect(s.connections['b']).toBeUndefined();
    expect(s.connections['a']).toBeDefined();
  });

  it('purgeStalePresence clears stale sockets; empties eject rosters, keeps async ones', () => {
    let ejectRoom = createRoom('r'); ejectRoom = join(ejectRoom, 'a', 'sa'); ejectRoom = join(ejectRoom, 'b', 'sb');
    expect(Object.keys(purgeStalePresence(ejectRoom).connections)).toHaveLength(0);

    let keepRoom = createRoom('k'); keepRoom = setEjectOnLeave(keepRoom, false); keepRoom = join(keepRoom, 'a', 'ka');
    const purged = purgeStalePresence(keepRoom);
    expect(purged.connections['a']).toBeDefined();
    expect(purged.connections['a'].socketIds).toHaveLength(0);
  });
});

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
      slug: 'happy-otter', active: true, connected: true, voter: true, hasVoted: false,
      revealed: false, roundLabel: '', count: 1, lastActivityAt: expect.any(Number),
    });
  });

  it('reports hasVoted once the member has voted', () => {
    const s = recordVote(withMember(), 'sa', '5');
    const r = statusFor(s, 'sa');
    expect(r).toMatchObject({ active: true, hasVoted: true, revealed: true }); // lone voter auto-reveals
  });
});
