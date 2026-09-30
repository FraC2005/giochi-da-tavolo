import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const onlineAvailable = !!(url && key)

export const supabase: SupabaseClient | null = onlineAvailable ? createClient(url!, key!, { realtime: { params: { eventsPerSecond: 5 } } }) : null

export interface RoomRow {
  code: string
  game: 'chess' | 'checkers'
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
