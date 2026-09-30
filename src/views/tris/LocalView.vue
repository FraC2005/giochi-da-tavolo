<script setup lang="ts">
import { computed } from 'vue'
import BackPill from '@/components/BackPill.vue'
import GameOverPanel from '@/components/GameOverPanel.vue'
import StatusBar from '@/components/StatusBar.vue'
import TrisBoard from '@/games/tris/TrisBoard.vue'
import { useTrisGame } from '@/games/tris/useTrisGame'

const g = useTrisGame()

const turnLabel = computed(() => `Turno di ${g.state.value.turn}`)
const gameOver = computed(() => g.state.value.status !== 'playing')
const overTitle = computed(() => {
  if (g.state.value.status === 'draw') return 'Pareggio!'
  return `Vince ${g.state.value.status === 'x-won' ? 'X' : 'O'}!`
})
</script>

<template>
  <div class="page-gradient min-h-screen">
    <div class="mx-auto max-w-md px-4 py-4">
      <BackPill to="/tris" label="Tris" />

      <StatusBar :label="turnLabel" sub="Stesso schermo, a turni" class="mt-3" />

      <div class="my-6">
        <TrisBoard :board="g.state.value.board" :winning-line="g.state.value.winningLine" :interactive="!gameOver" @cell-click="g.clickCell" />
      </div>

      <GameOverPanel v-if="gameOver" :title="overTitle" can-rematch @rematch="g.reset" @home="$router.push('/tris')" />
    </div>
  </div>
</template>
