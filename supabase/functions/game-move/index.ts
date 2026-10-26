// Edge Function "game-move": unica autorità per le partite di Poker/Scopa/Briscola online.
//
// Perché esiste: prima, ogni client calcolava la mossa in locale (motore puro, stesso codice di
// src/games/*/engine.ts) e scriveva lo stato COMPLETO risultante — incluse le mani di tutti i
// giocatori — in una riga di Postgres leggibile da chiunque conoscesse il codice della stanza via
// Realtime. Chiunque apra i DevTools poteva leggere (e anche scrivere) le carte degli avversari.
//
// Ora il client manda solo l'INTENZIONE ("ho giocato questa carta", "passo"); questa funzione,
// che gira lato server con la service role key, è l'unica a leggere/scrivere lo stato completo
// (tabella privata `game_rooms_state`, mai esposta al client) e calcola per ciascun posto una
// proiezione filtrata (`viewForSeat`, che nasconde le mani altrui) da scrivere in `game_rooms_view`
// — una riga per posto, leggibile solo dal suo auth.uid() grazie alla RLS (vedi la migration SQL).
//
// Deploy: `supabase functions deploy game-move` (richiede la CLI collegata al progetto). Questa
// funzione importa i motori di gioco da ./_shared (duplicati, non da src/, perché il deploy
// pacchetta solo i file sotto supabase/functions): se le regole dei giochi cambiano in src/, vanno
// riportate a mano anche in supabase/functions/_shared.

import { createClient } from 'npm:@supabase/supabase-js@2'
import * as poker from '../_shared/poker/engine.ts'
import * as scopa from '../_shared/scopa/engine.ts'
import * as briscola from '../_shared/briscola/engine.ts'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })
}

type SeatGame = 'poker' | 'scopa' | 'briscola'
interface Seat { id: string; name: string }
interface GameRoomRow { code: string; game: SeatGame; max_players: number; seats: Seat[]; state: unknown; winner: unknown }

function makeInitial(game: SeatGame, maxPlayers: number, extra: Record<string, unknown> | undefined) {
  if (game === 'poker') return poker.createGame((extra?.variant as poker.PokerVariant) ?? 'holdem', maxPlayers as poker.PlayerCount)
  if (game === 'scopa') return scopa.createGame(maxPlayers as scopa.PlayerCount)
  return briscola.createGame(maxPlayers as briscola.PlayerCount)
}

function viewForSeat(game: SeatGame, state: unknown, seat: number) {
  if (game === 'poker') return poker.viewForSeat(state as poker.PokerState, seat)
  if (game === 'scopa') return scopa.viewForSeat(state as scopa.ScopaState, seat)
  return briscola.viewForSeat(state as briscola.BriscolaState, seat)
}

/** Esito pubblico a fine mano: per il Poker sono i risultati del piatto, per gli altri l'`outcome()`. Non contiene mani nascoste. */
function publicWinner(game: SeatGame, state: unknown) {
  if (game === 'poker') return (state as poker.PokerState).status === 'finished' ? (state as poker.PokerState).results : null
  if (game === 'scopa') return scopa.outcome(state as scopa.ScopaState)
  return briscola.outcome(state as briscola.BriscolaState)
}

function applyMove(game: SeatGame, state: unknown, seat: number, payload: Record<string, unknown>) {
  if (game === 'poker') {
    if (payload.discardIndices) return poker.discardAndDraw(state as poker.PokerState, seat, payload.discardIndices as number[])
    return poker.applyAction(state as poker.PokerState, seat, payload.action as poker.Action)
  }
  if (game === 'scopa') {
    return scopa.playCard(state as scopa.ScopaState, seat, payload.played as scopa.Card, (payload.captured as scopa.Card[]) ?? [])
  }
  return briscola.playCard(state as briscola.BriscolaState, seat, payload.played as briscola.Card)
}

/** Scrive lo stato completo (privato) e, per ciascun posto, la proiezione filtrata che quel posto può vedere. */
async function persistAndBroadcast(
  admin: ReturnType<typeof createClient>,
  game: SeatGame,
  room: GameRoomRow,
  state: unknown,
) {
  const now = new Date().toISOString()
  await admin.from('game_rooms_state').upsert({ code: room.code, state, updated_at: now })
  await admin.from('game_rooms').update({ state: {}, winner: publicWinner(game, state) }).eq('code', room.code)
  const rows = room.seats.map((s, i) => ({ code: room.code, seat_id: s.id, view: viewForSeat(game, state, i), updated_at: now }))
  await admin.from('game_rooms_view').upsert(rows)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const anon = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userError } = await anon.auth.getUser()
    if (userError || !userData.user) return json({ error: 'Non autenticato.' }, 401)
    const userId = userData.user.id

    const { code, game, seat, kind, ...payload } = (await req.json()) as {
      code: string; game: SeatGame; seat: number; kind: 'start' | 'move' | 'rematch'; [key: string]: unknown
    }
    if (!code || !game || typeof seat !== 'number') return json({ error: 'Richiesta non valida.' }, 400)

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { data: room, error: roomError } = await admin.from('game_rooms').select('*').eq('code', code).single()
    if (roomError || !room) return json({ error: 'Stanza non trovata.' }, 404)
    const roomRow = room as GameRoomRow
    if (roomRow.game !== game) return json({ error: 'Gioco non corrispondente.' }, 400)

    const seatEntry = roomRow.seats[seat]
    if (!seatEntry || seatEntry.id !== userId) return json({ error: 'Questo posto non è tuo.' }, 403)

    if (kind === 'start') {
      if (roomRow.state || roomRow.seats.length !== roomRow.max_players) return json({ ok: true }) // già iniziata o non ancora piena: non-op
      const initial = makeInitial(game, roomRow.max_players, payload)
      await persistAndBroadcast(admin, game, roomRow, initial)
      return json({ ok: true })
    }

    if (kind === 'rematch') {
      const initial = makeInitial(game, roomRow.max_players, payload)
      await persistAndBroadcast(admin, game, roomRow, initial)
      return json({ ok: true })
    }

    // kind === 'move'
    const { data: stateRow } = await admin.from('game_rooms_state').select('state').eq('code', code).maybeSingle()
    if (!stateRow?.state) return json({ error: 'Partita non ancora iniziata.' }, 400)
    const next = applyMove(game, stateRow.state, seat, payload as Record<string, unknown>)
    await persistAndBroadcast(admin, game, roomRow, next)
    return json({ ok: true })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Errore interno.' }, 500)
  }
})
