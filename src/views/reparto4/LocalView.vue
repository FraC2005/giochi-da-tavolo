<script setup lang="ts">
import BackPill from '@/components/BackPill.vue'
</script>

<template>
  <div class="flex h-dvh flex-col overflow-hidden bg-[#090c0d] text-[#dfe3e8]">
    <header class="flex shrink-0 items-center justify-between gap-4 border-b border-white/10 px-4 py-3">
      <BackPill to="/" label="Tutti i giochi" class="!text-[#dfe3e8]" />
      <h1 class="font-display text-sm font-semibold tracking-wide">Reparto 4 · Ospedale San Vittore</h1>
      <span class="w-28" aria-hidden="true" />
    </header>
    <main class="min-h-0 flex-1">
      <iframe
        class="h-full w-full border-0"
        src="/games/reparto4/index.html"
        title="Reparto 4, gioco horror 3D"
        allow="gamepad"
        allowpointerlock
        allowfullscreen
      />
    </main>
  </div>
</template>
