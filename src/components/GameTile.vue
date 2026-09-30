<script setup lang="ts">
import { ArrowForward } from '@vicons/ionicons5'
import { computed } from 'vue'
import type { GameDef } from '@/games/registry'
import { NIcon } from './icon'

const props = defineProps<{ game: GameDef }>()
defineEmits<{ (e: 'click'): void }>()

const iconBg = computed(() => `linear-gradient(135deg, ${props.game.accent[0]}, ${props.game.accent[1]})`)
</script>

<template>
  <button class="group flex flex-col items-start gap-3 rounded-box bg-base-100 p-5 text-left shadow-md transition-transform hover:-translate-y-0.5 hover:shadow-lg" @click="$emit('click')">
    <span class="grid h-12 w-12 place-items-center rounded-field text-2xl leading-none shadow-inner" :style="{ background: iconBg }">{{ game.glyph }}</span>
    <span class="font-display text-lg font-semibold tracking-tight">{{ game.title }}</span>
    <span class="text-sm leading-snug opacity-65">{{ game.tagline }}</span>
    <span class="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-primary">Gioca <NIcon :component="ArrowForward" :size="14" class="transition group-hover:translate-x-0.5" /></span>
  </button>
</template>
