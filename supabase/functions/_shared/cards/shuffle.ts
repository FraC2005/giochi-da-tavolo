/**
 * Copia Deno-compatibile di src/games/cards/shuffle.ts, duplicata qui perché le Edge Function di
 * Supabase vengono deployate solo con i file sotto supabase/functions: non possono importare da
 * src/. Se l'originale cambia, questo file va aggiornato a mano.
 */
export function shuffled<T>(items: T[]): T[] {
  const arr = items.slice()
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}
