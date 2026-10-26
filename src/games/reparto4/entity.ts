/**
 * IA dell'entità che pattuglia il reparto: pura, in coordinate 2D (x,z — l'altezza non conta per
 * il movimento). Pattuglia un percorso di waypoint finché non viene "avvistata" (il raycast della
 * torcia, calcolato nel componente 3D, decide quando passare `spotted: true`); da quel momento
 * insegue il giocatore senza più fermarsi, finché la partita non finisce.
 */

export interface Vec2 { x: number; z: number }

export interface EntityState {
  position: Vec2
  waypointIndex: number
  alert: boolean
}

export const PATROL_SPEED = 1.1 // m/s
export const CHASE_SPEED = 2.0 // m/s (meno della camminata del giocatore, 2.7: si scappa restando lucidi)
export const CATCH_DISTANCE = 0.9 // m
const WAYPOINT_ARRIVE_DIST = 0.3

export function createEntity(start: Vec2): EntityState {
  return { position: start, waypointIndex: 0, alert: false }
}

export function stepEntity(entity: EntityState, waypoints: Vec2[], playerPos: Vec2, spotted: boolean, dt: number): EntityState {
  const alert = entity.alert || spotted
  const target = alert ? playerPos : waypoints[entity.waypointIndex]
  const speed = alert ? CHASE_SPEED : PATROL_SPEED

  const dx = target.x - entity.position.x
  const dz = target.z - entity.position.z
  const dist = Math.hypot(dx, dz)

  let position = entity.position
  if (dist > 0.0001) {
    const step = Math.min(speed * dt, dist)
    position = { x: entity.position.x + (dx / dist) * step, z: entity.position.z + (dz / dist) * step }
  }

  let waypointIndex = entity.waypointIndex
  if (!alert && dist <= WAYPOINT_ARRIVE_DIST && waypoints.length > 0) {
    waypointIndex = (entity.waypointIndex + 1) % waypoints.length
  }

  return { position, waypointIndex, alert }
}

export function distanceTo(entity: EntityState, playerPos: Vec2): number {
  return Math.hypot(entity.position.x - playerPos.x, entity.position.z - playerPos.z)
}
