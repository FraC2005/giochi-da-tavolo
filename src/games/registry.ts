/**
 * Elenco dei giochi disponibili nell'arcade. Per aggiungerne uno nuovo in futuro basta
 * un'altra voce qui (più le rotte e le viste del gioco): la home e il menu lo mostrano
 * automaticamente, senza toccare il loro codice. `accent` è la coppia di colori usata
 * per l'icona del gioco e per le sue caselle scure sulla scacchiera.
 */
export interface GameDef {
  id: 'chess' | 'checkers'
  slug: string
  title: string
  tagline: string
  glyph: string
  accent: [string, string]
}

export const GAMES: GameDef[] = [
  { id: 'checkers', slug: 'dama', title: 'Dama', tagline: 'Cattura obbligata, catture multiple, promozione a dama.', glyph: '⛀', accent: ['#ffd166', '#ff8fb3'] },
  { id: 'chess', slug: 'scacchi', title: 'Scacchi', tagline: 'Regole ufficiali complete: arrocco, en passant, scacco matto.', glyph: '♞', accent: ['#8ecae6', '#b591ff'] },
]

export const gameBySlug = (slug: string) => GAMES.find((g) => g.slug === slug)
export const gameById = (id: GameDef['id']) => GAMES.find((g) => g.id === id)!
