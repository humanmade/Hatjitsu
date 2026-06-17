import { useEffect, useState } from 'react';
import { computeVoteResults, type PublicRoom, type VoteStatus } from '@hmpp/shared';
import { cn } from '@/lib/utils';

/** Counts up from 0 to `target` on mount. Instant when reduced-motion (or no matchMedia, e.g. tests). */
function useCountUp(target: number, duration = 600): number {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const reduce = !window.matchMedia || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setVal(target); return; }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setVal(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

const STATUS_LABEL: Record<VoteStatus, string> = {
  unanimous: 'Unanimous',
  not_unanimous: 'Not unanimous',
  problem: 'Big spread',
  unfinished: '',
};

function Stat({ label, value }: { label: string; value: number }) {
  const shown = useCountUp(value);
  return (
    <div className="flex flex-col items-center">
      <span className="text-4xl font-bold leading-none tabular-nums">{shown}</span>
      <span className="mt-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
    </div>
  );
}

export function Results({ room }: { room: PublicRoom }) {
  if (!room.revealed) return null;
  // Compute from the fixed, revealed multiset (count = votes cast) so late joiners don't skew it.
  const r = computeVoteResults(room.votes.map((v) => ({ vote: v })), room.votes.length, true);

  const hasNumbers = r.validVotes.length > 0; // averages only make sense for numeric decks
  const pill =
    r.voteStatus === 'unanimous'
      ? 'bg-green-500/15 text-green-600 dark:text-green-400'
      : r.voteStatus === 'problem'
        ? 'bg-destructive/15 text-destructive'
        : 'bg-muted text-muted-foreground';

  return (
    <div className="flex items-center gap-10 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300 motion-safe:ease-out">
      {hasNumbers && <Stat label="Average" value={r.average} />}
      {hasNumbers && <Stat label="Total" value={r.total} />}
      {STATUS_LABEL[r.voteStatus] && (
        <span className={cn('rounded-full px-4 py-1.5 text-sm font-semibold', pill)}>{STATUS_LABEL[r.voteStatus]}</span>
      )}
    </div>
  );
}
