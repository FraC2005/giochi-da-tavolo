import { describe, expect, it } from 'vitest'
import type { Card } from '../cards/frenchDeck'
import {
  applyAction, ANTE, BIG_BLIND, createGame, discardAndDraw, SMALL_BLIND, STARTING_STACK,
  type PokerPlayer, type PokerState,
} from './engine'

const card = (suit: Card['suit'], rank: Card['rank']): Card => ({ suit, rank })

function player(overrides: Partial<PokerPlayer> = {}): PokerPlayer {
  return { stack: 1000, hand: [], contributed: 0, betThisStreet: 0, folded: false, allIn: false, acted: false, exchanged: false, ...overrides }
}

function stateWith(overrides: Partial<PokerState> & { players: PokerPlayer[] }): PokerState {
  return {
    variant: 'holdem', community: [], deck: [], currentBet: 0, minRaise: BIG_BLIND, dealer: 0, turn: 0,
    phase: 'preflop', status: 'playing', results: null, ...overrides,
  }
}

describe('createGame: Texas Hold\'em', () => {
  it('deals 2 hole cards each and posts small/big blind, heads-up (dealer posts small blind)', () => {
    const game = createGame('holdem', 2, 0)
    expect(game.players[0].hand).toHaveLength(2)
    expect(game.players[1].hand).toHaveLength(2)
    expect(game.players[0].contributed).toBe(SMALL_BLIND) // dealer = small blind, testa a testa
    expect(game.players[1].contributed).toBe(BIG_BLIND)
    expect(game.currentBet).toBe(BIG_BLIND)
    expect(game.turn).toBe(0) // testa a testa: il piccolo buio (mazziere) agisce per primo prima del flop
    expect(game.deck).toHaveLength(52 - 4)
  })

  it('with 4 players, blinds sit after the dealer and the first to act is after the big blind', () => {
    const game = createGame('holdem', 4, 0)
    expect(game.players[1].contributed).toBe(SMALL_BLIND)
    expect(game.players[2].contributed).toBe(BIG_BLIND)
    expect(game.turn).toBe(3)
  })

  it('never deals the same card twice', () => {
    const game = createGame('holdem', 6, 0)
    const all = [...game.players.flatMap((p) => p.hand), ...game.deck]
    expect(new Set(all.map((c) => `${c.suit}-${c.rank}`)).size).toBe(52)
  })
})

describe('createGame: Poker all\'italiana (draw)', () => {
  it('deals 5 cards each and collects an ante from everyone', () => {
    const game = createGame('draw', 3, 0)
    game.players.forEach((p) => {
      expect(p.hand).toHaveLength(5)
      expect(p.contributed).toBe(ANTE)
      expect(p.stack).toBe(STARTING_STACK - ANTE)
    })
    expect(game.currentBet).toBe(0)
    expect(game.turn).toBe(1) // si parte da dopo il mazziere
  })
})

describe('betting: a full round closes and deals the next street', () => {
  it('advances from preflop to the flop once both heads-up players have matched the bet', () => {
    let state = stateWith({
      players: [
        player({ contributed: SMALL_BLIND, betThisStreet: SMALL_BLIND, stack: 990 }),
        player({ contributed: BIG_BLIND, betThisStreet: BIG_BLIND, stack: 980 }),
      ],
      currentBet: BIG_BLIND,
      minRaise: BIG_BLIND,
      turn: 0,
      deck: [card('hearts', 7), card('diamonds', 8), card('clubs', 9), card('spades', 10), card('hearts', 2)],
    })

    state = applyAction(state, 0, { type: 'checkCall' }) // il piccolo buio pareggia
    expect(state.turn).toBe(1)
    expect(state.phase).toBe('preflop')

    state = applyAction(state, 1, { type: 'checkCall' }) // il grande buio, già in pari, passa
    expect(state.phase).toBe('flop')
    expect(state.community).toEqual([card('hearts', 7), card('diamonds', 8), card('clubs', 9)])
    expect(state.currentBet).toBe(0)
    expect(state.players.every((p) => p.betThisStreet === 0)).toBe(true)
    expect(state.turn).toBe(1) // dopo il flop, testa a testa: agisce per primo il grande buio
  })

  it('a raise reopens the action for players who had already matched the previous bet', () => {
    const state = stateWith({
      players: [
        player({ betThisStreet: 0, acted: false }), // seat 0 = UTG, deve ancora agire
        player({ betThisStreet: SMALL_BLIND, contributed: SMALL_BLIND, acted: true }),
        player({ betThisStreet: BIG_BLIND, contributed: BIG_BLIND, acted: true }),
      ],
      currentBet: BIG_BLIND,
      minRaise: BIG_BLIND,
      turn: 0,
    })
    const next = applyAction(state, 0, { type: 'raiseTo', amount: 60 })
    expect(next.currentBet).toBe(60)
    expect(next.minRaise).toBe(40) // rilancio di 40 sopra i 20 del grande buio
    expect(next.players[0].acted).toBe(true)
    expect(next.players[1].acted).toBe(false) // deve rispondere di nuovo al rilancio
    expect(next.players[2].acted).toBe(false)
    expect(next.turn).toBe(1)
  })
})

describe('folding down to one player ends the hand immediately', () => {
  it('awards the whole pot to the last player standing, without a showdown', () => {
    const state = stateWith({
      players: [
        player({ contributed: 30, betThisStreet: 30, stack: 970 }),
        player({ contributed: 30, betThisStreet: 30, stack: 970 }),
      ],
      currentBet: 30,
      turn: 0,
    })
    const next = applyAction(state, 0, { type: 'fold' })
    expect(next.status).toBe('finished')
    expect(next.results).toEqual([{ seat: 1, amount: 60, hand: null, categoryLabel: null }])
    expect(next.players[1].stack).toBe(970 + 60)
  })
})

describe('Poker all\'italiana: discardAndDraw', () => {
  it('swaps only the discarded cards and moves to the next player, then opens the second betting round once everyone has exchanged', () => {
    const state = stateWith({
      variant: 'draw',
      phase: 'exchange',
      players: [
        player({ hand: [card('hearts', 2), card('hearts', 3), card('hearts', 4), card('clubs', 9), card('clubs', 10)] }),
        player({ hand: [card('spades', 5), card('spades', 6), card('spades', 7), card('diamonds', 11), card('diamonds', 12)] }),
      ],
      deck: [card('hearts', 14), card('clubs', 13), card('diamonds', 6)],
      dealer: 0,
      turn: 0,
    })

    let next = discardAndDraw(state, 0, [3, 4]) // seat 0 scarta le due carte spaiate
    expect(next.players[0].hand).toEqual([card('hearts', 2), card('hearts', 3), card('hearts', 4), card('hearts', 14), card('clubs', 13)])
    expect(next.players[0].exchanged).toBe(true)
    expect(next.turn).toBe(1)
    expect(next.phase).toBe('exchange') // seat 1 deve ancora cambiare le carte

    next = discardAndDraw(next, 1, [3])
    expect(next.players[1].hand).toContainEqual(card('diamonds', 6))
    expect(next.phase).toBe('bet2')
    expect(next.currentBet).toBe(0)
    expect(next.players.every((p) => p.betThisStreet === 0)).toBe(true)
  })
})

describe('showdown with side pots', () => {
  it('splits the pot into layers by all-in amount, each won only by the hands still eligible for it', () => {
    // A e B sono già a tappeto per 500, C va a tappeto per 300 (meno degli altri), D si è ritirato dopo aver messo 200.
    const community5 = [card('hearts', 9), card('diamonds', 9), card('clubs', 9), card('spades', 13), card('hearts', 2)]
    const state = stateWith({
      players: [
        player({ hand: [card('hearts', 13), card('diamonds', 12)], contributed: 500, betThisStreet: 500, stack: 0, allIn: true, acted: true }), // A: poker di 9 no... full, Re + Donna
        player({ hand: [card('diamonds', 4), card('spades', 6)], contributed: 500, betThisStreet: 500, stack: 0, allIn: true, acted: true }), // B: tris di 9 con Re e 6
        player({ hand: [card('spades', 9), card('clubs', 14)], contributed: 0, betThisStreet: 0, stack: 300, allIn: false, acted: false }), // C: poker di 9
        player({ hand: [], contributed: 200, betThisStreet: 200, stack: 800, allIn: false, folded: true, acted: true }), // D: ritirato
      ],
      currentBet: 500,
      minRaise: 500,
      dealer: 0,
      turn: 2,
      deck: community5,
    })

    const next = applyAction(state, 2, { type: 'checkCall' }) // C chiama, a tappeto per tutto quello che ha: scatta lo showdown automatico

    expect(next.status).toBe('finished')
    expect(next.community).toEqual(community5)
    expect(next.results).toHaveLength(3) // D si è ritirato, non compare tra i risultati

    // piatto totale 500+500+300+200 = 1500, diviso in strati da 800 (0-200 × 4 giocatori), 300 (200-300 × 3) e 400 (300-500 × 2)
    // C ha il poker di 9 (batte tutti): vince i primi due strati (800+300=1100), eleggibile solo fino al suo tappeto di 300
    // tra A e B, resta lo strato più alto (400): A ha il full (batte il tris di B) e lo vince
    expect(next.players[2].stack).toBe(1100)
    expect(next.players[0].stack).toBe(400)
    expect(next.players[1].stack).toBe(0)
    expect(next.players[3].stack).toBe(800) // D non tocca: il suo stack (fuori dal piatto) resta quello che aveva

    // nessuna fiche creata o persa: gli stack finali sommano quanto c'era in gioco (stack + contributi) prima dello showdown
    const total = next.players.reduce((sum, p) => sum + p.stack, 0)
    expect(total).toBe(1100 + 1200) // stack (0+0+300+800) più contributi al piatto (500+500+0+200), prima della chiamata di C
  })
})
