<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BackPill from '@/components/BackPill.vue'
import GameOverPanel from '@/components/GameOverPanel.vue'
import SeatRoomLobby from '@/components/SeatRoomLobby.vue'
import StatusBar from '@/components/StatusBar.vue'
import PokerTable from '@/games/poker/PokerTable.vue'
import { createGame, type PlayerCount, type PokerResult, type PokerState, type PokerVariant } from '@/games/poker/engine'
import { usePokerGame } from '@/games/poker/usePokerGame'
import { seatRoomShareUrl, seatRoomsReady, useSeatRoom } from '@/lib/onlineRoomMulti'
import { useCountdownCopy } from '@/lib/onlineRoom'

const route = useRoute()
const router = useRouter()
const room = useSeatRoom<PokerState, PokerResult[]>('poker')
const { copied, copy } = useCountdownCopy()

// scelta valida solo per chi crea la stanza: chi entra con un codice gioca la variante già decisa
const variant = ref<PokerVariant>('holdem')
const makeInitial = (players: number) => createGame(variant.value, players as PlayerCount)
// per la rivincita, si riusa sempre la variante della partita già in corso (non quella scelta localmente
// da chi preme il pulsante, che potrebbe non essere stato lui a creare la stanza)
const rematchInitial = (players: number) => createGame(g.state.value.variant, players as PlayerCount)

// `onMove` scatta solo per le mosse giocate qui in locale, mai per la sincronizzazione da remoto.
const g = usePokerGame(undefined, (state) => {
  room.pushState(state, state.status === 'finished' ? state.results : null)
})

watch(() => room.gameState.value, (state) => { if (state) g.setState(state) }, { immediate: true })
watch(() => [room.seats.value.length, room.maxPlayers.value, room.status.value], () => {
  if (room.status.value === 'lobby' && room.seats.value.length === room.maxPlayers.value) room.startIfFull(makeInitial)
}, { immediate: true })

onMounted(() => {
  const roomParam = route.params.room
  if (typeof roomParam === 'string' && roomParam) room.join(roomParam).catch(() => {})
})

async function createRoom(maxPlayers: number) {
  const code = await room.create(maxPlayers).catch(() => null)
  if (code) router.replace({ name: 'poker-room', params: { room: code } })
}
async function joinRoom(code: string) {
  await room.join(code).catch(() => {})
  if (room.code.value) router.replace({ name: 'poker-room', params: { room: room.code.value } })
}

const link = computed(() => (room.code.value ? seatRoomShareUrl('poker', room.code.value) : null))
const interactive = computed(() => room.status.value === 'playing' && g.state.value.turn === room.mySeat.value)
const turnLabel = computed(() => {
  if (room.status.value === 'finished') return 'Mano finita'
  if (room.status.value !== 'playing') return ''
  return interactive.value ? 'Tocca a te' : `Tocca a ${room.playerNames.value[g.state.value.turn] ?? 'un avversario'}`
})
const gameOver = computed(() => room.status.value === 'finished')
const overTitle = computed(() => {
  const results = room.winner.value
  if (!results) return ''
  const winners = results.filter((r) => r.amount > 0)
  const youWon = winners.some((w) => w.seat === room.mySeat.value)
  if (youWon && winners.length === 1) return 'Hai vinto!'
  if (youWon) return 'Vinci parte del piatto!'
  return `Vince ${room.playerNames.value[winners[0]?.seat] ?? 'un avversario'}`
})
const overDetail = computed(() => {
  const results = room.winner.value
  if (!results) return ''
  return results.map((r) => `${room.playerNames.value[r.seat] ?? '—'}: +${r.amount}${r.categoryLabel ? ` (${r.categoryLabel})` : ''}`).join(' · ')
})

function fold() { if (interactive.value) g.act(room.mySeat.value, { type: 'fold' }) }
function checkCall() { if (interactive.value) g.act(room.mySeat.value, { type: 'checkCall' }) }
function raiseTo(amount: number) { if (interactive.value) g.act(room.mySeat.value, { type: 'raiseTo', amount }) }
function discard(indices: number[]) { if (room.status.value === 'playing' && g.state.value.turn === room.mySeat.value) g.discard(room.mySeat.value, indices) }
function rematch() { room.rematch(rematchInitial) }
</script>

<template>
  <div class="page-gradient min-h-screen">
    <div class="mx-auto max-w-2xl px-4 py-4">
      <BackPill to="/poker" label="Poker" />

      <div v-if="!seatRoomsReady" class="mt-6 rounded-box bg-base-100 px-4 py-3 text-sm shadow-sm">
        <span>Il gioco online non è configurato su questo sito (mancano le chiavi Supabase). Prova la modalità "stesso schermo".</span>
      </div>

      <template v-else-if="room.status.value === 'lobby'">
        <h1 class="font-display mb-4 mt-2 text-center text-2xl font-bold">Poker online</h1>
        <div v-if="!room.code.value" class="mx-auto mb-4 max-w-sm rounded-box bg-base-100 p-4 shadow-md">
          <p class="mb-2 text-center text-sm font-medium">Variante (solo per chi crea la stanza)</p>
          <div class="join w-full">
            <button type="button" class="btn join-item flex-1" :class="variant === 'holdem' ? 'btn-primary' : 'btn-outline'" @click="variant = 'holdem'">Texas Hold'em</button>
            <button type="button" class="btn join-item flex-1" :class="variant === 'draw' ? 'btn-primary' : 'btn-outline'" @click="variant = 'draw'">All'italiana</button>
          </div>
        </div>
        <SeatRoomLobby
          :player-options="[2, 3, 4, 5, 6]" :code="room.code.value" :seats="room.seats.value" :max-players="room.maxPlayers.value"
          :connecting="room.connecting.value" :error="room.error.value" :share-link="link" :copied="copied.value"
          @create="createRoom" @join="joinRoom" @copy="link && copy(link)"
        />
      </template>

      <template v-else>
        <StatusBar :label="turnLabel" :sub="`Tu sei ${room.playerNames.value[room.mySeat.value] ?? 'in attesa'}`" :badge-text="interactive ? 'Tuo turno' : undefined" class="mt-2" />
        <div class="my-4">
          <PokerTable
            :state="g.state.value" :seat="room.mySeat.value" :names="room.playerNames.value" :interactive="interactive"
            @fold="fold" @check-call="checkCall" @raise-to="raiseTo" @discard="discard"
          />
        </div>
      </template>

      <GameOverPanel v-if="gameOver" :title="overTitle" :detail="overDetail" can-rematch rematch-label="Nuova mano" @rematch="rematch" @home="router.push('/poker')" />
    </div>
  </div>
</template>
