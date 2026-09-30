import { describe, expect, it } from 'vitest'
import { createGame, legalMoves, playMove } from './engine'

describe('setup', () => {
  it('starts with an empty board and X to move', () => {
    const game = createGame()
    expect(game.board).toEqual(new Array(9).fill(null))
    expect(game.turn).toBe('X')
    expect(legalMoves(game)).toHaveLength(9)
  })
})

describe('playing moves', () => {
  it('places the mark, switches turn, and shrinks the legal moves', () => {
    const game = createGame()
    const next = playMove(game, 4)
    expect(next.board[4]).toBe('X')
    expect(next.turn).toBe('O')
    expect(legalMoves(next)).toHaveLength(8)
    expect(next.status).toBe('playing')
  })

  it('refuses to overwrite an occupied cell via legalMoves', () => {
    const game = playMove(createGame(), 0)
    expect(legalMoves(game)).not.toContain(0)
  })
})

describe('win detection', () => {
  it('detects a horizontal win for X', () => {
    let game = createGame()
    game = playMove(game, 0) // X
    game = playMove(game, 3) // O
    game = playMove(game, 1) // X
    game = playMove(game, 4) // O
    game = playMove(game, 2) // X wins top row
    expect(game.status).toBe('x-won')
    expect(game.winningLine).toEqual([0, 1, 2])
    expect(legalMoves(game)).toHaveLength(0)
  })

  it('detects a diagonal win for O', () => {
    let game = createGame()
    game = playMove(game, 1) // X
    game = playMove(game, 0) // O
    game = playMove(game, 2) // X
    game = playMove(game, 4) // O
    game = playMove(game, 6) // X
    game = playMove(game, 8) // O wins diagonal
    expect(game.status).toBe('o-won')
    expect(game.winningLine).toEqual([0, 4, 8])
  })

  it('detects a draw when the board fills with no line', () => {
    let game = createGame()
    // X O X
    // X O O
    // O X X
    const order = [0, 1, 2, 4, 3, 5, 7, 6, 8]
    for (const i of order) game = playMove(game, i)
    expect(game.status).toBe('draw')
    expect(game.winningLine).toBeNull()
  })
})
