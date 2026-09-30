<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import PlayingCard from '../cards/PlayingCard.vue'
import { RANK_LABEL, SUIT_COLOR, SUIT_GLYPH, SUIT_LABEL } from '../cards/frenchDeck'
import { legalActions, totalPot, type LegalActions, type PokerState } from './engine'

const props = defineProps<{
  state: PokerState
  seat: number
  names: string[]
  interactive: boolean
}>()
const emit = defineEmits<{
  (e: 'fold'): void
  (e: 'checkCall'): void
  (e: 'raiseTo', amount: number): void
  (e: 'discard', indices: number[]): void
}>()

const nameFor = (i: number) => props.names[i] ?? `Giocatore ${i + 1}`
const legal = computed<LegalActions>(() => legalActions(props.state, props.seat))
const pot = computed(() => totalPot(props.state))
const isExchange = computed(() => props.state.phase === 'exchange')
const isShowdown = computed(() => props.state.status === 'finished')

const raiseAmount = ref(legal.value.minRaiseTo)
watch(legal, (l) => { raiseAmount.value = Math.max(l.minRaiseTo, Math.min(raiseAmount.value, l.maxRaiseTo)) })

const discardChoice = ref<number[]>([])
watch(() => props.state.turn, () => { discardChoice.value = [] })
function toggleDiscard(i: number) {
  discardChoice.value = discardChoice.value.includes(i) ? discardChoice.value.filter((x) => x !== i) : [...discardChoice.value, i]
}
function confirmDiscard() {
  emit('discard', discardChoice.value)
  discardChoice.value = []
}

const resultFor = (seat: number) => props.state.results?.find((r) => r.seat === seat) ?? null
const phaseLabel: Record<string, string> = {
  preflop: 'Prima delle carte comuni', flop: 'Flop', turn: 'Turn', river: 'River',
  bet1: 'Prima puntata', exchange: 'Cambio carte', bet2: 'Puntata finale', showdown: 'Showdown',
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between rounded-box bg-base-100 px-4 py-2.5 shadow-sm">
      <span class="text-sm font-semibold">{{ phaseLabel[state.phase] ?? state.phase }}</span>
      <span class="text-xs opacity-55">Piatto: {{ pot }}</span>
    </div>

    <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
      <div
        v-for="(p, i) in state.players" v-show="i !== seat" :key="i"
        class="flex flex-col items-center gap-1 rounded-box bg-base-100 px-2 py-2.5 shadow-sm"
        :class="[state.turn === i && state.status === 'playing' ? 'ring-2 ring-primary' : '', p.folded ? 'opacity-40' : '']"
      >
        <span class="truncate text-xs font-semibold">{{ nameFor(i) }}</span>
        <span class="text-[11px] opacity-55">
          {{ p.folded ? 'Passato' : p.allIn ? 'All-in' : `Stack ${p.stack}` }}
          <template v-if="!p.folded && p.betThisStreet > 0"> · punta {{ p.betThisStreet }}</template>
        </span>
        <span v-if="isShowdown && resultFor(i)" class="text-[11px] font-medium text-primary">{{ resultFor(i)?.categoryLabel ?? '' }} (+{{ resultFor(i)?.amount }})</span>
      </div>
    </div>

    <div v-if="state.variant === 'holdem'" class="rounded-box bg-base-200/70 p-4 shadow-inner">
      <p class="mb-2 text-center text-xs font-medium opacity-55">Carte comuni</p>
      <div class="flex min-h-20 flex-wrap justify-center gap-2">
        <PlayingCard
          v-for="c in state.community" :key="`${c.suit}-${c.rank}`"
          :rank-label="RANK_LABEL[c.rank]" :suit-glyph="SUIT_GLYPH[c.suit]" :suit-label="SUIT_LABEL[c.suit]" :color="SUIT_COLOR[c.suit]"
        />
        <p v-if="state.community.length === 0" class="self-center text-xs opacity-40">Ancora nessuna carta comune</p>
      </div>
    </div>

    <div>
      <p class="mb-2 text-center text-xs font-medium opacity-55">
        {{ nameFor(seat) }} · stack {{ state.players[seat]?.stack ?? 0 }}
        <span v-if="isShowdown && resultFor(seat)" class="font-semibold text-primary">· {{ resultFor(seat)?.categoryLabel }} (+{{ resultFor(seat)?.amount }})</span>
      </p>
      <div class="flex flex-wrap justify-center gap-2.5">
        <PlayingCard
          v-for="(c, i) in state.players[seat]?.hand ?? []" :key="`${c.suit}-${c.rank}-${i}`"
          :rank-label="RANK_LABEL[c.rank]" :suit-glyph="SUIT_GLYPH[c.suit]" :suit-label="SUIT_LABEL[c.suit]" :color="SUIT_COLOR[c.suit]"
          :interactive="isExchange && interactive" :selected="discardChoice.includes(i)" @click="isExchange && interactive && toggleDiscard(i)"
        />
      </div>
    </div>

    <div v-if="isExchange && interactive" class="flex flex-col items-center gap-2">
      <p class="text-xs opacity-55">Tocca le carte da scartare, poi conferma (anche zero carte, se vuoi restare cosà).</p>
      <button type="button" class="btn btn-pop btn-sm rounded-full" @click="confirmDiscard">
        {{ discardChoice.length === 0 ? 'Non cambio nulla' : `Scarta ${discardChoice.length} cart${discardChoice.length === 1 ? 'a' : 'e'}` }}
      </button>
    </div>

    <div v-else-if="interactive && state.status === 'playing'" class="flex flex-col items-center gap-3 rounded-box bg-base-100 p-3 shadow-sm">
      <div class="flex flex-wrap justify-center gap-2">
        <button type="button" class="btn btn-outline btn-sm rounded-full" @click="emit('fold')">Passa</button>
        <button type="button" class="btn btn-pop btn-sm rounded-full" @click="emit('checkCall')">
          {{ legal.canCheck ? 'Check' : `Chiama ${legal.callAmount}` }}
        </button>
      </div>
      <div v-if="legal.canRaise" class="flex w-full max-w-xs flex-col items-center gap-1.5">
        <input v-model.number="raiseAmount" type="range" :min="legal.minRaiseTo" :max="legal.maxRaiseTo" step="10" class="range range-primary range-sm w-full" />
        <div class="flex items-center gap-2">
          <span class="text-xs tabular opacity-70">Punta {{ raiseAmount }}</span>
          <button type="button" class="btn btn-outline btn-xs rounded-full" @click="raiseAmount = legal.maxRaiseTo">All-in</button>
        </div>
        <button type="button" class="btn btn-secondary btn-sm rounded-full" @click="emit('raiseTo', raiseAmount)">Rilancia</button>
      </div>
    </div>
  </div>
</template>
