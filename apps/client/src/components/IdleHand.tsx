import { cn } from '@/lib/utils';
import type { IdlePhase } from '@/lib/useIdlePhase';

// A small fan of face-down cards the participant is "holding" while the room is idle.
// Breathes gently when drowsy; a 💤 floats up when they nod off. Positioned over the
// lower half of the participant indicator it belongs to.
export function IdleHand({ phase }: { phase: IdlePhase }) {
  if (phase === 'awake') return null;
  const dozing = phase === 'dozing';
  const leaving = phase === 'leaving';
  const rots = [-16, 0, 16];

  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-x-0 top-[58%] z-10 flex justify-center',
        leaving
          ? 'animate-[hmpp-egg-out_0.35s_ease-in_forwards]'
          : 'animate-[hmpp-egg-in_0.45s_ease-out]',
      )}
    >
      <div className="relative">
        {rots.map((rot, i) => (
          <div
            key={i}
            className="absolute left-1/2 top-0 transition-transform duration-500 ease-out"
            style={{ transform: `translateX(-50%) translateX(${(i - 1) * 9}px) rotate(${rot}deg)` }}
          >
            <div
              className={cn(
                'grid aspect-[5/7] w-8 place-items-center rounded-md border bg-card shadow-md',
                !dozing && 'motion-safe:animate-[hmpp-breathe_4s_ease-in-out_infinite]',
              )}
              style={{ animationDelay: `${i * 0.2}s` }}
            >
              <img src="/hm-mark-red.svg" alt="" className="w-3 opacity-15" />
            </div>
          </div>
        ))}
        {dozing && (
          <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-lg motion-safe:animate-[hmpp-flip-in_0.5s_ease-out_both]">
            💤
          </span>
        )}
      </div>
    </div>
  );
}
