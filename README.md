# Arcade da tavolo

Sito vetrina dove scegli **Dama**, **Scacchi**, **Tris**, **Briscola**, **Scopa** o **Poker** e giochi contro un
amico: sullo stesso schermo a turni, oppure online da case diverse con un codice stanza. Nessuna registrazione.
Ogni gioco ha anche un tutorial guidato passo-passo ("Come si gioca") con i componenti `steps` + `modal` di
DaisyUI.

Stack: **Vue 3 + TypeScript + Pinia + Vue Router**, **Tailwind 4 + DaisyUI 5**, **chess.js** per le regole degli
scacchi, tutti gli altri motori (dama, tris, briscola, scopa, poker) scritti da zero per questo progetto. Il
gioco online usa **Supabase** (database Postgres gratuito con sincronizzazione in tempo reale), perché
**Netlify ospita solo siti statici**: non può far girare un backend Django o un server con WebSocket persistenti.

## Avvio in locale

```bash
npm install
npm run dev        # http://localhost:5175
npm run test       # test del motore di dama e scacchi
npm run build      # controllo dei tipi + build di produzione
```

Senza configurare Supabase (vedi sotto), il sito funziona comunque: la modalità "stesso schermo" non ne ha
bisogno. La modalità online mostrerà un avviso invece di un errore.

## Cosa c'è

- **Scacchi**: regole complete tramite `chess.js` — arrocco, en passant, promozione (con scelta del pezzo),
  scacco, scacco matto, stallo, patta per tripla ripetizione/materiale insufficiente/50 mosse. Scacchiera con
  clic o trascinamento, evidenziazione delle mosse legali, pezzi catturati, tabellone che ruota a ogni turno
  in modalità locale.
- **Dama**: motore scritto per questo progetto (`src/games/checkers/engine.ts`, con test in `engine.test.ts`) —
  8×8, cattura obbligata, catture multiple con lo stesso pezzo, promozione a dama che termina il turno, sconfitta
  per assenza di mosse legali, patta dopo troppe mosse senza catture.
- **Tris**: il classico 3×3, motore scritto per questo progetto (`src/games/tris/engine.ts`, con test in
  `engine.test.ts`) — X inizia sempre, evidenzia la tripletta vincente, pareggio se la griglia si riempie.
- **Briscola**: mazzo italiano da 40 carte (`src/games/briscola/engine.ts`, con test in `engine.test.ts`), in 2
  giocatori (testa a testa) o in 4 (due coppie, compagni seduti l'uno di fronte all'altro): nessun obbligo di
  seguire il seme, forza e punteggio delle carte secondo le regole classiche, pesca dal mazzo dopo ogni mano.
- **Scopa**: stesso mazzo italiano da 40 carte (`src/games/scopa/engine.ts`, con test in `engine.test.ts`), in 2
  giocatori o in 4 (due coppie): presa obbligatoria quando possibile (valore uguale o combinazioni che sommano
  al valore giocato), scope, e punteggio di fine mano su carte prese, denari, settebello e primiera. Una sola
  mano completa del mazzo (non si gioca a più mani fino a un punteggio target).
- **Poker**: mazzo francese da 52 carte (`src/games/poker/engine.ts` per le puntate e i piatti laterali,
  `handEval.ts` per il valore delle mani, entrambi con test), da 2 a 6 giocatori, due varianti a scelta di chi
  crea la partita: **Texas Hold'em** (2 carte private, 5 comuni, 4 giri di puntate) e **Poker all'italiana**
  (5 carte private, un cambio carte, 2 giri di puntate). Puntate no-limit con piatti laterali corretti per gli
  all-in; una sola mano per partita (stack e bui ripartono da zero a ogni rivincita, non è un torneo).
- **Online**: crea una stanza (codice a 5 caratteri) o entra con un codice; la partita si sincronizza in tempo
  reale tramite Supabase. Dama, Scacchi e Tris sono sempre 1 contro 1 (stanza "host/guest"); Briscola, Scopa e
  Poker possono avere più posti (fino a 4 per Briscola/Scopa, fino a 6 per il Poker), uno per giocatore, nella
  stessa stanza. Rivincita senza cambiare stanza (per Dama/Scacchi/Tris con i colori invertiti).
- **Come si gioca**: ogni gioco che ha un tutorial mostra un pulsante "Come si gioca" nel suo menu, che apre un
  tour guidato passo-passo (`src/components/RulesTour.vue`, componenti `steps` + `modal` di DaisyUI). Aggiungere
  un tutorial a un nuovo gioco significa scrivere `src/games/<gioco>/rules.ts` e registrarlo in
  `src/games/rules.ts`.

## Configurare Supabase per il gioco online

1. Crea un account gratuito su [supabase.com](https://supabase.com) e un nuovo progetto.
2. Nella sezione **SQL Editor** del progetto, esegui:

```sql
create table rooms (
  code text primary key,
  game text not null check (game in ('chess', 'checkers', 'tris')),
  state jsonb not null,
  host_id text not null,
  guest_id text,
  host_name text not null,
  guest_name text,
  winner text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger rooms_touch_updated_at before update on rooms
  for each row execute function touch_updated_at();

alter table rooms enable row level security;

-- Politiche permissive: chi conosce il codice stanza può leggerla e scriverci.
-- Adatto a una partita informale tra amici, non a dati sensibili (vedi nota di sicurezza sotto).
create policy "chiunque legge" on rooms for select using (true);
create policy "chiunque crea" on rooms for insert with check (true);
create policy "chiunque aggiorna" on rooms for update using (true);

alter publication supabase_realtime add table rooms;
```

Se hai già un progetto Supabase creato prima dell'aggiunta del Tris, il vincolo sulla colonna `game` va
aggiornato per accettare anche `'tris'` (il nome del vincolo può variare, controllalo con `\d rooms` nell'SQL
Editor se il comando sotto fallisce):

```sql
alter table rooms drop constraint rooms_game_check;
alter table rooms add constraint rooms_game_check check (game in ('chess', 'checkers', 'tris'));
```

Briscola e Scopa (e in futuro Poker) usano una seconda tabella, `game_rooms`, perché possono avere più di 2
giocatori nella stessa stanza: un "posto" (seat) per giocatore invece dei soli `host`/`guest`. Eseguila anche
questa nello stesso SQL Editor:

```sql
create table game_rooms (
  code text primary key,
  game text not null check (game in ('briscola', 'scopa', 'poker')),
  max_players int not null check (max_players between 2 and 8),
  seats jsonb not null default '[]',
  state jsonb,
  winner jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger game_rooms_touch_updated_at before update on game_rooms
  for each row execute function touch_updated_at();

alter table game_rooms enable row level security;

create policy "chiunque legge" on game_rooms for select using (true);
create policy "chiunque crea" on game_rooms for insert with check (true);
create policy "chiunque aggiorna" on game_rooms for update using (true);

alter publication supabase_realtime add table game_rooms;
```

3. In **Project Settings → API**, copia "Project URL" e la chiave "anon public".
4. Crea un file `.env.local` nella cartella del progetto (copia `.env.example`) e incolla i due valori:

```
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbG....
```

5. Riavvia `npm run dev`. Su Netlify, imposta le stesse due variabili in **Site settings → Environment variables**
   prima di fare il deploy (sono lette al momento della build, come tutte le variabili `VITE_*`).

**Nota di sicurezza**: le policy sopra sono deliberatamente aperte (nessun login). Chiunque conosca o indovini
un codice stanza può leggerne e modificarne lo stato — accettabile per una partita informale con amici dove il
codice si manda a mano, ma non usarlo per dati sensibili. Il gioco online non l'ho potuto collaudare con un
progetto Supabase reale (serve un account che solo tu puoi creare): la logica è stata rivista con cura,
compresa la gestione della condizione di corsa quando due persone provano a entrare nella stessa stanza nello
stesso istante, ma testala con un amico prima di contarci per un torneo importante.

## Deploy su Netlify

1. Metti il progetto su GitHub (o GitLab/Bitbucket).
2. Su [netlify.com](https://netlify.com), "Add new site" → "Import an existing project" → scegli il repository.
3. Netlify legge `netlify.toml` in automatico (comando `npm run build`, cartella pubblicata `dist`).
4. Se vuoi il gioco online, aggiungi le due variabili d'ambiente Supabase prima del primo deploy (punto 5 sopra).
5. Deploy. Il link che ottieni è quello da condividere con i tuoi amici.

## Struttura del progetto

```
src/
  games/
    chess/      engine.ts (involucro su chess.js), useChessGame.ts, ChessBoard.vue, PromotionPicker.vue
    checkers/   engine.ts (motore scritto da zero), useCheckersGame.ts, CheckersBoard.vue
    tris/       engine.ts (motore scritto da zero), useTrisGame.ts, TrisBoard.vue, rules.ts (tutorial)
    briscola/   engine.ts (2 o 4 giocatori), useBriscolaGame.ts, BriscolaTable.vue, rules.ts (tutorial)
    scopa/      engine.ts (2 o 4 giocatori), useScopaGame.ts, ScopaTable.vue, rules.ts (tutorial)
    poker/      engine.ts (puntate, piatti laterali), handEval.ts (valore delle mani), usePokerGame.ts,
                PokerTable.vue, rules.ts (tutorial) — 2-6 giocatori, Texas Hold'em o all'italiana
    cards/      mazzo italiano (italianDeck.ts), mazzo francese (frenchDeck.ts), mescolamento condiviso
                (shuffle.ts), componente carta generico (PlayingCard.vue)
    rules.ts    mappa gioco → passi del tutorial guidato, usata da GameMenuView
  components/   RoomLobby, SeatRoomLobby, GameOverPanel, StatusBar, BackPill, RulesTour — condivisi tra i giochi
  lib/          player.ts (identità anonima), supabase.ts, onlineRoom.ts (stanze 1v1), onlineRoomMulti.ts
                (stanze con più posti, per Briscola/Scopa/Poker), tour.ts (tipo TourStep)
  views/        HomeView, GameMenuView, e Local/OnlineView per ciascun gioco
```

## Limiti noti

- Le pagine online richiedono che entrambi i giocatori tengano la scheda aperta; non c'è notifica se l'altro
  si disconnette, solo l'assenza di risposta.
- Nessuna cronologia delle partite passate, nessun profilo, nessuna classifica: è pensato per una partita alla
  volta tra amici.
- Il motore della dama implementa le regole anglo-americane classiche (non le varianti internazionali con le
  "dame volanti" o la regola della cattura massima obbligatoria).
- Il Poker è semplificato rispetto a un tavolo da casinò: un rilancio "corto" (all-in per meno del rilancio
  minimo) riapre comunque l'azione per tutti, invece di restare limitato al solo pareggio come vorrebbe la
  regola rigorosa; allo showdown si vedono la categoria della mano di ciascuno e quanto ha vinto, non le carte
  esatte degli avversari. Si gioca una sola mano per partita (stack e bui ripartono da zero a ogni rivincita),
  non un vero torneo con bui crescenti.
