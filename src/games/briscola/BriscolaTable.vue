<script setup lang="ts">
import { computed } from 'vue'
import PlayingCard from '../cards/PlayingCard.vue'
import { RANK_LABEL, SUIT_COLOR, SUIT_GLYPH, SUIT_LABEL, type Card } from '../cards/italianDeck'
import type { BriscolaState } from './engine'

const props = defineProps<{
  state: BriscolaState
  seat: number
  names: string[]
  interactive: boolean
}>()
const emit = defineEmits<{ (e: 'play', card: Card): void }>()

const myHand = computed(() => props.state.hands[props.seat] ?? [])
const otherSeats = computed(() => props.state.hands.map((_, i) => i).filter((i) => i !== props.seat))
const nameFor = (i: number) => props.names[i] ?? `Giocatore ${i + 1}`
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between rounded-box bg-base-100 px-4 py-2.5 shadow-sm">
      <span class="flex items-center gap-1.5 text-sm font-semibold">
        Briscola <span class="text-lg leading-none">{{ SUIT_GLYPH[state.briscola] }}</span> {{ SUIT_LABEL[state.briscola] }}
      </span>
      <span class="text-xs opacity-55">Mazzo: {{ state.deck.length }} carte</span>
    </div>

    <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <div
        v-for="i in otherSeats" :key="i"
        class="flex flex-col items-center gap-1 rounded-box bg-base-100 px-2 py-2.5 shadow-sm"
        :class="state.turn === i && state.status === 'playing' ? 'ring-2 ring-primary' : ''"
      >
        <span class="truncate text-xs font-semibold">{{ nameFor(i) }}</span>
        <span class="text-[11px] opacity-55">{{ state.hands[i]?.length ?? 0 }} carte · {{ state.points[i] }} pt</span>
      </div>
    </div>

    <div class="rounded-box bg-base-200/70 p-4 shadow-inner">
      <p class="mb-2 text-center text-xs font-medium opacity-55">Mano in corso</p>
      <div class="flex flex-wrap justify-center gap-2">
        <div v-for="(c, i) in state.table" :key="i" class="flex flex-col items-center gap-1">
          <PlayingCard
            v-if="c" :rank-label="RANK_LABEL[c.rank]" :suit-glyph="SUIT_GLYPH[c.suit]" :suit-label="SUIT_LABEL[c.suit]" :color="SUIT_COLOR[c.suit]"
          />
          <div v-else class="grid aspect-[2/3] w-16 place-items-center rounded-field border-2 border-dashed border-base-content/15 text-xs opacity-40 sm:w-20">—</div>
          <span class="text-[11px] opacity-55">{{ nameFor(i) }}</span>
        </div>
      </div>
    </div>

    <div>
      <p class="mb-2 text-center text-xs font-medium opacity-55">{{ nameFor(seat) }} · {{ state.points[seat] }} punti</p>
      <div class="flex flex-wrap justify-center gap-2.5">
        <PlayingCard
          v-for="c in myHand" :key="`${c.suit}-${c.rank}`"
          :rank-label="RANK_LABEL[c.rank]" :suit-glyph="SUIT_GLYPH[c.suit]" :suit-label="SUIT_LABEL[c.suit]" :color="SUIT_COLOR[c.suit]"
          :interactive="interactive" @click="emit('play', c)"
        />
      </div>
    </div>
  </div>
</template>
