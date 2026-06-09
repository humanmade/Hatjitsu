import { computeVoteResults, type PublicRoom, type VoteStatus } from '@hmpp/shared';
import { cn } from '@/lib/utils';

const STATUS_LABEL: Record<VoteStatus, string> = {
  unanimous: 'Unanimous',
  not_unanimous: 'Not unanimous',
  problem: 'Big spread',
  unfinished: '',
};

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-4xl font-bold leading-none tabular-nums">{value}</span>
      <span className="mt-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
    </div>
  );
}

export function Results({ room }: { room: PublicRoom }) {
  if (!room.revealed) return null;
  const voters = room.connections.filter((c) => c.voter);
  const votes = voters.filter((c) => c.vote !== null).map((c) => ({ vote: c.vote }));
  const r = computeVoteResults(votes, voters.length, room.forcedReveal);

  const hasNumbers = r.validVotes.length > 0; // averages only make sense for numeric decks
  const pill =
    r.voteStatus === 'unanimous'
      ? 'bg-green-500/15 text-green-600 dark:text-green-400'
      : r.voteStatus === 'problem'
        ? 'bg-destructive/15 text-destructive'
        : 'bg-muted text-muted-foreground';

  return (
    <div className="flex items-center gap-10">
      {hasNumbers && <Stat label="Average" value={r.average} />}
      {hasNumbers && <Stat label="Total" value={r.total} />}
      {STATUS_LABEL[r.voteStatus] && (
        <span className={cn('rounded-full px-4 py-1.5 text-sm font-semibold', pill)}>{STATUS_LABEL[r.voteStatus]}</span>
      )}
    </div>
  );
}
