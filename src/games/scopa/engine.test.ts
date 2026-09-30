import { describe, expect, it } from 'vitest'
import type { Card } from '../cards/italianDeck'
import { cardId } from '../cards/italianDeck'
import { createGame, legalCaptures, outcome, playCard, type ScopaState } from './engine'

const card = (suit: Card['suit'], rank: Card['rank']): Card => ({ suit, rank })

function stateWith(overrides: Partial<ScopaState> & { hands: Card[][]; table: Card[] }): ScopaState {
  return {
    players: 2,
    deck: [],
    captured: [[], []],
    scope: [0, 0],
    turn: 0,
    lastCapturer: null,
    trickCount: 0,
    lastMove: null,
    status: 'playing',
    ...overrides,
  }
}

describe('setup', () => {
  it('deals 3 cards to each of 2 players, 4 on the table, and keeps the rest in the deck', () => {
    const game = createGame(2)
    expect(game.hands[0]).toHaveLength(3)
    expect(game.hands[1]).toHaveLength(3)
    expect(game.table).toHaveLength(4)
    expect(game.deck).toHaveLength(40 - 6 - 4)
  })

  it('deals 3 cards to each of 4 players', () => {
    const game = createGame(4)
    game.hands.forEach((h) => expect(h).toHaveLength(3))
    expect(game.table).toHaveLength(4)
    expect(game.deck).toHaveLength(40 - 12 - 4)
  })

  it('never duplicates a card across hands, table, and deck', () => {
    const game = createGame(4)
    const all = [...game.hands.flat(), ...game.table, ...game.deck]
    expect(new Set(all.map(cardId)).size).toBe(40)
    expect(all).toHaveLength(40)
  })
})

describe('legalCaptures', () => {
  it('offers each equal-value card on the table as a separate single-card option', () => {
    const table = [card('denari', 5), card('coppe', 5), card('spade', 2)]
    const options = legalCaptures(table, 5)
    expect(options).toHaveLength(2)
    expect(options).toContainEqual([card('denari', 5)])
    expect(options).toContainEqual([card('coppe', 5)])
  })

  it('prefers an exact single match over any sum combination', () => {
    const table = [card('denari', 7), card('coppe', 3), card('spade', 4)] // 3+4 somma anche 7, ma c'è già un 7
    const options = legalCaptures(table, 7)
    expect(options).toEqual([[card('denari', 7)]])
  })

  it('finds every sum combination when there is no exact match', () => {
    const table = [card('coppe', 3), card('spade', 4), card('bastoni', 1), card('denari', 6)]
    const options = legalCaptures(table, 7) // 3+4, e 1+6
    expect(options).toHaveLength(2)
    expect(options.some((o) => o.length === 2 && o.some((c) => c.rank === 3) && o.some((c) => c.rank === 4))).toBe(true)
    expect(options.some((o) => o.length === 2 && o.some((c) => c.rank === 1) && o.some((c) => c.rank === 6))).toBe(true)
  })

  it('returns no options when nothing matches or sums correctly', () => {
    expect(legalCaptures([card('coppe', 9), card('spade', 10)], 4)).toEqual([])
  })
})

describe('playCard', () => {
  it('captures the chosen cards, removes them from the table, and adds them (plus the played card) to the pile', () => {
    let game = stateWith({
      hands: [[card('denari', 7)], [card('spade', 8)]], // seat 1 ha ancora una carta: non è l'ultima giocata della partita
      table: [card('coppe', 3), card('spade', 4), card('bastoni', 9)],
    })
    game = playCard(game, 0, card('denari', 7), [card('coppe', 3), card('spade', 4)])
    expect(game.table).toEqual([card('bastoni', 9)])
    expect(game.captured[0]).toEqual([card('denari', 7), card('coppe', 3), card('spade', 4)])
    expect(game.turn).toBe(1)
  })

  it('leaves the played card face-up on the table when no capture is chosen', () => {
    let game = stateWith({
      hands: [[card('denari', 7)], [card('spade', 8)]], // seat 1 ha ancora una carta: non è l'ultima giocata della partita
      table: [card('coppe', 9)],
    })
    game = playCard(game, 0, card('denari', 7), [])
    expect(game.table).toEqual([card('coppe', 9), card('denari', 7)])
    expect(game.captured[0]).toEqual([])
  })

  it('awards a scopa when a capture clears the whole table (mid-game)', () => {
    let game = stateWith({
      hands: [[card('denari', 7)], [card('spade', 2)]],
      table: [card('coppe', 7)],
      deck: [card('bastoni', 1)], // il mazzo non è vuoto: non è l'ultima giocata della partita
    })
    game = playCard(game, 0, card('denari', 7), [card('coppe', 7)])
    expect(game.table).toEqual([])
    expect(game.scope[0]).toBe(1)
    expect(game.lastMove?.scopa).toBe(true)
  })

  it('does not award a scopa on the very last play of the whole game', () => {
    let game = stateWith({
      hands: [[card('denari', 7)], []], // seat 1 ha già finito le carte, il mazzo è vuoto
      table: [card('coppe', 7)],
      deck: [],
    })
    game = playCard(game, 0, card('denari', 7), [card('coppe', 7)])
    expect(game.table).toEqual([])
    expect(game.scope[0]).toBe(0)
    expect(game.status).toBe('finished')
  })

  it('redeals 3 cards to each player once every hand is empty and the deck still has cards', () => {
    let game = stateWith({
      hands: [[card('denari', 5)], [card('coppe', 9)]],
      table: [card('spade', 2)],
      turn: 1,
      deck: [card('bastoni', 1), card('bastoni', 2), card('bastoni', 3), card('bastoni', 4), card('bastoni', 5), card('bastoni', 6)],
    })
    game = playCard(game, 1, card('coppe', 9), []) // seat 1 gioca la sua ultima carta, ma seat0 ne ha ancora una
    expect(game.hands[0]).toHaveLength(1) // non ridistribuisce finché non sono vuote *entrambe*
    game = playCard(game, 0, card('denari', 5), []) // ora anche seat0 resta senza carte in mano
    expect(game.hands[0]).toHaveLength(3)
    expect(game.hands[1]).toHaveLength(3)
    expect(game.deck).toHaveLength(0)
  })

  it('gives leftover table cards to the last capturer when the game ends', () => {
    let game = stateWith({
      hands: [[card('denari', 5)], []],
      table: [card('coppe', 9), card('spade', 10)], // nessuna presa possibile per un 5
      deck: [],
      lastCapturer: 1,
      captured: [[], [card('bastoni', 6)]],
    })
    game = playCard(game, 0, card('denari', 5), [])
    expect(game.status).toBe('finished')
    expect(game.table).toEqual([])
    // il 5 giocato non cattura nulla, resta sul tavolo, e finisce anche lui a chi ha fatto l'ultima presa
    expect(game.captured[1]).toEqual([card('bastoni', 6), card('coppe', 9), card('spade', 10), card('denari', 5)])
  })
})

describe('outcome', () => {
  it('awards points for cards, denari, settebello, primiera, and scope, and declares the higher total the winner', () => {
    const game = stateWith({
      hands: [[], []],
      table: [],
      status: 'finished',
      scope: [2, 0],
      captured: [
        [card('denari', 7), card('denari', 1), card('coppe', 6)], // settebello + più denari + primiera migliore (21+16 su coppe manca, ma comunque alta)
        [card('spade', 10), card('bastoni', 8)],
      ],
    })
    const result = outcome(game)
    expect(result?.draw).toBe(false)
    expect(result?.winners).toEqual([0])
    // seat0: 2 scope + 1 (più carte: 3 vs 2) + 1 (più denari) + 1 (settebello) + 1 (primiera migliore) = 6
    expect(result?.points[0]).toBe(6)
  })

  it('declares a draw when both sides end with the same total', () => {
    const game = stateWith({
      hands: [[], []],
      table: [],
      status: 'finished',
      captured: [[card('bastoni', 2)], [card('coppe', 2)]], // stesso numero di carte, nessuna delle due di denari, primiera pari
    })
    const result = outcome(game)
    expect(result).toEqual({ winners: [], draw: true, points: [0, 0] })
  })

  it('for 4 players, sums each pair of facing seats as one team', () => {
    const game = stateWith({
      players: 4,
      hands: [[], [], [], []],
      table: [],
      status: 'finished',
      captured: [[card('denari', 7)], [], [card('denari', 1)], []],
      scope: [1, 0, 0, 0],
    })
    const result = outcome(game)
    expect(result?.winners).toEqual([0, 2])
    expect(result?.points[0]).toBe(result?.points[2])
  })

  it('returns null while the game is still in progress', () => {
    const game = stateWith({ hands: [[card('denari', 1)], []], table: [] })
    expect(outcome(game)).toBeNull()
  })
})
