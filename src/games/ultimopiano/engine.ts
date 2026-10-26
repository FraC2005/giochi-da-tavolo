/**
 * Stato narrativo puro di "L'Ultimo Piano": quali indizi sono stati trovati, a che capitolo
 * siamo, se la partita è finita e con quale finale. Nessun riferimento a Three.js o al DOM qui —
 * la scena 3D (scene.ts + ThreeApartment.vue) legge questo stato per decidere cosa costruire,
 * ma la logica "cosa sblocca cosa" vive solo qui, testabile come gli altri giochi del sito.
 */
import { CHAPTERS, type ChapterDef, type Ending } from './story'

export type Status = 'playing' | 'ended'

export interface UltimoPianoState {
  chapterId: 1 | 2 | 3
  /** Indizi esaminati nel capitolo corrente (si azzera ad ogni avanzamento). */
  found: string[]
  /** Tutti gli indizi mai trovati, in ogni capitolo: usato per lo sblocco del capitolo 3 e per il diario. */
  foundEver: string[]
  /** true se il giocatore è tornato nella cameretta vuota al capitolo 3 prima di cercare l'uscita. */
  confrontedRoom: boolean
  status: Status
  ending: Ending | null
}

export function createGame(): UltimoPianoState {
  return { chapterId: 1, found: [], foundEver: [], confrontedRoom: false, status: 'playing', ending: null }
}

export function currentChapter(state: UltimoPianoState): ChapterDef {
  return CHAPTERS.find((c) => c.id === state.chapterId)!
}

/** Segna un indizio come trovato (idempotente: esaminarlo due volte non duplica nulla). */
export function findClue(state: UltimoPianoState, clueId: string): UltimoPianoState {
  if (state.status !== 'playing' || state.found.includes(clueId)) return state
  return {
    ...state,
    found: [...state.found, clueId],
    foundEver: state.foundEver.includes(clueId) ? state.foundEver : [...state.foundEver, clueId],
  }
}

/** true se nel capitolo corrente è stato trovato l'indizio che sblocca il prossimo (al rientro dalla porta). */
export function readyToAdvance(state: UltimoPianoState): boolean {
  const chapter = currentChapter(state)
  return chapter.clues.some((c) => c.unlocksNextChapter && state.found.includes(c.id))
}

/** Chiamato quando il giocatore esce e rientra dalla porta d'ingresso: avanza se pronto, altrimenti non fa nulla. */
export function reenterApartment(state: UltimoPianoState): UltimoPianoState {
  if (state.status !== 'playing' || !readyToAdvance(state)) return state
  const nextId = (state.chapterId + 1) as UltimoPianoState['chapterId']
  if (nextId > 3) return state
  return { ...state, chapterId: nextId, found: [] }
}

/** Il giocatore, al capitolo 3, è tornato nella cameretta vuota prima di cercare l'uscita. */
export function confrontRoom(state: UltimoPianoState): UltimoPianoState {
  if (state.status !== 'playing' || state.chapterId !== 3) return state
  return { ...state, confrontedRoom: true }
}

/** Il giocatore ha raggiunto la vera porta d'uscita al capitolo 3: il finale dipende da `confrontedRoom`. */
export function reachExit(state: UltimoPianoState): UltimoPianoState {
  if (state.status !== 'playing' || state.chapterId !== 3) return state
  return { ...state, status: 'ended', ending: state.confrontedRoom ? 'confronto' : 'fuga' }
}
