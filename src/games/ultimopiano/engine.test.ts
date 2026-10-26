import { describe, expect, it } from 'vitest'
import { confrontRoom, createGame, findClue, reachExit, readyToAdvance, reenterApartment, type UltimoPianoState } from './engine'

describe('createGame', () => {
  it('starts at chapter 1, playing, with nothing found', () => {
    const state = createGame()
    expect(state.chapterId).toBe(1)
    expect(state.status).toBe('playing')
    expect(state.found).toEqual([])
    expect(state.ending).toBeNull()
  })
})

describe('findClue', () => {
  it('adds the clue to both found and foundEver', () => {
    const state = findClue(createGame(), 'foto-famiglia')
    expect(state.found).toEqual(['foto-famiglia'])
    expect(state.foundEver).toEqual(['foto-famiglia'])
  })

  it('does not duplicate an already-found clue', () => {
    let state = findClue(createGame(), 'foto-famiglia')
    state = findClue(state, 'foto-famiglia')
    expect(state.found).toEqual(['foto-famiglia'])
  })
})

describe('readyToAdvance / reenterApartment', () => {
  it('is not ready until the chapter-unlocking clue is found', () => {
    let state = createGame()
    expect(readyToAdvance(state)).toBe(false)
    state = findClue(state, 'foto-famiglia') // indizio normale, non sblocca nulla
    expect(readyToAdvance(state)).toBe(false)
    expect(reenterApartment(state).chapterId).toBe(1)
  })

  it('advances to the next chapter and resets found once the unlocking clue is found', () => {
    let state = createGame()
    state = findClue(state, 'disegno-nascosto') // sblocca il capitolo 2
    expect(readyToAdvance(state)).toBe(true)
    state = reenterApartment(state)
    expect(state.chapterId).toBe(2)
    expect(state.found).toEqual([])
    expect(state.foundEver).toEqual(['disegno-nascosto']) // la storia pregressa resta
  })

  it('does not advance past chapter 3', () => {
    let state = createGame()
    state = { ...state, chapterId: 3 as const }
    state = reenterApartment(state)
    expect(state.chapterId).toBe(3)
  })

  it('reentering without the right clue from a later chapter does nothing', () => {
    let state = createGame()
    state = { ...state, chapterId: 2 as const }
    state = findClue(state, 'cameretta') // indizio del capitolo 2, non sblocca
    state = reenterApartment(state)
    expect(state.chapterId).toBe(2)
  })
})

describe('confrontRoom / reachExit (capitolo 3, finali)', () => {
  it('ending is "fuga" if the exit is reached without confronting the room first', () => {
    const state = reachExit({ ...createGame(), chapterId: 3 })
    expect(state.status).toBe('ended')
    expect(state.ending).toBe('fuga')
  })

  it('ending is "confronto" if the room was confronted before reaching the exit', () => {
    let state: UltimoPianoState = { ...createGame(), chapterId: 3 }
    state = confrontRoom(state)
    state = reachExit(state)
    expect(state.ending).toBe('confronto')
  })

  it('confrontRoom only applies during chapter 3', () => {
    const state = confrontRoom({ ...createGame(), chapterId: 1 })
    expect(state.confrontedRoom).toBe(false)
  })

  it('reachExit does nothing outside chapter 3', () => {
    const state = reachExit({ ...createGame(), chapterId: 2 })
    expect(state.status).toBe('playing')
  })

  it('once ended, further actions are no-ops', () => {
    let state = reachExit({ ...createGame(), chapterId: 3 })
    const before = state
    state = findClue(state, 'anything')
    state = confrontRoom(state)
    expect(state).toEqual(before)
  })
})
