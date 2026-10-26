<script setup lang="ts">
/**
 * Carta da gioco con una faccia vera: fotografie reali, libere da copyright (pubblico dominio da
 * Wikimedia Commons, vedi public/cards/README.md per le fonti), non disegni nostri.
 * - Briscola/Scopa (mazzo italiano): Napoletane e Piacentine hanno tutte le 40 carte fotografate;
 *   delle Siciliane esistono foto solo per Asso/Fante/Cavallo/Re, le numeriche (2-7) mostrano il
 *   seme vero (anch'esso una scansione reale) ripetuto tante volte quanto vale la carta.
 * - Poker (mazzo francese): le 52 carte del classico mazzo "English pattern", anch'esso di
 *   pubblico dominio — stesso trattamento, nessuna variante regionale da scegliere.
 */
import { computed } from 'vue'
import { RANK_LABEL as FRENCH_RANK_LABEL, SUIT_LABEL as FRENCH_SUIT_LABEL, type Suit as FrenchSuit } from './frenchDeck'
import { SUIT_LABEL as ITALIAN_SUIT_LABEL, type Suit as ItalianSuit } from './italianDeck'
import type { CardTheme } from './cardTheme'

const props = withDefaults(
  defineProps<{
    rank: number
    suit: ItalianSuit | FrenchSuit
    deck: 'italian' | 'french'
    theme?: CardTheme
    faceDown?: boolean
    selected?: boolean
    interactive?: boolean
    small?: boolean
  }>(),
  { faceDown: false, selected: false, interactive: false, small: false },
)
const emit = defineEmits<{ (e: 'click'): void }>()

const ITALIAN_RANK_LABEL: Record<number, string> = { 1: 'Asso', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: 'Fante', 9: 'Cavallo', 10: 'Re' }

const isItalian = computed(() => props.deck === 'italian')
const theme = computed<CardTheme>(() => props.theme ?? 'napoletane')
const rankLabel = computed(() => (isItalian.value ? ITALIAN_RANK_LABEL[props.rank as never] : FRENCH_RANK_LABEL[props.rank as never]) ?? '')
const suitLabel = computed(() => (isItalian.value ? ITALIAN_SUIT_LABEL[props.suit as ItalianSuit] : FRENCH_SUIT_LABEL[props.suit as FrenchSuit]))

/** Napoletane e Piacentine: le 40 carte sono fotografate per intero. Il mazzo francese (Poker) sempre. */
const FULL_PHOTO_THEMES = new Set<CardTheme>(['napoletane', 'piacentine'])
/** Siciliane: foto reali solo per Asso, Fante, Cavallo, Re. */
const SICILIANE_PHOTO_RANKS = new Set([1, 8, 9, 10])

const hasPhoto = computed(() => !isItalian.value || FULL_PHOTO_THEMES.has(theme.value) || (theme.value === 'siciliane' && SICILIANE_PHOTO_RANKS.has(props.rank)))
const photoSrc = computed(() => (isItalian.value ? `/cards/${theme.value}/${props.rank}-${props.suit}.jpg` : `/cards/french/${props.rank}-${props.suit}.jpg`))
const siciliePipSrc = computed(() => `/cards/suits/siciliane-${props.suit}.svg`)

const pipCount = computed(() => {
  if (!isItalian.value) return 0 // il mazzo francese ha sempre la foto, non serve comporre i pip
  if (props.rank >= 8) return 0 // figure
  return props.rank // 1 (Asso) .. 7
})
</script>

<template>
  <button
    type="button"
    class="relative grid aspect-[2/3] shrink-0 place-items-center overflow-hidden rounded-field border-2 shadow-md transition"
    :class="[
      small ? 'w-12 sm:w-14' : 'w-16 sm:w-20',
      faceDown ? 'border-base-100 bg-gradient-to-br from-primary to-accent' : 'border-base-100 bg-[#fbf6ea]',
      selected ? '-translate-y-2.5 ring-2 ring-primary' : '',
      interactive ? 'cursor-pointer hover:-translate-y-1.5' : 'cursor-default',
    ]"
    :disabled="!interactive"
    :aria-label="faceDown ? 'Carta coperta' : `${rankLabel} di ${suitLabel}`"
    @click="emit('click')"
  >
    <template v-if="!faceDown">
      <!-- Foto reale: sempre per il mazzo francese, per l'italiano quando il mazzo/carta scelto la copre -->
      <img v-if="hasPhoto" :src="photoSrc" :alt="`${rankLabel} di ${suitLabel}`" class="h-full w-full object-cover" draggable="false" />

      <!-- Siciliane, numeriche 2-7: il seme vero (scansione reale) ripetuto -->
      <div v-else class="grid grid-cols-2 place-items-center gap-1 px-3 py-4">
        <img v-for="i in pipCount" :key="i" :src="siciliePipSrc" :alt="suitLabel" class="h-3 w-3 sm:h-3.5 sm:w-3.5" draggable="false" />
      </div>
    </template>
    <div v-else class="h-full w-full bg-[repeating-linear-gradient(45deg,rgba(255,255,255,0.15)_0_6px,transparent_6px_12px)]" />
  </button>
</template>
