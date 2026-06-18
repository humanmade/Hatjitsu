import { describe, it, expect } from 'vitest';
import { computeVoteResults } from './vote-math';

const v = (vals: Array<string | number>) => vals.map((vote) => ({ vote }));

describe('computeVoteResults', () => {
  it('flags unanimous when all voters cast the same value', () => {
    const r = computeVoteResults(v(['5', '5', '5']), 3, false);
    expect(r.voteStatus).toBe('unanimous');
    expect(r.average).toBe(5);
    expect(r.total).toBe(15);
    expect(r.stddev).toBe(0);
    expect(r.showAverage).toBe(true);
    expect(r.placeholderCount).toBe(0);
  });

  it('is unfinished and hides average while votes are outstanding', () => {
    const r = computeVoteResults(v(['5', '8']), 3, false);
    expect(r.voteStatus).toBe('unfinished');
    expect(r.showAverage).toBe(false);
    expect(r.placeholderCount).toBe(1);
    expect(r.forceRevealDisable).toBe(false);
  });

  it('flags problem when every voter disagrees', () => {
    const r = computeVoteResults(v(['1', '5', '13']), 3, false);
    expect(r.voteStatus).toBe('problem');
  });

  it('flags problem when all-but-one disagree in a group >3', () => {
    const r = computeVoteResults(v(['1', '2', '3', '5', '5']), 5, false);
    expect(r.voteStatus).toBe('problem');
  });

  it('ignores non-numeric votes in the average but counts them for reveal', () => {
    const r = computeVoteResults(v(['5', '?', '5']), 3, false);
    expect(r.average).toBe(5);
    expect(r.validVotes).toEqual([5, 5]);
    expect(r.voteStatus).toBe('not_unanimous');
  });

  it('reveals on forced reveal even when incomplete', () => {
    const r = computeVoteResults(v(['5']), 3, true);
    expect(r.forceRevealDisable).toBe(true);
    expect(['unanimous', 'not_unanimous', 'problem']).toContain(r.voteStatus);
  });
});
