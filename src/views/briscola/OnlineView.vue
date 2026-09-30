<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BackPill from '@/components/BackPill.vue'
import GameOverPanel from '@/components/GameOverPanel.vue'
import SeatRoomLobby from '@/components/SeatRoomLobby.vue'
import StatusBar from '@/components/StatusBar.vue'
import BriscolaTable from '@/games/briscola/BriscolaTable.vue'
import { createGame, outcome, type BriscolaOutcome, type BriscolaState, type PlayerCount } from '@/games/briscola/engine'
import { useBriscolaGame } from '@/games/briscola/useBriscolaGame'
import type { Card } from '@/games/cards/italianDeck'
import { seatRoomShareUrl, seatRoomsReady, useSeatRoom } from '@/lib/onlineRoomMulti'
import { useCountdownCopy } from '@/lib/onlineRoom'

const route = useRoute()
const router = useRouter()
const room = useSeatRoom<BriscolaState, BriscolaOutcome>('briscola')
const { copied, copy } = useCountdownCopy()

const makeInitial = (players: number) => createGame(players as PlayerCount)

// `onMove` scatta solo per le mosse giocate qui in locale, mai per la sincronizzazione da remoto.
const g = useBriscolaGame(undefined, (state) => {
  room.pushState(state, state.status === 'finished' ? outcome(state) : null)
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
  if (code) router.replace({ name: 'briscola-room', params: { room: code } })
}
async function joinRoom(code: string) {
  await room.join(code).catch(() => {})
  if (room.code.value) router.replace({ name: 'briscola-room', params: { room: room.code.value } })
}

const link = computed(() => (room.code.value ? seatRoomShareUrl('briscola', room.code.value) : null))
const interactive = computed(() => room.status.value === 'playing' && g.state.value.turn === room.mySeat.value)
const turnLabel = computed(() => {
  if (room.status.value === 'finished') return 'Partita finita'
  if (room.status.value !== 'playing') return ''
  return interactive.value ? 'Tocca a te' : `Tocca a ${room.playerNames.value[g.state.value.turn] ?? 'un avversario'}`
})
const gameOver = computed(() => room.status.value === 'finished')
const result = computed(() => room.winner.value)
const overTitle = computed(() => {
  const r = result.value
  if (!r) return ''
  if (r.draw) return 'Pareggio a 60!'
  if (room.maxPlayers.value === 2) {
    const youWon = r.winners.includes(room.mySeat.value)
    return youWon ? 'Hai vinto!' : 'Hai perso'
  }
  const yourTeamWon = r.winners.includes(room.mySeat.value)
  return yourTeamWon ? 'La tua coppia vince!' : 'Vince la coppia avversaria'
})
const overDetail = computed(() => {
  if (room.maxPlayers.value === 2) return `Tu: ${g.state.value.points[room.mySeat.value] ?? 0} punti · Avversario: ${g.state.value.points[1 - room.mySeat.value] ?? 0} punti`
  const teamA = g.state.value.points[0] + g.state.value.points[2]
  const teamB = g.state.value.points[1] + g.state.value.points[3]
  return `Coppia 1 e 3: ${teamA} punti · Coppia 2 e 4: ${teamB} punti`
})

function playCard(card: Card) {
  if (!interactive.value) return
  g.play(room.mySeat.value, card)
}
function rematch() { room.rematch(makeInitial) }
</script>

<template>
  <div class="page-gradient min-h-screen">
    <div class="mx-auto max-w-2xl px-4 py-4">
      <BackPill to="/briscola" label="Briscola" />

      <div v-if="!seatRoomsReady" class="mt-6 rounded-box bg-base-100 px-4 py-3 text-sm shadow-sm">
        <span>Il gioco online non è configurato su questo sito (mancano le chiavi Supabase). Prova la modalità "stesso schermo".</span>
      </div>

      <template v-else-if="room.status.value === 'lobby'">
        <h1 class="font-display mb-4 mt-2 text-center text-2xl font-bold">Briscola online</h1>
        <SeatRoomLobby
          :player-options="[2, 4]" :code="room.code.value" :seats="room.seats.value" :max-players="room.maxPlayers.value"
          :connecting="room.connecting.value" :error="room.error.value" :share-link="link" :copied="copied.value"
          @create="createRoom" @join="joinRoom" @copy="link && copy(link)"
        />
      </template>

      <template v-else>
        <StatusBar :label="turnLabel" :sub="`Tu sei ${room.playerNames.value[room.mySeat.value] ?? 'in attesa'}`" :badge-text="interactive ? 'Tuo turno' : undefined" class="mt-2" />
        <div class="my-4">
          <BriscolaTable :state="g.state.value" :seat="room.mySeat.value" :names="room.playerNames.value" :interactive="interactive" @play="playCard" />
        </div>
      </template>

      <GameOverPanel v-if="gameOver" :title="overTitle" :detail="overDetail" can-rematch rematch-label="Nuova partita" @rematch="rematch" @home="router.push('/briscola')" />
    </div>
  </div>
</template>
