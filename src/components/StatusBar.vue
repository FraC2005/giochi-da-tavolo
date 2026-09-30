<script setup lang="ts">
defineProps<{ label: string; sub?: string; badgeText?: string; alert?: boolean }>()
</script>

<template>
  <div class="flex items-center justify-between rounded-box bg-base-100 px-4 py-2.5 shadow-sm">
    <div class="min-w-0">
      <p class="truncate text-sm font-semibold">{{ label }}</p>
      <p v-if="sub" class="truncate text-xs opacity-55">{{ sub }}</p>
    </div>
    <span v-if="badgeText" class="badge badge-sm shrink-0" :class="alert ? 'badge-error' : 'badge-primary badge-outline'">{{ badgeText }}</span>
  </div>
</template>
