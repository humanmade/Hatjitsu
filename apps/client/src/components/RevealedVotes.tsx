import { cn } from '@/lib/utils';
import type { Vote } from '@hmpp/shared';

/**
 * The revealed votes as anonymous, uncoloured card faces. They REPLACE the per-person
 * cards and are sorted by value, so the flip-in animation reveals "the value", not
 * "this person's card" — identity stays decoupled from value.
 */
export function RevealedVotes({ votes, highlight }: { votes: Vote[]; highlight?: 'unanimous' | 'problem' | null }) {
  // Unanimous: everyone agrees, so collapse the identical cards into one celebratory card.
  if (highlight === 'unanimous' && votes.length > 0) {
    const v = votes[0];
    return (
      <div className="flex justify-center">
        <div className="relative grid aspect-[5/7] w-32 place-items-center rounded-2xl border-2 border-border bg-card text-card-foreground shadow-lg hover:shadow-xl motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out motion-safe:animate-[hmpp-flip-in_0.5s_ease-out] motion-safe:hover:-translate-y-2 motion-safe:hover:scale-[1.03] sm:w-40">
          <span aria-hidden className="absolute left-3 top-2 text-sm font-semibold opacity-60">{String(v)}</span>
          <span className="text-6xl font-bold tabular-nums sm:text-7xl">{String(v)}</span>
          <span aria-hidden className="absolute right-3 bottom-2 rotate-180 text-sm font-semibold opacity-60">{String(v)}</span>
        </div>
      </div>
    );
  }

  return (
    <ul className={cn('flex flex-wrap justify-center gap-4', highlight === 'problem' && 'motion-safe:animate-[hmpp-shake_0.5s_ease-in-out]')}>
      {votes.map((v, i) => (
        <li
          key={i}
          style={{ animationDelay: `${i * 90}ms` }}
          className={cn(
            'relative grid aspect-[5/7] w-20 place-items-center rounded-xl border-2 border-border bg-card text-card-foreground shadow-sm sm:w-24',
            'motion-safe:animate-[hmpp-flip-in_0.45s_ease-out_backwards]',
            'hover:shadow-lg motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out motion-safe:hover:-translate-y-1.5 motion-safe:hover:scale-[1.03]',
          )}
        >
          <span aria-hidden className="absolute left-2 top-1.5 text-xs font-semibold opacity-60">{String(v)}</span>
          <span className="text-3xl font-bold tabular-nums sm:text-4xl">{String(v)}</span>
          <span aria-hidden className="absolute right-2 bottom-1.5 rotate-180 text-xs font-semibold opacity-60">{String(v)}</span>
        </li>
      ))}
    </ul>
  );
}
