type Bucket = { tokens: number; last: number };
export type Limits = Record<string, { capacity: number; refillPerSec: number }>;

/** Per-instance token-bucket limiter. Create one per socket connection; call with the event
 * name. Unconfigured events are always allowed. `now` is injectable for tests. */
export function createRateLimiter(limits: Limits, now: () => number = Date.now) {
  const buckets = new Map<string, Bucket>();
  return (event: string): boolean => {
    const cfg = limits[event];
    if (!cfg) return true;
    const t = now();
    let b = buckets.get(event);
    if (!b) { b = { tokens: cfg.capacity, last: t }; buckets.set(event, b); }
    b.tokens = Math.min(cfg.capacity, b.tokens + ((t - b.last) / 1000) * cfg.refillPerSec);
    b.last = t;
    if (b.tokens < 1) return false;
    b.tokens -= 1;
    return true;
  };
}
