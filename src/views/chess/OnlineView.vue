<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BackPill from '@/components/BackPill.vue'
import GameOverPanel from '@/components/GameOverPanel.vue'
import RoomLobby from '@/components/RoomLobby.vue'
import StatusBar from '@/components/StatusBar.vue'
import ChessBoard from '@/games/chess/ChessBoard.vue'
import type { MoveRecord } from '@/games/chess/engine'
import PromotionPicker from '@/games/chess/PromotionPicker.vue'
import { useChessGame } from '@/games/chess/useChessGame'
import { shareUrl, supabaseReady, useCountdownCopy, useOnlineRoom } from '@/lib/onlineRoom'

const route = useRoute()
const router = useRouter()
const room = useOnlineRoom<MoveRecord[]>('chess', () => [])
const { copied, copy } = useCountdownCopy()

// `onMove` scatta solo per le mosse giocate qui in locale (commit()), mai per la sincronizzazione
// da remoto (setFromMoves non lo richiama): ogni chiamata corrisponde quindi a una mossa nostra da inviare.
const g = useChessGame([], (moves) => {
  const finished = g.status.value !== 'playing'
  room.pushState(moves, finished ? (g.winner.value ?? 'draw') : null)
})

watch(() => room.gameState.value, (moves) => { if (moves) g.setFromMoves(moves) }, { immediate: true })

onMounted(() => {
  const roomParam = route.params.room
  if (typeof roomParam === 'string' && roomParam) room.join(roomParam).catch(() => {})
})

async function createRoom() {
  const code = await room.create().catch(() => null)
  if (code) router.replace({ name: 'chess-room', params: { room: code } })
}
async function joinRoom(code: string) {
  await room.join(code).catch(() => {})
  if (room.code.value) router.replace({ name: 'chess-room', params: { room: room.code.value } })
}

const link = computed(() => (room.code.value ? shareUrl('chess-room', room.code.value) : null))
const yourTurn = computed(() => room.status.value === 'playing' && room.yourColor.value === g.game.value.turn)
const checkSquare = computed(() => {
  if (!g.game.value.inCheck) return null
  for (const row of g.game.value.board) for (const cell of row) if (cell?.type === 'k' && cell.color === g.game.value.turn) return cell.square
  return null
})
const turnLabel = computed(() => {
  if (room.status.value !== 'playing') return ''
  if (yourTurn.value) return 'Tocca a te'
  return `In attesa di ${room.opponentName.value ?? 'avversario'}`
})
const yourColorLabel = computed(() => (room.yourColor.value === 'w' ? 'Bianco' : 'Nero'))
const gameOver = computed(() => room.status.value === 'finished')
const overTitle = computed(() => {
  if (g.status.value === 'checkmate') return g.winner.value === room.yourColor.value ? 'Hai vinto per scacco matto!' : 'Hai perso per scacco matto'
  if (g.status.value === 'stalemate') return 'Stallo: patta'
  return 'Partita patta'
})

function rematch() { room.rematch(() => []) }
</script>

<template>
  <div class="page-gradient min-h-screen">
    <div class="mx-auto max-w-2xl px-4 py-4">
      <BackPill to="/scacchi" label="Scacchi" />

      <div v-if="!supabaseReady" class="mt-6 rounded-box bg-base-100 px-4 py-3 text-sm shadow-sm">
        <span>Il gioco online non è configurato su questo sito (mancano le chiavi Supabase). Prova la modalità "stesso schermo".</span>
      </div>

      <template v-else-if="room.status.value !== 'playing' && room.status.value !== 'finished'">
        <h1 class="font-display mb-4 mt-2 text-center text-2xl font-bold">Scacchi online</h1>
        <RoomLobby
          :code="room.code.value" :status="room.status.value" :connecting="room.connecting.value" :error="room.error.value"
          :share-link="link" :copied="copied.value" @create="createRoom" @join="joinRoom" @copy="link && copy(link)"
        />
      </template>

      <template v-else>
        <StatusBar :label="turnLabel" :sub="`Tu giochi il ${yourColorLabel} · avversario: ${room.opponentName.value ?? '—'}`" :badge-text="g.game.value.inCheck ? 'Scacco' : yourTurn ? 'Tuo turno' : undefined" :alert="g.game.value.inCheck" class="mt-2" />
        <div class="my-4">
          <ChessBoard
            :board="g.game.value.board" :selected="g.selected.value" :legal-targets="g.legalTargets.value" :last-move="g.lastMove.value"
            :check-square="checkSquare" :orientation="room.yourColor.value ?? 'w'" :interactive="yourTurn"
            @square-click="(sq) => g.clickSquare(sq, true)"
          />
        </div>
      </template>

      <PromotionPicker v-if="g.pendingPromotion.value" :color="g.game.value.turn" @choose="g.choosePromotion" />
      <GameOverPanel v-if="gameOver" :title="overTitle" can-rematch rematch-label="Nuova partita" @rematch="rematch" @home="router.push('/scacchi')" />
    </div>
  </div>
</template>
