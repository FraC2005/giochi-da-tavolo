import type { RoguelikeState } from './engine'

const KEY = 'roguelike.save'

export function saveGame(state: RoguelikeState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch { /* storage privato o pieno: la partita continua comunque, solo senza salvataggio */ }
}

export function loadGame(): RoguelikeState | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as RoguelikeState
    // scarta i salvataggi di un formato precedente (es. prima dell'aggiunta di personaggi/piani)
    if (!parsed.player || typeof parsed.player.characterId !== 'string' || typeof parsed.floor !== 'number') return null
    return parsed
  } catch {
    return null
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY)
  } catch { /* privato */ }
}
