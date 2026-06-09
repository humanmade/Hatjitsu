import type { Vote } from './types';

export type VoteStatus = 'unfinished' | 'unanimous' | 'not_unanimous' | 'problem';

export interface VoteResult {
  validVotes: number[];
  average: number;
  total: number;
  stddev: number;
  placeholderCount: number;
  showAverage: boolean;
  forceRevealDisable: boolean;
  voteStatus: VoteStatus;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function standardDeviation(values: number[]): number {
  const avg = mean(values);
  const squareDiffs = values.map((value) => (value - avg) ** 2);
  return Math.sqrt(mean(squareDiffs));
}

export function computeVoteResults(
  votes: Array<{ vote: Vote }>,
  voterCount: number,
  forcedReveal: boolean,
): VoteResult {
  const voteCount = votes.length;

  const validVotes = votes
    .map((x) => x.vote)
    .filter((vote): vote is string | number => !Number.isNaN(parseFloat(String(vote))))
    .map((vote) => parseFloat(String(vote)));

  const placeholderCount = Math.max(0, voterCount - voteCount);
  const showAverage = placeholderCount === 0;

  let average = 0;
  let total = 0;
  let stddev = 0;
  if (validVotes.length > 0) {
    total = validVotes.reduce((a, b) => a + b, 0);
    average = Math.round(total / validVotes.length);
    stddev = standardDeviation(validVotes);
  }

  const forceRevealDisable = forcedReveal || (voteCount === voterCount && voterCount > 0);

  const allVotesCast =
    voterCount > 0 && voteCount === voterCount && votes.every((x) => x.vote !== undefined && x.vote !== null);

  let voteStatus: VoteStatus = 'unfinished';
  if (allVotesCast || forcedReveal) {
    const uniqVotes = new Set(votes.map((x) => x.vote)).size;
    if (uniqVotes === 1) voteStatus = 'unanimous';
    else if (uniqVotes === voterCount) voteStatus = 'problem';
    else if (voterCount > 3 && uniqVotes === voterCount - 1) voteStatus = 'problem';
    else voteStatus = 'not_unanimous';
  }

  return { validVotes, average, total, stddev, placeholderCount, showAverage, forceRevealDisable, voteStatus };
}
