<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import BackPill from '@/components/BackPill.vue'
import GameOverPanel from '@/components/GameOverPanel.vue'
import StatusBar from '@/components/StatusBar.vue'
import PokerTable from '@/games/poker/PokerTable.vue'
import type { PlayerCount, PokerVariant } from '@/games/poker/engine'
import { usePokerGame } from '@/games/poker/usePokerGame'

const phase = ref<'setup' | 'playing'>('setup')
const variant = ref<PokerVariant>('holdem')
const players = ref<PlayerCount>(2)
const names = ref<string[]>(['Giocatore 1', 'Giocatore 2', 'Giocatore 3', 'Giocatore 4', 'Giocatore 5', 'Giocatore 6'])
// In modalità "stesso schermo" le mani sono private: a ogni cambio di turno va ri-confermata
// la lettura, per non far vedere di sfuggita le carte di chi ha appena giocato.
const revealed = ref(false)

const g = usePokerGame()

function setPlayers(n: number) {
  players.value = n as PlayerCount
}

function start() {
  g.reset(variant.value, players.value)
  revealed.value = false
  phase.value = 'playing'
}

watch(() => g.state.value.turn, () => { revealed.value = false })

const activeNames = computed(() => names.value.slice(0, players.value))
const gameOver = computed(() => g.state.value.status === 'finished')
const turnLabel = computed(() => (gameOver.value ? 'Mano finita' : `Tocca a ${activeNames.value[g.state.value.turn]}`))

function fold() { g.act(g.state.value.turn, { type: 'fold' }) }
function checkCall() { g.act(g.state.value.turn, { type: 'checkCall' }) }
function raiseTo(amount: number) { g.act(g.state.value.turn, { type: 'raiseTo', amount }) }
function discard(indices: number[]) { g.discard(g.state.value.turn, indices) }

const overTitle = computed(() => {
  const results = g.state.value.results
  if (!results) return ''
  const winners = results.filter((r) => r.amount > 0)
  if (winners.length === 1) return `Vince ${activeNames.value[winners[0].seat]}!`
  return `Piatto diviso tra ${winners.map((w) => activeNames.value[w.seat]).join(' e ')}`
})
const overDetail = computed(() => {
  const results = g.state.value.results
  if (!results) return ''
  return results.map((r) => `${activeNames.value[r.seat]}: +${r.amount}${r.categoryLabel ? ` (${r.categoryLabel})` : ''}`).join(' · ')
})
</script>

<template>
  <div class="page-gradient min-h-screen">
    <div class="mx-auto max-w-2xl px-4 py-4">
      <BackPill to="/poker" label="Poker" />

      <template v-if="phase === 'setup'">
        <h1 class="font-display mb-4 mt-4 text-center text-2xl font-bold">Poker, stesso schermo</h1>
        <div class="mx-auto max-w-sm rounded-box bg-base-100 p-5 shadow-md">
          <p class="mb-2 text-sm font-medium">Variante</p>
          <div class="join mb-4 w-full">
            <button type="button" class="btn join-item flex-1" :class="variant === 'holdem' ? 'btn-primary' : 'btn-outline'" @click="variant = 'holdem'">Texas Hold'em</button>
            <button type="button" class="btn join-item flex-1" :class="variant === 'draw' ? 'btn-primary' : 'btn-outline'" @click="variant = 'draw'">All'italiana</button>
          </div>
          <p class="mb-2 text-sm font-medium">Quanti giocatori?</p>
          <div class="join mb-4 w-full">
            <button v-for="n in [2, 3, 4, 5, 6]" :key="n" type="button" class="btn join-item flex-1" :class="players === n ? 'btn-primary' : 'btn-outline'" @click="setPlayers(n)">{{ n }}</button>
          </div>
          <div class="flex flex-col gap-2">
            <input v-for="(n, i) in players" :key="i" v-model="names[i]" class="input input-bordered w-full" :placeholder="`Giocatore ${i + 1}`" maxlength="20" />
          </div>
          <button class="btn btn-pop btn-block mt-4 rounded-full" @click="start">Inizia</button>
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
          <PokerTable
            :state="g.state.value" :seat="gameOver ? 0 : g.state.value.turn" :names="activeNames" :interactive="!gameOver"
            @fold="fold" @check-call="checkCall" @raise-to="raiseTo" @discard="discard"
          />
        </div>
      </template>

      <GameOverPanel v-if="gameOver" :title="overTitle" :detail="overDetail" can-rematch @rematch="start" @home="$router.push('/poker')" />
    </div>
  </div>
</template>
