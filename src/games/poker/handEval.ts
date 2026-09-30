/**
 * Valutazione delle mani di poker (5 carte esatte, o le migliori 5 su un mazzetto più grande
 * come i 7 di Texas Hold'em). Confronto: prima la categoria (scala più alta vince), poi gli
 * "spareggi" (tiebreakers) in ordine — la prima cifra in cui differiscono decide.
 */

import type { Card, Rank } from '../cards/frenchDeck'

export const CATEGORY = {
  HIGH_CARD: 0,
  PAIR: 1,
  TWO_PAIR: 2,
  THREE_OF_A_KIND: 3,
  STRAIGHT: 4,
  FLUSH: 5,
  FULL_HOUSE: 6,
  FOUR_OF_A_KIND: 7,
  STRAIGHT_FLUSH: 8,
} as const
export type Category = (typeof CATEGORY)[keyof typeof CATEGORY]

export const CATEGORY_LABEL: Record<Category, string> = {
  0: 'Carta alta',
  1: 'Coppia',
  2: 'Doppia coppia',
  3: 'Tris',
  4: 'Scala',
  5: 'Colore',
  6: 'Full',
  7: 'Poker',
  8: 'Scala colore',
}

export interface HandValue { category: Category; tiebreakers: Rank[]; cards: Card[] }

function straightHighCard(ranksDesc: Rank[]): Rank | null {
  const unique = Array.from(new Set(ranksDesc)).sort((a, b) => b - a)
  // Asso basso (scala del "cane pezzato" A-2-3-4-5): l'asso conta come 1, la carta alta è il 5.
  const withLowAce = unique.includes(14) ? [...unique, 1] : unique
  for (let i = 0; i <= withLowAce.length - 5; i++) {
    const slice = withLowAce.slice(i, i + 5)
    if (slice[0] - slice[4] === 4) return slice[0] === 1 ? (5 as Rank) : (slice[0] as Rank)
  }
  return null
}

/** Valuta esattamente 5 carte. */
export function evaluate5(cards: Card[]): HandValue {
  const ranksDesc = cards.map((c) => c.rank).sort((a, b) => b - a)
  const isFlush = cards.every((c) => c.suit === cards[0].suit)
  const straightHigh = straightHighCard(ranksDesc)

  const counts = new Map<Rank, number>()
  for (const r of ranksDesc) counts.set(r, (counts.get(r) ?? 0) + 1)
  const groups = Array.from(counts.entries()).sort((a, b) => (b[1] - a[1]) || (b[0] - a[0])) // per numero di copie, poi per valore
  const groupCounts = groups.map((g) => g[1])

  if (isFlush && straightHigh !== null) return { category: CATEGORY.STRAIGHT_FLUSH, tiebreakers: [straightHigh], cards }
  if (groupCounts[0] === 4) return { category: CATEGORY.FOUR_OF_A_KIND, tiebreakers: [groups[0][0], groups[1][0]], cards }
  if (groupCounts[0] === 3 && groupCounts[1] === 2) return { category: CATEGORY.FULL_HOUSE, tiebreakers: [groups[0][0], groups[1][0]], cards }
  if (isFlush) return { category: CATEGORY.FLUSH, tiebreakers: ranksDesc, cards }
  if (straightHigh !== null) return { category: CATEGORY.STRAIGHT, tiebreakers: [straightHigh], cards }
  if (groupCounts[0] === 3) return { category: CATEGORY.THREE_OF_A_KIND, tiebreakers: [groups[0][0], ...groups.slice(1).map((g) => g[0])], cards }
  if (groupCounts[0] === 2 && groupCounts[1] === 2) return { category: CATEGORY.TWO_PAIR, tiebreakers: [groups[0][0], groups[1][0], groups[2][0]], cards }
  if (groupCounts[0] === 2) return { category: CATEGORY.PAIR, tiebreakers: [groups[0][0], ...groups.slice(1).map((g) => g[0])], cards }
  return { category: CATEGORY.HIGH_CARD, tiebreakers: ranksDesc, cards }
}

export function compareHands(a: HandValue, b: HandValue): number {
  if (a.category !== b.category) return a.category - b.category
  for (let i = 0; i < Math.max(a.tiebreakers.length, b.tiebreakers.length); i++) {
    const diff = (a.tiebreakers[i] ?? 0) - (b.tiebreakers[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

function combinations5(cards: Card[]): Card[][] {
  const results: Card[][] = []
  function backtrack(start: number, current: Card[]) {
    if (current.length === 5) {
      results.push(current.slice())
      return
    }
    for (let i = start; i < cards.length; i++) {
      current.push(cards[i])
      backtrack(i + 1, current)
      current.pop()
    }
  }
  backtrack(0, [])
  return results
}

/** Trova la miglior mano da 5 carte tra tutte quelle disponibili (usato da Texas Hold'em: 2 in mano + 5 comuni). */
export function bestHand(cards: Card[]): HandValue {
  if (cards.length === 5) return evaluate5(cards)
  let best: HandValue | null = null
  for (const combo of combinations5(cards)) {
    const value = evaluate5(combo)
    if (!best || compareHands(value, best) > 0) best = value
  }
  return best!
}
