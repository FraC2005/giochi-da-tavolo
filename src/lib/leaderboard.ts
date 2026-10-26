import { ref } from 'vue'
import { onlineAvailable, supabase } from './supabase'

export interface ScoreEntry { player_name: string; score: number; created_at: string }

export const leaderboardReady = onlineAvailable

/** Classifica condivisa per un gioco in stile arcade (punteggio singolo, nessuna partita da sincronizzare). */
export function useLeaderboard(game: string) {
  const scores = ref<ScoreEntry[]>([])
  const loading = ref(false)
  const error = ref('')

  async function refresh() {
    if (!supabase) return
    loading.value = true
    const { data, error: dbError } = await supabase
      .from('leaderboard')
      .select('player_name, score, created_at')
      .eq('game', game)
      .order('score', { ascending: false })
      .limit(10)
    if (dbError) error.value = dbError.message
    else scores.value = (data as ScoreEntry[] | null) ?? []
    loading.value = false
  }

  async function submit(playerName: string, score: number) {
    if (!supabase) return
    const clean = playerName.trim().slice(0, 24) || 'Giocatore'
    const { error: dbError } = await supabase.from('leaderboard').insert({ game, player_name: clean, score })
    if (dbError) { error.value = dbError.message; return }
    await refresh()
  }

  return { scores, loading, error, refresh, submit }
}
