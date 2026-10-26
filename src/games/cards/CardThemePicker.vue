<script setup lang="ts">
/** Selettore del mazzo regionale (Napoletane/Piacentine/Siciliane), con scelta salvata in locale. */
import { CARD_THEMES, type CardTheme } from './cardTheme'

defineProps<{ modelValue: CardTheme }>()
const emit = defineEmits<{ (e: 'update:modelValue', theme: CardTheme): void }>()
</script>

<template>
  <div class="join">
    <button
      v-for="t in CARD_THEMES" :key="t.id" type="button"
      class="btn join-item btn-xs sm:btn-sm" :class="modelValue === t.id ? 'btn-primary' : 'btn-outline'"
      @click="emit('update:modelValue', t.id)"
    >
      {{ t.label }}
    </button>
  </div>
</template>
