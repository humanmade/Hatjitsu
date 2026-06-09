import { Eye, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PublicConnection } from '@hmpp/shared';

export function Participants({ connections, revealed }: { connections: PublicConnection[]; revealed: boolean }) {
  if (connections.length === 0) return null;
  return (
    <ul className="flex flex-wrap justify-center gap-5">
      {connections.map((c) => {
        const faceUp = revealed && c.voter;
        const dashed = c.voter ? !c.hasVoted : true; // observers + not-yet-voted show a face-down card
        return (
          <li key={c.sessionId} className="flex w-20 flex-col items-center gap-2 sm:w-24">
            <div
              className={cn(
                'grid aspect-[5/7] w-full place-items-center rounded-xl border-2 text-3xl font-bold shadow-sm transition-colors',
                dashed && 'border-dashed',
                !c.voter && 'opacity-60',
              )}
              style={
                faceUp
                  ? { background: c.color, borderColor: c.color, color: '#fff' }
                  : { borderColor: c.color, color: c.color }
              }
              title={c.voter ? c.name : `${c.name} (observer)`}
            >
              {faceUp ? (c.vote ?? '–') : !c.voter ? <Eye className="size-5" /> : c.hasVoted ? <Check className="size-7" /> : null}
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
