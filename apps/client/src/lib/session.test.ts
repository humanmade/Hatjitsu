import { describe, it, expect, beforeEach } from 'vitest';
import { getSessionId } from './session';

beforeEach(() => localStorage.clear());

describe('getSessionId', () => {
  it('creates and persists a stable id', () => {
    const a = getSessionId();
    expect(a).toMatch(/[0-9a-f-]{36}/);
    expect(getSessionId()).toBe(a);
  });
});
