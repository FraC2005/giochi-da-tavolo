/**
 * Motore del Platformer: simulazione pura a passi (`step(stato, dt, input)`), senza alcun
 * accesso a DOM/canvas — stesso approccio del Breakout. Piattaforme rettangolari fisse, niente
 * tile grid: le collisioni si risolvono un asse alla volta (tecnica standard per questo genere).
 */

export interface Rect { x: number; y: number; w: number; h: number }
export interface LevelData {
  width: number
  height: number
  spawn: { x: number; y: number }
  goal: Rect
  platforms: Rect[]
  enemies: { x: number; y: number; w: number; h: number; minX: number; maxX: number; speed: number }[]
}

export interface Player { x: number; y: number; w: number; h: number; vx: number; vy: number; onGround: boolean; facing: 1 | -1 }
export interface Enemy extends Rect { dir: 1 | -1; minX: number; maxX: number; speed: number; alive: boolean }

export type Status = 'playing' | 'levelComplete' | 'won' | 'lost'

export interface PlatformerState {
  levelIndex: number
  level: LevelData
  player: Player
  enemies: Enemy[]
  lives: number
  score: number
  status: Status
}

export interface Input { left: boolean; right: boolean; jump: boolean }

const MOVE_SPEED = 220 // px/s
const GRAVITY = 1500 // px/s²
const JUMP_VELOCITY = -560 // px/s (y cresce verso il basso: negativo = verso l'alto)
const MAX_FALL_SPEED = 900
const PLAYER_W = 30
const PLAYER_H = 36

function overlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

export function createPlayer(level: LevelData): Player {
  return { x: level.spawn.x, y: level.spawn.y, w: PLAYER_W, h: PLAYER_H, vx: 0, vy: 0, onGround: false, facing: 1 }
}

export function createGame(levels: LevelData[], levelIndex = 0, lives = 3, score = 0): PlatformerState {
  const level = levels[levelIndex]
  return {
    levelIndex,
    level,
    player: createPlayer(level),
    enemies: level.enemies.map((e) => ({ ...e, dir: 1, alive: true })),
    lives,
    score,
    status: 'playing',
  }
}

/** Sposta un rettangolo di (dx, dy) e lo ferma contro le piattaforme, un asse alla volta. Ritorna anche se è atterrato su qualcosa. */
function moveAgainstPlatforms(rect: Rect, dx: number, dy: number, platforms: Rect[]): { rect: Rect; onGround: boolean; hitCeiling: boolean } {
  let next = { ...rect, x: rect.x + dx }
  for (const p of platforms) {
    if (!overlap(next, p)) continue
    next = { ...next, x: dx > 0 ? p.x - next.w : dx < 0 ? p.x + p.w : next.x }
  }

  let onGround = false
  let hitCeiling = false
  next = { ...next, y: next.y + dy }
  for (const p of platforms) {
    if (!overlap(next, p)) continue
    if (dy > 0) { next = { ...next, y: p.y - next.h }; onGround = true }
    else if (dy < 0) { next = { ...next, y: p.y + p.h }; hitCeiling = true }
  }

  return { rect: next, onGround, hitCeiling }
}

function stepEnemy(e: Enemy, dt: number): Enemy {
  if (!e.alive) return e
  let dir = e.dir
  let x = e.x + dir * e.speed * dt
  if (x <= e.minX) { x = e.minX; dir = 1 }
  else if (x >= e.maxX) { x = e.maxX; dir = -1 }
  return { ...e, x, dir }
}

export function step(state: PlatformerState, dt: number, input: Input): PlatformerState {
  if (state.status !== 'playing') return state
  const { level } = state
  let player = { ...state.player }

  const vx = input.left && !input.right ? -MOVE_SPEED : input.right && !input.left ? MOVE_SPEED : 0
  player.vx = vx
  if (vx !== 0) player.facing = vx > 0 ? 1 : -1

  if (input.jump && player.onGround) player.vy = JUMP_VELOCITY
  player.vy = Math.min(player.vy + GRAVITY * dt, MAX_FALL_SPEED)

  const moved = moveAgainstPlatforms(player, player.vx * dt, player.vy * dt, level.platforms)
  player = { ...player, x: moved.rect.x, y: moved.rect.y, onGround: moved.onGround, vy: moved.onGround ? 0 : moved.hitCeiling ? 0 : player.vy }
  player.x = Math.max(0, Math.min(level.width - player.w, player.x))

  const enemies = state.enemies.map((e) => stepEnemy(e, dt))

  // nemico: calpestarlo da sopra lo elimina (e dà punti), toccarlo di lato/sotto costa una vita
  let score = state.score
  let hitEnemySide = false
  let bounced = false
  const afterEnemies = enemies.map((e) => {
    if (!e.alive || !overlap(player, e)) return e
    const playerBottom = player.y + player.h
    const stomp = player.vy > 0 && playerBottom - e.y < 16
    if (stomp) {
      score += 50
      bounced = true
      return { ...e, alive: false }
    }
    hitEnemySide = true
    return e
  })
  if (bounced) player.vy = JUMP_VELOCITY * 0.6

  if (hitEnemySide || player.y > level.height) {
    const lives = state.lives - 1
    if (lives <= 0) return { ...state, player, enemies: afterEnemies, score, lives: 0, status: 'lost' }
    return { ...state, player: createPlayer(level), enemies: level.enemies.map((e) => ({ ...e, dir: 1 as const, alive: true })), score, lives }
  }

  if (overlap(player, level.goal)) {
    return { ...state, player, enemies: afterEnemies, score: score + 100, status: 'levelComplete' }
  }

  return { ...state, player, enemies: afterEnemies, score, status: 'playing' }
}

export function nextLevel(levels: LevelData[], state: PlatformerState): PlatformerState {
  const levelIndex = state.levelIndex + 1
  if (levelIndex >= levels.length) return { ...state, status: 'won' }
  return createGame(levels, levelIndex, state.lives, state.score)
}
