import { computed, onBeforeUnmount, reactive, ref, type Ref } from 'vue'
import { newRoomCode, playerId, playerName } from './player'
import { onlineAvailable, supabase, type RoomRow } from './supabase'

export type PlayerColor = 'w' | 'b'
export type RoomStatus = 'waiting' | 'playing' | 'finished'

/** Involucro salvato in `rooms.state`: separa "chi gioca il bianco/primo" (cambia a ogni rivincita) dallo stato del gioco vero e proprio. */
export interface RoomPayload<T> { hostColor: PlayerColor; game: T }

export interface RoomError { message: string }

const CHANNEL_PREFIX = 'room-'

function must() {
  if (!supabase) throw new Error('Supabase non configurato')
  return supabase
}

/**
 * Gestisce una stanza di gioco online: creazione, ingresso, sincronizzazione in tempo reale e rivincita.
 * `T` è lo stato del gioco specifico (mosse per gli scacchi, l'intero stato per la dama).
 */
export function useOnlineRoom<T>(game: 'chess' | 'checkers' | 'tris', initialGameState: () => T) {
  const me = playerId()
  const code: Ref<string | null> = ref(null)
  const row = ref<RoomRow | null>(null)
  const error = ref('')
  const connecting = ref(false)
  let channel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null

  const youAre = computed<'host' | 'guest' | null>(() => {
    if (!row.value) return null
    if (row.value.host_id === me) return 'host'
    if (row.value.guest_id === me) return 'guest'
    return null
  })
  const payload = computed<RoomPayload<T> | null>(() => (row.value ? (JSON.parse(row.value.state) as RoomPayload<T>) : null))
  const gameState = computed<T | null>(() => payload.value?.game ?? null)
  const yourColor = computed<PlayerColor | null>(() => {
    if (!payload.value || !youAre.value) return null
    return youAre.value === 'host' ? payload.value.hostColor : payload.value.hostColor === 'w' ? 'b' : 'w'
  })
  const status = computed<RoomStatus>(() => {
    if (!row.value) return 'waiting'
    return !row.value.guest_id ? 'waiting' : row.value.winner !== null ? 'finished' : 'playing'
  })
  const opponentName = computed(() => (youAre.value === 'host' ? row.value?.guest_name : row.value?.host_name) ?? null)
  const yourName = computed(() => (youAre.value === 'host' ? row.value?.host_name : row.value?.guest_name) ?? playerName())

  function applyRow(next: RoomRow | null) { row.value = next }

  function subscribe(roomCode: string) {
    channel?.unsubscribe()
    channel = must()
      .channel(CHANNEL_PREFIX + roomCode)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `code=eq.${roomCode}` }, (msg) => {
        applyRow((msg.new as RoomRow) ?? null)
      })
      .subscribe()
  }

  async function create(): Promise<string> {
    error.value = ''
    connecting.value = true
    const client = must()
    try {
      for (let attempt = 0; attempt < 6; attempt++) {
        const roomCode = newRoomCode()
        const state: RoomPayload<T> = { hostColor: 'w', game: initialGameState() }
        const { data, error: dbError } = await client
          .from('rooms')
          .insert({ code: roomCode, game, state: JSON.stringify(state), host_id: me, host_name: playerName(), guest_id: null, guest_name: null, winner: null })
          .select()
          .single()
        if (!dbError && data) {
          code.value = roomCode
          applyRow(data as RoomRow)
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
      const { data, error: dbError } = await client.from('rooms').select('*').eq('code', normalized).maybeSingle()
      if (dbError) throw dbError
      if (!data) throw new Error('Nessuna stanza con questo codice.')
      let current = data as RoomRow
      const alreadyIn = current.host_id === me || current.guest_id === me
      if (!alreadyIn) {
        if (current.guest_id) throw new Error('La stanza è già piena.')
        const { data: updated, error: updateError } = await client
          .from('rooms')
          .update({ guest_id: me, guest_name: playerName() })
          .eq('code', normalized)
          .is('guest_id', null)
          .select()
          .single()
        if (updateError || !updated) throw new Error('Qualcun altro è appena entrato per primo in questa stanza.')
        current = updated as RoomRow
      }
      code.value = normalized
      applyRow(current)
      subscribe(normalized)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Impossibile entrare nella stanza.'
      throw e
    } finally {
      connecting.value = false
    }
  }

  async function pushState(nextGame: T, winner: PlayerColor | 'draw' | null) {
    if (!code.value || !payload.value) return
    const state: RoomPayload<T> = { hostColor: payload.value.hostColor, game: nextGame }
    const { error: dbError } = await must().from('rooms').update({ state: JSON.stringify(state), winner }).eq('code', code.value)
    if (dbError) error.value = dbError.message
  }

  async function rematch(freshGame: () => T) {
    if (!code.value || !payload.value) return
    const nextHostColor: PlayerColor = payload.value.hostColor === 'w' ? 'b' : 'w'
    const state: RoomPayload<T> = { hostColor: nextHostColor, game: freshGame() }
    const { error: dbError } = await must().from('rooms').update({ state: JSON.stringify(state), winner: null }).eq('code', code.value)
    if (dbError) error.value = dbError.message
  }

  function leave() {
    channel?.unsubscribe()
    channel = null
  }
  onBeforeUnmount(leave)

  return { code, row, error, connecting, youAre, yourColor, yourName, opponentName, status, gameState, create, join, pushState, rematch, leave, me }
}

const ROOM_PATH: Record<'chess-room' | 'checkers-room' | 'tris-room', string> = {
  'chess-room': 'scacchi',
  'checkers-room': 'dama',
  'tris-room': 'tris',
}

export function shareUrl(routeName: 'chess-room' | 'checkers-room' | 'tris-room', code: string): string {
  return `${window.location.origin}/${ROOM_PATH[routeName]}/online/${code}`
}

export function useCountdownCopy() {
  const copied = reactive({ value: false })
  let timer: ReturnType<typeof setTimeout> | null = null
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      copied.value = true
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => (copied.value = false), 1800)
    } catch { /* clipboard non disponibile: l'utente può selezionare il testo a mano */ }
  }
  onBeforeUnmount(() => { if (timer) clearTimeout(timer) })
  return { copied, copy }
}

export const supabaseReady = onlineAvailable
export type { RoomRow } from './supabase'
export type RoomErrorLike = RoomError
