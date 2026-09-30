<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import BackPill from '@/components/BackPill.vue'
import GameOverPanel from '@/components/GameOverPanel.vue'
import StatusBar from '@/components/StatusBar.vue'
import BriscolaTable from '@/games/briscola/BriscolaTable.vue'
import { outcome, type PlayerCount } from '@/games/briscola/engine'
import { useBriscolaGame } from '@/games/briscola/useBriscolaGame'
import type { Card } from '@/games/cards/italianDeck'

const phase = ref<'setup' | 'playing'>('setup')
const players = ref<PlayerCount>(2)
const names = ref<string[]>(['Giocatore 1', 'Giocatore 2', 'Giocatore 3', 'Giocatore 4'])
// In modalità "stesso schermo" le mani sono private: a ogni cambio di turno va ri-confermata
// la lettura, per non far vedere di sfuggita le carte di chi ha appena giocato.
const revealed = ref(false)

const g = useBriscolaGame()

function start() {
  g.reset(players.value)
  revealed.value = false
  phase.value = 'playing'
}

watch(() => g.state.value.turn, () => { revealed.value = false })

function playCard(card: Card) {
  g.play(g.state.value.turn, card)
}

const activeNames = computed(() => names.value.slice(0, players.value))
const gameOver = computed(() => g.state.value.status === 'finished')
const result = computed(() => outcome(g.state.value))
const turnLabel = computed(() => (gameOver.value ? 'Partita finita' : `Tocca a ${activeNames.value[g.state.value.turn]}`))
const overTitle = computed(() => {
  const r = result.value
  if (!r) return ''
  if (r.draw) return 'Pareggio a 60!'
  if (players.value === 2) return `Vince ${activeNames.value[r.winners[0]]}!`
  return `Vince la coppia ${activeNames.value[r.winners[0]]} e ${activeNames.value[r.winners[1]]}!`
})
const overDetail = computed(() => {
  if (players.value === 2) return `${activeNames.value[0]}: ${g.state.value.points[0]} punti · ${activeNames.value[1]}: ${g.state.value.points[1]} punti`
  const teamA = g.state.value.points[0] + g.state.value.points[2]
  const teamB = g.state.value.points[1] + g.state.value.points[3]
  return `Coppia ${activeNames.value[0]}/${activeNames.value[2]}: ${teamA} punti · Coppia ${activeNames.value[1]}/${activeNames.value[3]}: ${teamB} punti`
})
</script>

<template>
  <div class="page-gradient min-h-screen">
    <div class="mx-auto max-w-2xl px-4 py-4">
      <BackPill to="/briscola" label="Briscola" />

      <template v-if="phase === 'setup'">
        <h1 class="font-display mb-4 mt-4 text-center text-2xl font-bold">Briscola, stesso schermo</h1>
        <div class="mx-auto max-w-sm rounded-box bg-base-100 p-5 shadow-md">
          <p class="mb-2 text-sm font-medium">Quanti giocatori?</p>
          <div class="join mb-4 w-full">
            <button type="button" class="btn join-item flex-1" :class="players === 2 ? 'btn-primary' : 'btn-outline'" @click="players = 2">2 giocatori</button>
            <button type="button" class="btn join-item flex-1" :class="players === 4 ? 'btn-primary' : 'btn-outline'" @click="players = 4">4 giocatori (2 coppie)</button>
          </div>
          <div class="flex flex-col gap-2">
            <input v-for="(n, i) in players" :key="i" v-model="names[i]" class="input input-bordered w-full" :placeholder="`Giocatore ${i + 1}`" maxlength="20" />
          </div>
          <button class="btn btn-pop btn-block mt-4 rounded-full" @click="start">Inizia</button>
          <p v-if="players === 4" class="mt-3 text-center text-xs opacity-50">Giocatore 1 e 3 fanno coppia contro Giocatore 2 e 4.</p>
        </div>
      </template>

      <template v-else-if="!gameOver && !revealed">
        <div class="mt-10 flex flex-col items-center gap-4 text-center">
          <p class="text-sm opacity-60">Passa il dispositivo a</p>
          <p class="font-display text-2xl font-bold">{{ activeNames[g.state.value.turn] }}</p>
          <button class="btn btn-pop rounded-full" @click="revealed = true">Mostra le mie carte</button>
        </div>
      </template>

      <template v-else>
        <StatusBar :label="turnLabel" sub="Stesso schermo, a turni" class="mt-3" />
        <div class="my-4">
          <BriscolaTable :state="g.state.value" :seat="g.state.value.turn" :names="activeNames" :interactive="!gameOver" @play="playCard" />
        </div>
      </template>

      <GameOverPanel v-if="gameOver" :title="overTitle" :detail="overDetail" can-rematch @rematch="start" @home="$router.push('/briscola')" />
    </div>
  </div>
</template>
