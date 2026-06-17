import { describe, it, expect } from 'vitest';
import { joinSchema, voteSchema, roomsStatusSchema } from './schemas';

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

describe('roomsStatusSchema', () => {
  it('accepts a sessionId and a list of slugs', () => {
    const r = roomsStatusSchema.safeParse({ sessionId: 's1', slugs: ['happy-otter', 'quick-beaver'] });
    expect(r.success).toBe(true);
  });
  it('rejects a missing sessionId', () => {
    expect(roomsStatusSchema.safeParse({ slugs: ['a'] }).success).toBe(false);
  });
  it('rejects more than 100 slugs', () => {
    const slugs = Array.from({ length: 101 }, (_, i) => `s${i}`);
    expect(roomsStatusSchema.safeParse({ sessionId: 's', slugs }).success).toBe(false);
  });
});
