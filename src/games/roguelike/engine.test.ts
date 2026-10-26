import { describe, expect, it } from 'vitest'
import {
  CHARACTERS, createDungeon, createGame, move, nextFloor, roomKey, shoot, ROOM_H, ROOM_W,
  type Dir, type Enemy, type ItemPickup, type Player, type RoguelikeState, type Room,
} from './engine'

/** Generatore pseudocasuale riproducibile (LCG), per rendere deterministici i test sulla generazione del dungeon. */
function seededRng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

const OPPOSITE: Record<Dir, Dir> = { N: 'S', S: 'N', E: 'W', W: 'E' }
const DELTA: Record<Dir, { x: number; y: number }> = { N: { x: 0, y: -1 }, S: { x: 0, y: 1 }, E: { x: 1, y: 0 }, W: { x: -1, y: 0 } }

describe('createDungeon', () => {
  it('generates exactly the requested number of connected rooms, with one start, one boss, one item room', () => {
    const rooms = createDungeon(9, 1, seededRng(42))
    const list = Object.values(rooms)
    expect(list).toHaveLength(9)
    expect(list.filter((r) => r.kind === 'start')).toHaveLength(1)
    expect(list.filter((r) => r.kind === 'boss')).toHaveLength(1)
    expect(list.filter((r) => r.kind === 'item')).toHaveLength(1)
  })

  it('every door is reciprocated by the neighbouring room (no one-way doors)', () => {
    const rooms = createDungeon(10, 1, seededRng(7))
    for (const room of Object.values(rooms)) {
      for (const dir of ['N', 'S', 'E', 'W'] as Dir[]) {
        if (!room.doors[dir]) continue
        const neighbourPos = { x: room.pos.x + DELTA[dir].x, y: room.pos.y + DELTA[dir].y }
        const neighbour = rooms[roomKey(neighbourPos)]
        expect(neighbour).toBeDefined()
        expect(neighbour.doors[OPPOSITE[dir]]).toBe(true)
      }
    }
  })

  it('the boss room has a ranged enemy, and higher floors scale up enemy stats', () => {
    const roomsFloor1 = createDungeon(8, 1, seededRng(123))
    const roomsFloor3 = createDungeon(8, 3, seededRng(123))
    const boss1 = Object.values(roomsFloor1).find((r) => r.kind === 'boss')!
    const boss3 = Object.values(roomsFloor3).find((r) => r.kind === 'boss')!
    expect(boss1.enemies[0].ranged).toBe(true)
    expect(boss3.enemies[0].maxHp).toBeGreaterThan(boss1.enemies[0].maxHp)
  })
})

describe('createGame', () => {
  it('applies the chosen character\'s stats and starting trait', () => {
    const tiratrice = CHARACTERS.find((c) => c.id === 'tiratrice')!
    const game = createGame('tiratrice', 1, seededRng(1))
    expect(game.player.hp).toBe(tiratrice.hp)
    expect(game.player.maxHp).toBe(tiratrice.hp)
    expect(game.player.attack).toBe(tiratrice.attack)
    expect(game.player.piercing).toBe(true)
    expect(game.player.triShot).toBe(false)
  })

  it('falls back to the first character for an unknown id', () => {
    const game = createGame('non-esiste', 1, seededRng(1))
    expect(game.player.hp).toBe(CHARACTERS[0].hp)
  })
})

function emptyRoom(overrides: Partial<Room> = {}): Room {
  return { pos: { x: 0, y: 0 }, doors: { N: false, S: false, E: false, W: false }, kind: 'normal', enemies: [], items: [], visited: true, ...overrides }
}
function player(overrides: Partial<Player> = {}): Player {
  return { x: 5, y: 4, hp: 10, maxHp: 10, attack: 3, roomKey: '0,0', characterId: 'bimbo', piercing: false, triShot: false, armor: 0, regen: 0, ...overrides }
}
function enemy(overrides: Partial<Enemy> = {}): Enemy {
  return { id: 1, x: 6, y: 4, hp: 5, maxHp: 5, attack: 2, glyph: 'g', awake: false, ranged: false, enraged: false, ...overrides }
}
function stateWith(room: Room, p: Player, overrides: Partial<RoguelikeState> = {}): RoguelikeState {
  return { rooms: { [roomKey(room.pos)]: room }, player: { ...p, roomKey: roomKey(room.pos) }, floor: 1, turn: 0, status: 'playing', log: [], ...overrides }
}

describe('move: walking, walls, and enemies blocking the way', () => {
  it('moves the player onto open floor', () => {
    const state = stateWith(emptyRoom(), player())
    const next = move(state, 1, 0)
    expect(next.player.x).toBe(6)
    expect(next.turn).toBe(1)
  })

  it('refuses to walk into a wall and does not spend a turn', () => {
    const state = stateWith(emptyRoom(), player({ x: 1, y: 1 }))
    const next = move(state, -1, 0)
    expect(next.player.x).toBe(1)
    expect(next.turn).toBe(0)
  })

  it('an enemy blocks movement like a wall: no bump attack, no turn spent', () => {
    const room = emptyRoom({ enemies: [enemy({ x: 6, y: 4, hp: 5 })] })
    const state = stateWith(room, player({ x: 5, y: 4 }))
    const next = move(state, 1, 0)
    expect(next.player.x).toBe(5)
    expect(next.turn).toBe(0)
    expect(next.rooms['0,0'].enemies[0].hp).toBe(5) // intatto: camminare non lo colpisce
  })
})

describe('shoot: ranged combat', () => {
  it('hits the first enemy in a straight line and does not move the player', () => {
    const room = emptyRoom({ enemies: [enemy({ x: 8, y: 4, hp: 5 })] })
    const state = stateWith(room, player({ x: 5, y: 4, attack: 3 }))
    const next = shoot(state, 'E')
    expect(next.player.x).toBe(5)
    expect(next.rooms['0,0'].enemies[0].hp).toBe(2)
    expect(next.turn).toBe(1)
  })

  it('stops at the first enemy without piercing', () => {
    const room = emptyRoom({ enemies: [enemy({ id: 1, x: 7, y: 4, hp: 5 }), enemy({ id: 2, x: 9, y: 4, hp: 5 })] })
    const state = stateWith(room, player({ x: 5, y: 4, attack: 3, piercing: false }))
    const next = shoot(state, 'E')
    expect(next.rooms['0,0'].enemies[0].hp).toBe(2)
    expect(next.rooms['0,0'].enemies[1].hp).toBe(5) // il secondo nemico non è stato raggiunto
  })

  it('pierces through every enemy in line when the player has piercing shots', () => {
    const room = emptyRoom({ enemies: [enemy({ id: 1, x: 7, y: 4, hp: 5 }), enemy({ id: 2, x: 9, y: 4, hp: 5 })] })
    const state = stateWith(room, player({ x: 5, y: 4, attack: 3, piercing: true }))
    const next = shoot(state, 'E')
    expect(next.rooms['0,0'].enemies[0].hp).toBe(2)
    expect(next.rooms['0,0'].enemies[1].hp).toBe(2)
  })

  it('fires sideways too with tri-shot', () => {
    const room = emptyRoom({ enemies: [enemy({ id: 1, x: 5, y: 2, hp: 5 }), enemy({ id: 2, x: 5, y: 6, hp: 5 }), enemy({ id: 3, x: 8, y: 4, hp: 5 })] })
    const state = stateWith(room, player({ x: 5, y: 4, attack: 3, triShot: true }))
    const next = shoot(state, 'E') // tiro triplo: avanti (E) + lati (N e S)
    expect(next.rooms['0,0'].enemies[0].hp).toBeLessThan(5) // colpito a nord
    expect(next.rooms['0,0'].enemies[1].hp).toBeLessThan(5) // colpito a sud
    expect(next.rooms['0,0'].enemies[2].hp).toBeLessThan(5) // colpito a est
  })

  it('a shot that hits nothing still spends a turn and wakes the room', () => {
    const room = emptyRoom({ enemies: [enemy({ x: 8, y: 6, hp: 5 })] }) // non allineato col tiro verso est
    const state = stateWith(room, player({ x: 5, y: 4 }))
    const next = shoot(state, 'E')
    expect(next.turn).toBe(1)
    expect(next.rooms['0,0'].enemies[0].hp).toBe(5)
  })
})

describe('combat: armor and player defeat', () => {
  it('armor reduces incoming damage but never below 1', () => {
    const room = emptyRoom({ enemies: [enemy({ x: 6, y: 5, hp: 5, attack: 3 })] })
    const state = stateWith(room, player({ x: 5, y: 4, hp: 10, armor: 2 }))
    const next = move(state, 1, 0) // si avvicina: il nemico in (6,5) diventa adiacente dopo la mossa
    expect(next.player.hp).toBe(9) // 3 di danno - 2 di armatura, mai sotto 1
  })

  it('ends the run when the player hp drops to zero', () => {
    const room = emptyRoom({ enemies: [enemy({ x: 6, y: 5, hp: 5, attack: 99 })] })
    const state = stateWith(room, player({ x: 5, y: 4, hp: 10 }))
    const next = move(state, 1, 0)
    expect(next.status).toBe('lost')
  })
})

describe('move: doors', () => {
  it('blocks a door while the room still has living enemies', () => {
    const room = emptyRoom({ doors: { N: false, S: false, E: true, W: false }, enemies: [enemy({ x: 3, y: 3, hp: 5 })] })
    const state = stateWith(room, player({ x: ROOM_W - 2, y: 4 }))
    const next = move(state, 1, 0)
    expect(next.player.x).toBe(ROOM_W - 2)
    expect(next.player.roomKey).toBe('0,0')
  })

  it('transitions to the next room, placing the player just inside the opposite door, once cleared', () => {
    const start = emptyRoom({ pos: { x: 0, y: 0 }, doors: { N: false, S: false, E: true, W: false }, enemies: [] })
    const east = emptyRoom({ pos: { x: 1, y: 0 }, doors: { N: false, S: false, E: false, W: true }, enemies: [] })
    const state: RoguelikeState = {
      rooms: { '0,0': start, '1,0': east },
      player: player({ x: ROOM_W - 2, y: 4, roomKey: '0,0' }),
      floor: 1, turn: 0, status: 'playing', log: [],
    }
    const next = move(state, 1, 0)
    expect(next.player.roomKey).toBe('1,0')
    expect(next.player.x).toBe(1)
    expect(next.player.y).toBe(4)
  })
})

describe('move: items', () => {
  it('heals the player and consumes the item when walked over', () => {
    const room = emptyRoom({ items: [{ id: 1, x: 6, y: 4, kind: 'heal', taken: false } as ItemPickup] })
    const state = stateWith(room, player({ x: 5, y: 4, hp: 4, maxHp: 10 }))
    const next = move(state, 1, 0)
    expect(next.player.hp).toBe(10)
    expect(next.rooms['0,0'].items[0].taken).toBe(true)
  })

  it('grants piercing shots from a piercing item', () => {
    const room = emptyRoom({ items: [{ id: 1, x: 6, y: 4, kind: 'piercing', taken: false } as ItemPickup] })
    const state = stateWith(room, player({ x: 5, y: 4, piercing: false }))
    const next = move(state, 1, 0)
    expect(next.player.piercing).toBe(true)
  })
})

describe('boss: ranged attacks and enrage', () => {
  it('a ranged enemy with line of sight hits the player without needing to be adjacent', () => {
    const room = emptyRoom({ enemies: [enemy({ x: 9, y: 4, hp: 10, attack: 3, ranged: true, awake: true })] })
    const state = stateWith(room, player({ x: 2, y: 4, hp: 20 }))
    const next = move(state, 1, 0) // il giocatore cammina, il boss è allineato e lo colpisce a distanza
    expect(next.player.hp).toBe(17)
  })

  it('does not hit at range without a clear line of sight (different row and column)', () => {
    const room = emptyRoom({ enemies: [enemy({ x: 9, y: 7, hp: 10, attack: 3, ranged: true, awake: true })] })
    const state = stateWith(room, player({ x: 2, y: 4, hp: 20 }))
    const next = move(state, 1, 0)
    expect(next.player.hp).toBe(20)
  })

  it('enrages and hits harder once below half health', () => {
    const room = emptyRoom({ enemies: [enemy({ x: 6, y: 5, hp: 4, maxHp: 10, attack: 2, ranged: true })] })
    const state = stateWith(room, player({ x: 5, y: 4, hp: 20 }))
    const next = move(state, 1, 0) // adiacente dopo la mossa, già sotto metà vita: colpisce con l'attacco potenziato
    expect(next.rooms['0,0'].enemies[0].enraged).toBe(true)
    expect(20 - next.player.hp).toBeGreaterThan(2)
  })
})

describe('floor progression', () => {
  it('clears the floor instead of winning outright when the boss dies before the last floor', () => {
    const room = emptyRoom({ kind: 'boss', enemies: [enemy({ x: 6, y: 4, hp: 2 })] })
    const state = stateWith(room, player({ x: 5, y: 4, attack: 5 }), { floor: 1 })
    const next = shoot(state, 'E')
    expect(next.status).toBe('floorClear')
  })

  it('nextFloor descends to a harder, freshly generated floor and resets the player position', () => {
    const state = createGame('bimbo', 2, seededRng(9))
    const cleared: RoguelikeState = { ...state, status: 'floorClear' }
    const next = nextFloor(cleared, seededRng(9))
    expect(next.floor).toBe(3)
    expect(next.status).toBe('playing')
    expect(next.player.roomKey).toBe('0,0')
  })

  it('declares final victory once the floor cleared was the last one', () => {
    const state = createGame('bimbo', 5, seededRng(3))
    const cleared: RoguelikeState = { ...state, status: 'floorClear' }
    const next = nextFloor(cleared)
    expect(next.status).toBe('won')
  })
})
