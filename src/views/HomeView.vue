<script setup lang="ts">
import { useRouter } from 'vue-router'
import GameTile from '@/components/GameTile.vue'
import { GAMES } from '@/games/registry'

const router = useRouter()
</script>

<template>
  <div class="page-gradient min-h-screen">
    <header class="mx-auto max-w-3xl px-6 py-6">
      <div class="font-display flex items-center gap-2 text-base font-semibold tracking-tight">
        <span class="grid h-7 w-7 place-items-center rounded-field bg-base-100 text-sm shadow-sm">🎲</span>Arcade
      </div>
    </header>

    <main class="mx-auto max-w-3xl px-6 pb-20 pt-4">
      <h1 class="font-display text-[clamp(2rem,5.5vw,2.8rem)] font-extrabold leading-tight tracking-tight">Scegli un gioco, sfida un amico</h1>
      <p class="mt-3 max-w-lg text-base opacity-70">Sullo stesso schermo a turni, oppure online da case diverse con un codice da condividere. Nessuna registrazione.</p>

      <div class="mt-10 grid gap-4 sm:grid-cols-2">
        <GameTile v-for="g in GAMES" :key="g.id" :game="g" @click="router.push(`/${g.slug}`)" />
        <div class="flex flex-col items-start gap-3 rounded-box border-2 border-dashed border-base-content/15 p-5 opacity-60">
          <span class="grid h-12 w-12 place-items-center rounded-field border-2 border-dashed border-base-content/20 text-2xl leading-none">+</span>
          <span class="font-display text-lg font-semibold tracking-tight">Altri giochi</span>
          <span class="text-sm leading-snug">In arrivo prossimamente.</span>
        </div>
      </div>
    </main>

    <footer class="px-6 py-6 text-center text-xs opacity-50">Progetto personale, fatto per divertimento.</footer>
  </div>
</template>
