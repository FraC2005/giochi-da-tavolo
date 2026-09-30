<script setup lang="ts">
import { computed, ref } from 'vue'
import BackPill from '@/components/BackPill.vue'
import GameOverPanel from '@/components/GameOverPanel.vue'
import StatusBar from '@/components/StatusBar.vue'
import ChessBoard from '@/games/chess/ChessBoard.vue'
import PromotionPicker from '@/games/chess/PromotionPicker.vue'
import { useChessGame } from '@/games/chess/useChessGame'

const g = useChessGame()
const flipEachTurn = ref(true)
const orientation = computed<'w' | 'b'>(() => (flipEachTurn.value ? g.game.value.turn : 'w'))

const checkSquare = computed(() => {
  if (!g.game.value.inCheck) return null
  for (const row of g.game.value.board) for (const cell of row) if (cell?.type === 'k' && cell.color === g.game.value.turn) return cell.square
  return null
})
const turnLabel = computed(() => (g.game.value.turn === 'w' ? 'Turno del Bianco' : 'Turno del Nero'))
const captured = computed(() => g.game.value.captured())
const gameOver = computed(() => g.status.value !== 'playing')
const overTitle = computed(() => {
  if (g.status.value === 'checkmate') return `Scacco matto! Vince il ${g.winner.value === 'w' ? 'Bianco' : 'Nero'}`
  if (g.status.value === 'stalemate') return 'Stallo: patta'
  return 'Partita patta'
})
const overDetail = computed(() => (g.status.value === 'draw' ? g.game.value.drawReason() ?? undefined : undefined))
</script>

<template>
  <div class="page-gradient min-h-screen">
    <div class="mx-auto max-w-2xl px-4 py-4">
      <div class="mb-3 flex items-center justify-between">
        <BackPill to="/scacchi" label="Scacchi" />
        <label class="label cursor-pointer gap-2 text-xs"><span class="label-text">Ruota a ogni turno</span><input v-model="flipEachTurn" type="checkbox" class="toggle toggle-sm toggle-primary" /></label>
      </div>

      <StatusBar :label="turnLabel" :sub="g.game.value.inCheck ? 'Sotto scacco' : `${g.game.value.historySAN().length} mosse giocate`" :badge-text="g.game.value.inCheck ? 'Scacco' : undefined" :alert="g.game.value.inCheck" />

      <div class="my-4">
        <ChessBoard
          :board="g.game.value.board" :selected="g.selected.value" :legal-targets="g.legalTargets.value" :last-move="g.lastMove.value"
          :check-square="checkSquare" :orientation="orientation" :interactive="!gameOver"
          @square-click="(sq) => g.clickSquare(sq, true)"
        />
      </div>

      <div class="grid grid-cols-2 gap-3 text-sm">
        <div class="rounded-box bg-base-100 px-3 py-2 shadow-sm"><p class="mb-1 text-xs font-semibold uppercase opacity-50">Catturati dal Bianco</p><p class="text-lg leading-none">{{ captured.b.map((p) => ({ p: '♟', n: '♞', b: '♝', r: '♜', q: '♛' }[p])).join(' ') || '—' }}</p></div>
        <div class="rounded-box bg-base-100 px-3 py-2 shadow-sm"><p class="mb-1 text-xs font-semibold uppercase opacity-50">Catturati dal Nero</p><p class="text-lg leading-none">{{ captured.w.map((p) => ({ p: '♙', n: '♘', b: '♗', r: '♖', q: '♕' }[p])).join(' ') || '—' }}</p></div>
      </div>

      <PromotionPicker v-if="g.pendingPromotion.value" :color="g.game.value.turn" @choose="g.choosePromotion" />
      <GameOverPanel v-if="gameOver" :title="overTitle" :detail="overDetail" can-rematch @rematch="g.reset" @home="$router.push('/scacchi')" />
    </div>
  </div>
</template>
