import { describe, expect, it } from 'vitest'
import { createGame, nextLevel, step, type LevelData } from './engine'

const NO_INPUT = { left: false, right: false, jump: false }

function flatLevel(overrides: Partial<LevelData> = {}): LevelData {
  return {
    width: 960,
    height: 540,
    spawn: { x: 40, y: 460 },
    goal: { x: 900, y: 460, w: 40, h: 40 },
    platforms: [{ x: 0, y: 500, w: 960, h: 40 }],
    enemies: [],
    ...overrides,
  }
}

describe('createGame', () => {
  it('spawns the player at the level spawn point, standing still', () => {
    const game = createGame([flatLevel()])
    expect(game.player.x).toBe(40)
    expect(game.player.y).toBe(460)
    expect(game.player.vx).toBe(0)
    expect(game.player.vy).toBe(0)
    expect(game.lives).toBe(3)
    expect(game.status).toBe('playing')
  })
})

describe('step: gravity and ground collision', () => {
  it('falls under gravity until it lands on the ground platform', () => {
    let game = createGame([flatLevel()])
    for (let i = 0; i < 60; i++) game = step(game, 1 / 60, NO_INPUT)
    expect(game.player.onGround).toBe(true)
    expect(game.player.y + game.player.h).toBeLessThanOrEqual(500 + 0.01)
    expect(game.player.vy).toBe(0)
  })

  it('moves right when holding the right input', () => {
    let game = createGame([flatLevel()])
    game = step(game, 0.1, { ...NO_INPUT, right: true })
    expect(game.player.x).toBeGreaterThan(40)
    expect(game.player.facing).toBe(1)
  })

  it('stops at a platform edge instead of passing through it', () => {
    const level = flatLevel({ platforms: [{ x: 0, y: 500, w: 960, h: 40 }, { x: 100, y: 300, w: 40, h: 240 }] })
    let game = createGame([level])
    for (let i = 0; i < 300; i++) game = step(game, 1 / 60, { ...NO_INPUT, right: true })
    expect(game.player.x + game.player.w).toBeLessThanOrEqual(100 + 0.5)
  })

  it('jumps when grounded and the jump input is held', () => {
    let game = createGame([flatLevel()])
    for (let i = 0; i < 60; i++) game = step(game, 1 / 60, NO_INPUT) // atterra
    expect(game.player.onGround).toBe(true)
    game = step(game, 1 / 60, { ...NO_INPUT, jump: true })
    expect(game.player.vy).toBeLessThan(0)
    expect(game.player.onGround).toBe(false)
  })
})

describe('step: falling off the level', () => {
  it('loses a life and respawns when the player falls past the bottom', () => {
    const level = flatLevel({ platforms: [] }) // nessun pavimento: si cade sempre
    let game = createGame([level])
    let guard = 0
    while (game.lives === 3 && guard++ < 200) game = step(game, 1 / 10, NO_INPUT) // si ferma al primo volo giù
    expect(game.lives).toBe(2)
    expect(game.player.x).toBe(level.spawn.x)
    expect(game.player.y).toBe(level.spawn.y)
    expect(game.status).toBe('playing')
  })

  it('ends the run when the last life is lost', () => {
    const level = flatLevel({ platforms: [] })
    let game = createGame([level], 0, 1)
    let guard = 0
    while (game.status === 'playing' && guard++ < 200) game = step(game, 1 / 10, NO_INPUT)
    expect(game.lives).toBe(0)
    expect(game.status).toBe('lost')
  })
})

describe('step: enemies', () => {
  it('patrols back and forth between minX and maxX', () => {
    const level = flatLevel({ enemies: [{ x: 100, y: 476, w: 28, h: 24, minX: 100, maxX: 160, speed: 1000 }] })
    let game = createGame([level])
    game = step(game, 1, NO_INPUT) // velocità enorme: in un secondo rimbalza già indietro
    expect(game.enemies[0].x).toBeLessThanOrEqual(160)
    expect(game.enemies[0].x).toBeGreaterThanOrEqual(100)
  })

  it('costs a life when the player walks into an enemy from the side', () => {
    const level = flatLevel({ enemies: [{ x: 60, y: 464, w: 28, h: 24, minX: 60, maxX: 60, speed: 0 }] })
    let game = createGame([level])
    let guard = 0
    while (game.lives === 3 && guard++ < 200) game = step(game, 1 / 60, { ...NO_INPUT, right: true })
    expect(game.lives).toBe(2)
  })

  it('kills the enemy and scores when the player lands on top of it (a stomp)', () => {
    // il nemico galleggia a mezz'aria, lontano da terra: il giocatore ci cade sopra ancora in caduta (vy > 0)
    const level = flatLevel({ spawn: { x: 100, y: 300 }, enemies: [{ x: 95, y: 416, w: 28, h: 24, minX: 95, maxX: 95, speed: 0 }] })
    let game = createGame([level])
    for (let i = 0; i < 20; i++) game = step(game, 1 / 60, NO_INPUT)
    expect(game.enemies[0].alive).toBe(false)
    expect(game.lives).toBe(3) // niente danno: è stata una schiacciata, non un colpo
    expect(game.score).toBe(50)
  })
})

describe('step: reaching the goal', () => {
  it('completes the level when the player reaches the goal', () => {
    const level = flatLevel({ spawn: { x: 895, y: 460 }, goal: { x: 900, y: 460, w: 40, h: 40 } })
    let game = createGame([level])
    game = step(game, 0.05, { ...NO_INPUT, right: true })
    expect(game.status).toBe('levelComplete')
    expect(game.score).toBe(100)
  })
})

describe('nextLevel', () => {
  it('advances to the next level, keeping score and lives', () => {
    const levels = [flatLevel(), flatLevel({ spawn: { x: 10, y: 10 } })]
    const game = { ...createGame(levels), score: 100, lives: 2, status: 'levelComplete' as const }
    const next = nextLevel(levels, game)
    expect(next.levelIndex).toBe(1)
    expect(next.score).toBe(100)
    expect(next.lives).toBe(2)
    expect(next.player.x).toBe(10)
    expect(next.status).toBe('playing')
  })

  it('declares the run won after the last level', () => {
    const levels = [flatLevel()]
    const game = { ...createGame(levels), status: 'levelComplete' as const }
    const next = nextLevel(levels, game)
    expect(next.status).toBe('won')
  })
})
