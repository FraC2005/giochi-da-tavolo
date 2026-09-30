import { computed, onBeforeUnmount, ref, type Ref } from 'vue'
import { newRoomCode, playerId, playerName } from './player'
import { onlineAvailable, supabase, type GameRoomRow, type Seat } from './supabase'

export type SeatRoomStatus = 'lobby' | 'playing' | 'finished'
export type SeatGame = 'briscola' | 'scopa' | 'poker'

const CHANNEL_PREFIX = 'game-room-'

function must() {
  if (!supabase) throw new Error('Supabase non configurato')
  return supabase
}

/**
 * Gestisce una stanza online con un posto per giocatore (invece dei soli host/guest usati da
 * Dama, Scacchi e Tris): serve ai giochi con più di 2 giocatori, come Briscola a 4, Scopa a 4 o
 * Poker. Il primo posto (indice 0) fa da "host": è l'unico che inizializza la partita quando la
 * stanza si riempie, per evitare che due client la inizializzino insieme.
 */
export function useSeatRoom<T, W = unknown>(game: SeatGame) {
  const me = playerId()
  const code: Ref<string | null> = ref(null)
  const row = ref<GameRoomRow | null>(null)
  const error = ref('')
  const connecting = ref(false)
  let channel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null

  const seats = computed<Seat[]>(() => row.value?.seats ?? [])
  const mySeat = computed<number>(() => seats.value.findIndex((s) => s.id === me))
  const isHost = computed(() => mySeat.value === 0)
  const maxPlayers = computed(() => row.value?.max_players ?? 0)
  const playerNames = computed(() => seats.value.map((s) => s.name))
  const status = computed<SeatRoomStatus>(() => {
    if (!row.value) return 'lobby'
    if (row.value.winner) return 'finished'
    return row.value.state ? 'playing' : 'lobby'
  })
  const gameState = computed<T | null>(() => (row.value?.state as T | null) ?? null)
  const winner = computed<W | null>(() => (row.value?.winner as W | null) ?? null)

  function applyRow(next: GameRoomRow | null) {
    row.value = next
  }

  function subscribe(roomCode: string) {
    channel?.unsubscribe()
    channel = must()
      .channel(CHANNEL_PREFIX + roomCode)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_rooms', filter: `code=eq.${roomCode}` }, (msg) => {
        applyRow((msg.new as GameRoomRow) ?? null)
      })
      .subscribe()
  }

  async function create(maxPlayers: number): Promise<string> {
    error.value = ''
    connecting.value = true
    const client = must()
    try {
      for (let attempt = 0; attempt < 6; attempt++) {
        const roomCode = newRoomCode()
        const { data, error: dbError } = await client
          .from('game_rooms')
          .insert({ code: roomCode, game, max_players: maxPlayers, seats: [{ id: me, name: playerName() }], state: null, winner: null })
          .select()
          .single()
        if (!dbError && data) {
          code.value = roomCode
          applyRow(data as GameRoomRow)
          subscribe(roomCode)
          return roomCode
        }
        if (dbError && dbError.code !== '23505') throw dbError // 23505 = codice duplicato, riprova
      }
      throw new Error('Non sono riuscito a creare una stanza libera, riprova.')
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Impossibile creare la stanza.'
      throw e
    } finally {
      connecting.value = false
    }
  }

  async function join(roomCode: string): Promise<void> {
    error.value = ''
    connecting.value = true
    const client = must()
    try {
      const normalized = roomCode.trim().toUpperCase()
      for (let attempt = 0; attempt < 5; attempt++) {
        const { data, error: dbError } = await client.from('game_rooms').select('*').eq('code', normalized).maybeSingle()
        if (dbError) throw dbError
        if (!data) throw new Error('Nessuna stanza con questo codice.')
        const current = data as GameRoomRow
        if (current.seats.some((s) => s.id === me)) {
          code.value = normalized
          applyRow(current)
          subscribe(normalized)
          return
        }
        if (current.seats.length >= current.max_players) throw new Error('La stanza è già piena.')
        const nextSeats = [...current.seats, { id: me, name: playerName() }]
        const { data: updated, error: updateError } = await client
          .from('game_rooms')
          .update({ seats: nextSeats })
          .eq('code', normalized)
          .eq('updated_at', current.updated_at) // blocco ottimistico: fallisce se qualcuno ha scritto nel frattempo
          .select()
          .single()
        if (!updateError && updated) {
          code.value = normalized
          applyRow(updated as GameRoomRow)
          subscribe(normalized)
          return
        }
      }
      throw new Error('Qualcun altro sta modificando questa stanza, riprova.')
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Impossibile entrare nella stanza.'
      throw e
    } finally {
      connecting.value = false
    }
  }

  /** Da chiamare quando i posti sono al completo: solo il posto 0 inizializza davvero la partita. */
  async function startIfFull(makeInitial: (players: number) => T) {
    if (!row.value || row.value.state) return
    if (row.value.seats.length !== row.value.max_players) return
    if (mySeat.value !== 0) return
    const state = makeInitial(row.value.max_players)
    const { error: dbError } = await must().from('game_rooms').update({ state }).eq('code', row.value.code).is('state', null)
    if (dbError) error.value = dbError.message
  }

  async function pushState(nextState: T, nextWinner: W | null) {
    if (!code.value) return
    const { error: dbError } = await must().from('game_rooms').update({ state: nextState, winner: nextWinner }).eq('code', code.value)
    if (dbError) error.value = dbError.message
  }

  async function rematch(makeInitial: (players: number) => T) {
    if (!code.value || !row.value) return
    const state = makeInitial(row.value.max_players)
    const { error: dbError } = await must().from('game_rooms').update({ state, winner: null }).eq('code', code.value)
    if (dbError) error.value = dbError.message
  }

  function leave() {
    channel?.unsubscribe()
    channel = null
  }
  onBeforeUnmount(leave)

  return {
    code, row, error, connecting, seats, mySeat, isHost, maxPlayers, playerNames, status, gameState, winner,
    create, join, startIfFull, pushState, rematch, leave, me,
  }
}

export function seatRoomShareUrl(slug: string, code: string): string {
  return `${window.location.origin}/${slug}/online/${code}`
}

export const seatRoomsReady = onlineAvailable
