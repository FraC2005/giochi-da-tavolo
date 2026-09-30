const KEY = 'arena.player-id'
const NAME_KEY = 'arena.player-name'
const ADJ = ['Veloce', 'Astuto', 'Silenzioso', 'Audace', 'Paziente', 'Curioso', 'Leale', 'Intrepido']
const ANIMALS = ['Falco', 'Volpe', 'Orso', 'Lupo', 'Gufo', 'Tasso', 'Lince', 'Cervo']

function newId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function playerId(): string {
  try {
    let id = localStorage.getItem(KEY)
    if (!id) { id = newId(); localStorage.setItem(KEY, id) }
    return id
  } catch {
    return ((window as unknown as { __pid?: string }).__pid ??= newId())
  }
}

export function playerName(): string {
  try {
    let name = localStorage.getItem(NAME_KEY)
    if (!name) {
      name = `${ADJ[Math.floor(Math.random() * ADJ.length)]} ${ANIMALS[Math.floor(Math.random() * ANIMALS.length)]}`
      localStorage.setItem(NAME_KEY, name)
    }
    return name
  } catch {
    return 'Giocatore'
  }
}

export function setPlayerName(name: string) {
  const clean = name.trim().slice(0, 24)
  if (!clean) return
  try { localStorage.setItem(NAME_KEY, clean) } catch { /* privato */ }
}

export function newRoomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 5 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('')
}
