import { shallowRef } from 'vue'
import { createGame, playMove, type TrisState } from './engine'

export function useTrisGame(initial?: TrisState, onMove?: (state: TrisState) => void) {
  const state = shallowRef<TrisState>(initial ?? createGame())

  function setState(next: TrisState) {
    state.value = next
  }

  function reset() {
    state.value = createGame()
  }

  function clickCell(index: number) {
    if (state.value.status !== 'playing' || state.value.board[index] !== null) return
    const next = playMove(state.value, index)
    state.value = next
    onMove?.(next)
  }

  return { state, setState, reset, clickCell }
}
