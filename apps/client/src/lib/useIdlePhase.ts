import { useEffect, useRef, useState } from 'react';
import type { PublicRoom } from '@hmpp/shared';

// Drives the idle easter egg: after a while of nobody doing anything the room gets
// drowsy (breathing), then nods off (dozing) once, then keeps breathing. Any activity
// — local input OR room activity — resets it: hands animate out and the clock restarts.
//
// Timings: breathe at 9 min, doze at 10 min. Override for testing with ?idle=<seconds>
// (sets the doze time; breathing stays at 90% of it, preserving the 9:10 feel).
const idleParam = Number(new URLSearchParams(window.location.search).get('idle'));
const DOZE_MS = idleParam > 0 ? idleParam * 1000 : 10 * 60 * 1000;
const BREATHE_MS = DOZE_MS * 0.9;
const DOZE_HOLD_MS = 4500; // hold the doze before breathing resumes
// Re-doze every couple of minutes while idle. In test mode (?idle) re-doze every doze
// period so the replay is observable quickly.
const DOZE_REPEAT_MS = idleParam > 0 ? DOZE_MS : 2 * 60 * 1000;
const STARTLE_MS = 500; // hold the surprised "!" before hands whisk away
const EXIT_MS = 350; // must match the hmpp-egg-out duration in globals.css

export const idleReduceMotion =
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export type IdlePhase = 'awake' | 'breathing' | 'dozing' | 'startled' | 'leaving';

export function useIdlePhase(room: PublicRoom | null): IdlePhase {
  const [phase, setPhase] = useState<IdlePhase>('awake');
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const lastActivity = useRef(Date.now());
  const nextDoze = useRef(DOZE_MS); // idle-elapsed (ms) at which to nod off next

  // Single reset path: bump the clock and, if hands are showing, startle them
  // (the startled -> leaving -> awake sequence then plays itself out).
  const reset = () => {
    lastActivity.current = Date.now();
    nextDoze.current = DOZE_MS;
    setPhase((p) => (p === 'breathing' || p === 'dozing' ? 'startled' : p));
  };

  // Local input + tab-return reset.
  useEffect(() => {
    if (idleReduceMotion) return;
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
  const sig = room
    ? `${room.connections.length}:${room.connections.filter((c) => c.hasVoted).length}:${room.revealed}`
    : 'none';
  useEffect(() => { reset(); }, [sig]);

  // Surprised beat, then hands whisk away, then gone.
  useEffect(() => {
    if (phase === 'startled') {
      const id = window.setTimeout(() => setPhase('leaving'), STARTLE_MS);
      return () => window.clearTimeout(id);
    }
    if (phase === 'leaving') {
      const id = window.setTimeout(() => setPhase('awake'), EXIT_MS);
      return () => window.clearTimeout(id);
    }
  }, [phase]);

  // Phase advancement (reads the live phase via ref to stay out of the deps).
  useEffect(() => {
    if (idleReduceMotion) return;
    let dozeTimer = 0;
    const id = window.setInterval(() => {
      if (document.hidden) return;
      const p = phaseRef.current;
      if (p === 'startled' || p === 'leaving') return;
      const idle = Date.now() - lastActivity.current;
      if (p !== 'dozing' && idle >= nextDoze.current) {
        nextDoze.current = idle + DOZE_REPEAT_MS; // re-arm for the next nod-off
        setPhase('dozing');
        dozeTimer = window.setTimeout(
          () => { if (phaseRef.current === 'dozing') setPhase('breathing'); },
          DOZE_HOLD_MS,
        );
      } else if (idle >= BREATHE_MS && p === 'awake') {
        setPhase('breathing');
      }
    }, 500);
    return () => { window.clearInterval(id); window.clearTimeout(dozeTimer); };
  }, []);

  return phase;
}
