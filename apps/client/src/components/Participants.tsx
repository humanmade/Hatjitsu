import { Eye, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PublicConnection } from '@hmpp/shared';

export function Participants({ connections }: { connections: PublicConnection[] }) {
  if (connections.length === 0) return null;
  return (
    <ul className="flex flex-wrap justify-center gap-5">
      {connections.map((c) => {
        const voted = c.voter && c.hasVoted;
        // Cards never show the value — only whether this person has voted. Anonymity is
        // about identity↔value: the values appear de-identified in the results, not here.
        return (
          <li key={c.sessionId} className="flex w-20 flex-col items-center gap-2 sm:w-24">
            <div
              className={cn(
                'grid aspect-[5/7] w-full place-items-center rounded-xl border-2 shadow-sm transition-colors',
                !voted && 'border-dashed',
                !c.voter && 'opacity-60',
              )}
              style={voted ? { background: c.color, borderColor: c.color, color: '#fff' } : { borderColor: c.color, color: c.color }}
              title={c.voter ? c.name : `${c.name} (observer)`}
            >
              {voted ? <Check className="size-8" /> : !c.voter ? <Eye className="size-5" /> : null}
            </div>
            <span className="max-w-full truncate text-sm font-medium" style={{ color: c.color }}>
              {c.name}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
