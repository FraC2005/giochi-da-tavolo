import { computed, ref, shallowRef } from 'vue'
import { createGame, idx, legalMovesFrom, playMove, samePos, type CheckersState, type Move, type Pos } from './engine'

export function useCheckersGame(initial?: CheckersState, onMove?: (state: CheckersState) => void) {
  const state = shallowRef<CheckersState>(initial ?? createGame())
  const selected = ref<Pos | null>(null)

  const moves = computed<Move[]>(() => (selected.value ? legalMovesFrom(state.value, selected.value) : []))
  const legalTargets = computed(() => moves.value.map((m) => m.to))
  /** durante una cattura multipla obbligata, solo questo pezzo può muoversi */
  const forcedFrom = computed(() => state.value.mustContinueFrom)

  function setState(next: CheckersState) {
    state.value = next
    selected.value = null
  }

  function reset() {
    state.value = createGame()
    selected.value = null
  }

  function clickSquare(pos: Pos) {
    if (forcedFrom.value && !samePos(forcedFrom.value, pos) && !selected.value) return
    if (selected.value && samePos(selected.value, pos)) { selected.value = null; return }
    if (selected.value) {
      const move = moves.value.find((m) => samePos(m.to, pos))
      if (move) {
        const next = playMove(state.value, move)
        state.value = next
        selected.value = next.mustContinueFrom // se deve proseguire la cattura, resta selezionato lo stesso pezzo
        onMove?.(next)
        return
      }
    }
    const piece = state.value.board[idx(pos.row, pos.col)]
    selected.value = piece && piece.color === state.value.turn && legalMovesFrom(state.value, pos).length > 0 ? pos : null
  }

  return { state, selected, legalTargets, forcedFrom, setState, reset, clickSquare }
}
