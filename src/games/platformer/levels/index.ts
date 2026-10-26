import type { LevelData } from '../engine'
import level1 from './level1.json'
import level2 from './level2.json'
import level3 from './level3.json'

/** Livelli caricati da file JSON (uno per file), non scritti a mano nel codice del motore. */
export const LEVELS: LevelData[] = [level1, level2, level3] as LevelData[]
