/**
 * Motore del Tris (3×3, tris classico):
 * - due giocatori a turni, X inizia sempre;
 * - si vince allineando tre simboli propri in orizzontale, verticale o diagonale;
 * - se le 9 caselle si riempiono senza una tripletta, è pareggio.
 */

export type Mark = 'X' | 'O'
export type Cell = Mark | null
export type Status = 'playing' | 'x-won' | 'o-won' | 'draw'

export interface TrisState {
  board: Cell[]
  turn: Mark
  status: Status
  winningLine: number[] | null
  history: number[]
}

export const SIZE = 3

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
]

export function createGame(): TrisState {
  return { board: new Array(9).fill(null), turn: 'X', status: 'playing', winningLine: null, history: [] }
}

export function legalMoves(state: TrisState): number[] {
  if (state.status !== 'playing') return []
  return state.board.flatMap((cell, i) => (cell === null ? [i] : []))
}

function findWinningLine(board: Cell[], mark: Mark): number[] | null {
  return LINES.find((line) => line.every((i) => board[i] === mark)) ?? null
}

export const otherMark = (m: Mark): Mark => (m === 'X' ? 'O' : 'X')

/** Applica una mossa (deve provenire da legalMoves) e restituisce il nuovo stato. */
export function playMove(state: TrisState, index: number): TrisState {
  const board = state.board.slice()
  board[index] = state.turn
  const winningLine = findWinningLine(board, state.turn)
  const status: Status = winningLine ? (state.turn === 'X' ? 'x-won' : 'o-won') : board.every((c) => c !== null) ? 'draw' : 'playing'
  return { board, turn: otherMark(state.turn), status, winningLine, history: [...state.history, index] }
}
