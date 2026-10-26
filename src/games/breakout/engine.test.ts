import { describe, expect, it } from 'vitest'
import {
  createGame, createLevel, FIELD_H, FIELD_W, launch, movePaddle, nextLevel, step, type BreakoutState,
} from './engine'

describe('createGame / createLevel', () => {
  it('starts with the ball resting on the paddle, ready to launch', () => {
    const game = createGame()
    expect(game.status).toBe('ready')
    expect(game.ball.vx).toBe(0)
    expect(game.ball.vy).toBe(0)
    expect(game.ball.y).toBeLessThan(game.paddle.y)
    expect(game.lives).toBe(3)
    expect(game.score).toBe(0)
  })

  it('adds more brick rows at higher levels, never exceeding the field', () => {
    const level1 = createLevel(1)
    const level3 = createLevel(3)
    expect(level3.length).toBeGreaterThan(level1.length)
    for (const b of level3) expect(b.y + b.h).toBeLessThan(FIELD_H)
  })
})

describe('movePaddle / setPaddleX', () => {
  it('clamps the paddle within the field', () => {
    const game = createGame()
    const left = movePaddle(game, -10_000)
    expect(left.paddle.x).toBe(0)
    const right = movePaddle(game, 10_000)
    expect(right.paddle.x).toBe(FIELD_W - game.paddle.w)
  })

  it('keeps the resting ball glued to the paddle before launch', () => {
    const game = createGame()
    const moved = movePaddle(game, 50)
    expect(moved.ball.x).toBe(moved.paddle.x + moved.paddle.w / 2)
  })
})

describe('launch', () => {
  it('gives the ball an upward velocity and switches to playing', () => {
    const launched = launch(createGame())
    expect(launched.status).toBe('playing')
    expect(launched.ball.vy).toBeLessThan(0) // verso l'alto (y cresce verso il basso)
  })

  it('does nothing if the ball is already in play', () => {
    const playing = { ...launch(createGame()) }
    expect(launch(playing)).toBe(playing)
  })
})

function withBall(state: BreakoutState, ball: Partial<BreakoutState['ball']>): BreakoutState {
  return { ...state, status: 'playing', ball: { ...state.ball, vx: 0, vy: 0, ...ball } }
}

describe('step: walls and paddle', () => {
  it('bounces the ball off the left and right walls', () => {
    const game = withBall(createGame(), { x: 2, y: 300, vx: -100, vy: 50 })
    const next = step(game, 0.1)
    expect(next.ball.vx).toBeGreaterThan(0)
  })

  it('bounces the ball off the ceiling', () => {
    const game = withBall(createGame(), { x: 240, y: 2, vx: 0, vy: -100 })
    const next = step(game, 0.1)
    expect(next.ball.vy).toBeGreaterThan(0)
  })

  it('bounces off the paddle, aiming left when hit on the left side', () => {
    const game = createGame()
    const ball = { x: game.paddle.x + 5, y: game.paddle.y - 1, vx: 0, vy: 200 }
    const next = step(withBall(game, ball), 0.001)
    expect(next.ball.vy).toBeLessThan(0) // rimbalza verso l'alto
    expect(next.ball.vx).toBeLessThan(0) // colpita sul lato sinistro del paddle: rimbalza a sinistra
  })

  it('loses a life and resets the ball when it falls past the paddle, but keeps playing with lives left', () => {
    const game = withBall(createGame(), { x: 240, y: FIELD_H - 5, vx: 0, vy: 500 })
    const next = step(game, 0.1)
    expect(next.lives).toBe(2)
    expect(next.status).toBe('ready')
  })

  it('ends the game when the last life is lost', () => {
    const game = withBall({ ...createGame(), lives: 1 }, { x: 240, y: FIELD_H - 5, vx: 0, vy: 500 })
    const next = step(game, 0.1)
    expect(next.lives).toBe(0)
    expect(next.status).toBe('lost')
  })
})

describe('step: bricks', () => {
  it('destroys a single-hit brick, adds score, and bounces the ball', () => {
    let game = createGame(1)
    const brick = game.bricks[0]
    game = withBall(game, { x: brick.x + brick.w / 2, y: brick.y + brick.h + 1, vx: 0, vy: -200 })
    const next = step(game, 0.05)
    expect(next.bricks[0].alive).toBe(false)
    expect(next.score).toBe(10)
    expect(next.ball.vy).toBeGreaterThan(0)
  })

  it('needs two hits for a reinforced brick (level 2+, top rows)', () => {
    let game = createGame(2)
    const brick = game.bricks[0]
    expect(brick.maxHits).toBe(2)
    game = withBall(game, { x: brick.x + brick.w / 2, y: brick.y + brick.h + 1, vx: 0, vy: -200 })
    const afterFirstHit = step(game, 0.05)
    expect(afterFirstHit.bricks[0].alive).toBe(true)
    expect(afterFirstHit.bricks[0].hits).toBe(1)

    const second = withBall(afterFirstHit, { x: brick.x + brick.w / 2, y: brick.y + brick.h + 1, vx: 0, vy: -200 })
    const afterSecondHit = step(second, 0.05)
    expect(afterSecondHit.bricks[0].alive).toBe(false)
    expect(afterSecondHit.score).toBe(20)
  })

  it('declares the level won once every brick is gone', () => {
    let game = createGame(1)
    game = { ...game, bricks: game.bricks.map((b, i) => (i === 0 ? b : { ...b, alive: false })) }
    const brick = game.bricks[0]
    game = withBall(game, { x: brick.x + brick.w / 2, y: brick.y + brick.h + 1, vx: 0, vy: -200 })
    const next = step(game, 0.05)
    expect(next.status).toBe('won')
  })
})

describe('nextLevel', () => {
  it('carries over score and lives into a fresh, harder level', () => {
    const game = { ...createGame(1), score: 150, lives: 2 }
    const next = nextLevel(game)
    expect(next.level).toBe(2)
    expect(next.score).toBe(150)
    expect(next.lives).toBe(2)
    expect(next.status).toBe('ready')
    expect(next.bricks.length).toBeGreaterThan(game.bricks.length)
  })
})
