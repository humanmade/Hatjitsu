import type { Vote } from '@hmpp/shared';

/** The revealed votes as anonymous, uncoloured card faces (colour would tie a vote to a person). */
export function RevealedVotes({ votes }: { votes: Vote[] }) {
  return (
    <ul className="flex flex-wrap justify-center gap-4">
      {votes.map((v, i) => (
        <li
          key={i}
          className="relative grid aspect-[5/7] w-20 place-items-center rounded-xl border-2 border-border bg-card text-card-foreground shadow-sm sm:w-24"
        >
          <span aria-hidden className="absolute left-2 top-1.5 text-xs font-semibold opacity-60">{String(v)}</span>
          <span className="text-3xl font-bold tabular-nums sm:text-4xl">{String(v)}</span>
          <span aria-hidden className="absolute right-2 bottom-1.5 rotate-180 text-xs font-semibold opacity-60">{String(v)}</span>
        </li>
      ))}
    </ul>
  );
}
