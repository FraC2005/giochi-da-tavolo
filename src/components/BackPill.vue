<script setup lang="ts">
import { ChevronBack } from '@vicons/ionicons5'
import { useRouter } from 'vue-router'
import { NIcon } from './icon'

const props = withDefaults(defineProps<{ to?: string; label?: string }>(), { to: '/', label: 'Indietro' })
const router = useRouter()
</script>

<template>
  <button class="btn btn-ghost btn-sm gap-1 rounded-full" @click="router.push(to)">
    <NIcon :component="ChevronBack" :size="16" />{{ label }}
  </button>
</template>
