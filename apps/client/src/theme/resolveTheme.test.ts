import { describe, it, expect } from 'vitest';
import { resolveTheme } from './resolveTheme';

describe('resolveTheme', () => {
  it('returns the explicit choice when not auto', () => {
    expect(resolveTheme('dark', true)).toBe('dark');
    expect(resolveTheme('light', false)).toBe('light');
  });
  it('follows the OS when auto', () => {
    expect(resolveTheme('auto', true)).toBe('dark');
    expect(resolveTheme('auto', false)).toBe('light');
  });
});
