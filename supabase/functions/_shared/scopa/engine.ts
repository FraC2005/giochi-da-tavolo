/**
 * Copia Deno-compatibile di src/games/scopa/engine.ts — vedi ../cards/shuffle.ts per il perché.
 * Deve restare in sincronia a mano con l'originale: se le regole della Scopa cambiano lì, vanno
 * applicate anche qui.
 */

import { buildDeck, sameCard, shuffled, SUITS, type Card, type Rank } from '../cards/italianDeck.ts'

export type PlayerCount = 2 | 4

export interface ScopaMove { played: Card; captured: Card[]; scopa: boolean }

export interface ScopaState {
  players: PlayerCount
  hands: Card[][]
  deck: Card[]
  table: Card[]
  captured: Card[][]
  scope: number[]
  turn: number
  lastCapturer: number | null
  trickCount: number
  lastMove: ScopaMove | null
  status: 'playing' | 'finished'
}

export function createGame(players: PlayerCount): ScopaState {
  const shuffledDeck = shuffled(buildDeck())
  const hands: Card[][] = Array.from({ length: players }, () => [])
  let i = 0
  for (let round = 0; round < 3; round++) for (let seat = 0; seat < players; seat++) hands[seat].push(shuffledDeck[i++])
  const table = shuffledDeck.slice(i, i + 4)
  const deck = shuffledDeck.slice(i + 4)

  return {
    players,
    hands,
    deck,
    table,
    captured: Array.from({ length: players }, () => []),
    scope: new Array(players).fill(0),
    turn: 0,
    lastCapturer: null,
    trickCount: 0,
    lastMove: null,
    status: 'playing',
  }
}

function sumSubsets(cards: Card[], target: number): Card[][] {
  const results: Card[][] = []
  function backtrack(idx: number, current: Card[], sum: number) {
    if (sum === target && current.length > 0) {
      results.push(current.slice())
      return
    }
    if (idx === cards.length || sum >= target) return
    current.push(cards[idx])
    backtrack(idx + 1, current, sum + cards[idx].rank)
    current.pop()
    backtrack(idx + 1, current, sum)
  }
  backtrack(0, [], 0)
  return results
}

export function legalCaptures(table: Card[], rank: Rank): Card[][] {
  const singleMatches = table.filter((c) => c.rank === rank)
  if (singleMatches.length > 0) return singleMatches.map((c) => [c])
  return sumSubsets(table, rank)
}

function sameCardSet(a: Card[], b: Card[]): boolean {
  if (a.length !== b.length) return false
  const remaining = b.slice()
  for (const card of a) {
    const idx = remaining.findIndex((c) => sameCard(c, card))
    if (idx === -1) return false
    remaining.splice(idx, 1)
  }
  return true
}

export function playCard(state: ScopaState, seat: number, card: Card, capture: Card[]): ScopaState {
  if (state.status !== 'playing' || state.turn !== seat || !state.hands[seat].some((c) => sameCard(c, card))) return state
  const options = legalCaptures(state.table, card.rank)
  const captureIsLegal = options.length === 0 ? capture.length === 0 : options.some((o) => sameCardSet(o, capture))
  if (!captureIsLegal) return state
  const hands = state.hands.map((hand, i) => (i === seat ? hand.filter((c) => !sameCard(c, card)) : hand))
  const capturing = capture.length > 0
  const table = capturing ? state.table.filter((t) => !capture.some((c) => sameCard(c, t))) : [...state.table, card]

  const handsNowEmpty = hands.every((h) => h.length === 0)
  const deckNowEmpty = state.deck.length === 0
  const isLastPlayOfGame = handsNowEmpty && deckNowEmpty
  const isScopa = capturing && table.length === 0 && !isLastPlayOfGame

  const captured = state.captured.map((pile, i) => (i === seat && capturing ? [...pile, card, ...capture] : pile))
  const scope = state.scope.map((s, i) => (i === seat && isScopa ? s + 1 : s))
  const lastCapturer = capturing ? seat : state.lastCapturer
  const lastMove: ScopaMove = { played: card, captured: capturing ? capture : [], scopa: isScopa }
  const turn = (seat + 1) % state.players

  if (isLastPlayOfGame) {
    const finalCaptured = lastCapturer !== null && table.length > 0
      ? captured.map((pile, i) => (i === lastCapturer ? [...pile, ...table] : pile))
      : captured
    return { ...state, hands, deck: state.deck, table: [], captured: finalCaptured, scope, turn, lastCapturer, trickCount: state.trickCount + 1, lastMove, status: 'finished' }
  }

  let nextHands = hands
  let deck = state.deck
  if (handsNowEmpty && deck.length > 0) {
    nextHands = hands.map((h) => h.slice())
    for (let round = 0; round < 3; round++) {
      for (let s = 0; s < state.players; s++) {
        if (deck.length === 0) break
        nextHands[s] = [...nextHands[s], deck[0]]
        deck = deck.slice(1)
      }
    }
  }

  return { ...state, hands: nextHands, deck, table, captured, scope, turn, lastCapturer, trickCount: state.trickCount + 1, lastMove, status: 'playing' }
}

const PRIMIERA_VALUE: Record<Rank, number> = { 7: 21, 6: 18, 1: 16, 5: 15, 4: 14, 3: 13, 2: 12, 8: 10, 9: 10, 10: 10 }

function primieraScore(cards: Card[]): number {
  let total = 0
  for (const suit of SUITS) {
    const bySuit = cards.filter((c) => c.suit === suit)
    if (bySuit.length === 0) continue
    total += Math.max(...bySuit.map((c) => PRIMIERA_VALUE[c.rank]))
  }
  return total
}

export interface ScopaOutcome { winners: number[]; draw: boolean; points: number[] }

export function outcome(state: ScopaState): ScopaOutcome | null {
  if (state.status !== 'finished') return null
  const groups: number[][] = state.players === 2 ? [[0], [1]] : [[0, 2], [1, 3]]
  const tallies = groups.map((seats) => {
    const cards = seats.flatMap((s) => state.captured[s])
    return {
      scope: seats.reduce((sum, s) => sum + state.scope[s], 0),
      cards: cards.length,
      denari: cards.filter((c) => c.suit === 'denari').length,
      settebello: cards.some((c) => c.suit === 'denari' && c.rank === 7),
      primiera: primieraScore(cards),
    }
  })
  const groupPoints = tallies.map((t, gi) => {
    const other = tallies[1 - gi]
    let points = t.scope
    if (t.cards > other.cards) points += 1
    if (t.denari > other.denari) points += 1
    if (t.settebello) points += 1
    if (t.primiera > other.primiera) points += 1
    return points
  })

  const points: number[] = []
  groups.forEach((seats, gi) => seats.forEach((s) => { points[s] = groupPoints[gi] }))

  if (groupPoints[0] === groupPoints[1]) return { winners: [], draw: true, points }
  return { winners: groups[groupPoints[0] > groupPoints[1] ? 0 : 1], draw: false, points }
}

const HIDDEN_CARD: Card = { suit: 'spade', rank: 2 }

export function viewForSeat(state: ScopaState, seat: number): ScopaState {
  return {
    ...state,
    deck: state.deck.map(() => HIDDEN_CARD),
    hands: state.hands.map((hand, i) => (i === seat ? hand : hand.map(() => HIDDEN_CARD))),
  }
}
