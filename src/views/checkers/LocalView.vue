<script setup lang="ts">
import { computed, ref } from 'vue'
import BackPill from '@/components/BackPill.vue'
import GameOverPanel from '@/components/GameOverPanel.vue'
import StatusBar from '@/components/StatusBar.vue'
import CheckersBoard from '@/games/checkers/CheckersBoard.vue'
import { useCheckersGame } from '@/games/checkers/useCheckersGame'

const g = useCheckersGame()
const flipEachTurn = ref(true)
const orientation = computed<'w' | 'b'>(() => (flipEachTurn.value ? g.state.value.turn : 'w'))

const lastMove = computed(() => {
  const h = g.state.value.history
  return h.length ? { from: h[h.length - 1].from, to: h[h.length - 1].to } : null
})
const pieceCount = (color: 'w' | 'b') => g.state.value.board.filter((p) => p?.color === color).length
const turnLabel = computed(() => {
  if (g.forcedFrom.value) return 'Cattura multipla: continua con la stessa pedina'
  return g.state.value.turn === 'w' ? 'Turno del Chiaro' : 'Turno dello Scuro'
})
const gameOver = computed(() => g.state.value.status !== 'playing')
const overTitle = computed(() => {
  if (g.state.value.status === 'white-won') return 'Vince il Chiaro!'
  if (g.state.value.status === 'black-won') return 'Vince lo Scuro!'
  return 'Partita patta'
})
const overDetail = computed(() => {
  if (g.state.value.status === 'draw') return 'Troppe mosse senza catture.'
  const loser = g.state.value.status === 'white-won' ? 'Scuro' : 'Chiaro'
  return pieceCount(g.state.value.status === 'white-won' ? 'b' : 'w') === 0 ? `Lo ${loser} non ha più pedine.` : `Lo ${loser} non ha più mosse legali.`
})
</script>

<template>
  <div class="page-gradient min-h-screen">
    <div class="mx-auto max-w-2xl px-4 py-4">
      <div class="mb-3 flex items-center justify-between">
        <BackPill to="/dama" label="Dama" />
        <label class="label cursor-pointer gap-2 text-xs"><span class="label-text">Ruota a ogni turno</span><input v-model="flipEachTurn" type="checkbox" class="toggle toggle-sm toggle-primary" /></label>
      </div>

      <StatusBar :label="turnLabel" :sub="`Chiaro: ${pieceCount('w')} pedine · Scuro: ${pieceCount('b')} pedine`" :badge-text="g.forcedFrom.value ? 'Cattura' : undefined" />

      <div class="my-4">
        <CheckersBoard
          :board="g.state.value.board" :selected="g.selected.value" :legal-targets="g.legalTargets.value" :last-move="lastMove"
          :orientation="orientation" :interactive="!gameOver" @square-click="g.clickSquare"
        />
      </div>

      <GameOverPanel v-if="gameOver" :title="overTitle" :detail="overDetail" can-rematch @rematch="g.reset" @home="$router.push('/dama')" />
    </div>
  </div>
</template>
