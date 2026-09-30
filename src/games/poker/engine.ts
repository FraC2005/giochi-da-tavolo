/**
 * Motore del Poker, per 2-6 giocatori: Texas Hold'em (carte comuni, 4 giri di puntate) oppure
 * Poker all'italiana a 5 carte (mano privata, un cambio carte, 2 giri di puntate). Una sola mano
 * per partita (stack, bui e piatto ripartono da zero a ogni rivincita, non si gioca a torneo).
 *
 * Puntate no-limit semplificate: un'azione di rilancio ("raiseTo") specifica il livello totale a
 * cui portare la propria puntata in questa fase, non l'incremento. Un rilancio, anche se "corto"
 * (all-in per meno del rilancio minimo), riapre sempre l'azione per gli altri: è una
 * semplificazione rispetto alla regola rigorosa da casinò, scelta per restare giocabile senza
 * dover distinguere i casi limite. I piatti laterali per gli all-in sono invece calcolati con
 * l'algoritmo standard, per restare corretti quando gli stack non sono tutti uguali.
 */

import { buildDeck, shuffled, type Card } from '../cards/frenchDeck'
import { bestHand, CATEGORY_LABEL, compareHands, type HandValue } from './handEval'

export type PokerVariant = 'holdem' | 'draw'
export type PlayerCount = 2 | 3 | 4 | 5 | 6
export type Phase = 'preflop' | 'flop' | 'turn' | 'river' | 'bet1' | 'exchange' | 'bet2' | 'showdown'

export const STARTING_STACK = 1000
export const SMALL_BLIND = 10
export const BIG_BLIND = 20
export const ANTE = 10

export interface PokerPlayer {
  stack: number
  hand: Card[]
  contributed: number
  betThisStreet: number
  folded: boolean
  allIn: boolean
  acted: boolean
  exchanged: boolean
}

export interface PokerResult { seat: number; amount: number; hand: HandValue | null; categoryLabel: string | null }

export interface PokerState {
  variant: PokerVariant
  players: PokerPlayer[]
  community: Card[]
  deck: Card[]
  currentBet: number
  minRaise: number
  dealer: number
  turn: number
  phase: Phase
  status: 'playing' | 'finished'
  results: PokerResult[] | null
}

const seatsInOrder = (n: number, start: number): number[] => Array.from({ length: n }, (_, i) => (start + i) % n)

function firstActingSeat(players: PokerPlayer[], order: number[]): number {
  return order.find((s) => !players[s].folded && !players[s].allIn) ?? order[0]
}

function drawN(deck: Card[], n: number): { cards: Card[]; deck: Card[] } {
  return { cards: deck.slice(0, n), deck: deck.slice(n) }
}

export function totalPot(state: PokerState): number {
  return state.players.reduce((sum, p) => sum + p.contributed, 0)
}

export function createGame(variant: PokerVariant, playerCount: PlayerCount, dealer = 0): PokerState {
  const deck0 = shuffled(buildDeck())
  const players: PokerPlayer[] = Array.from({ length: playerCount }, () => ({
    stack: STARTING_STACK, hand: [], contributed: 0, betThisStreet: 0, folded: false, allIn: false, acted: false, exchanged: false,
  }))

  const dealCount = variant === 'holdem' ? 2 : 5
  let deck = deck0
  for (let round = 0; round < dealCount; round++) {
    for (let seat = 0; seat < playerCount; seat++) {
      players[seat].hand.push(deck[0])
      deck = deck.slice(1)
    }
  }

  let state: PokerState = {
    variant, players, community: [], deck, currentBet: 0, minRaise: BIG_BLIND, dealer, turn: 0,
    phase: variant === 'holdem' ? 'preflop' : 'bet1', status: 'playing', results: null,
  }

  if (variant === 'holdem') {
    const sbSeat = playerCount === 2 ? dealer : (dealer + 1) % playerCount
    const bbSeat = playerCount === 2 ? (dealer + 1) % playerCount : (dealer + 2) % playerCount
    state = postForced(state, [{ seat: sbSeat, amount: SMALL_BLIND }, { seat: bbSeat, amount: BIG_BLIND }])
    state.currentBet = BIG_BLIND
    const start = playerCount === 2 ? dealer : (dealer + 3) % playerCount
    state.turn = firstActingSeat(state.players, seatsInOrder(playerCount, start))
  } else {
    state = postForced(state, Array.from({ length: playerCount }, (_, seat) => ({ seat, amount: ANTE })))
    state.turn = firstActingSeat(state.players, seatsInOrder(playerCount, (dealer + 1) % playerCount))
  }

  return state
}

function postForced(state: PokerState, posts: { seat: number; amount: number }[]): PokerState {
  const players = state.players.map((p) => ({ ...p }))
  for (const { seat, amount } of posts) {
    const p = players[seat]
    const pay = Math.min(amount, p.stack)
    p.stack -= pay
    p.contributed += pay
    p.betThisStreet += pay
    if (p.stack === 0) p.allIn = true
  }
  return { ...state, players }
}

export type Action = { type: 'fold' } | { type: 'checkCall' } | { type: 'raiseTo'; amount: number }

export interface LegalActions {
  canCheck: boolean
  canCall: boolean
  callAmount: number
  canRaise: boolean
  minRaiseTo: number
  maxRaiseTo: number
}

export function legalActions(state: PokerState, seat: number): LegalActions {
  const p = state.players[seat]
  const toCall = Math.max(0, state.currentBet - p.betThisStreet)
  const maxRaiseTo = p.betThisStreet + p.stack
  return {
    canCheck: toCall === 0,
    canCall: toCall > 0,
    callAmount: Math.min(toCall, p.stack),
    canRaise: p.stack > toCall,
    minRaiseTo: Math.min(state.currentBet + state.minRaise, maxRaiseTo),
    maxRaiseTo,
  }
}

export function applyAction(state: PokerState, seat: number, action: Action): PokerState {
  if (state.status !== 'playing' || state.turn !== seat) return state
  if (state.phase === 'exchange') return state // in questa fase si usa discardAndDraw, non applyAction
  const player = state.players[seat]
  const originalBet = state.currentBet
  let currentBet = state.currentBet
  let minRaise = state.minRaise
  const updated: PokerPlayer = { ...player }
  let isRaise = false

  if (action.type === 'fold') {
    updated.folded = true
    updated.acted = true
  } else if (action.type === 'checkCall') {
    const toCall = Math.min(currentBet - player.betThisStreet, player.stack)
    updated.stack -= toCall
    updated.contributed += toCall
    updated.betThisStreet += toCall
    updated.allIn = updated.stack === 0
    updated.acted = true
  } else {
    const target = Math.min(action.amount, player.betThisStreet + player.stack)
    const additional = Math.max(0, target - player.betThisStreet)
    updated.stack -= additional
    updated.contributed += additional
    updated.betThisStreet = player.betThisStreet + additional
    updated.allIn = updated.stack === 0
    updated.acted = true
    isRaise = updated.betThisStreet > originalBet
    if (isRaise) {
      const increment = updated.betThisStreet - originalBet
      if (increment >= minRaise) minRaise = increment
      currentBet = updated.betThisStreet
    }
  }

  const players = state.players.map((p, i) => {
    if (i === seat) return updated
    if (isRaise && !p.folded && !p.allIn) return { ...p, acted: false } // un rilancio riapre l'azione per gli altri
    return p
  })

  return advanceTurnOrStreet({ ...state, players, currentBet, minRaise })
}

/** Nella fase 'exchange' del Poker all'italiana: scarta le carte agli indici dati e ne pesca altrettante. */
export function discardAndDraw(state: PokerState, seat: number, discardIndices: number[]): PokerState {
  if (state.status !== 'playing' || state.phase !== 'exchange' || state.turn !== seat) return state
  const player = state.players[seat]
  if (player.folded || player.exchanged) return state
  const keep = player.hand.filter((_, i) => !discardIndices.includes(i))
  const { cards: drawn, deck } = drawN(state.deck, discardIndices.length)
  const updated: PokerPlayer = { ...player, hand: [...keep, ...drawn], exchanged: true }
  const players = state.players.map((p, i) => (i === seat ? updated : p))
  let next: PokerState = { ...state, players, deck }

  const n = players.length
  const remaining = seatsInOrder(n, (seat + 1) % n).find((s) => !players[s].folded && !players[s].exchanged)
  if (remaining !== undefined) {
    next.turn = remaining
    return next
  }
  // tutti hanno cambiato le carte: si passa al secondo giro di puntate
  next = resetStreet(next)
  next.phase = 'bet2'
  next.turn = firstActingSeat(next.players, seatsInOrder(n, (next.dealer + 1) % n))
  return maybeAutoRunOut(next)
}

function advanceTurnOrStreet(state: PokerState): PokerState {
  const stillIn = state.players.filter((p) => !p.folded)
  if (stillIn.length === 1) return resolveUncontested(state)

  const n = state.players.length
  const order = seatsInOrder(n, (state.turn + 1) % n)
  const nextSeat = order.find((s) => !state.players[s].folded && !state.players[s].allIn && !state.players[s].acted)
  if (nextSeat !== undefined) return { ...state, turn: nextSeat }

  return advanceStreet(state)
}

function resetStreet(state: PokerState): PokerState {
  const players = state.players.map((p) => ({ ...p, betThisStreet: 0, acted: p.folded || p.allIn }))
  return { ...state, players, currentBet: 0, minRaise: BIG_BLIND }
}

function advanceStreet(state: PokerState): PokerState {
  let next = resetStreet(state)
  const n = next.players.length

  if (next.variant === 'holdem') {
    if (state.phase === 'preflop') {
      const { cards, deck } = drawN(next.deck, 3)
      next = { ...next, community: [...next.community, ...cards], deck, phase: 'flop' }
    } else if (state.phase === 'flop') {
      const { cards, deck } = drawN(next.deck, 1)
      next = { ...next, community: [...next.community, ...cards], deck, phase: 'turn' }
    } else if (state.phase === 'turn') {
      const { cards, deck } = drawN(next.deck, 1)
      next = { ...next, community: [...next.community, ...cards], deck, phase: 'river' }
    } else {
      return resolveShowdown(next)
    }
    next.turn = firstActingSeat(next.players, seatsInOrder(n, (next.dealer + 1) % n))
    return maybeAutoRunOut(next)
  }

  // variante "draw": dopo il primo giro di puntate si passa allo scambio carte (gestito da discardAndDraw);
  // dopo il secondo giro di puntate (post-scambio) si va invece direttamente allo showdown.
  if (state.phase === 'bet1') {
    next = { ...next, phase: 'exchange' }
    next.turn = firstActingSeat(next.players, seatsInOrder(n, (next.dealer + 1) % n))
    return next
  }
  return resolveShowdown(next)
}

/** Se resta al massimo un giocatore che può ancora scegliere (gli altri sono a tappeto), completa la mano senza altre puntate. */
function maybeAutoRunOut(state: PokerState): PokerState {
  const canAct = state.players.filter((p) => !p.folded && !p.allIn).length
  if (canAct > 1) return state
  if (state.variant === 'holdem' && state.phase !== 'showdown') return advanceStreet(state)
  if (state.variant === 'draw' && state.phase === 'bet2') return resolveShowdown(state)
  return state
}

function resolveUncontested(state: PokerState): PokerState {
  const winnerSeat = state.players.findIndex((p) => !p.folded)
  const pot = totalPot(state)
  const players = state.players.map((p, i) => (i === winnerSeat ? { ...p, stack: p.stack + pot } : p))
  return { ...state, players, status: 'finished', phase: 'showdown', results: [{ seat: winnerSeat, amount: pot, hand: null, categoryLabel: null }] }
}

interface PotSlice { amount: number; eligibleSeats: number[] }

function computeSidePots(contributions: number[], folded: boolean[]): PotSlice[] {
  const seats = contributions.map((_, i) => i).filter((i) => contributions[i] > 0)
  const levels = Array.from(new Set(seats.map((i) => contributions[i]))).sort((a, b) => a - b)
  const slices: PotSlice[] = []
  let prev = 0
  let pending = 0
  for (const level of levels) {
    const contributingCount = contributions.filter((c) => c >= level).length
    const amount = (level - prev) * contributingCount + pending
    const eligibleSeats = seats.filter((i) => !folded[i] && contributions[i] >= level)
    if (eligibleSeats.length > 0) {
      slices.push({ amount, eligibleSeats })
      pending = 0
    } else {
      pending = amount
    }
    prev = level
  }
  return slices
}

function resolveShowdown(state: PokerState): PokerState {
  const contributions = state.players.map((p) => p.contributed)
  const folded = state.players.map((p) => p.folded)
  const slices = computeSidePots(contributions, folded)

  const handOf = new Map<number, HandValue>()
  const handFor = (seat: number): HandValue => {
    let cached = handOf.get(seat)
    if (!cached) {
      cached = bestHand([...state.players[seat].hand, ...state.community])
      handOf.set(seat, cached)
    }
    return cached
  }

  const winnings = new Array(state.players.length).fill(0)
  for (const slice of slices) {
    let best: HandValue | null = null
    for (const seat of slice.eligibleSeats) {
      const value = handFor(seat)
      if (!best || compareHands(value, best) > 0) best = value
    }
    const winners = slice.eligibleSeats.filter((seat) => compareHands(handFor(seat), best!) === 0)
    const share = Math.floor(slice.amount / winners.length)
    const remainder = slice.amount - share * winners.length
    winners.forEach((seat, i) => { winnings[seat] += share + (i === 0 ? remainder : 0) })
  }

  const players = state.players.map((p, i) => ({ ...p, stack: p.stack + winnings[i] }))
  const results: PokerResult[] = state.players.flatMap((p, seat) => {
    if (p.folded) return []
    const hand = handFor(seat)
    return [{ seat, amount: winnings[seat], hand, categoryLabel: CATEGORY_LABEL[hand.category] }]
  })

  return { ...state, players, status: 'finished', phase: 'showdown', results }
}
