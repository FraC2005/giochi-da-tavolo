/**
 * Sottile involucro attorno a chess.js: regole complete (arrocco, en passant, promozione,
 * scacco/scacco matto/stallo/patta) già gestite dalla libreria. Qui adattiamo solo l'interfaccia
 * per l'uso nell'app (stato serializzabile per il gioco online, elenco mosse, pezzi catturati).
 */
import { Chess, type Square } from 'chess.js'

export type Color = 'w' | 'b'
export interface MoveRecord { from: string; to: string; promotion?: string }
export type Status = 'playing' | 'checkmate' | 'stalemate' | 'draw'

export interface BoardSquare { square: string; type: string; color: Color }

const PIECE_VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 }

export class ChessGame {
  private chess: Chess
  readonly moves: MoveRecord[]

  constructor(moves: MoveRecord[] = []) {
    this.chess = new Chess()
    for (const m of moves) this.chess.move(m)
    this.moves = moves.slice()
  }

  static fromMoves(moves: MoveRecord[]) { return new ChessGame(moves) }

  get turn(): Color { return this.chess.turn() }
  get fen() { return this.chess.fen() }
  get inCheck() { return this.chess.isCheck() }

  /** righe dalla 8 alla 1, come mostrate a schermo con il bianco in basso */
  get board(): (BoardSquare | null)[][] {
    return this.chess.board().map((row) => row.map((cell) => (cell ? { square: cell.square, type: cell.type, color: cell.color } : null)))
  }

  legalMovesFrom(square: string) {
    return this.chess.moves({ square: square as Square, verbose: true }) as { from: string; to: string; promotion?: string; san: string }[]
  }

  needsPromotionChoice(from: string, to: string): boolean {
    return this.legalMovesFrom(from).some((m) => m.to === to && !!m.promotion)
  }

  /**
   * Se `from` è il proprio re e `to` è la casella della propria torre con cui si può arroccare,
   * ritorna la casella dove finirebbe il re per quell'arrocco (g1/c1/g8/c8), altrimenti null.
   * Permette di arroccare anche cliccando o trascinando il re sopra la torre, non solo sulla
   * casella esatta di arrivo del re: un'imprecisione facile con la scacchiera che ruota a ogni
   * turno in modalità locale.
   */
  castleTargetFor(from: string, to: string): string | null {
    const piece = this.chess.get(from as Square)
    if (!piece || piece.type !== 'k') return null
    const rank = piece.color === 'w' ? '1' : '8'
    const moves = this.legalMovesFrom(from)
    if (to === `h${rank}` && moves.some((m) => m.to === `g${rank}`)) return `g${rank}`
    if (to === `a${rank}` && moves.some((m) => m.to === `c${rank}`)) return `c${rank}`
    return null
  }

  /** Prova la mossa; ritorna null se illegale. `promotion`: 'q'|'r'|'b'|'n'. */
  tryMove(from: string, to: string, promotion?: string): MoveRecord | null {
    try {
      this.chess.move({ from, to, promotion })
      const record: MoveRecord = { from, to, promotion }
      this.moves.push(record)
      return record
    } catch {
      return null
    }
  }

  status(): Status {
    if (this.chess.isCheckmate()) return 'checkmate'
    if (this.chess.isStalemate()) return 'stalemate'
    if (this.chess.isDraw()) return 'draw'
    return 'playing'
  }

  /** null se la partita non è finita in scacco matto */
  winner(): Color | null {
    return this.status() === 'checkmate' ? (this.turn === 'w' ? 'b' : 'w') : null
  }

  drawReason(): string | null {
    if (!this.chess.isDraw()) return null
    if (this.chess.isStalemate()) return null
    if (this.chess.isThreefoldRepetition()) return 'Tripla ripetizione della posizione'
    if (this.chess.isInsufficientMaterial()) return 'Materiale insufficiente per dare scacco matto'
    if (this.chess.isDrawByFiftyMoves()) return 'Regola delle 50 mosse senza catture né mosse di pedone'
    return 'Patta'
  }

  historySAN(): string[] { return this.chess.history() }

  /** pezzi catturati finora, per colore del pezzo catturato (da mostrare accanto al giocatore che li ha presi) */
  captured(): { w: string[]; b: string[] } {
    const out: { w: string[]; b: string[] } = { w: [], b: [] }
    for (const m of this.chess.history({ verbose: true })) {
      if (m.captured) out[m.color === 'w' ? 'b' : 'w'].push(m.captured)
    }
    return out
  }

  materialDelta(): number {
    const c = this.captured()
    const sum = (list: string[]) => list.reduce((s, p) => s + (PIECE_VALUE[p] ?? 0), 0)
    return sum(c.b) - sum(c.w)
  }
}
