import { computed, ref, shallowRef } from 'vue'
import { sameCard, type Card } from '../cards/italianDeck'
import { createGame, legalCaptures, playCard, type PlayerCount, type ScopaState } from './engine'

export function useScopaGame(initial?: ScopaState, onMove?: (state: ScopaState) => void) {
  const state = shallowRef<ScopaState>(initial ?? createGame(2))
  const selectedCard = ref<Card | null>(null)

  const captureOptions = computed<Card[][]>(() => (selectedCard.value ? legalCaptures(state.value.table, selectedCard.value.rank) : []))

  function setState(next: ScopaState) {
    state.value = next
    selectedCard.value = null
  }

  function reset(players: PlayerCount) {
    state.value = createGame(players)
    selectedCard.value = null
  }

  function commit(seat: number, card: Card, capture: Card[]) {
    const next = playCard(state.value, seat, card, capture)
    state.value = next
    selectedCard.value = null
    onMove?.(next)
  }

  /** Tocca una carta in mano: la gioca subito se non c'è ambiguità, altrimenti apre la scelta della presa. */
  function selectCard(seat: number, card: Card) {
    if (state.value.status !== 'playing' || state.value.turn !== seat) return
    if (!state.value.hands[seat].some((c) => sameCard(c, card))) return
    if (selectedCard.value && sameCard(selectedCard.value, card)) {
      selectedCard.value = null
      return
    }
    const options = legalCaptures(state.value.table, card.rank)
    if (options.length <= 1) {
      commit(seat, card, options[0] ?? [])
    } else {
      selectedCard.value = card
    }
  }

  function chooseCapture(seat: number, option: Card[]) {
    if (!selectedCard.value) return
    commit(seat, selectedCard.value, option)
  }

  return { state, selectedCard, captureOptions, setState, reset, selectCard, chooseCapture }
}
