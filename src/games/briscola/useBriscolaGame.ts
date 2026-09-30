import { shallowRef } from 'vue'
import type { Card } from '../cards/italianDeck'
import { sameCard } from '../cards/italianDeck'
import { createGame, playCard, type BriscolaState, type PlayerCount } from './engine'

export function useBriscolaGame(initial?: BriscolaState, onMove?: (state: BriscolaState) => void) {
  const state = shallowRef<BriscolaState>(initial ?? createGame(2))

  function setState(next: BriscolaState) {
    state.value = next
  }

  function reset(players: PlayerCount) {
    state.value = createGame(players)
  }

  function play(seat: number, card: Card) {
    if (state.value.status !== 'playing' || state.value.turn !== seat) return
    if (!state.value.hands[seat].some((c) => sameCard(c, card))) return
    const next = playCard(state.value, seat, card)
    state.value = next
    onMove?.(next)
  }

  return { state, setState, reset, play }
}
