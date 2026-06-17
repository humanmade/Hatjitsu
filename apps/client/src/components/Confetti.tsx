import { useEffect, useMemo, useState } from 'react';

const COLORS = ['#46C2CB', '#BE3144', '#A2678A', '#f5c542', '#5b8def', '#7bd389', '#ff8c42', '#e0488b'];

/** Pure-CSS confetti burst: many small pieces fall + spin + fade. Respects reduced-motion. */
export function Confetti({ count = 110 }: { count?: number }) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDone(true), 4800);
    return () => clearTimeout(t);
  }, []);

  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        i,
        left: Math.random() * 100,
        delay: Math.random() * 0.5,
        duration: 2.6 + Math.random() * 1.8,
        drift: (Math.random() * 2 - 1) * 18,
        spin: 360 + Math.random() * 900,
        color: COLORS[i % COLORS.length],
        w: 6 + Math.random() * 6,
        h: 9 + Math.random() * 9,
        round: Math.random() > 0.7,
      })),
    [count],
  );

  if (done) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden="true">
      {pieces.map((p) => {
        const style = {
          left: `${p.left}%`,
          width: `${p.w}px`,
          height: `${p.h}px`,
          background: p.color,
          borderRadius: p.round ? '9999px' : '2px',
          animation: `hmpp-confetti-fall ${p.duration}s cubic-bezier(0.3,0.6,0.5,1) ${p.delay}s both`,
          ['--drift']: `${p.drift}vw`,
          ['--spin']: `${p.spin}deg`,
        } as React.CSSProperties;
        return <span key={p.i} className="hmpp-confetti-piece absolute top-0 block" style={style} />;
      })}
    </div>
  );
}
