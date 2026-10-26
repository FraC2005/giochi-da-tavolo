import { supabase } from './supabase'

let pending: Promise<string> | null = null

/**
 * Identità reale e verificata del giocatore per le stanze con informazione nascosta (Poker,
 * Scopa, Briscola): un utente anonimo di Supabase Auth, il cui id (`auth.uid()`) le policy RLS
 * usano per decidere chi può leggere la mano di chi. A differenza della stringa casuale salvata
 * in localStorage (usata per Scacchi/Dama/Tris, dove non c'è nulla da nascondere), questo id è
 * firmato dal server e non può essere falsificato dal client.
 */
export function ensureAuthPlayerId(): Promise<string> {
  const client = supabase
  if (!client) return Promise.reject(new Error('Supabase non configurato'))
  if (!pending) {
    pending = client.auth.getSession().then(async ({ data }) => {
      const existing = data.session?.user.id
      if (existing) return existing
      const { data: signed, error } = await client.auth.signInAnonymously()
      if (error || !signed.user) throw error ?? new Error('Accesso anonimo non riuscito')
      return signed.user.id
    })
  }
  return pending
}
