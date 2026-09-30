/**
 * Elenco dei giochi disponibili nell'arcade. Per aggiungerne uno nuovo in futuro basta
 * un'altra voce qui (più le rotte e le viste del gioco): la home e il menu lo mostrano
 * automaticamente, senza toccare il loro codice. `accent` è la coppia di colori usata
 * per l'icona del gioco e per le sue caselle scure sulla scacchiera.
 */
export interface GameDef {
  id: 'chess' | 'checkers' | 'tris' | 'briscola'
  slug: string
  title: string
  tagline: string
  glyph: string
  accent: [string, string]
}

export const GAMES: GameDef[] = [
  { id: 'checkers', slug: 'dama', title: 'Dama', tagline: 'Cattura obbligata, catture multiple, promozione a dama.', glyph: '⛀', accent: ['#ffd166', '#ff8fb3'] },
  { id: 'chess', slug: 'scacchi', title: 'Scacchi', tagline: 'Regole ufficiali complete: arrocco, en passant, scacco matto.', glyph: '♞', accent: ['#8ecae6', '#b591ff'] },
  { id: 'tris', slug: 'tris', title: 'Tris', tagline: 'Tre in fila per vincere: il classico gioco della X e O.', glyph: '⭕', accent: ['#34c98a', '#8ecae6'] },
  { id: 'briscola', slug: 'briscola', title: 'Briscola', tagline: 'Il classico gioco di carte italiano, in 2 o in 4 a coppie.', glyph: '🪙', accent: ['#d1972f', '#e0526b'] },
]

export const gameBySlug = (slug: string) => GAMES.find((g) => g.slug === slug)
export const gameById = (id: GameDef['id']) => GAMES.find((g) => g.id === id)!
