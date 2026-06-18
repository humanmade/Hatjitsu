import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

const reduced = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Animates its own height when its children change size, so swapping content of different
 * heights grows/shrinks smoothly instead of jumping. The inner box is measured with a
 * ResizeObserver: the first measurement (auto → px) is instant, later ones transition.
 *
 * `overflow-hidden` is applied ONLY while the height is animating (to clip the taller
 * incoming content); at rest the box overflows visibly so card hover lifts and drop
 * shadows aren't clipped.
 */
export function AutoHeight({ children, className }: { children: ReactNode; className?: string }) {
  const inner = useRef<HTMLDivElement>(null);
  const prev = useRef<number | null>(null);
  const [height, setHeight] = useState<number | 'auto'>('auto');
  const [clip, setClip] = useState(false);

  useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    const measure = () => {
      const next = el.offsetHeight;
      if (prev.current !== null && prev.current !== next && !reduced()) setClip(true);
      prev.current = next;
      setHeight(next);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      className={cn(
        'motion-safe:transition-[height] motion-safe:duration-200 motion-safe:ease-out',
        clip && 'overflow-hidden',
        className,
      )}
      style={{ height }}
      onTransitionEnd={(e) => {
        if (e.target === e.currentTarget && e.propertyName === 'height') setClip(false);
      }}
    >
      <div ref={inner}>{children}</div>
    </div>
  );
}
