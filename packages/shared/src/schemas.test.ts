import { describe, it, expect } from 'vitest';
import { joinSchema, voteSchema } from './schemas';

describe('schemas', () => {
  it('accepts a valid join payload', () => {
    expect(joinSchema.safeParse({ slug: 'happy-otter', sessionId: 'abc', voter: true }).success).toBe(true);
  });
  it('rejects a join with a missing sessionId', () => {
    expect(joinSchema.safeParse({ slug: 'happy-otter' }).success).toBe(false);
  });
  it('rejects an over-long slug', () => {
    expect(voteSchema.safeParse({ slug: 'x'.repeat(101), vote: '5' }).success).toBe(false);
  });
  it('accepts string or number votes', () => {
    expect(voteSchema.safeParse({ slug: 'a', vote: 5 }).success).toBe(true);
    expect(voteSchema.safeParse({ slug: 'a', vote: '5' }).success).toBe(true);
  });
});
