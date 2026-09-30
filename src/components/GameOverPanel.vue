<script setup lang="ts">
defineProps<{ title: string; detail?: string; canRematch: boolean; rematchLabel?: string }>()
defineEmits<{ (e: 'rematch'): void; (e: 'home'): void }>()
</script>

<template>
  <div class="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" style="animation: pop-in 0.12s ease-out" @click.self="$emit('home')">
    <div class="w-full max-w-sm rounded-box bg-base-100 p-6 text-center shadow-xl">
      <h2 class="font-display text-xl font-bold tracking-tight">{{ title }}</h2>
      <p v-if="detail" class="mt-1 text-sm opacity-60">{{ detail }}</p>
      <div class="mt-5 flex flex-col gap-2">
        <button v-if="canRematch" class="btn btn-pop btn-block rounded-full" @click="$emit('rematch')">{{ rematchLabel ?? 'Rivincita' }}</button>
        <button class="btn btn-ghost btn-block rounded-full" @click="$emit('home')">Torna al menu</button>
      </div>
    </div>
  </div>
</template>
