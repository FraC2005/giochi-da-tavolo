/**
 * Regole del tutorial guidato per gioco. Solo i giochi con un tutorial compaiono qui: se un
 * gioco non ha voce, GameMenuView non mostra il pulsante "Come si gioca". Aggiungere un gioco
 * nuovo significa scrivere il suo `rules.ts` e aggiungerlo qui.
 */
import type { GameDef } from './registry'
import { briscolaRules } from './briscola/rules'
import { scopaRules } from './scopa/rules'
import { trisRules } from './tris/rules'
import type { TourStep } from '@/lib/tour'

export const rulesByGame: Partial<Record<GameDef['id'], TourStep[]>> = {
  tris: trisRules,
  briscola: briscolaRules,
  scopa: scopaRules,
}
