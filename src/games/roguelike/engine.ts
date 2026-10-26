/**
 * Motore del roguelike ASCII a turni, ispirato a The Binding of Isaac: dungeon di stanze generate
 * proceduralmente su una griglia, nemici che si svegliano quando entri nella stanza, porte
 * bloccate finché non la liberi, oggetti da raccogliere, una stanza del boss nel punto più
 * lontano dall'ingresso, più piani via via più difficili. Come in Isaac non si attacca "a
 * corpo" (i nemici bloccano il passaggio come un muro): si colpisce sparando in una direzione,
 * un raggio istantaneo che percorre la stanza finché non trova un muro o un nemico.
 * Tutto puro e testabile: `move`/`shoot` prendono un'azione alla volta, applicano l'azione del
 * giocatore e poi il turno dei nemici, senza toccare DOM/localStorage.
 */

export const ROOM_W = 11
export const ROOM_H = 9
const CX = Math.floor(ROOM_W / 2) // 5
const CY = Math.floor(ROOM_H / 2) // 4

export type Dir = 'N' | 'S' | 'E' | 'W'
export interface RoomPos { x: number; y: number }
export interface Enemy { id: number; x: number; y: number; hp: number; maxHp: number; attack: number; glyph: string; awake: boolean; ranged: boolean; enraged: boolean }
export type ItemKind = 'heal' | 'attack' | 'maxhp' | 'piercing' | 'trishot' | 'armor' | 'regen'
export interface ItemPickup { id: number; x: number; y: number; kind: ItemKind; taken: boolean }
export type RoomKind = 'start' | 'normal' | 'item' | 'boss'

export interface Room {
  pos: RoomPos
  doors: Record<Dir, boolean>
  kind: RoomKind
  enemies: Enemy[]
  items: ItemPickup[]
  visited: boolean
}

export interface Character { id: string; name: string; emoji: string; hp: number; attack: number; trait: ItemKind | 'none'; description: string }

export const CHARACTERS: Character[] = [
  { id: 'bimbo', name: 'Il Bambino', emoji: '🧒', hp: 12, attack: 2, trait: 'none', description: 'Nessun bonus: stile di gioco equilibrato, ideale per iniziare.' },
  { id: 'forzuto', name: 'Il Forzuto', emoji: '💪', hp: 18, attack: 1, trait: 'none', description: 'Tantissima vita, ma colpi deboli: può incassare molti più errori.' },
  { id: 'tiratrice', name: 'La Tiratrice', emoji: '🎯', hp: 8, attack: 3, trait: 'piercing', description: 'Parte già con colpi perforanti: i proiettili attraversano più nemici in linea.' },
  { id: 'gemello', name: 'Il Gemello', emoji: '👯', hp: 10, attack: 2, trait: 'trishot', description: 'Parte con il tiro triplo: ogni colpo parte anche nelle due direzioni laterali.' },
  { id: 'corazzata', name: 'La Corazzata', emoji: '🛡️', hp: 10, attack: 2, trait: 'armor', description: "Parte con un'armatura che assorbe 1 danno da ogni colpo subito." },
  { id: 'fortunato', name: 'Il Fortunato', emoji: '🍀', hp: 10, attack: 2, trait: 'regen', description: 'Parte con la rigenerazione: recupera vita lentamente nel tempo.' },
]

export interface Player {
  x: number; y: number; hp: number; maxHp: number; attack: number; roomKey: string
  characterId: string; piercing: boolean; triShot: boolean; armor: number; regen: number
}

export const MAX_FLOOR = 5

export interface RoguelikeState {
  rooms: Record<string, Room>
  player: Player
  floor: number
  turn: number
  status: 'playing' | 'floorClear' | 'won' | 'lost'
  log: string[]
}

export const roomKey = (p: RoomPos) => `${p.x},${p.y}`
const DIR_DELTA: Record<Dir, RoomPos> = { N: { x: 0, y: -1 }, S: { x: 0, y: 1 }, E: { x: 1, y: 0 }, W: { x: -1, y: 0 } }
const OPPOSITE: Record<Dir, Dir> = { N: 'S', S: 'N', E: 'W', W: 'E' }
const PERPENDICULAR: Record<Dir, [Dir, Dir]> = { N: ['E', 'W'], S: ['E', 'W'], E: ['N', 'S'], W: ['N', 'S'] }

function doorCell(dir: Dir): RoomPos {
  if (dir === 'N') return { x: CX, y: 0 }
  if (dir === 'S') return { x: CX, y: ROOM_H - 1 }
  if (dir === 'W') return { x: 0, y: CY }
  return { x: ROOM_W - 1, y: CY }
}
/** Cella subito dentro la stanza, appena varcata la porta su quel lato (dove il giocatore riappare). */
function entryCell(enteredFrom: Dir): RoomPos {
  if (enteredFrom === 'N') return { x: CX, y: 1 }
  if (enteredFrom === 'S') return { x: CX, y: ROOM_H - 2 }
  if (enteredFrom === 'W') return { x: 1, y: CY }
  return { x: ROOM_W - 2, y: CY }
}

function isWall(x: number, y: number, doors: Record<Dir, boolean>): boolean {
  if (x <= 0 || x >= ROOM_W - 1 || y <= 0 || y >= ROOM_H - 1) {
    if (y === 0 && x === CX) return !doors.N
    if (y === ROOM_H - 1 && x === CX) return !doors.S
    if (x === 0 && y === CY) return !doors.W
    if (x === ROOM_W - 1 && y === CY) return !doors.E
    return true
  }
  return false
}

export interface Rng { (): number }
function pick<T>(arr: T[], rng: Rng): T {
  return arr[Math.floor(rng() * arr.length)]
}

/** Genera un dungeon connesso di `roomCount` stanze con un'espansione casuale a partire dal centro. */
export function createDungeon(roomCount: number, floor: number, rng: Rng = Math.random): Record<string, Room> {
  const rooms: Record<string, Room> = {}
  const start: RoomPos = { x: 0, y: 0 }
  rooms[roomKey(start)] = { pos: start, doors: { N: false, S: false, E: false, W: false }, kind: 'start', enemies: [], items: [], visited: true }

  const frontier: RoomPos[] = [start]
  let guard = 0
  while (Object.keys(rooms).length < roomCount && guard++ < roomCount * 30) {
    const from = pick(frontier, rng)
    const dir = pick(['N', 'S', 'E', 'W'] as Dir[], rng)
    const delta = DIR_DELTA[dir]
    const to: RoomPos = { x: from.x + delta.x, y: from.y + delta.y }
    const toKey = roomKey(to)
    if (rooms[toKey]) continue
    rooms[toKey] = { pos: to, doors: { N: false, S: false, E: false, W: false }, kind: 'normal', enemies: [], items: [], visited: false }
    rooms[roomKey(from)].doors[dir] = true
    rooms[toKey].doors[OPPOSITE[dir]] = true
    frontier.push(to)
  }

  const distances = bfsDistances(rooms, start)
  let farthestKey = roomKey(start)
  let farthestDist = -1
  for (const [key, dist] of distances) if (dist > farthestDist) { farthestDist = dist; farthestKey = key }
  rooms[farthestKey].kind = 'boss'

  const itemCandidates = Object.keys(rooms).filter((k) => rooms[k].kind === 'normal')
  if (itemCandidates.length > 0) rooms[pick(itemCandidates, rng)].kind = 'item'

  populateRooms(rooms, floor, rng)
  return rooms
}

function bfsDistances(rooms: Record<string, Room>, start: RoomPos): Map<string, number> {
  const dist = new Map<string, number>([[roomKey(start), 0]])
  const queue: RoomPos[] = [start]
  while (queue.length > 0) {
    const cur = queue.shift()!
    const room = rooms[roomKey(cur)]
    const d = dist.get(roomKey(cur))!
    for (const dir of ['N', 'S', 'E', 'W'] as Dir[]) {
      if (!room.doors[dir]) continue
      const next = { x: cur.x + DIR_DELTA[dir].x, y: cur.y + DIR_DELTA[dir].y }
      const nk = roomKey(next)
      if (dist.has(nk)) continue
      dist.set(nk, d + 1)
      queue.push(next)
    }
  }
  return dist
}

let nextEntityId = 1
const BOSS_GLYPHS = ['👹', '🐲', '👻', '🦂', '🕷️']
const ENEMY_GLYPHS = ['👾', '🦇', '🐍', '🧟']

function freeFloorCell(doors: Record<Dir, boolean>, rng: Rng, taken: RoomPos[]): RoomPos {
  for (let attempt = 0; attempt < 50; attempt++) {
    const x = 1 + Math.floor(rng() * (ROOM_W - 2))
    const y = 1 + Math.floor(rng() * (ROOM_H - 2))
    if (isWall(x, y, doors)) continue
    if (x === CX && y === CY) continue
    if (taken.some((t) => t.x === x && t.y === y)) continue
    return { x, y }
  }
  return { x: CX, y: CY }
}

const ITEM_KINDS: ItemKind[] = ['heal', 'attack', 'maxhp', 'piercing', 'trishot', 'armor', 'regen']

function populateRooms(rooms: Record<string, Room>, floor: number, rng: Rng) {
  const scale = 1 + (floor - 1) * 0.5
  for (const room of Object.values(rooms)) {
    if (room.kind === 'start') continue
    const occupied: RoomPos[] = []
    const enemyCount = room.kind === 'boss' ? 1 : room.kind === 'item' ? 0 : 1 + Math.floor(rng() * 2)
    const baseHp = room.kind === 'boss' ? Math.round(14 * scale) : Math.round(3 * scale)
    const baseAtk = room.kind === 'boss' ? Math.round(2 * scale) + 1 : Math.max(1, Math.round(1 * scale))
    for (let i = 0; i < enemyCount; i++) {
      const cell = freeFloorCell(room.doors, rng, occupied)
      occupied.push(cell)
      const isBoss = room.kind === 'boss'
      room.enemies.push({
        id: nextEntityId++, x: cell.x, y: cell.y, hp: baseHp, maxHp: baseHp, attack: baseAtk,
        glyph: isBoss ? pick(BOSS_GLYPHS, rng) : pick(ENEMY_GLYPHS, rng), awake: false, ranged: isBoss, enraged: false,
      })
    }
    if (room.kind === 'item' || (room.kind === 'normal' && rng() < 0.4)) {
      const cell = freeFloorCell(room.doors, rng, occupied)
      occupied.push(cell)
      room.items.push({ id: nextEntityId++, x: cell.x, y: cell.y, kind: pick(ITEM_KINDS, rng), taken: false })
    }
  }
}

function roomCountForFloor(floor: number): number {
  return 8 + (floor - 1) * 2
}

export function createGame(characterId: string = CHARACTERS[0].id, floor = 1, rng: Rng = Math.random): RoguelikeState {
  const character = CHARACTERS.find((c) => c.id === characterId) ?? CHARACTERS[0]
  const rooms = createDungeon(roomCountForFloor(floor), floor, rng)
  return {
    rooms,
    player: {
      x: CX, y: CY, hp: character.hp, maxHp: character.hp, attack: character.attack, roomKey: roomKey({ x: 0, y: 0 }),
      characterId: character.id,
      piercing: character.trait === 'piercing',
      triShot: character.trait === 'trishot',
      armor: character.trait === 'armor' ? 1 : 0,
      regen: character.trait === 'regen' ? 1 : 0,
    },
    floor,
    turn: 0,
    status: 'playing',
    log: [`${character.name} entra nel dungeon (piano ${floor}).`],
  }
}

function cloneRoom(room: Room): Room {
  return { ...room, doors: { ...room.doors }, enemies: room.enemies.map((e) => ({ ...e })), items: room.items.map((i) => ({ ...i })) }
}

const ITEM_LABEL: Record<ItemKind, string> = {
  heal: 'una pozione: curi 6 vita',
  attack: "un'arma migliore: +1 danno",
  maxhp: 'un amuleto di vitalità: +4 vita massima',
  piercing: 'colpi perforanti: i proiettili attraversano i nemici',
  trishot: 'tiro triplo: spari anche ai lati',
  armor: "un'armatura: assorbi 1 danno da ogni colpo",
  regen: 'rigenerazione: recuperi vita nel tempo',
}

function applyItem(player: Player, kind: ItemKind): Player {
  if (kind === 'heal') return { ...player, hp: Math.min(player.maxHp, player.hp + 6) }
  if (kind === 'attack') return { ...player, attack: player.attack + 1 }
  if (kind === 'maxhp') return { ...player, maxHp: player.maxHp + 4, hp: player.hp + 4 }
  if (kind === 'piercing') return { ...player, piercing: true }
  if (kind === 'trishot') return { ...player, triShot: true }
  if (kind === 'armor') return { ...player, armor: player.armor + 1 }
  return { ...player, regen: player.regen + 1 }
}

function dealDamageToPlayer(player: Player, amount: number): Player {
  const reduced = Math.max(1, amount - player.armor) // l'armatura riduce ma non annulla mai del tutto un colpo
  return { ...player, hp: player.hp - reduced }
}

/** true se non ci sono muri tra due celle allineate sulla stessa riga o colonna (linea di tiro libera). */
function hasLineOfSight(from: RoomPos, to: RoomPos, doors: Record<Dir, boolean>): boolean {
  if (from.x !== to.x && from.y !== to.y) return false
  const stepX = Math.sign(to.x - from.x)
  const stepY = Math.sign(to.y - from.y)
  let x = from.x + stepX
  let y = from.y + stepY
  while (x !== to.x || y !== to.y) {
    if (isWall(x, y, doors)) return false
    x += stepX
    y += stepY
  }
  return true
}

function enemiesTurn(room: Room, player: Player, log: string[]): Player {
  let next = player
  for (const enemy of room.enemies) {
    if (enemy.hp <= 0) continue
    if (!enemy.enraged && enemy.hp <= enemy.maxHp / 2 && enemy.ranged) {
      enemy.enraged = true
      enemy.attack = Math.round(enemy.attack * 1.6)
      log.push('Il boss infuria!')
    }
    const dx = next.x - enemy.x
    const dy = next.y - enemy.y
    const adjacent = Math.abs(dx) + Math.abs(dy) === 1
    if (adjacent) {
      next = dealDamageToPlayer(next, enemy.attack)
      log.push(`${enemy.ranged ? 'Il boss' : 'Un nemico'} ti colpisce per ${enemy.attack}.`)
      continue
    }
    if (enemy.ranged && enemy.awake && hasLineOfSight({ x: enemy.x, y: enemy.y }, { x: next.x, y: next.y }, room.doors)) {
      next = dealDamageToPlayer(next, enemy.attack)
      log.push(`Il boss ti colpisce a distanza per ${enemy.attack}.`)
      continue
    }
    if (!enemy.awake) continue
    const stepX = Math.sign(dx)
    const stepY = Math.sign(dy)
    const tryMoves: RoomPos[] = Math.abs(dx) > Math.abs(dy)
      ? [{ x: enemy.x + stepX, y: enemy.y }, { x: enemy.x, y: enemy.y + stepY }]
      : [{ x: enemy.x, y: enemy.y + stepY }, { x: enemy.x + stepX, y: enemy.y }]
    for (const m of tryMoves) {
      if (isWall(m.x, m.y, room.doors)) continue
      if (m.x === next.x && m.y === next.y) continue
      if (room.enemies.some((o) => o !== enemy && o.hp > 0 && o.x === m.x && o.y === m.y)) continue
      enemy.x = m.x
      enemy.y = m.y
      break
    }
  }
  return next
}

function finishTurn(state: RoguelikeState, rooms: Record<string, Room>, player: Player, log: string[]): RoguelikeState {
  if (player.regen > 0 && player.hp < player.maxHp && state.turn > 0 && (state.turn + 1) % 5 === 0) {
    player = { ...player, hp: Math.min(player.maxHp, player.hp + player.regen) }
    log.push('Ti rigeneri un po\' di vita.')
  }
  const trimmedLog = [...log].slice(-6)
  const turn = state.turn + 1
  if (player.hp <= 0) return { ...state, rooms, player, log: [...trimmedLog, 'Sei stato sconfitto...'], turn, status: 'lost' }
  const room = rooms[player.roomKey]
  if (room.kind === 'boss' && room.enemies.length > 0 && room.enemies.every((e) => e.hp <= 0)) {
    return { ...state, rooms, player, log: [...trimmedLog, 'Hai ripulito il piano!'], turn, status: 'floorClear' }
  }
  return { ...state, rooms, player, log: trimmedLog, turn }
}

/** Da chiamare quando `status` è 'floorClear': scende a un piano più difficile, o dichiara la vittoria finale all'ultimo. */
export function nextFloor(state: RoguelikeState, rng: Rng = Math.random): RoguelikeState {
  if (state.floor >= MAX_FLOOR) return { ...state, status: 'won' }
  const floor = state.floor + 1
  const rooms = createDungeon(roomCountForFloor(floor), floor, rng)
  return {
    rooms,
    player: { ...state.player, x: CX, y: CY, roomKey: roomKey({ x: 0, y: 0 }) },
    floor,
    turn: state.turn,
    status: 'playing',
    log: [`Scendi al piano ${floor}...`],
  }
}

/** Applica uno spostamento (dx,dy = -1/0/1, una sola direzione). I nemici bloccano il passo come un muro: per colpirli si spara. */
export function move(state: RoguelikeState, dx: number, dy: number): RoguelikeState {
  if (state.status !== 'playing') return state
  const rooms = { ...state.rooms }
  const room = cloneRoom(rooms[state.player.roomKey])
  rooms[state.player.roomKey] = room
  room.visited = true
  room.enemies.forEach((e) => { e.awake = true })
  const log = [...state.log]

  const targetX = state.player.x + dx
  const targetY = state.player.y + dy
  let player = state.player

  const dir = dx === 1 ? 'E' : dx === -1 ? 'W' : dy === 1 ? 'S' : dy === -1 ? 'N' : null
  const atDoor = dir && targetX === doorCell(dir).x && targetY === doorCell(dir).y && room.doors[dir]
  const cleared = room.enemies.every((e) => e.hp <= 0)
  const blockedByEnemy = room.enemies.some((e) => e.hp > 0 && e.x === targetX && e.y === targetY)

  if (atDoor && !cleared) {
    log.push('La porta è bloccata: prima sconfiggi tutti i nemici nella stanza.')
  } else if (atDoor && dir) {
    const nextPos = { x: room.pos.x + DIR_DELTA[dir].x, y: room.pos.y + DIR_DELTA[dir].y }
    const nextKey = roomKey(nextPos)
    const entry = entryCell(OPPOSITE[dir])
    player = { ...player, x: entry.x, y: entry.y, roomKey: nextKey }
    const nextRoom = rooms[nextKey]
    if (nextRoom && !nextRoom.visited) log.push(nextRoom.kind === 'boss' ? 'Entri nella stanza del boss!' : 'Entri in una nuova stanza.')
    return finishTurn({ ...state, log }, rooms, player, log)
  } else if (blockedByEnemy) {
    return state // non si attraversano i nemici: sparagli per colpirli, questa mossa non consuma il turno
  } else if (isWall(targetX, targetY, room.doors)) {
    return state
  } else {
    player = { ...player, x: targetX, y: targetY }
    const item = room.items.find((i) => !i.taken && i.x === targetX && i.y === targetY)
    if (item) {
      item.taken = true
      player = applyItem(player, item.kind)
      log.push(`Raccogli ${ITEM_LABEL[item.kind]}.`)
    }
  }

  player = enemiesTurn(room, player, log)
  return finishTurn(state, rooms, player, log)
}

function fireRay(room: Room, from: RoomPos, dir: Dir, damage: number, piercing: boolean, log: string[]): boolean {
  const delta = DIR_DELTA[dir]
  let x = from.x + delta.x
  let y = from.y + delta.y
  let hitAny = false
  while (!isWall(x, y, room.doors)) {
    const target = room.enemies.find((e) => e.hp > 0 && e.x === x && e.y === y)
    if (target) {
      target.hp -= damage
      hitAny = true
      log.push(`Colpisci ${target.ranged ? 'il boss' : 'un nemico'} per ${damage}.`)
      if (target.hp <= 0) log.push(target.ranged ? 'Il boss è sconfitto!' : 'Il nemico è sconfitto.')
      if (!piercing) break
    }
    x += delta.x
    y += delta.y
  }
  return hitAny
}

/** Spara un colpo nella direzione indicata: un raggio istantaneo, non un movimento. Consuma comunque il turno. */
export function shoot(state: RoguelikeState, dir: Dir): RoguelikeState {
  if (state.status !== 'playing') return state
  const rooms = { ...state.rooms }
  const room = cloneRoom(rooms[state.player.roomKey])
  rooms[state.player.roomKey] = room
  room.enemies.forEach((e) => { e.awake = true })
  const log = [...state.log]
  const player = state.player
  const origin = { x: player.x, y: player.y }

  fireRay(room, origin, dir, player.attack, player.piercing, log)
  if (player.triShot) {
    for (const side of PERPENDICULAR[dir]) fireRay(room, origin, side, player.attack, player.piercing, log)
  }

  const afterPlayer = enemiesTurn(room, player, log)
  return finishTurn(state, rooms, afterPlayer, log)
}
