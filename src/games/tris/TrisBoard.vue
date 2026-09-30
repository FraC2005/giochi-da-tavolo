<script setup lang="ts">
import type { Cell } from './engine'

defineProps<{ board: Cell[]; winningLine: number[] | null; interactive: boolean }>()
const emit = defineEmits<{ (e: 'cell-click', index: number): void }>()
</script>

<template>
  <div class="mx-auto grid aspect-square w-full max-w-sm grid-cols-3 gap-2 rounded-box bg-base-300 p-2 shadow-inner">
    <button
      v-for="(cell, i) in board" :key="i" type="button"
      class="grid place-items-center rounded-field bg-base-100 text-5xl font-black leading-none shadow-sm transition"
      :class="[
        winningLine?.includes(i) ? 'bg-primary/15 text-primary' : cell === 'X' ? 'text-secondary' : cell === 'O' ? 'text-accent' : 'text-base-content/20',
        interactive && cell === null ? 'cursor-pointer hover:bg-base-200' : 'cursor-default',
      ]"
      :disabled="!interactive || cell !== null"
      :aria-label="cell ? `Casella ${i + 1}: ${cell}` : `Casella ${i + 1}, vuota`"
      @click="emit('cell-click', i)"
    >{{ cell }}</button>
  </div>
</template>
