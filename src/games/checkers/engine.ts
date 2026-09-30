/**
 * Motore della dama (regole classiche anglo-americane, 8×8):
 * - cattura obbligata; se la cattura continua dalla casella di arrivo, si deve proseguire con lo stesso pezzo;
 * - la pedina promossa a dama termina subito la mossa, anche se sarebbe possibile catturare ancora;
 * - la dama si muove/cattura di una sola casella in diagonale, in qualunque direzione (senza "volo");
 * - non avere mosse legali (pezzi finiti o bloccati) significa perdere la partita;
 * - dopo troppe mosse senza catture, la partita finisce in parità.
 */

export type Color = 'w' | 'b'
export interface Piece { color: Color; king: boolean }
export type Board = (Piece | null)[]
export type Status = 'playing' | 'white-won' | 'black-won' | 'draw'

export interface Pos { row: number; col: number }
export interface Move { from: Pos; to: Pos; captures: Pos[] }

export interface CheckersState {
  board: Board
  turn: Color
  mustContinueFrom: Pos | null
  noCaptureCount: number
  status: Status
  history: Move[]
}

export const SIZE = 8
export const NO_CAPTURE_LIMIT = 80

export const idx = (row: number, col: number) => row * SIZE + col
export const inBounds = (row: number, col: number) => row >= 0 && row < SIZE && col >= 0 && col < SIZE
export const isDark = (row: number, col: number) => (row + col) % 2 === 1
export const at = (board: Board, p: Pos) => board[idx(p.row, p.col)]
export const samePos = (a: Pos, b: Pos) => a.row === b.row && a.col === b.col

export function initialBoard(): Board {
  const board: Board = new Array(SIZE * SIZE).fill(null)
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      if (!isDark(row, col)) continue
      if (row < 3) board[idx(row, col)] = { color: 'b', king: false }
      else if (row > 4) board[idx(row, col)] = { color: 'w', king: false }
    }
  }
  return board
}

export function createGame(): CheckersState {
  return { board: initialBoard(), turn: 'w', mustContinueFrom: null, noCaptureCount: 0, status: 'playing', history: [] }
}

const DIAGONALS = [
  { dr: -1, dc: -1 }, { dr: -1, dc: 1 }, { dr: 1, dc: -1 }, { dr: 1, dc: 1 },
]
/** direzione "in avanti" per una pedina non promossa */
const forward = (color: Color) => (color === 'w' ? -1 : 1)

function pieceCaptures(board: Board, from: Pos, piece: Piece): Move[] {
  const dirs = piece.king ? DIAGONALS : DIAGONALS.filter((d) => d.dr === forward(piece.color))
  const moves: Move[] = []
  for (const d of dirs) {
    const midRow = from.row + d.dr
    const midCol = from.col + d.dc
    const toRow = from.row + d.dr * 2
    const toCol = from.col + d.dc * 2
    if (!inBounds(toRow, toCol)) continue
    const mid = board[idx(midRow, midCol)]
    if (!mid || mid.color === piece.color) continue
    if (board[idx(toRow, toCol)] !== null) continue
    moves.push({ from, to: { row: toRow, col: toCol }, captures: [{ row: midRow, col: midCol }] })
  }
  return moves
}

function pieceSimpleMoves(board: Board, from: Pos, piece: Piece): Move[] {
  const dirs = piece.king ? DIAGONALS : DIAGONALS.filter((d) => d.dr === forward(piece.color))
  const moves: Move[] = []
  for (const d of dirs) {
    const toRow = from.row + d.dr
    const toCol = from.col + d.dc
    if (!inBounds(toRow, toCol) || board[idx(toRow, toCol)] !== null) continue
    moves.push({ from, to: { row: toRow, col: toCol }, captures: [] })
  }
  return moves
}

/** Tutte le mosse legali del giocatore di turno, applicando la cattura obbligata e il vincolo del pezzo in corso. */
export function legalMoves(state: CheckersState): Move[] {
  if (state.status !== 'playing') return []
  const { board, turn, mustContinueFrom } = state

  if (mustContinueFrom) {
    const piece = at(board, mustContinueFrom)
    return piece ? pieceCaptures(board, mustContinueFrom, piece) : []
  }

  const positions: Pos[] = []
  for (let row = 0; row < SIZE; row++) for (let col = 0; col < SIZE; col++) {
    const p = board[idx(row, col)]
    if (p && p.color === turn) positions.push({ row, col })
  }

  const captures = positions.flatMap((pos) => pieceCaptures(board, pos, at(board, pos)!))
  if (captures.length) return captures
  return positions.flatMap((pos) => pieceSimpleMoves(board, pos, at(board, pos)!))
}

export function legalMovesFrom(state: CheckersState, from: Pos): Move[] {
  return legalMoves(state).filter((m) => samePos(m.from, from))
}

const KING_ROW: Record<Color, number> = { w: 0, b: SIZE - 1 }

/** Applica una mossa (deve provenire da legalMoves/legalMovesFrom) e restituisce il nuovo stato. */
export function playMove(state: CheckersState, move: Move): CheckersState {
  const board = state.board.slice()
  const piece = at(board, move.from)!
  board[idx(move.from.row, move.from.col)] = null
  for (const c of move.captures) board[idx(c.row, c.col)] = null

  let promoted = false
  let finalPiece = piece
  if (!piece.king && move.to.row === KING_ROW[piece.color]) { finalPiece = { ...piece, king: true }; promoted = true }
  board[idx(move.to.row, move.to.col)] = finalPiece

  const captured = move.captures.length > 0
  // Una pedina appena promossa non prosegue la cattura nello stesso turno.
  const more = captured && !promoted ? pieceCaptures(board, move.to, finalPiece) : []
  const nextTurn: Color = more.length ? state.turn : state.turn === 'w' ? 'b' : 'w'
  const mustContinueFrom = more.length ? move.to : null

  let next: CheckersState = {
    board,
    turn: nextTurn,
    mustContinueFrom,
    noCaptureCount: captured ? 0 : state.noCaptureCount + 1,
    status: 'playing',
    history: [...state.history, move],
  }
  next.status = computeStatus(next)
  return next
}

function hasAnyPiece(board: Board, color: Color) {
  return board.some((p) => p?.color === color)
}

function computeStatus(state: CheckersState): Status {
  if (state.noCaptureCount >= NO_CAPTURE_LIMIT) return 'draw'
  if (!hasAnyPiece(state.board, 'w')) return 'black-won'
  if (!hasAnyPiece(state.board, 'b')) return 'white-won'
  if (legalMoves(state).length === 0) return state.turn === 'w' ? 'black-won' : 'white-won'
  return 'playing'
}

export const otherColor = (c: Color): Color => (c === 'w' ? 'b' : 'w')
