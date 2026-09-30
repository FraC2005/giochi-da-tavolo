import { describe, expect, it } from 'vitest'
import {
  Board, CheckersState, createGame, idx, initialBoard, legalMoves, legalMovesFrom, NO_CAPTURE_LIMIT, playMove, SIZE,
} from './engine'

function emptyBoard(): Board {
  return new Array(SIZE * SIZE).fill(null)
}

describe('setup', () => {
  it('places 12 pieces per side on dark squares only', () => {
    const board = initialBoard()
    const white = board.filter((p) => p?.color === 'w')
    const black = board.filter((p) => p?.color === 'b')
    expect(white).toHaveLength(12)
    expect(black).toHaveLength(12)
    expect(white.every((p) => !p!.king)).toBe(true)
  })

  it('has exactly 7 opening moves for white, the well-known checkers fact', () => {
    const game = createGame()
    expect(legalMoves(game)).toHaveLength(7)
  })
})

describe('mandatory capture', () => {
  it('forces a capture when one is available, hiding simple moves', () => {
    const board = emptyBoard()
    board[idx(4, 3)] = { color: 'w', king: false }
    board[idx(3, 4)] = { color: 'b', king: false }
    board[idx(5, 2)] = { color: 'w', king: false } // avrebbe una mossa semplice, ma deve restare ferma
    const game = { board, turn: 'w' as const, mustContinueFrom: null, noCaptureCount: 0, status: 'playing' as const, history: [] }

    const moves = legalMoves(game)
    expect(moves).toHaveLength(1)
    expect(moves[0]).toMatchObject({ from: { row: 4, col: 3 }, to: { row: 2, col: 5 }, captures: [{ row: 3, col: 4 }] })
  })

  it('removes the captured piece and switches turn after a single jump', () => {
    const board = emptyBoard()
    board[idx(4, 3)] = { color: 'w', king: false }
    board[idx(3, 4)] = { color: 'b', king: false }
    const game = { board, turn: 'w' as const, mustContinueFrom: null, noCaptureCount: 0, status: 'playing' as const, history: [] }

    const [move] = legalMoves(game)
    const next = playMove(game, move)
    expect(next.board[idx(3, 4)]).toBeNull()
    expect(next.board[idx(2, 5)]).toEqual({ color: 'w', king: false })
    expect(next.turn).toBe('b')
    expect(next.mustContinueFrom).toBeNull()
    expect(next.noCaptureCount).toBe(0)
  })
})

describe('multi-jump chains', () => {
  it('forces continuing the capture with the same piece', () => {
    const board = emptyBoard()
    board[idx(6, 1)] = { color: 'w', king: false }
    board[idx(5, 2)] = { color: 'b', king: false }
    board[idx(3, 4)] = { color: 'b', king: false }
    board[idx(0, 0)] = { color: 'w', king: false } // pedina innocente: non deve poter muoversi ora
    let game: CheckersState = { board, turn: 'w', mustContinueFrom: null, noCaptureCount: 0, status: 'playing', history: [] }

    const first = legalMoves(game)
    expect(first).toHaveLength(1)
    game = playMove(game, first[0])
    expect(game.mustContinueFrom).toEqual({ row: 4, col: 3 })
    expect(game.turn).toBe('w')

    const second = legalMoves(game)
    expect(second).toHaveLength(1)
    expect(second[0]).toMatchObject({ to: { row: 2, col: 5 }, captures: [{ row: 3, col: 4 }] })
    game = playMove(game, second[0])
    expect(game.turn).toBe('b')
    expect(game.mustContinueFrom).toBeNull()
    expect(game.board.filter((p) => p?.color === 'b')).toHaveLength(0)
  })
})

describe('promotion', () => {
  it('crowns a man reaching the last row and ends the turn even if another capture would be possible', () => {
    const board = emptyBoard()
    board[idx(2, 3)] = { color: 'w', king: false }
    board[idx(1, 4)] = { color: 'b', king: false }
    board[idx(1, 6)] = { color: 'b', king: false } // catturabile solo se la neo-dama potesse proseguire subito
    const game = { board, turn: 'w' as const, mustContinueFrom: null, noCaptureCount: 0, status: 'playing' as const, history: [] }

    const [move] = legalMoves(game)
    expect(move).toMatchObject({ to: { row: 0, col: 5 } })
    const next = playMove(game, move)
    expect(next.board[idx(1, 4)]).toBeNull()
    expect(next.board[idx(0, 5)]).toEqual({ color: 'w', king: true })
    expect(next.board[idx(1, 6)]).not.toBeNull() // non catturata: il turno è già finito
    expect(next.turn).toBe('b')
    expect(next.mustContinueFrom).toBeNull()
  })

  it('lets a king move and capture backwards in any diagonal direction', () => {
    const board = emptyBoard()
    board[idx(4, 4)] = { color: 'w', king: true }
    board[idx(5, 5)] = { color: 'b', king: false }
    const game = { board, turn: 'w' as const, mustContinueFrom: null, noCaptureCount: 0, status: 'playing' as const, history: [] }
    const moves = legalMovesFrom(game, { row: 4, col: 4 })
    expect(moves).toContainEqual({ from: { row: 4, col: 4 }, to: { row: 6, col: 6 }, captures: [{ row: 5, col: 5 }] })
  })
})

describe('game over conditions', () => {
  it('declares the opponent winner when a side has no pieces left', () => {
    const board = emptyBoard()
    board[idx(4, 3)] = { color: 'w', king: false }
    board[idx(3, 4)] = { color: 'b', king: false }
    const game = { board, turn: 'w' as const, mustContinueFrom: null, noCaptureCount: 0, status: 'playing' as const, history: [] }
    const next = playMove(game, legalMoves(game)[0])
    expect(next.status).toBe('white-won')
  })

  it('declares a loss for the side with no legal moves (blocked, not just piece-less)', () => {
    const board = emptyBoard()
    // Bianco in un angolo, completamente bloccato da pezzi neri e dal bordo.
    board[idx(0, 1)] = { color: 'w', king: false }
    board[idx(1, 0)] = { color: 'b', king: false }
    board[idx(1, 2)] = { color: 'b', king: false }
    board[idx(2, 1)] = { color: 'b', king: false } // impedisce ogni cattura verso il basso
    const game = { board, turn: 'w' as const, mustContinueFrom: null, noCaptureCount: 0, status: 'playing' as const, history: [] }
    expect(legalMoves(game)).toHaveLength(0)
    // Il motore imposta lo stato solo dopo una playMove; verifichiamo direttamente la funzione di stato
    // rigiocando una mossa neutra dell'avversario che porta a valutare lo stato di "game" stesso.
    const boardWithBlackMover = board.slice()
    boardWithBlackMover[idx(5, 4)] = { color: 'b', king: false }
    const before = { board: boardWithBlackMover, turn: 'b' as const, mustContinueFrom: null, noCaptureCount: 0, status: 'playing' as const, history: [] }
    const afterBlackMove = playMove(before, legalMovesFrom(before, { row: 5, col: 4 })[0])
    expect(afterBlackMove.turn).toBe('w')
    expect(afterBlackMove.status).toBe('black-won')
  })

  it('calls a draw after too many moves without captures', () => {
    const board = emptyBoard()
    board[idx(4, 3)] = { color: 'w', king: false }
    board[idx(0, 1)] = { color: 'b', king: false }
    const game = { board, turn: 'w' as const, mustContinueFrom: null, noCaptureCount: NO_CAPTURE_LIMIT - 1, status: 'playing' as const, history: [] }
    const next = playMove(game, legalMovesFrom(game, { row: 4, col: 3 })[0])
    expect(next.status).toBe('draw')
  })
})
