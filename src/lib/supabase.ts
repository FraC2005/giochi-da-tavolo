import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const onlineAvailable = !!(url && key)

export const supabase: SupabaseClient | null = onlineAvailable ? createClient(url!, key!, { realtime: { params: { eventsPerSecond: 5 } } }) : null

export interface RoomRow {
  code: string
  game: 'chess' | 'checkers' | 'tris'
  state: string
  turn: string
  host_id: string
  guest_id: string | null
  host_name: string
  guest_name: string | null
  winner: string | null
  rematch_of: string | null
  updated_at: string
}

/** Stanze da 2, 3 o più giocatori (Briscola, Scopa, Poker): un posto per giocatore invece di host/guest fissi. */
export interface Seat {
  id: string
  name: string
}

export interface GameRoomRow {
  code: string
  game: 'briscola' | 'scopa' | 'poker'
  max_players: number
  seats: Seat[]
  state: unknown | null
  winner: unknown | null
  updated_at: string
}
