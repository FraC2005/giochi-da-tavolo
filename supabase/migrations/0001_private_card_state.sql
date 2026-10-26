-- Privacy delle mani nascoste per Poker/Scopa/Briscola online.
--
-- Prima di questa migration, `game_rooms.state` conteneva lo stato di gioco COMPLETO (incluse le
-- mani di tutti i giocatori) ed era leggibile da chiunque conoscesse il codice della stanza, via
-- Realtime. Qualsiasi client poteva anche scriverlo direttamente, senza alcuna validazione delle
-- mosse. Questa migration sposta lo stato vero in una tabella privata (solo l'Edge Function
-- `game-move`, con la service role key, può leggerla e scriverla) e introduce una tabella di
-- "vista" filtrata per posto, leggibile da ciascun giocatore solo per il proprio posto.
--
-- Applicare questo file dall'SQL Editor della dashboard Supabase (Database > SQL Editor), oppure
-- con `supabase db push` se il progetto è collegato via CLI.

-- 1. Abilita RLS su game_rooms se non già attiva, e restringe le policy: la lobby (codice, posti,
--    numero massimo di giocatori) non contiene informazione nascosta, quindi resta leggibile da
--    chiunque conosca il codice; solo chi è autenticato può creare una stanza o aggiungersi come
--    posto. Le mosse di gioco NON passano più da qui: la colonna `state` è solo un flag "partita
--    iniziata" e la colonna `winner` un riepilogo pubblico a fine mano (non contiene mani nascoste).
alter table if exists game_rooms enable row level security;

drop policy if exists "game_rooms select" on game_rooms;
create policy "game_rooms select" on game_rooms for select using (true);

drop policy if exists "game_rooms insert" on game_rooms;
create policy "game_rooms insert" on game_rooms for insert with check (auth.uid() is not null);

drop policy if exists "game_rooms update seats" on game_rooms;
create policy "game_rooms update seats" on game_rooms for update using (auth.uid() is not null);

-- 2. Stato autoritativo completo: nessuna policy per client, quindi RLS nega sempre l'accesso a
--    chiunque usi la chiave anonima. Solo l'Edge Function, con la service role key (che ignora la
--    RLS), può leggerlo e scriverlo.
create table if not exists game_rooms_state (
  code text primary key references game_rooms(code) on delete cascade,
  state jsonb,
  updated_at timestamptz not null default now()
);
alter table game_rooms_state enable row level security;

-- 3. Vista filtrata per posto: ogni riga è quello che un singolo giocatore può vedere (le mani
--    degli altri sono già sostituite da carte segnaposto quando questa riga viene scritta).
--    `seat_id` è l'auth.uid() del giocatore che siede in quel posto: la policy fa sì che Realtime
--    (che rispetta la RLS su postgres_changes) mandi questa riga solo al suo browser.
create table if not exists game_rooms_view (
  code text not null references game_rooms(code) on delete cascade,
  seat_id uuid not null,
  view jsonb,
  updated_at timestamptz not null default now(),
  primary key (code, seat_id)
);
alter table game_rooms_view enable row level security;

drop policy if exists "game_rooms_view select own seat" on game_rooms_view;
create policy "game_rooms_view select own seat" on game_rooms_view for select using (auth.uid() = seat_id);

-- 4. Promemoria: l'autenticazione anonima (Authentication > Providers > Anonymous Sign-Ins) deve
--    essere abilitata dalla dashboard: non è configurabile via SQL.
