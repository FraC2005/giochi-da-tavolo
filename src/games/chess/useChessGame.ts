import { computed, ref, shallowRef } from 'vue'
import { ChessGame, type Color, type MoveRecord } from './engine'

export interface PendingPromotion { from: string; to: string }

/**
 * Stato reattivo di una partita a scacchi. Ricostruisce chess.js da zero dopo ogni mossa
 * (poche decine di mosse a partita: nessun problema di prestazioni) così la stessa lista di
 * mosse funziona sia in locale sia come stato sincronizzato online.
 */
export function useChessGame(initialMoves: MoveRecord[] = [], onMove?: (moves: MoveRecord[]) => void) {
  const game = shallowRef(new ChessGame(initialMoves))
  const selected = ref<string | null>(null)
  const pendingPromotion = ref<PendingPromotion | null>(null)
  const lastMove = computed<{ from: string; to: string } | null>(() => {
    const m = game.value.moves[game.value.moves.length - 1]
    return m ? { from: m.from, to: m.to } : null
  })
  const legalTargets = computed(() => (selected.value ? game.value.legalMovesFrom(selected.value).map((m) => m.to) : []))
  const status = computed(() => game.value.status())
  const winner = computed<Color | null>(() => game.value.winner())

  function setFromMoves(moves: MoveRecord[]) {
    game.value = ChessGame.fromMoves(moves)
    selected.value = null
    pendingPromotion.value = null
  }

  function reset() {
    game.value = new ChessGame([])
    selected.value = null
    pendingPromotion.value = null
  }

  /** ritorna la mossa registrata se legale, altrimenti null; per la promozione senza `promotion` apre il selettore */
  function commit(from: string, to: string, promotion?: string): MoveRecord | null {
    if (!promotion && game.value.needsPromotionChoice(from, to)) {
      pendingPromotion.value = { from, to }
      selected.value = null
      return null
    }
    const g = game.value
    const record = g.tryMove(from, to, promotion)
    if (!record) return null
    game.value = new ChessGame(g.moves)
    selected.value = null
    pendingPromotion.value = null
    onMove?.(game.value.moves)
    return record
  }

  function choosePromotion(piece: 'q' | 'r' | 'b' | 'n') {
    if (!pendingPromotion.value) return null
    const { from, to } = pendingPromotion.value
    return commit(from, to, piece)
  }

  /** click su una casella: seleziona/deseleziona un proprio pezzo, oppure tenta la mossa se già selezionato */
  function clickSquare(square: string, canMove: boolean) {
    if (pendingPromotion.value) return
    if (selected.value === square) { selected.value = null; return }
    if (selected.value && legalTargets.value.includes(square)) { commit(selected.value, square); return }
    if (!canMove) { selected.value = null; return }
    const piece = game.value.board.flat().find((c) => c?.square === square)
    selected.value = piece && piece.color === game.value.turn ? square : null
  }

  return { game, selected, pendingPromotion, lastMove, legalTargets, status, winner, setFromMoves, reset, commit, choosePromotion, clickSquare }
}
