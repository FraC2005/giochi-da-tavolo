import { describe, expect, it } from 'vitest'
import type { Card } from '../cards/italianDeck'
import { buildDeck, cardId } from '../cards/italianDeck'
import { cardPoints, createGame, outcome, playCard, type BriscolaState } from './engine'

const card = (suit: Card['suit'], rank: Card['rank']): Card => ({ suit, rank })

/** Costruisce uno stato a 2 giocatori con mani/mazzo/briscola scelti a mano, per test deterministici. */
function stateWith(overrides: Partial<BriscolaState> & { hands: Card[][] }): BriscolaState {
  return {
    players: 2,
    deck: [],
    briscola: 'denari',
    briscolaCard: card('denari', 4),
    table: [null, null],
    leader: 0,
    turn: 0,
    points: [0, 0],
    wonCards: [[], []],
    trickCount: 0,
    lastTrick: null,
    status: 'playing',
    ...overrides,
  }
}

describe('setup', () => {
  it('deals 3 cards to each of 2 players and keeps the rest (minus the briscola indicator) in the deck', () => {
    const game = createGame(2)
    expect(game.hands).toHaveLength(2)
    expect(game.hands[0]).toHaveLength(3)
    expect(game.hands[1]).toHaveLength(3)
    expect(game.deck).toHaveLength(40 - 6) // 34 carte, l'ultima è la briscolaCard
    expect(game.deck[game.deck.length - 1]).toEqual(game.briscolaCard)
    expect(game.briscola).toBe(game.briscolaCard.suit)
  })

  it('deals 3 cards to each of 4 players', () => {
    const game = createGame(4)
    expect(game.hands).toHaveLength(4)
    game.hands.forEach((h) => expect(h).toHaveLength(3))
    expect(game.deck).toHaveLength(40 - 12)
  })

  it('never duplicates a card across hands, deck, and the briscola indicator', () => {
    const game = createGame(4)
    const all = [...game.hands.flat(), ...game.deck]
    const ids = new Set(all.map(cardId))
    expect(ids.size).toBe(40)
    expect(all).toHaveLength(40)
    expect(buildDeck()).toHaveLength(40)
  })
})

describe('trick resolution', () => {
  it('lets briscola beat a higher card of the leading suit', () => {
    let game = stateWith({
      briscola: 'bastoni',
      hands: [[card('coppe', 1)], [card('bastoni', 2)]], // Asso di coppe vs 2 di bastoni (briscola)
    })
    game = playCard(game, 0, card('coppe', 1))
    game = playCard(game, 1, card('bastoni', 2))
    expect(game.lastTrick?.winner).toBe(1) // la briscola vince anche se debole
    expect(game.points[1]).toBe(11) // prende l'asso, che vale 11
  })

  it('lets the strongest card of the leading suit win when no briscola is played', () => {
    let game = stateWith({
      briscola: 'bastoni',
      hands: [[card('coppe', 4)], [card('coppe', 1)]],
    })
    game = playCard(game, 0, card('coppe', 4))
    game = playCard(game, 1, card('coppe', 1)) // Asso batte il 4 dello stesso seme
    expect(game.lastTrick?.winner).toBe(1)
  })

  it('ignores a card from a third, non-leading, non-briscola suit', () => {
    let game = stateWith({
      briscola: 'bastoni',
      hands: [[card('coppe', 2)], [card('spade', 1)]], // Asso di spade non conta: non è né coppe né bastoni
    })
    game = playCard(game, 0, card('coppe', 2))
    game = playCard(game, 1, card('spade', 1))
    expect(game.lastTrick?.winner).toBe(0)
  })

  it('has no follow-suit obligation: any card in hand is playable', () => {
    let game = stateWith({
      briscola: 'bastoni',
      hands: [[card('coppe', 2), card('bastoni', 7)], [card('spade', 5)]],
    })
    expect(() => playCard(game, 0, card('bastoni', 7))).not.toThrow()
  })
})

describe('drawing after a trick', () => {
  it('lets the trick winner draw first, then refills both hands from the deck', () => {
    let game = stateWith({
      hands: [[card('coppe', 4)], [card('coppe', 1)]],
      deck: [card('spade', 5), card('denari', 6)],
    })
    game = playCard(game, 0, card('coppe', 4))
    game = playCard(game, 1, card('coppe', 1)) // seat 1 vince, pesca per primo
    expect(game.hands[1]).toEqual([card('spade', 5)])
    expect(game.hands[0]).toEqual([card('denari', 6)])
    expect(game.deck).toHaveLength(0)
    expect(game.leader).toBe(1)
    expect(game.turn).toBe(1)
  })
})

describe('end of game', () => {
  it('finishes when both hands and the deck are empty, and declares the higher score the winner', () => {
    let game = stateWith({
      hands: [[card('coppe', 2)], [card('coppe', 1)]],
      points: [50, 55],
    })
    game = playCard(game, 0, card('coppe', 2))
    game = playCard(game, 1, card('coppe', 1))
    expect(game.status).toBe('finished')
    expect(game.points[1]).toBe(55 + cardPoints(2) + cardPoints(1))
    expect(outcome(game)).toEqual({ winners: [1], draw: false })
  })

  it('declares a draw at 60-60', () => {
    let game = stateWith({
      hands: [[card('spade', 4)], [card('bastoni', 6)]],
      points: [60, 60],
    })
    game = playCard(game, 0, card('spade', 4))
    game = playCard(game, 1, card('bastoni', 6))
    expect(game.status).toBe('finished')
    expect(outcome(game)).toEqual({ winners: [], draw: true })
  })

  it('for 4 players, sums the two facing seats as a team', () => {
    let game = stateWith({
      players: 4,
      hands: [[card('coppe', 4)], [card('spade', 5)], [card('coppe', 1)], [card('bastoni', 6)]],
      table: [null, null, null, null],
      points: [10, 20, 15, 5],
      wonCards: [[], [], [], []],
    })
    game = playCard(game, 0, card('coppe', 4))
    game = playCard(game, 1, card('spade', 5))
    game = playCard(game, 2, card('coppe', 1)) // seat 2 vince (Asso di coppe, seme di apertura)
    game = playCard(game, 3, card('bastoni', 6))
    // team 0+2 = 10+15+ punti presa, team 1+3 = 20+5
    const trickPoints = cardPoints(4) + cardPoints(5) + cardPoints(1) + cardPoints(6)
    expect(game.points[2]).toBe(15 + trickPoints)
    expect(outcome(game)).toEqual({ winners: [0, 2], draw: false })
  })
})
