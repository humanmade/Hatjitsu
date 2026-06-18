import { Eye, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PublicConnection } from '@hmpp/shared';
import { IdleHand } from '@/components/IdleHand';
import type { IdlePhase } from '@/lib/useIdlePhase';

export function Participants({
  connections,
  facilitatorSessionId,
  idlePhase = 'awake',
}: {
  connections: PublicConnection[];
  facilitatorSessionId?: string | null;
  idlePhase?: IdlePhase;
}) {
  if (connections.length === 0) return null;
  return (
    <ul className="flex flex-wrap justify-center gap-5">
      {connections.map((c) => {
        const voted = c.voter && c.hasVoted;
        // Cards never show the value — only whether this person has voted. Anonymity is
        // about identity↔value: the values appear de-identified in the results, not here.
        return (
          <li
            key={c.sessionId}
            className="relative flex w-20 flex-col items-center gap-2 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-300 sm:w-24"
          >
            {c.voter && <IdleHand phase={idlePhase} />}
            <div
              className={cn(
                'grid aspect-[5/7] w-full place-items-center rounded-xl border-2 shadow-sm',
                'motion-safe:transition-all motion-safe:duration-200 motion-safe:ease-out',
                'hover:shadow-lg motion-safe:hover:-translate-y-1.5 motion-safe:hover:scale-[1.03]',
                // Waiting/observer: a soft "card back" matching the deck (neutral border + tint),
                // not a hard saturated outline. The bold filled card is reserved for "voted".
                !voted && 'border-border',
                !c.voter && 'opacity-60',
                !c.connected && 'opacity-45', // away: tab closed, kept in the roster
              )}
              style={
                voted
                  ? { background: c.color, borderColor: c.color, color: '#fff' }
                  : {
                      background: `color-mix(in oklab, ${c.color} 12%, var(--card))`,
                      color: `color-mix(in oklab, ${c.color}, var(--foreground) 40%)`,
                    }
              }
              title={`${c.name}${c.voter ? '' : ' (observer)'}${c.connected ? '' : ' (away)'}`}
            >
              {/* Key on the glyph state so toggling observer↔voter (and voting) remounts this
                  wrapper, replaying the enter animation instead of hard-swapping the icon. */}
              <span
                key={voted ? 'voted' : c.voter ? 'waiting' : 'observer'}
                className="inline-flex motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-75 motion-safe:duration-200"
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
              </span>
            </div>
            <span className="flex max-w-full items-center gap-1.5">
              {c.sessionId === facilitatorSessionId && (
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: c.color }}
                  title="Room Facilitator"
                  aria-label="Room Facilitator"
                  role="img"
                />
              )}
              <span
                className="truncate text-sm font-medium"
                // Keep the player's hue but guarantee contrast: blend toward the theme's
                // foreground (lightens dark colours in dark mode, darkens light ones in light mode).
                style={{ color: `color-mix(in oklab, ${c.color}, var(--foreground) 40%)` }}
              >
                {c.name}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
