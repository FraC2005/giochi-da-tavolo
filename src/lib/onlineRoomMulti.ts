import { computed, onBeforeUnmount, ref, type Ref } from 'vue'
import { ensureAuthPlayerId } from './auth'
import { newRoomCode, playerName } from './player'
import { onlineAvailable, supabase, type GameRoomRow, type GameRoomViewRow, type Seat } from './supabase'

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
 *
 * Qui dentro c'è informazione nascosta (le mani di carte): nessuna mossa viene calcolata sul
 * client e poi scritta nel database, come succederebbe per Scacchi/Dama/Tris. Il client manda
 * solo l'intenzione ("ho giocato questa carta") all'Edge Function `game-move`, che è l'unica ad
 * avere lo stato completo e a decidere cosa mandare a ciascun posto.
 */
export function useSeatRoom<T, W = unknown>(game: SeatGame) {
  const me = ref<string | null>(null)
  const code: Ref<string | null> = ref(null)
  const row = ref<GameRoomRow | null>(null)
  const view = ref<GameRoomViewRow | null>(null)
  const error = ref('')
  const connecting = ref(false)
  let channel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null
  let viewChannel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null

  async function myId(): Promise<string> {
    if (!me.value) me.value = await ensureAuthPlayerId()
    return me.value
  }
  if (onlineAvailable) myId().catch((e) => { error.value = e instanceof Error ? e.message : 'Accesso non riuscito.' })

  const seats = computed<Seat[]>(() => row.value?.seats ?? [])
  const mySeat = computed<number>(() => seats.value.findIndex((s) => s.id === me.value))
  const isHost = computed(() => mySeat.value === 0)
  const maxPlayers = computed(() => row.value?.max_players ?? 0)
  const playerNames = computed(() => seats.value.map((s) => s.name))
  const status = computed<SeatRoomStatus>(() => {
    if (!row.value) return 'lobby'
    if (row.value.winner) return 'finished'
    return row.value.state ? 'playing' : 'lobby'
  })
  const gameState = computed<T | null>(() => (view.value?.view as T | null) ?? null)
  const winner = computed<W | null>(() => (row.value?.winner as W | null) ?? null)

  function applyRow(next: GameRoomRow | null) {
    row.value = next
  }

  function subscribe(roomCode: string) {
    channel?.unsubscribe()
    viewChannel?.unsubscribe()
    const client = must()
    channel = client
      .channel(CHANNEL_PREFIX + roomCode)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_rooms', filter: `code=eq.${roomCode}` }, (msg) => {
        applyRow((msg.new as GameRoomRow) ?? null)
      })
      .subscribe()
    // la RLS di game_rooms_view lascia passare solo la riga del proprio posto: non serve filtrare anche per seat_id qui.
    viewChannel = client
      .channel(CHANNEL_PREFIX + roomCode + '-view')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_rooms_view', filter: `code=eq.${roomCode}` }, (msg) => {
        view.value = (msg.new as GameRoomViewRow) ?? null
      })
      .subscribe()
    myId().then((id) => client.from('game_rooms_view').select('*').eq('code', roomCode).eq('seat_id', id).maybeSingle())
      .then((res) => { if (res?.data) view.value = res.data as GameRoomViewRow })
  }

  async function create(maxPlayers: number): Promise<string> {
    error.value = ''
    connecting.value = true
    const client = must()
    try {
      const id = await myId()
      for (let attempt = 0; attempt < 6; attempt++) {
        const roomCode = newRoomCode()
        const { data, error: dbError } = await client
          .from('game_rooms')
          .insert({ code: roomCode, game, max_players: maxPlayers, seats: [{ id, name: playerName() }], state: null, winner: null })
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
      const id = await myId()
      const normalized = roomCode.trim().toUpperCase()
      for (let attempt = 0; attempt < 5; attempt++) {
        const { data, error: dbError } = await client.from('game_rooms').select('*').eq('code', normalized).maybeSingle()
        if (dbError) throw dbError
        if (!data) throw new Error('Nessuna stanza con questo codice.')
        const current = data as GameRoomRow
        if (current.seats.some((s) => s.id === id)) {
          code.value = normalized
          applyRow(current)
          subscribe(normalized)
          return
        }
        if (current.seats.length >= current.max_players) throw new Error('La stanza è già piena.')
        const nextSeats = [...current.seats, { id, name: playerName() }]
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

  async function callMove(kind: string, payload?: Record<string, unknown>) {
    if (!code.value) return
    const { error: fnError } = await must().functions.invoke('game-move', {
      body: { code: code.value, game, seat: mySeat.value, kind, ...payload },
    })
    if (fnError) error.value = fnError.message
  }

  /** Da chiamare quando i posti sono al completo: solo il posto 0 inizializza davvero la partita. */
  async function startIfFull(extra?: Record<string, unknown>) {
    if (!row.value || row.value.state) return
    if (row.value.seats.length !== row.value.max_players) return
    if (mySeat.value !== 0) return
    await callMove('start', extra)
  }

  /** Invia una mossa di gioco (es. una carta giocata, un'azione di puntata): la calcola e la valida solo il server. */
  async function sendMove(payload: Record<string, unknown>) {
    await callMove('move', payload)
  }

  async function rematch(extra?: Record<string, unknown>) {
    if (!code.value) return
    await callMove('rematch', extra)
  }

  function leave() {
    channel?.unsubscribe()
    viewChannel?.unsubscribe()
    channel = null
    viewChannel = null
  }
  onBeforeUnmount(leave)

  return {
    code, row, error, connecting, seats, mySeat, isHost, maxPlayers, playerNames, status, gameState, winner,
    create, join, startIfFull, sendMove, rematch, leave, me,
  }
}

export function seatRoomShareUrl(slug: string, code: string): string {
  return `${window.location.origin}/${slug}/online/${code}`
}

export const seatRoomsReady = onlineAvailable
