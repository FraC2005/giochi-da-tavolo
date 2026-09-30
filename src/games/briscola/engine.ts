/**
 * Motore della Briscola (mazzo italiano da 40 carte), per 2 giocatori (testa a testa) o 4
 * (due coppie, compagni seduti "di fronte": posti 0+2 contro 1+3):
 * - si può giocare qualunque carta in mano, senza obbligo di rispondere al seme;
 * - vince la presa la carta di briscola più forte; se nessuno gioca briscola, vince la carta più
 *   forte del seme di chi ha giocato per primo; le carte degli altri semi non contano mai;
 * - forza delle carte (dalla più alla meno forte): Asso, 3, Re, Cavallo, Fante, 7, 6, 5, 4, 2;
 * - punti delle carte: Asso 11, 3 vale 10, Re 4, Cavallo 3, Fante 2, le altre 0 (120 punti totali);
 * - chi vince una presa pesca per primo (poi gli altri in ordine), finché il mazzo non finisce;
 * - l'ultima carta pescata è quella mostrata a inizio partita per indicare il seme di briscola;
 * - a mazzo esaurito si giocano le ultime prese senza pescare; vince chi (o la coppia che) ha più
 *   punti a fine partita; 60 punti pari per squadra/giocatore è parità.
 */

import { buildDeck, sameCard, shuffled, type Card, type Rank, type Suit } from '../cards/italianDeck'

export type PlayerCount = 2 | 4

export interface BriscolaState {
  players: PlayerCount
  hands: Card[][]
  deck: Card[]
  briscola: Suit
  briscolaCard: Card
  table: (Card | null)[]
  leader: number
  turn: number
  points: number[]
  wonCards: Card[][]
  trickCount: number
  lastTrick: { cards: Card[]; winner: number } | null
  status: 'playing' | 'finished'
}

const STRENGTH_ORDER: Rank[] = [1, 3, 10, 9, 8, 7, 6, 5, 4, 2]
const POINTS: Record<Rank, number> = { 1: 11, 3: 10, 10: 4, 9: 3, 8: 2, 7: 0, 6: 0, 5: 0, 4: 0, 2: 0 }

export const cardPoints = (rank: Rank) => POINTS[rank]
const strengthIndex = (rank: Rank) => STRENGTH_ORDER.indexOf(rank)

export function createGame(players: PlayerCount): BriscolaState {
  const deckShuffled = shuffled(buildDeck())
  const hands: Card[][] = Array.from({ length: players }, () => [])
  let i = 0
  for (let round = 0; round < 3; round++) for (let seat = 0; seat < players; seat++) hands[seat].push(deckShuffled[i++])
  const briscolaCard = deckShuffled[i]
  const deck = [...deckShuffled.slice(i + 1), briscolaCard] // pescata dal fronte: briscolaCard è l'ultima

  return {
    players,
    hands,
    deck,
    briscola: briscolaCard.suit,
    briscolaCard,
    table: new Array(players).fill(null),
    leader: 0,
    turn: 0,
    points: new Array(players).fill(0),
    wonCards: Array.from({ length: players }, () => []),
    trickCount: 0,
    lastTrick: null,
    status: 'playing',
  }
}

/** true se `challenger` prende la mano su `current` (entrambe già sul tavolo, `current` conta sempre). */
function beats(challenger: Card, current: Card, leadSuit: Suit, briscola: Suit): boolean {
  const challengerCounts = challenger.suit === leadSuit || challenger.suit === briscola
  if (!challengerCounts) return false
  const challengerIsBriscola = challenger.suit === briscola
  const currentIsBriscola = current.suit === briscola
  if (challengerIsBriscola && !currentIsBriscola) return true
  if (!challengerIsBriscola && currentIsBriscola) return false
  if (challenger.suit !== current.suit) return false // stesso seme "di apertura", niente briscola in gioco
  return strengthIndex(challenger.rank) < strengthIndex(current.rank)
}

function resolveTrick(table: Card[], leader: number, briscola: Suit): number {
  const leadSuit = table[leader].suit
  let winner = leader
  for (let offset = 1; offset < table.length; offset++) {
    const seat = (leader + offset) % table.length
    if (beats(table[seat], table[winner], leadSuit, briscola)) winner = seat
  }
  return winner
}

/** Applica la giocata di `seat` (deve essere il suo turno e avere la carta in mano) e restituisce il nuovo stato. */
export function playCard(state: BriscolaState, seat: number, card: Card): BriscolaState {
  const hands = state.hands.map((hand, i) => (i === seat ? hand.filter((c) => !sameCard(c, card)) : hand))
  const table = state.table.slice()
  table[seat] = card
  const nextTurn = (seat + 1) % state.players

  if (table.some((c) => c === null)) {
    return { ...state, hands, table, turn: nextTurn }
  }

  const completedTrick = table as Card[]
  const winner = resolveTrick(completedTrick, state.leader, state.briscola)
  const trickPoints = completedTrick.reduce((sum, c) => sum + cardPoints(c.rank), 0)
  const points = state.points.slice()
  points[winner] += trickPoints
  const wonCards = state.wonCards.map((won, i) => (i === winner ? [...won, ...completedTrick] : won))

  const deck = state.deck.slice()
  const drawnHands = hands.map((hand) => hand.slice())
  for (let offset = 0; offset < state.players; offset++) {
    if (deck.length === 0) break
    const seatToDraw = (winner + offset) % state.players
    drawnHands[seatToDraw] = [...drawnHands[seatToDraw], deck.shift()!]
  }

  const status = drawnHands.every((hand) => hand.length === 0) ? 'finished' : 'playing'

  return {
    ...state,
    hands: drawnHands,
    deck,
    table: new Array(state.players).fill(null),
    leader: winner,
    turn: winner,
    points,
    wonCards,
    trickCount: state.trickCount + 1,
    lastTrick: { cards: completedTrick, winner },
    status,
  }
}

export interface BriscolaOutcome { winners: number[]; draw: boolean }

/** Chi ha vinto a fine partita: per 4 giocatori confronta le coppie (posti 0+2 contro 1+3). */
export function outcome(state: BriscolaState): BriscolaOutcome | null {
  if (state.status !== 'finished') return null
  if (state.players === 2) {
    if (state.points[0] === state.points[1]) return { winners: [], draw: true }
    return { winners: [state.points[0] > state.points[1] ? 0 : 1], draw: false }
  }
  const teamA = state.points[0] + state.points[2]
  const teamB = state.points[1] + state.points[3]
  if (teamA === teamB) return { winners: [], draw: true }
  return { winners: teamA > teamB ? [0, 2] : [1, 3], draw: false }
}
