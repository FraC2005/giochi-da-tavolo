/** Mazzo di carte francesi da 52, usato dal Poker (sia Texas Hold'em che Poker all'italiana a 5 carte). */

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades'
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 // 11=Fante, 12=Regina, 13=Re, 14=Asso
export interface Card { suit: Suit; rank: Rank }

export const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades']
export const RANKS: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]

export const SUIT_LABEL: Record<Suit, string> = { hearts: 'Cuori', diamonds: 'Quadri', clubs: 'Fiori', spades: 'Picche' }
export const SUIT_GLYPH: Record<Suit, string> = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' }
export const SUIT_COLOR: Record<Suit, string> = { hearts: '#e0526b', diamonds: '#e0526b', clubs: '#241832', spades: '#241832' }
export const RANK_LABEL: Record<Rank, string> = { 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A' }

export const cardId = (c: Card) => `${c.suit}-${c.rank}`
export const sameCard = (a: Card, b: Card) => a.suit === b.suit && a.rank === b.rank

export function buildDeck(): Card[] {
  const deck: Card[] = []
  for (const suit of SUITS) for (const rank of RANKS) deck.push({ suit, rank })
  return deck
}

export { shuffled } from './shuffle'
