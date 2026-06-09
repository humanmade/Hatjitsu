import { describe, it, expect } from 'vitest';
import {
  createRoom, enter, leave, recordVote, clearVote, resetVotes,
  forceReveal, toggleVoter, setCardPack, isAdmin, votingFinished, clientCount, publicView,
} from './room';

const join = (state: ReturnType<typeof createRoom>, sessionId: string, socketId: string, voter = true) =>
  enter(state, { sessionId, socketId, voter });

describe('Room domain', () => {
  it('makes the first joiner the admin', () => {
    let s = createRoom('happy-otter');
    s = join(s, 'a', 'sock-a');
    expect(s.adminSessionId).toBe('a');
    expect(isAdmin(s, 'a')).toBe(true);
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
    expect(s.forcedReveal).toBe(false);
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
    expect(s.forcedReveal).toBe(false);
    expect(s.connections['a'].vote).toBeNull();
  });

  it('toggling a voter to observer clears their vote', () => {
    let s = createRoom('r'); s = join(s, 'a', 'sa'); s = recordVote(s, 'a', '5');
    s = toggleVoter(s, 'a', false);
    expect(s.connections['a'].voter).toBe(false);
    expect(s.connections['a'].vote).toBeNull();
  });

  it('reassigns admin when the admin leaves', () => {
    let s = createRoom('r'); s = join(s, 'a', 'sa'); s = join(s, 'b', 'sb');
    s = leave(s, 'sa');
    expect(s.adminSessionId).toBe('b');
    expect(clientCount(s)).toBe(1);
  });

  it('keeps a session alive across multiple sockets (tabs)', () => {
    let s = createRoom('r'); s = join(s, 'a', 'sa1'); s = enter(s, { sessionId: 'a', socketId: 'sa2' });
    s = leave(s, 'sa1');
    expect(clientCount(s)).toBe(1);
    s = leave(s, 'sa2');
    expect(clientCount(s)).toBe(0);
  });
});
