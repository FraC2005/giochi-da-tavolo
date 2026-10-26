import { describe, expect, it } from 'vitest'
import { catchPlayer, createGame, tickBattery, toggleFlashlight, winGame } from './engine'

describe('createGame', () => {
  it('starts playing, full battery, flashlight on', () => {
    const state = createGame()
    expect(state).toEqual({ status: 'playing', battery: 100, flashlightOn: true })
  })
})

describe('tickBattery', () => {
  it('drains only while the flashlight is on', () => {
    const on = tickBattery(createGame(), 10)
    expect(on.battery).toBeLessThan(100)
    const off = tickBattery({ ...createGame(), flashlightOn: false }, 10)
    expect(off.battery).toBe(100)
  })

  it('clamps at 0 and turns the flashlight off when empty', () => {
    const state = tickBattery({ ...createGame(), battery: 1 }, 100)
    expect(state.battery).toBe(0)
    expect(state.flashlightOn).toBe(false)
  })

  it('does nothing once the game has ended', () => {
    const state = tickBattery({ ...createGame(), status: 'won' }, 10)
    expect(state.battery).toBe(100)
  })
})

describe('toggleFlashlight', () => {
  it('flips on/off', () => {
    let state = createGame()
    state = toggleFlashlight(state)
    expect(state.flashlightOn).toBe(false)
    state = toggleFlashlight(state)
    expect(state.flashlightOn).toBe(true)
  })

  it('cannot turn on with an empty battery', () => {
    const state = toggleFlashlight({ ...createGame(), battery: 0, flashlightOn: false })
    expect(state.flashlightOn).toBe(false)
  })
})

describe('winGame / catchPlayer', () => {
  it('sets status accordingly and is idempotent once ended', () => {
    let state = winGame(createGame())
    expect(state.status).toBe('won')
    state = catchPlayer(state)
    expect(state.status).toBe('won') // già finita: non si passa da "won" a "caught"
  })
})
