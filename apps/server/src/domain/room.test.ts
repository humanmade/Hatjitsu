import { describe, it, expect } from 'vitest';
import {
  createRoom, enter, leave, recordVote, clearVote, resetVotes,
  forceReveal, toggleVoter, isAdmin, votingFinished, clientCount, publicView,
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

  it('hides votes until everyone has voted, then reveals', () => {
    let s = createRoom('r'); s = join(s, 'a', 'sa'); s = join(s, 'b', 'sb');
    s = recordVote(s, 'a', '5');
    expect(votingFinished(s)).toBe(false);
    expect(publicView(s).revealed).toBe(false);
    expect(publicView(s).connections.find((c) => c.sessionId === 'a')!.vote).toBeNull();
    expect(publicView(s).connections.find((c) => c.sessionId === 'a')!.hasVoted).toBe(true);
    s = recordVote(s, 'b', '5');
    expect(votingFinished(s)).toBe(true);
    expect(publicView(s).revealed).toBe(true);
    expect(publicView(s).connections.find((c) => c.sessionId === 'a')!.vote).toBe('5');
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
