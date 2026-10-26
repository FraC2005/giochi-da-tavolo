/** Copia Deno-compatibile di src/games/cards/italianDeck.ts — vedi shuffle.ts per il perché. */

export type Suit = 'denari' | 'coppe' | 'spade' | 'bastoni'
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10
export interface Card { suit: Suit; rank: Rank }

export const SUITS: Suit[] = ['denari', 'coppe', 'spade', 'bastoni']
export const RANKS: Rank[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

export const sameCard = (a: Card, b: Card) => a.suit === b.suit && a.rank === b.rank

export function buildDeck(): Card[] {
  const deck: Card[] = []
  for (const suit of SUITS) for (const rank of RANKS) deck.push({ suit, rank })
  return deck
}

export { shuffled } from './shuffle.ts'
