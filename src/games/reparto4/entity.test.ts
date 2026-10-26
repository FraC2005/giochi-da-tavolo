import { describe, expect, it } from 'vitest'
import { CATCH_DISTANCE, createEntity, distanceTo, stepEntity } from './entity'

const waypoints = [{ x: 0, z: 0 }, { x: 5, z: 0 }]

describe('createEntity', () => {
  it('starts at the given position, patrolling, not alert', () => {
    const e = createEntity({ x: 1, z: 2 })
    expect(e).toEqual({ position: { x: 1, z: 2 }, waypointIndex: 0, alert: false })
  })
})

describe('stepEntity — pattuglia', () => {
  it('moves toward the current waypoint at patrol speed', () => {
    const e = { position: { x: -1, z: 0 }, waypointIndex: 0, alert: false } // waypoints[0] è (0,0): si avvicina
    const next = stepEntity(e, waypoints, { x: 100, z: 100 }, false, 1)
    expect(next.position.x).toBeGreaterThan(-1)
    expect(next.position.z).toBeCloseTo(0)
    expect(next.alert).toBe(false)
  })

  it('advances to the next waypoint once close enough', () => {
    const e = { position: { x: 4.9, z: 0 }, waypointIndex: 1, alert: false } // vicino a waypoints[1] = (5,0)
    const next = stepEntity(e, waypoints, { x: 100, z: 100 }, false, 1)
    expect(next.waypointIndex).toBe(0) // torna al primo: sono solo 2 waypoint
  })

  it('loops back to the first waypoint after the last', () => {
    const e = { position: { x: 0.05, z: 0 }, waypointIndex: 1, alert: false } // vicino al waypoint[1] di questa lista, (0,0)
    const next = stepEntity(e, [waypoints[1], waypoints[0]], { x: 100, z: 100 }, false, 1)
    expect(next.waypointIndex).toBe(0)
  })
})

describe('stepEntity — avvistamento e inseguimento', () => {
  it('becomes permanently alert once spotted, moving toward the player instead of waypoints', () => {
    const e = createEntity({ x: 0, z: 0 })
    const spotted = stepEntity(e, waypoints, { x: -5, z: 0 }, true, 1)
    expect(spotted.alert).toBe(true)
    expect(spotted.position.x).toBeLessThan(0) // va verso il giocatore (x negativo), non verso il waypoint (x positivo)
  })

  it('stays alert on later frames even if spotted becomes false again', () => {
    let e = createEntity({ x: 0, z: 0 })
    e = stepEntity(e, waypoints, { x: -5, z: 0 }, true, 1)
    e = stepEntity(e, waypoints, { x: -5, z: 0 }, false, 1)
    expect(e.alert).toBe(true)
  })

  it('chases faster than it patrols', () => {
    const patrol = stepEntity(createEntity({ x: 0, z: 0 }), waypoints, { x: 0, z: 100 }, false, 1)
    const chase = stepEntity(createEntity({ x: 0, z: 0 }), waypoints, { x: 100, z: 0 }, true, 1)
    const patrolDist = Math.hypot(patrol.position.x, patrol.position.z)
    const chaseDist = Math.hypot(chase.position.x, chase.position.z)
    expect(chaseDist).toBeGreaterThan(patrolDist)
  })
})

describe('distanceTo / CATCH_DISTANCE', () => {
  it('computes straight-line distance in the xz plane', () => {
    const e = createEntity({ x: 0, z: 0 })
    expect(distanceTo(e, { x: 3, z: 4 })).toBe(5)
  })

  it('CATCH_DISTANCE is a small, sane radius', () => {
    expect(CATCH_DISTANCE).toBeGreaterThan(0)
    expect(CATCH_DISTANCE).toBeLessThan(2)
  })
})
