/** Copia Deno-compatibile di src/games/cards/frenchDeck.ts — vedi shuffle.ts per il perché. */

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades'
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14
export interface Card { suit: Suit; rank: Rank }

export const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades']
export const RANKS: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]

export const sameCard = (a: Card, b: Card) => a.suit === b.suit && a.rank === b.rank

export function buildDeck(): Card[] {
  const deck: Card[] = []
  for (const suit of SUITS) for (const rank of RANKS) deck.push({ suit, rank })
  return deck
}

export { shuffled } from './shuffle.ts'
