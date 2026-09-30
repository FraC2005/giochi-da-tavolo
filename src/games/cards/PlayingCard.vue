<script setup lang="ts">
/** Carta da gioco generica (usata da Briscola, Scopa e Poker): niente illustrazioni, solo valore e seme. */
withDefaults(
  defineProps<{
    rankLabel: string
    suitGlyph: string
    suitLabel: string
    color: string
    faceDown?: boolean
    selected?: boolean
    interactive?: boolean
    small?: boolean
  }>(),
  { faceDown: false, selected: false, interactive: false, small: false },
)
const emit = defineEmits<{ (e: 'click'): void }>()
</script>

<template>
  <button
    type="button"
    class="relative grid aspect-[2/3] shrink-0 place-items-center rounded-field border-2 border-base-100 shadow-md transition"
    :class="[
      small ? 'w-12 sm:w-14' : 'w-16 sm:w-20',
      faceDown ? 'bg-gradient-to-br from-primary to-accent' : 'bg-base-100',
      selected ? '-translate-y-2.5 ring-2 ring-primary' : '',
      interactive ? 'cursor-pointer hover:-translate-y-1.5' : 'cursor-default',
    ]"
    :disabled="!interactive"
    :aria-label="faceDown ? 'Carta coperta' : `${rankLabel} di ${suitLabel}`"
    @click="emit('click')"
  >
    <template v-if="!faceDown">
      <span class="absolute left-1.5 top-1 text-xs font-black leading-none" :style="{ color }">{{ rankLabel }}</span>
      <span class="text-2xl leading-none sm:text-3xl">{{ suitGlyph }}</span>
      <span class="absolute bottom-1 right-1.5 rotate-180 text-xs font-black leading-none" :style="{ color }">{{ rankLabel }}</span>
    </template>
    <span v-else class="text-lg opacity-70">🂠</span>
  </button>
</template>
