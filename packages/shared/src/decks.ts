export const DECKS: Record<string, Array<string | number>> = {
  '135 set': ['1', '3', '5', '8', '13', '21', '?'],
  'Fibonacci': ['0', '1', '2', '3', '5', '8', '13', '21', '34', '55', '89', '?'],
  'Fibonacci Goat': ['1', '2', '3', '5', '8', '13', '?', '☕'],
  'Mountain Goat': ['0', '½', '1', '2', '3', '5', '8', '13', '20', '40', '100', '?', '☕'],
  'Sequential': ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '?'],
  'Playing Cards': ['A♠', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J♔', 'Q♔', 'K♔'],
  'T-Shirt': ['XS', 'S', 'M', 'L', 'XL', '?'],
  'Fruit': ['🍎', '🍊', '🍌', '🍉', '🍑', '🍇'],
  '1-5': [1, 2, 3, 4, 5],
  '1-10': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
};

export function chooseCardPack(val: string): Array<string | number> {
  if (val in DECKS) return DECKS[val];
  return val.split(',');
}
