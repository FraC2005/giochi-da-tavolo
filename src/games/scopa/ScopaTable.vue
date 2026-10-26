<script setup lang="ts">
import { computed, ref } from 'vue'
import CardThemePicker from '../cards/CardThemePicker.vue'
import PlayingCard from '../cards/PlayingCard.vue'
import { cardTheme, setCardTheme } from '../cards/cardTheme'
import { sameCard, type Card } from '../cards/italianDeck'
import type { ScopaState } from './engine'

const props = defineProps<{
  state: ScopaState
  seat: number
  names: string[]
  interactive: boolean
  selectedCard: Card | null
  captureOptions: Card[][]
}>()
const emit = defineEmits<{ (e: 'select', card: Card): void; (e: 'choose', option: Card[]): void }>()

const myHand = computed(() => props.state.hands[props.seat] ?? [])
const otherSeats = computed(() => props.state.hands.map((_, i) => i).filter((i) => i !== props.seat))
const nameFor = (i: number) => props.names[i] ?? `Giocatore ${i + 1}`
const isSelected = (c: Card) => !!props.selectedCard && sameCard(props.selectedCard, c)

const theme = ref(cardTheme())
function chooseTheme(t: typeof theme.value) {
  theme.value = t
  setCardTheme(t)
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex justify-center"><CardThemePicker :model-value="theme" @update:model-value="chooseTheme" /></div>

    <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <div
        v-for="i in otherSeats" :key="i"
        class="flex flex-col items-center gap-1 rounded-box bg-base-100 px-2 py-2.5 shadow-sm"
        :class="state.turn === i && state.status === 'playing' ? 'ring-2 ring-primary' : ''"
      >
        <span class="truncate text-xs font-semibold">{{ nameFor(i) }}</span>
        <span class="text-[11px] opacity-55">{{ state.hands[i]?.length ?? 0 }} in mano · {{ state.captured[i]?.length ?? 0 }} prese · {{ state.scope[i] }} scope</span>
      </div>
    </div>

    <div class="rounded-box bg-base-200/70 p-4 shadow-inner">
      <p class="mb-2 text-center text-xs font-medium opacity-55">Tavolo</p>
      <div class="flex min-h-20 flex-wrap justify-center gap-2">
        <PlayingCard
          v-for="c in state.table" :key="`${c.suit}-${c.rank}`"
          :rank="c.rank" :suit="c.suit" deck="italian" :theme="theme" small
        />
        <p v-if="state.table.length === 0" class="self-center text-xs opacity-40">Tavolo vuoto</p>
      </div>
    </div>

    <div v-if="selectedCard && captureOptions.length > 1" class="rounded-box bg-base-100 p-3 shadow-sm">
      <p class="mb-2 text-center text-xs font-medium opacity-60">Cosa vuoi prendere?</p>
      <div class="flex flex-col items-center gap-2">
        <button
          v-for="(option, oi) in captureOptions" :key="oi" type="button"
          class="flex gap-1 rounded-field p-1.5 outline-dashed outline-1 outline-base-content/15 transition hover:bg-base-200"
          @click="emit('choose', option)"
        >
          <PlayingCard
            v-for="c in option" :key="`${c.suit}-${c.rank}`"
            :rank="c.rank" :suit="c.suit" deck="italian" :theme="theme" small
          />
        </button>
      </div>
    </div>

    <div>
      <p class="mb-2 text-center text-xs font-medium opacity-55">{{ nameFor(seat) }} · {{ state.captured[seat]?.length ?? 0 }} prese · {{ state.scope[seat] }} scope</p>
      <div class="flex flex-wrap justify-center gap-2.5">
        <PlayingCard
          v-for="c in myHand" :key="`${c.suit}-${c.rank}`"
          :rank="c.rank" :suit="c.suit" deck="italian" :theme="theme"
          :interactive="interactive" :selected="isSelected(c)" @click="emit('select', c)"
        />
      </div>
    </div>
  </div>
</template>
