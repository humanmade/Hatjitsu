import { describe, it, expect } from 'vitest';
import { DECKS, chooseCardPack } from './decks';

describe('chooseCardPack', () => {
  it('returns a known deck by name', () => {
    expect(chooseCardPack('135 set')).toEqual(['1', '3', '5', '8', '13', '21', '?']);
  });
  it('returns the T-Shirt deck', () => {
    expect(chooseCardPack('T-Shirt')).toEqual(['XS', 'S', 'M', 'L', 'XL', '?']);
  });
  it('splits a custom comma string into a deck', () => {
    expect(chooseCardPack('a,b,c')).toEqual(['a', 'b', 'c']);
  });
  it('exposes all named decks', () => {
    expect(Object.keys(DECKS)).toContain('Fibonacci');
    expect(Object.keys(DECKS)).toContain('Fruit');
  });
});
