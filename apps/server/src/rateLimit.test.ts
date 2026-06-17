import { describe, it, expect } from 'vitest';
import { createRateLimiter } from './rateLimit';

const limits = { 'rooms:status': { capacity: 3, refillPerSec: 1 } };

describe('createRateLimiter', () => {
  it('allows up to capacity then blocks', () => {
    const now = 0;
    const limit = createRateLimiter(limits, () => now);
    expect(limit('rooms:status')).toBe(true);
    expect(limit('rooms:status')).toBe(true);
    expect(limit('rooms:status')).toBe(true);
    expect(limit('rooms:status')).toBe(false); // 4th in the same instant
  });

  it('refills over time', () => {
    let now = 0;
    const limit = createRateLimiter(limits, () => now);
    limit('rooms:status'); limit('rooms:status'); limit('rooms:status');
    expect(limit('rooms:status')).toBe(false);
    now = 1000; // one second → +1 token
    expect(limit('rooms:status')).toBe(true);
  });

  it('treats unconfigured events as unlimited', () => {
    const limit = createRateLimiter(limits, () => 0);
    for (let i = 0; i < 100; i++) expect(limit('room:join')).toBe(true);
  });
});
