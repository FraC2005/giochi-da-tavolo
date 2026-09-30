<script setup lang="ts">
defineProps<{ color: 'w' | 'b' }>()
const emit = defineEmits<{ (e: 'choose', piece: 'q' | 'r' | 'b' | 'n'): void }>()
const GLYPH: Record<string, string> = { q: '♛', r: '♜', b: '♝', n: '♞' }
const CHOICES = [['q', 'Regina'], ['r', 'Torre'], ['b', 'Alfiere'], ['n', 'Cavallo']] as const
</script>

<template>
  <div class="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" style="animation: pop-in 0.12s ease-out">
    <div class="w-full max-w-xs rounded-box bg-base-100 p-5 text-center shadow-xl">
      <h3 class="font-display text-sm font-semibold">Promuovi il pedone in…</h3>
      <div class="mt-3 grid grid-cols-4 gap-2">
        <button
          v-for="[key, label] in CHOICES" :key="key" class="btn btn-square h-16 w-16 border-none text-3xl" :aria-label="label"
          :class="color === 'w' ? 'bg-[#eef1fb] text-[#7c8ee0]' : 'bg-[#2a1832] text-[#c9b3ff]'"
          @click="emit('choose', key)"
        >{{ GLYPH[key] }}</button>
      </div>
    </div>
  </div>
</template>
