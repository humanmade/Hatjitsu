import { describe, it, expect } from 'vitest';
import { FORBIDDEN, COLOURS, generateColor, generateName, generateSlug, uniquifyName } from './names';

describe('names', () => {
  it('never emits a forbidden word from generateName', () => {
    for (let i = 0; i < 200; i++) {
      const parts = generateName().toLowerCase().split(' ');
      for (const p of parts) expect(FORBIDDEN).not.toContain(p);
    }
  });
  it('never emits a forbidden word from generateSlug (room URLs)', () => {
    for (let i = 0; i < 200; i++) {
      const parts = generateSlug().toLowerCase().split('-');
      for (const p of parts) expect(FORBIDDEN).not.toContain(p);
    }
  });
  it('generateColor returns a value from the palette', () => {
    expect(COLOURS).toContain(generateColor());
  });
  it('uniquifyName returns the name unchanged when free', () => {
    expect(uniquifyName('spock', new Set())).toBe('spock');
  });
  it('uniquifyName disambiguates a taken name (longer, still contains it)', () => {
    const out = uniquifyName('spock', new Set(['spock']));
    expect(out).not.toBe('spock');
    expect(out.toLowerCase().endsWith('spock')).toBe(true);
  });
});
