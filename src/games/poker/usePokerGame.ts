import { shallowRef } from 'vue'
import { applyAction, createGame, discardAndDraw, legalActions, type Action, type PlayerCount, type PokerState, type PokerVariant } from './engine'

export function usePokerGame(initial?: PokerState, onMove?: (state: PokerState) => void) {
  const state = shallowRef<PokerState>(initial ?? createGame('holdem', 2))

  function setState(next: PokerState) {
    state.value = next
  }

  function reset(variant: PokerVariant, players: PlayerCount) {
    state.value = createGame(variant, players)
  }

  function act(seat: number, action: Action) {
    if (state.value.status !== 'playing' || state.value.turn !== seat || state.value.phase === 'exchange') return
    const next = applyAction(state.value, seat, action)
    state.value = next
    onMove?.(next)
  }

  function discard(seat: number, indices: number[]) {
    if (state.value.status !== 'playing' || state.value.turn !== seat || state.value.phase !== 'exchange') return
    const next = discardAndDraw(state.value, seat, indices)
    state.value = next
    onMove?.(next)
  }

  const legal = (seat: number) => legalActions(state.value, seat)

  return { state, setState, reset, act, discard, legal }
}
