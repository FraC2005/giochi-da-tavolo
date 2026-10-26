/** Stile illustrativo del mazzo italiano (Scopa, Briscola): varia semi e figure, non le regole. */
export type CardTheme = 'napoletane' | 'piacentine' | 'siciliane'

export const CARD_THEMES: { id: CardTheme; label: string }[] = [
  { id: 'napoletane', label: 'Napoletane' },
  { id: 'piacentine', label: 'Piacentine' },
  { id: 'siciliane', label: 'Siciliane' },
]

const KEY = 'arena.card-theme'

export function cardTheme(): CardTheme {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'napoletane' || saved === 'piacentine' || saved === 'siciliane') return saved
  } catch { /* privato */ }
  return 'napoletane'
}

export function setCardTheme(theme: CardTheme) {
  try {
    localStorage.setItem(KEY, theme)
  } catch { /* privato */ }
}
