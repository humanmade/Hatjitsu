/*jslint indent: 2, browser: true */

'use strict';

/* Deck definitions — framework-agnostic */

var DECKS = {
  '135 set': ['1', '3', '5', '8', '13', '21', '?'],
  'Fibonacci': ['0', '1', '2', '3', '5', '8', '13', '21', '34', '55', '89', '?'],
  'Fibonacci Goat': ['1', '2', '3', '5', '8', '13', '?', '\u2615'],
  'Mountain Goat': ['0', '\u00BD', '1', '2', '3', '5', '8', '13', '20', '40', '100', '?', '\u2615'],
  'Sequential': ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '?'],
  'Playing Cards': ['A\u2660', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J\u2654', 'Q\u2654', 'K\u2654'],
  'T-Shirt': ['XL', 'L', 'M', 'S', 'XS', '?'],
  'Fruit': ['🍎', '🍊', '🍌', '🍉', '🍑', '🍇'],
  '1-5': [1, 2, 3, 4, 5],
  '1-10': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
};

function chooseCardPack(val) {
  if (val in DECKS) {
    return DECKS[val];
  }
  return val.split(',');
}
