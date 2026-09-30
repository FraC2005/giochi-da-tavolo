/**
 * Mazzo di carte italiane da 40 (semi regionali "napoletane/piacentine"), condiviso da Briscola
 * e Scopa: 4 semi, per ciascuno le carte da 1 a 7 più le tre figure Fante (8), Cavallo (9), Re (10).
 * Il significato dei punti (forza, valore) è specifico di ogni gioco e vive nel suo motore.
 */

export type Suit = 'denari' | 'coppe' | 'spade' | 'bastoni'
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10
export interface Card { suit: Suit; rank: Rank }

export const SUITS: Suit[] = ['denari', 'coppe', 'spade', 'bastoni']
export const RANKS: Rank[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

export const SUIT_LABEL: Record<Suit, string> = { denari: 'Denari', coppe: 'Coppe', spade: 'Spade', bastoni: 'Bastoni' }
export const SUIT_GLYPH: Record<Suit, string> = { denari: '🪙', coppe: '🏆', spade: '⚔️', bastoni: '🌿' }
export const SUIT_COLOR: Record<Suit, string> = { denari: '#d1972f', coppe: '#e0526b', spade: '#5b8fd6', bastoni: '#4caf7d' }
export const RANK_LABEL: Record<Rank, string> = { 1: 'A', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: 'F', 9: 'C', 10: 'R' }

export const cardId = (c: Card) => `${c.suit}-${c.rank}`
export const sameCard = (a: Card, b: Card) => a.suit === b.suit && a.rank === b.rank

export function buildDeck(): Card[] {
  const deck: Card[] = []
  for (const suit of SUITS) for (const rank of RANKS) deck.push({ suit, rank })
  return deck
}

/** Fisher-Yates: non muta l'array passato. */
export function shuffled<T>(items: T[]): T[] {
  const arr = items.slice()
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}
