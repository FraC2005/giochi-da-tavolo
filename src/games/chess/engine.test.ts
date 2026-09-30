import { describe, expect, it } from 'vitest'
import { ChessGame } from './engine'

describe('ChessGame wrapper', () => {
  it('rejects illegal moves and accepts legal ones', () => {
    const game = new ChessGame()
    expect(game.tryMove('e2', 'e5')).toBeNull()
    expect(game.tryMove('e2', 'e4')).toEqual({ from: 'e2', to: 'e4', promotion: undefined })
    expect(game.turn).toBe('b')
  })

  it('detects checkmate (Scholar\'s mate) and reports the winner', () => {
    const game = new ChessGame()
    for (const [from, to] of [['e2', 'e4'], ['e7', 'e5'], ['d1', 'h5'], ['b8', 'c6'], ['f1', 'c4'], ['g8', 'f6'], ['h5', 'f7']] as const) {
      expect(game.tryMove(from, to)).not.toBeNull()
    }
    expect(game.status()).toBe('checkmate')
    expect(game.winner()).toBe('w')
    expect(game.inCheck).toBe(true)
  })

  it('flags a promotion choice and lets the player under-promote', () => {
    const moves: [string, string][] = [
      ['a2', 'a4'], ['b8', 'c6'], ['a4', 'a5'], ['c6', 'b8'], ['a5', 'a6'], ['b8', 'c6'],
      ['a6', 'b7'], ['c6', 'a5'], ['b7', 'b8'],
    ]
    const game = new ChessGame()
    for (const [from, to] of moves.slice(0, -1)) expect(game.tryMove(from, to)).not.toBeNull()
    const [from, to] = moves[moves.length - 1]
    expect(game.needsPromotionChoice(from, to)).toBe(true)
    expect(game.tryMove(from, to)).toBeNull() // senza scegliere il pezzo, chess.js rifiuta
    expect(game.tryMove(from, to, 'n')).toEqual({ from, to, promotion: 'n' })
  })

  it('tracks captured pieces by color', () => {
    const game = new ChessGame()
    for (const [from, to] of [['e2', 'e4'], ['d7', 'd5'], ['e4', 'd5']] as const) game.tryMove(from, to)
    expect(game.captured()).toEqual({ w: [], b: ['p'] })
  })

  it('reconstructs identical state from a stored move list (for the online replay)', () => {
    const original = new ChessGame()
    for (const [from, to] of [['g1', 'f3'], ['g8', 'f6'], ['d2', 'd4'], ['d7', 'd5']] as const) original.tryMove(from, to)
    const replay = ChessGame.fromMoves(original.moves)
    expect(replay.fen).toBe(original.fen)
    expect(replay.historySAN()).toEqual(original.historySAN())
  })

  it('rejects a move that is legal in shape but leaves the king in check (pinned piece)', () => {
    // L'alfiere nero in b4 inchioda il cavallo bianco in c3 al proprio re in e1 (diagonale b4-c3-d2-e1, libera).
    const game = new ChessGame()
    for (const [from, to] of [['d2', 'd4'], ['e7', 'e5'], ['b1', 'c3'], ['f8', 'b4']] as const) {
      expect(game.tryMove(from, to)).not.toBeNull()
    }
    expect(game.tryMove('c3', 'd5')).toBeNull() // scoprirebbe lo scacco al re bianco
    expect(game.turn).toBe('w') // la mossa respinta non ha cambiato il turno
    expect(game.legalMovesFrom('c3')).toHaveLength(0) // un cavallo inchiodato non ha alcuna mossa legale
    expect(game.tryMove('g1', 'f3')).not.toBeNull() // un'altra pedina può comunque muoversi
  })
})
