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
                'grid aspect-[5/7] w-full place-items-center rounded-xl border-2 shadow-sm',
                'motion-safe:transition-all motion-safe:duration-200 motion-safe:ease-out',
                'hover:shadow-lg motion-safe:hover:-translate-y-1.5 motion-safe:hover:scale-[1.03]',
                !c.voter && 'opacity-60',
              )}
              style={voted ? { background: c.color, borderColor: c.color, color: '#fff' } : { borderColor: c.color, color: c.color }}
              title={c.voter ? c.name : `${c.name} (observer)`}
            >
              {voted ? (
                <Check className="size-8" />
              ) : !c.voter ? (
                <Eye className="size-5" />
              ) : (
                <span className="flex gap-1" aria-label="waiting to vote">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="size-1.5 rounded-full motion-safe:animate-pulse"
                      style={{
                        backgroundColor: `color-mix(in oklab, ${c.color}, var(--foreground) 40%)`,
                        animationDelay: `${i * 160}ms`,
                      }}
                    />
                  ))}
                </span>
              )}
            </div>
            <span
              className="max-w-full truncate text-sm font-medium"
              // Keep the player's hue but guarantee contrast: blend toward the theme's
              // foreground (lightens dark colours in dark mode, darkens light ones in light mode).
              style={{ color: `color-mix(in oklab, ${c.color}, var(--foreground) 40%)` }}
            >
              {c.name}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
