<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BackPill from '@/components/BackPill.vue'
import GameOverPanel from '@/components/GameOverPanel.vue'
import RoomLobby from '@/components/RoomLobby.vue'
import StatusBar from '@/components/StatusBar.vue'
import TrisBoard from '@/games/tris/TrisBoard.vue'
import { createGame, type Mark, type TrisState } from '@/games/tris/engine'
import { useTrisGame } from '@/games/tris/useTrisGame'
import { shareUrl, supabaseReady, useCountdownCopy, useOnlineRoom } from '@/lib/onlineRoom'

const route = useRoute()
const router = useRouter()
const room = useOnlineRoom<TrisState>('tris', createGame)
const { copied, copy } = useCountdownCopy()

// host gioca sempre X (colore 'w'), guest gioca sempre O (colore 'b'), come per gli altri giochi.
const markForColor = (c: 'w' | 'b'): Mark => (c === 'w' ? 'X' : 'O')

// `onMove` scatta solo per le mosse giocate qui in locale, mai per la sincronizzazione da remoto.
const g = useTrisGame(undefined, (state) => {
  const winner = state.status === 'playing' ? null : state.status === 'draw' ? 'draw' : state.status === 'x-won' ? 'w' : 'b'
  room.pushState(state, winner)
})

watch(() => room.gameState.value, (state) => { if (state) g.setState(state) }, { immediate: true })

onMounted(() => {
  const roomParam = route.params.room
  if (typeof roomParam === 'string' && roomParam) room.join(roomParam).catch(() => {})
})

async function createRoom() {
  const code = await room.create().catch(() => null)
  if (code) router.replace({ name: 'tris-room', params: { room: code } })
}
async function joinRoom(code: string) {
  await room.join(code).catch(() => {})
  if (room.code.value) router.replace({ name: 'tris-room', params: { room: room.code.value } })
}

const link = computed(() => (room.code.value ? shareUrl('tris-room', room.code.value) : null))
const yourMark = computed(() => (room.yourColor.value ? markForColor(room.yourColor.value) : null))
const yourTurn = computed(() => room.status.value === 'playing' && g.state.value.turn === yourMark.value)
const turnLabel = computed(() => {
  if (room.status.value !== 'playing') return ''
  return yourTurn.value ? 'Tocca a te' : `In attesa di ${room.opponentName.value ?? 'avversario'}`
})
const gameOver = computed(() => room.status.value === 'finished')
const overTitle = computed(() => {
  if (g.state.value.status === 'draw') return 'Pareggio!'
  const youWon = (g.state.value.status === 'x-won' && room.yourColor.value === 'w') || (g.state.value.status === 'o-won' && room.yourColor.value === 'b')
  return youWon ? 'Hai vinto!' : 'Hai perso'
})

function rematch() { room.rematch(createGame) }
</script>

<template>
  <div class="page-gradient min-h-screen">
    <div class="mx-auto max-w-md px-4 py-4">
      <BackPill to="/tris" label="Tris" />

      <div v-if="!supabaseReady" class="mt-6 rounded-box bg-base-100 px-4 py-3 text-sm shadow-sm">
        <span>Il gioco online non è configurato su questo sito (mancano le chiavi Supabase). Prova la modalità "stesso schermo".</span>
      </div>

      <template v-else-if="room.status.value !== 'playing' && room.status.value !== 'finished'">
        <h1 class="font-display mb-4 mt-2 text-center text-2xl font-bold">Tris online</h1>
        <RoomLobby
          :code="room.code.value" :status="room.status.value" :connecting="room.connecting.value" :error="room.error.value"
          :share-link="link" :copied="copied.value" @create="createRoom" @join="joinRoom" @copy="link && copy(link)"
        />
      </template>

      <template v-else>
        <StatusBar :label="turnLabel" :sub="`Tu giochi ${yourMark} · avversario: ${room.opponentName.value ?? '—'}`" :badge-text="yourTurn ? 'Tuo turno' : undefined" class="mt-2" />
        <div class="my-6">
          <TrisBoard :board="g.state.value.board" :winning-line="g.state.value.winningLine" :interactive="yourTurn" @cell-click="g.clickCell" />
        </div>
      </template>

      <GameOverPanel v-if="gameOver" :title="overTitle" can-rematch rematch-label="Nuova partita" @rematch="rematch" @home="router.push('/tris')" />
    </div>
  </div>
</template>
