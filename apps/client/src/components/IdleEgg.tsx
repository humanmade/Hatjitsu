import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { PublicRoom } from '@hmpp/shared';

// Idle easter egg: after a while of nobody doing anything, the deck gets drowsy
// (breathing loop), then nods off (deals a sleepy hand of z·z·z·💤 once), then
// keeps breathing. Any activity — local input OR room activity — resets it.
//
// Timings: breathe at 9 min, doze at 10 min. Override for testing with ?idle=<seconds>
// (sets the doze time; breathing stays at 90% of it, preserving the 9:10 feel).
const idleParam = Number(new URLSearchParams(window.location.search).get('idle'));
const DOZE_MS = idleParam > 0 ? idleParam * 1000 : 10 * 60 * 1000;
const BREATHE_MS = DOZE_MS * 0.9;
const DOZE_HOLD_MS = 4500; // deal + flip + hold before breathing resumes

const SLEEPY = ['z', 'z', 'z', '💤'];
const reduceMotion =
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

type Phase = 'awake' | 'breathing' | 'dozing';

export function IdleEgg({ room }: { room: PublicRoom }) {
  const [phase, setPhase] = useState<Phase>('awake');
  const lastActivity = useRef(Date.now());
  const dozed = useRef(false);

  // Single reset path for every activity signal.
  const reset = () => {
    lastActivity.current = Date.now();
    dozed.current = false;
    setPhase((p) => (p === 'awake' ? p : 'awake'));
  };

  // Local input + tab-return reset.
  useEffect(() => {
    if (reduceMotion) return;
    const events = ['pointermove', 'pointerdown', 'keydown', 'touchstart', 'scroll', 'wheel'];
    const onActivity = () => reset();
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    const onVis = () => { if (!document.hidden) reset(); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      events.forEach((e) => window.removeEventListener(e, onActivity));
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  // Room activity reset: someone joins, a vote is cast, or a reveal/reset happens.
  const sig = `${room.connections.length}:${room.connections.filter((c) => c.hasVoted).length}:${room.revealed}`;
  useEffect(() => { reset(); }, [sig]);

  // Phase advancement.
  useEffect(() => {
    if (reduceMotion) return;
    const id = window.setInterval(() => {
      if (document.hidden) return;
      const idle = Date.now() - lastActivity.current;
      if (idle >= DOZE_MS && !dozed.current) {
        dozed.current = true;
        setPhase('dozing');
        window.setTimeout(() => setPhase('breathing'), DOZE_HOLD_MS);
      } else if (idle >= BREATHE_MS) {
        setPhase((p) => (p === 'awake' ? 'breathing' : p));
      }
    }, 500);
    return () => window.clearInterval(id);
  }, []);

  if (reduceMotion || phase === 'awake') return null;

  const dozing = phase === 'dozing';
  return (
    <div className="pointer-events-none fixed inset-0 z-40 grid place-items-center" aria-hidden>
      <div className="relative h-28 w-72">
        {SLEEPY.map((ch, i) => {
          const rot = [-12, -4, 4, 12][i];
          const off = (i - (SLEEPY.length - 1) / 2) * (dozing ? 52 : 16);
          return (
            <div
              key={i}
              className="absolute left-1/2 top-0 transition-transform duration-700 ease-out"
              style={{ transform: `translateX(-50%) translateX(${off}px) rotate(${dozing ? rot : rot / 3}deg)` }}
            >
              <div
                className={cn(
                  'grid aspect-[5/7] w-[4.5rem] place-items-center rounded-xl border-2 bg-card text-card-foreground shadow-md',
                  !dozing && 'motion-safe:animate-[hmpp-breathe_4s_ease-in-out_infinite]',
                )}
                style={{ animationDelay: `${i * 0.25}s` }}
              >
                {dozing ? (
                  <span
                    className="text-3xl motion-safe:animate-[hmpp-flip-in_0.5s_ease-out_both]"
                    style={{ animationDelay: `${i * 0.12}s` }}
                  >
                    {ch}
                  </span>
                ) : (
                  <span className="text-2xl text-muted-foreground/30">·</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
