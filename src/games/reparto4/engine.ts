/**
 * Stato puro di "Reparto 4": batteria della torcia e stato della partita. Nessun riferimento a
 * Three.js qui — la scena (scene.ts + Reparto4Scene.vue) legge questo stato per decidere cosa
 * mostrare, ma le regole ("si vince/si perde quando") vivono solo qui, testabili.
 */

export type Status = 'playing' | 'won' | 'caught'

export interface GameState {
  status: Status
  battery: number // 0..100
  flashlightOn: boolean
}

export const BATTERY_DRAIN_PER_SECOND = 100 / 240 // si esaurisce in 4 minuti di uso continuo

export function createGame(): GameState {
  return { status: 'playing', battery: 100, flashlightOn: true }
}

export function tickBattery(state: GameState, dt: number): GameState {
  if (state.status !== 'playing' || !state.flashlightOn || state.battery <= 0) return state
  const battery = Math.max(0, state.battery - BATTERY_DRAIN_PER_SECOND * dt)
  return { ...state, battery, flashlightOn: battery > 0 }
}

export function toggleFlashlight(state: GameState): GameState {
  if (state.status !== 'playing' || state.battery <= 0) return state
  return { ...state, flashlightOn: !state.flashlightOn }
}

export function winGame(state: GameState): GameState {
  if (state.status !== 'playing') return state
  return { ...state, status: 'won' }
}

export function catchPlayer(state: GameState): GameState {
  if (state.status !== 'playing') return state
  return { ...state, status: 'caught' }
}
