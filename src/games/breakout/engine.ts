/**
 * Motore del Breakout: simulazione pura (nessun accesso a DOM/canvas), passo per passo con un
 * `dt` in secondi, così la fisica è la stessa a qualunque framerate e testabile senza un browser.
 * Il campo di gioco è un rettangolo logico FIELD_W × FIELD_H; chi disegna lo scala come vuole.
 */

export const FIELD_W = 480
export const FIELD_H = 640

export interface Rect { x: number; y: number; w: number; h: number }
export interface Ball { x: number; y: number; r: number; vx: number; vy: number }
export interface Brick extends Rect { alive: boolean; hits: number; maxHits: number; color: string }

export type Status = 'ready' | 'playing' | 'won' | 'lost'

export interface BreakoutState {
  paddle: Rect
  ball: Ball
  bricks: Brick[]
  lives: number
  score: number
  level: number
  status: Status
}

const PADDLE_W = 90
const PADDLE_H = 14
export const PADDLE_SPEED = 620 // px/s, usata dalla UI per muovere il paddle da tastiera
const BALL_R = 8
export const BALL_SPEED = 300
const BRICK_ROWS_PER_LEVEL = 2 // ogni livello aggiunge 2 righe di mattoni (fino al tetto)
const BRICK_COLS = 8
const BRICK_GAP = 6
const BRICK_TOP = 60
const BRICK_H = 22
const ROW_COLORS = ['#ef476f', '#ff8f5d', '#ffd166', '#34c98a', '#8ecae6', '#b591ff']

function brickRows(level: number): number {
  return Math.min(3 + level * BRICK_ROWS_PER_LEVEL, 10) // non supera mai il campo
}

export function createLevel(level: number): Brick[] {
  const rows = brickRows(level)
  const brickW = (FIELD_W - BRICK_GAP * (BRICK_COLS + 1)) / BRICK_COLS
  const bricks: Brick[] = []
  for (let row = 0; row < rows; row++) {
    // le righe più vicine al soffitto (valore di `row` più basso) reggono un colpo in più, dal livello 2 in su
    const maxHits = level >= 2 && row < Math.floor(rows / 3) ? 2 : 1
    for (let col = 0; col < BRICK_COLS; col++) {
      bricks.push({
        x: BRICK_GAP + col * (brickW + BRICK_GAP),
        y: BRICK_TOP + row * (BRICK_H + BRICK_GAP),
        w: brickW,
        h: BRICK_H,
        alive: true,
        hits: 0,
        maxHits,
        color: ROW_COLORS[row % ROW_COLORS.length],
      })
    }
  }
  return bricks
}

function ballOnPaddle(paddle: Rect): Ball {
  return { x: paddle.x + paddle.w / 2, y: paddle.y - BALL_R - 1, r: BALL_R, vx: 0, vy: 0 }
}

export function createGame(level = 1, lives = 3, score = 0): BreakoutState {
  const paddle: Rect = { x: (FIELD_W - PADDLE_W) / 2, y: FIELD_H - 36, w: PADDLE_W, h: PADDLE_H }
  return { paddle, ball: ballOnPaddle(paddle), bricks: createLevel(level), lives, score, level, status: 'ready' }
}

export function movePaddle(state: BreakoutState, deltaX: number): BreakoutState {
  const x = Math.max(0, Math.min(FIELD_W - state.paddle.w, state.paddle.x + deltaX))
  const paddle = { ...state.paddle, x }
  // la pallina appoggiata segue il paddle finché non viene lanciata
  const ball = state.status === 'ready' ? ballOnPaddle(paddle) : state.ball
  return { ...state, paddle, ball }
}

export function setPaddleX(state: BreakoutState, x: number): BreakoutState {
  return movePaddle(state, x - state.paddle.x)
}

export function launch(state: BreakoutState): BreakoutState {
  if (state.status !== 'ready') return state
  // angolo di partenza leggermente casuale, sempre verso l'alto
  const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.6
  return { ...state, status: 'playing', ball: { ...state.ball, vx: Math.cos(angle) * BALL_SPEED, vy: Math.sin(angle) * BALL_SPEED } }
}

function circleRectOverlap(ball: Ball, rect: Rect): boolean {
  const closestX = Math.max(rect.x, Math.min(ball.x, rect.x + rect.w))
  const closestY = Math.max(rect.y, Math.min(ball.y, rect.y + rect.h))
  const dx = ball.x - closestX
  const dy = ball.y - closestY
  return dx * dx + dy * dy < ball.r * ball.r
}

/** Riflette la pallina su un rettangolo, scegliendo l'asse con meno compenetrazione (tecnica standard per i breakout "arcade"). */
function bounceOffRect(ball: Ball, rect: Rect): Ball {
  const overlapLeft = ball.x + ball.r - rect.x
  const overlapRight = rect.x + rect.w - (ball.x - ball.r)
  const overlapTop = ball.y + ball.r - rect.y
  const overlapBottom = rect.y + rect.h - (ball.y - ball.r)
  const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom)
  if (minOverlap === overlapLeft || minOverlap === overlapRight) return { ...ball, vx: -ball.vx }
  return { ...ball, vy: -ball.vy }
}

/** Avanza la simulazione di `dt` secondi. Pura: non mutano né lo stato passato né i suoi array. */
export function step(state: BreakoutState, dt: number): BreakoutState {
  if (state.status !== 'playing') return state

  let ball: Ball = { ...state.ball, x: state.ball.x + state.ball.vx * dt, y: state.ball.y + state.ball.vy * dt }

  if (ball.x - ball.r < 0) { ball = { ...ball, x: ball.r, vx: Math.abs(ball.vx) } }
  else if (ball.x + ball.r > FIELD_W) { ball = { ...ball, x: FIELD_W - ball.r, vx: -Math.abs(ball.vx) } }
  if (ball.y - ball.r < 0) { ball = { ...ball, y: ball.r, vy: Math.abs(ball.vy) } }

  if (circleRectOverlap(ball, state.paddle) && ball.vy > 0) {
    // l'angolo di rimbalzo dipende da dove la pallina tocca il paddle, non solo dal lato
    const hitPos = (ball.x - (state.paddle.x + state.paddle.w / 2)) / (state.paddle.w / 2) // -1..1
    const angle = -Math.PI / 2 + hitPos * (Math.PI / 3) // max ±60°
    const speed = Math.hypot(ball.vx, ball.vy)
    ball = { ...ball, y: state.paddle.y - ball.r - 1, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed }
  }

  let score = state.score
  const bricks = state.bricks.map((brick) => {
    if (!brick.alive || !circleRectOverlap(ball, brick)) return brick
    const hits = brick.hits + 1
    const alive = hits < brick.maxHits
    if (!alive) score += 10 * brick.maxHits
    ball = bounceOffRect(ball, brick)
    return { ...brick, hits, alive }
  })

  if (ball.y - ball.r > FIELD_H) {
    const lives = state.lives - 1
    if (lives <= 0) return { ...state, bricks, score, lives: 0, status: 'lost', ball }
    return { ...state, bricks, score, lives, status: 'ready', ball: ballOnPaddle(state.paddle) }
  }

  const won = bricks.every((b) => !b.alive)
  if (won) return { ...state, bricks, score, status: 'won', ball }

  return { ...state, bricks, score, ball, status: 'playing' }
}

/** Prepara il livello successivo mantenendo punteggio e vite (chiamare dopo che `status` è 'won'). */
export function nextLevel(state: BreakoutState): BreakoutState {
  return createGame(state.level + 1, state.lives, state.score)
}
