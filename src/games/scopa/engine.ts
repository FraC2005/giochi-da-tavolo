/**
 * Motore della Scopa (mazzo italiano da 40 carte), per 2 giocatori (testa a testa) o 4 (due
 * coppie, compagni seduti "di fronte": posti 0+2 contro 1+3). Una sola "mano" completa del
 * mazzo, poi si contano i punti (non si gioca a più mani fino a un punteggio target):
 * - si parte con 3 carte a testa e 4 carte scoperte sul tavolo;
 * - a turno si gioca una carta: se sul tavolo c'è una carta dello stesso valore, la presa di
 *   quella carta è obbligatoria (si sceglie quale, se ce n'è più di una dello stesso valore);
 *   altrimenti, se una o più combinazioni di carte sul tavolo hanno somma pari al valore
 *   giocato, la presa è comunque obbligatoria e si sceglie quale combinazione prendere;
 *   se nessuna presa è possibile, la carta resta scoperta sul tavolo;
 *   la carta giocata si aggiunge sempre alle carte prese, insieme a quelle catturate;
 * - "scopa": se una presa svuota completamente il tavolo, vale un punto bonus — tranne
 *   sull'ultima carta giocata dell'intera partita, che non conta mai come scopa;
 * - quando tutti finiscono le carte in mano e il mazzo non è ancora esaurito, si pescano altre
 *   3 carte a testa; quando il mazzo finisce, le carte rimaste sul tavolo vanno a chi ha fatto
 *   l'ultima presa;
 * - punti di fine mano: 1 per ogni scopa, +1 a chi ha preso più carte in totale, +1 a chi ha
 *   preso più carte di denari, +1 a chi ha preso il 7 di denari ("settebello"), +1 a chi ha la
 *   "primiera" migliore (per ogni seme, il punteggio della carta più alta secondo la scala
 *   primiera: 7=21, 6=18, Asso=16, 5=15, 4=14, 3=13, 2=12, figure=10).
 */

import { buildDeck, sameCard, shuffled, SUITS, type Card, type Rank } from '../cards/italianDeck'

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

/** Tutti i sottoinsiemi non vuoti di `cards` la cui somma dei valori fa `target` (il valore giocato è al massimo 10, quindi resta velocissimo). */
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

/**
 * Le prese possibili per una carta di valore `rank` sul tavolo attuale: se c'è un valore
 * uguale, solo quelle sono legali (una singola carta a scelta); altrimenti tutte le
 * combinazioni la cui somma è `rank`. Array vuoto = nessuna presa possibile.
 */
export function legalCaptures(table: Card[], rank: Rank): Card[][] {
  const singleMatches = table.filter((c) => c.rank === rank)
  if (singleMatches.length > 0) return singleMatches.map((c) => [c])
  return sumSubsets(table, rank)
}

/** Applica la giocata di `seat` (deve essere il suo turno, avere la carta in mano, e `capture` deve essere una delle opzioni di legalCaptures). */
export function playCard(state: ScopaState, seat: number, card: Card, capture: Card[]): ScopaState {
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

/** Punteggio di fine mano per posto (in 4 giocatori, le coppie 0+2 e 1+3 condividono lo stesso punteggio). */
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
