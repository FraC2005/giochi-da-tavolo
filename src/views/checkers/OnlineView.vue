<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BackPill from '@/components/BackPill.vue'
import GameOverPanel from '@/components/GameOverPanel.vue'
import RoomLobby from '@/components/RoomLobby.vue'
import StatusBar from '@/components/StatusBar.vue'
import CheckersBoard from '@/games/checkers/CheckersBoard.vue'
import { createGame, type CheckersState } from '@/games/checkers/engine'
import { useCheckersGame } from '@/games/checkers/useCheckersGame'
import { shareUrl, supabaseReady, useCountdownCopy, useOnlineRoom } from '@/lib/onlineRoom'

const route = useRoute()
const router = useRouter()
const room = useOnlineRoom<CheckersState>('checkers', createGame)
const { copied, copy } = useCountdownCopy()

// `onMove` scatta solo per le mosse giocate qui in locale, mai per la sincronizzazione da remoto.
const g = useCheckersGame(undefined, (state) => {
  const winner = state.status === 'playing' ? null : state.status === 'draw' ? 'draw' : state.status === 'white-won' ? 'w' : 'b'
  room.pushState(state, winner)
})

watch(() => room.gameState.value, (state) => { if (state) g.setState(state) }, { immediate: true })

onMounted(() => {
  const roomParam = route.params.room
  if (typeof roomParam === 'string' && roomParam) room.join(roomParam).catch(() => {})
})

async function createRoom() {
  const code = await room.create().catch(() => null)
  if (code) router.replace({ name: 'checkers-room', params: { room: code } })
}
async function joinRoom(code: string) {
  await room.join(code).catch(() => {})
  if (room.code.value) router.replace({ name: 'checkers-room', params: { room: room.code.value } })
}

const link = computed(() => (room.code.value ? shareUrl('checkers-room', room.code.value) : null))
const yourTurn = computed(() => room.status.value === 'playing' && room.yourColor.value === g.state.value.turn)
const lastMove = computed(() => {
  const h = g.state.value.history
  return h.length ? { from: h[h.length - 1].from, to: h[h.length - 1].to } : null
})
const pieceCount = (color: 'w' | 'b') => g.state.value.board.filter((p) => p?.color === color).length
const yourColorLabel = computed(() => (room.yourColor.value === 'w' ? 'Chiaro' : 'Scuro'))
const turnLabel = computed(() => {
  if (room.status.value !== 'playing') return ''
  if (g.forcedFrom.value && yourTurn.value) return 'Cattura multipla: continua'
  return yourTurn.value ? 'Tocca a te' : `In attesa di ${room.opponentName.value ?? 'avversario'}`
})
const gameOver = computed(() => room.status.value === 'finished')
const overTitle = computed(() => {
  if (g.state.value.status === 'draw') return 'Partita patta'
  const youWon = (g.state.value.status === 'white-won' && room.yourColor.value === 'w') || (g.state.value.status === 'black-won' && room.yourColor.value === 'b')
  return youWon ? 'Hai vinto!' : 'Hai perso'
})

function rematch() { room.rematch(createGame) }
</script>

<template>
  <div class="page-gradient min-h-screen">
    <div class="mx-auto max-w-2xl px-4 py-4">
      <BackPill to="/dama" label="Dama" />

      <div v-if="!supabaseReady" class="mt-6 rounded-box bg-base-100 px-4 py-3 text-sm shadow-sm">
        <span>Il gioco online non è configurato su questo sito (mancano le chiavi Supabase). Prova la modalità "stesso schermo".</span>
      </div>

      <template v-else-if="room.status.value !== 'playing' && room.status.value !== 'finished'">
        <h1 class="font-display mb-4 mt-2 text-center text-2xl font-bold">Dama online</h1>
        <RoomLobby
          :code="room.code.value" :status="room.status.value" :connecting="room.connecting.value" :error="room.error.value"
          :share-link="link" :copied="copied.value" @create="createRoom" @join="joinRoom" @copy="link && copy(link)"
        />
      </template>

      <template v-else>
        <StatusBar :label="turnLabel" :sub="`Tu giochi lo ${yourColorLabel} · avversario: ${room.opponentName.value ?? '—'}`" :badge-text="yourTurn ? 'Tuo turno' : undefined" class="mt-2" />
        <p class="mt-2 text-center text-xs opacity-60">Chiaro: {{ pieceCount('w') }} pedine · Scuro: {{ pieceCount('b') }} pedine</p>
        <div class="my-4">
          <CheckersBoard
            :board="g.state.value.board" :selected="g.selected.value" :legal-targets="g.legalTargets.value" :last-move="lastMove"
            :orientation="room.yourColor.value ?? 'w'" :interactive="yourTurn" @square-click="g.clickSquare"
          />
        </div>
      </template>

      <GameOverPanel v-if="gameOver" :title="overTitle" can-rematch rematch-label="Nuova partita" @rematch="rematch" @home="router.push('/dama')" />
    </div>
  </div>
</template>
