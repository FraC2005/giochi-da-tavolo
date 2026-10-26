/**
 * Il reparto: un corridoio lungo con due stanze laterali, costruito con geometrie primitive ma
 * vestite di materiali PBR fotografici veri (vedi materials.ts). La maggior parte delle plafoniere
 * è rotta apposta — l'unica luce affidabile è la torcia del giocatore.
 */
import * as THREE from 'three'
import { enableAoUv2, pbrMaterial } from './materials'

export interface FlickerLight {
  light: THREE.PointLight
  baseIntensity: number
  seed: number
}

export interface BuiltLevel {
  group: THREE.Group
  collidables: THREE.Box3[]
  flickerLights: FlickerLight[]
  spawn: THREE.Vector3
  spawnYaw: number
  exitBox: THREE.Box3
  entityWaypoints: { x: number; z: number }[]
  entitySpawn: { x: number; z: number }
}

const WALL_H = 2.9
const WALL_T = 0.25
const LIGHT_SCALE = 60 // three.js recente usa unità fotometriche: un'intensità vecchio stile va moltiplicata

function addBox(
  group: THREE.Group, collidables: THREE.Box3[],
  opts: { x: number; y: number; z: number; w: number; h: number; d: number; material: THREE.Material; collide?: boolean; repeat?: [number, number] },
): THREE.Mesh {
  const geo = new THREE.BoxGeometry(opts.w, opts.h, opts.d)
  enableAoUv2(geo)
  const mesh = new THREE.Mesh(geo, opts.material)
  mesh.position.set(opts.x, opts.y, opts.z)
  mesh.receiveShadow = true
  mesh.castShadow = true
  group.add(mesh)
  if (opts.collide !== false) collidables.push(new THREE.Box3().setFromObject(mesh))
  return mesh
}

function wallAlongX(group: THREE.Group, collidables: THREE.Box3[], z: number, xFrom: number, xTo: number, material: THREE.Material, gap?: [number, number]) {
  if (!gap) { addBox(group, collidables, { x: (xFrom + xTo) / 2, y: WALL_H / 2, z, w: xTo - xFrom, h: WALL_H, d: WALL_T, material }); return }
  const [gFrom, gTo] = gap
  if (gFrom > xFrom) addBox(group, collidables, { x: (xFrom + gFrom) / 2, y: WALL_H / 2, z, w: gFrom - xFrom, h: WALL_H, d: WALL_T, material })
  if (xTo > gTo) addBox(group, collidables, { x: (gTo + xTo) / 2, y: WALL_H / 2, z, w: xTo - gTo, h: WALL_H, d: WALL_T, material })
}

function wallAlongZ(group: THREE.Group, collidables: THREE.Box3[], x: number, zFrom: number, zTo: number, material: THREE.Material, gap?: [number, number]) {
  if (!gap) { addBox(group, collidables, { x, y: WALL_H / 2, z: (zFrom + zTo) / 2, w: WALL_T, h: WALL_H, d: zTo - zFrom, material }); return }
  const [gFrom, gTo] = gap
  if (gFrom > zFrom) addBox(group, collidables, { x, y: WALL_H / 2, z: (zFrom + gFrom) / 2, w: WALL_T, h: WALL_H, d: gFrom - zFrom, material })
  if (zTo > gTo) addBox(group, collidables, { x, y: WALL_H / 2, z: (gTo + zTo) / 2, w: WALL_T, h: WALL_H, d: zTo - gTo, material })
}

function addFloorCeiling(group: THREE.Group, x: number, z: number, w: number, d: number, floorMat: THREE.MeshStandardMaterial, ceilMat: THREE.Material, repeat: [number, number]) {
  const floorGeo = new THREE.PlaneGeometry(w, d)
  const uv = floorGeo.getAttribute('uv')
  for (let i = 0; i < uv.count; i += 1) uv.setXY(i, uv.getX(i) * repeat[0], uv.getY(i) * repeat[1])
  uv.needsUpdate = true
  enableAoUv2(floorGeo)
  const floor = new THREE.Mesh(floorGeo, floorMat)
  floor.rotation.x = -Math.PI / 2
  floor.position.set(x, 0, z)
  floor.receiveShadow = true
  group.add(floor)

  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(w, d), ceilMat)
  ceiling.rotation.x = Math.PI / 2
  ceiling.position.set(x, WALL_H, z)
  group.add(ceiling)
}

/** Plafoniera: quasi tutte rotte (solo il tubo, niente luce); una ogni tanto è ancora accesa, debole. */
function addCeilingLight(group: THREE.Group, flickerLights: FlickerLight[], x: number, z: number, working: boolean) {
  const fixture = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.08, 0.2),
    new THREE.MeshStandardMaterial({ color: working ? 0xcfd8dc : 0x2a2a2a, emissive: working ? 0xbfd8ff : 0x000000, emissiveIntensity: working ? 0.6 : 0 }),
  )
  fixture.position.set(x, WALL_H - 0.05, z)
  group.add(fixture)
  if (working) {
    const light = new THREE.PointLight(0xbfd8ff, 0.35 * LIGHT_SCALE, 5, 2)
    light.position.set(x, WALL_H - 0.2, z)
    group.add(light)
    flickerLights.push({ light, baseIntensity: 0.35 * LIGHT_SCALE, seed: Math.random() * 1000 })
  }
}

function addGurney(group: THREE.Group, collidables: THREE.Box3[], x: number, z: number, rotY: number, metalMat: THREE.Material) {
  const g = new THREE.Group()
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 1.9), metalMat)
  top.position.y = 0.75
  top.castShadow = true
  g.add(top)
  for (const [lx, lz] of [[-0.3, -0.8], [0.3, -0.8], [-0.3, 0.8], [0.3, 0.8]] as const) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.75, 8), metalMat)
    leg.position.set(lx, 0.375, lz)
    g.add(leg)
  }
  g.position.set(x, 0, z)
  g.rotation.y = rotY
  group.add(g)
  const box = new THREE.Box3().setFromObject(g)
  box.expandByScalar(-0.05)
  collidables.push(box)
}

function addBed(group: THREE.Group, collidables: THREE.Box3[], x: number, z: number, metalMat: THREE.Material, mattressMat: THREE.Material) {
  addBox(group, collidables, { x, y: 0.3, z, w: 1, h: 0.5, d: 2, material: metalMat })
  addBox(group, collidables, { x, y: 0.58, z, w: 0.92, h: 0.12, d: 1.9, material: mattressMat, collide: false })
}

function addLocker(group: THREE.Group, collidables: THREE.Box3[], x: number, z: number, rotY: number, metalMat: THREE.Material) {
  addBox(group, collidables, { x, y: 0.95, z, w: 0.6, h: 1.9, d: 0.5, material: metalMat })
}

type RoomSide = 'east' | 'west'

interface RoomSpec {
  side: RoomSide
  z: number
  label: string
  kind: 'ward' | 'nurse' | 'storage' | 'treatment' | 'isolation'
}

function addRoomSign(group: THREE.Group, side: RoomSide, z: number, label: string) {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 128
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Impossibile creare la segnaletica del reparto.')

  context.fillStyle = '#d6dedb'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.strokeStyle = '#53605d'
  context.lineWidth = 8
  context.strokeRect(4, 4, canvas.width - 8, canvas.height - 8)
  context.fillStyle = '#25312f'
  context.font = 'bold 42px Arial'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText(label, canvas.width / 2, canvas.height / 2, canvas.width - 28)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(0.95, 0.24),
    new THREE.MeshStandardMaterial({ map: texture, roughness: 0.82 }),
  )
  const innerX = side === 'east' ? 1.6 : -1.6
  sign.position.set(innerX + (side === 'east' ? -0.16 : 0.16), 2.45, z + 1.45)
  sign.rotation.y = side === 'east' ? -Math.PI / 2 : Math.PI / 2
  group.add(sign)
}

function addSideRoom(
  group: THREE.Group,
  collidables: THREE.Box3[],
  flickerLights: FlickerLight[],
  room: RoomSpec,
  wallMat: THREE.Material,
  floorMat: THREE.MeshStandardMaterial,
  ceilMat: THREE.Material,
  metalMat: THREE.Material,
  mattressMat: THREE.Material,
) {
  const corridorEdge = room.side === 'east' ? 1.6 : -1.6
  const outerEdge = room.side === 'east' ? 8.8 : -8.8
  const xMin = Math.min(corridorEdge, outerEdge)
  const xMax = Math.max(corridorEdge, outerEdge)
  const roomWidth = xMax - xMin
  const roomDepth = 8
  const zMin = room.z - roomDepth / 2
  const zMax = room.z + roomDepth / 2
  const doorHalfWidth = 0.95
  const doorGap: [number, number] = [room.z - doorHalfWidth, room.z + doorHalfWidth]

  addFloorCeiling(group, (xMin + xMax) / 2, room.z, roomWidth, roomDepth, floorMat, ceilMat, [roomWidth / 2, roomDepth / 2])
  wallAlongX(group, collidables, zMin, xMin, xMax, wallMat)
  wallAlongX(group, collidables, zMax, xMin, xMax, wallMat)
  wallAlongZ(group, collidables, outerEdge, zMin, zMax, wallMat)
  wallAlongZ(group, collidables, corridorEdge, zMin, zMax, wallMat, doorGap)

  const jambMat = new THREE.MeshStandardMaterial({ color: 0x89928f, roughness: 0.76, metalness: 0.24 })
  for (const z of [room.z - doorHalfWidth, room.z + doorHalfWidth]) {
    addBox(group, collidables, {
      x: corridorEdge,
      y: 1.05,
      z,
      w: 0.12,
      h: 2.1,
      d: 0.12,
      material: jambMat,
      collide: false,
    })
  }
  addBox(group, collidables, {
    x: corridorEdge,
    y: 2.12,
    z: room.z,
    w: 0.12,
    h: 0.12,
    d: doorHalfWidth * 2 + 0.12,
    material: jambMat,
    collide: false,
  })
  addRoomSign(group, room.side, room.z, room.label)
  addCeilingLight(group, flickerLights, (xMin + xMax) / 2, room.z, room.kind === 'nurse')

  const inwardSign = room.side === 'east' ? 1 : -1
  if (room.kind === 'ward') {
    addBed(group, collidables, inwardSign * 3.3, room.z, metalMat, mattressMat)
    addBed(group, collidables, inwardSign * 6.7, room.z, metalMat, mattressMat)
    for (const x of [inwardSign * 2.45, inwardSign * 5.85]) {
      addBox(group, collidables, { x, y: 0.34, z: room.z - 1.25, w: 0.42, h: 0.68, d: 0.42, material: metalMat })
    }
  } else if (room.kind === 'nurse') {
    addBox(group, collidables, { x: inwardSign * 5.8, y: 0.48, z: room.z, w: 2.4, h: 0.96, d: 1.2, material: metalMat })
    addBox(group, collidables, { x: inwardSign * 5.8, y: 1.08, z: room.z, w: 2.2, h: 0.12, d: 1.05, material: mattressMat, collide: false })
    addLocker(group, collidables, inwardSign * 2.5, room.z + 2.2, 0, metalMat)
  } else if (room.kind === 'storage') {
    for (const z of [room.z - 2.4, room.z - 0.8, room.z + 0.8, room.z + 2.4]) {
      addLocker(group, collidables, inwardSign * 7.5, z, 0, metalMat)
    }
  } else {
    addBed(group, collidables, inwardSign * 4.8, room.z, metalMat, mattressMat)
    if (room.kind === 'isolation') {
      addLocker(group, collidables, inwardSign * 7.55, room.z + 2.4, 0, metalMat)
    }
  }
}

function wallAlongZWithGaps(
  group: THREE.Group,
  collidables: THREE.Box3[],
  x: number,
  zFrom: number,
  zTo: number,
  material: THREE.Material,
  gaps: [number, number][],
) {
  let cursor = zFrom
  for (const [gapFrom, gapTo] of [...gaps].sort((a, b) => a[0] - b[0])) {
    if (gapFrom > cursor) wallAlongZ(group, collidables, x, cursor, gapFrom, material)
    cursor = Math.max(cursor, gapTo)
  }
  if (cursor < zTo) wallAlongZ(group, collidables, x, cursor, zTo, material)
}

function addCorridorHandrails(group: THREE.Group, side: RoomSide, corridorLen: number, gaps: [number, number][]) {
  const x = side === 'east' ? 1.42 : -1.42
  const material = new THREE.MeshStandardMaterial({ color: 0x69716e, roughness: 0.58, metalness: 0.42 })
  const sortedGaps = [...gaps].sort((a, b) => a[0] - b[0])
  let cursor = -corridorLen
  for (const [gapFrom, gapTo] of sortedGaps) {
    if (gapFrom > cursor) {
      const length = gapFrom - cursor
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, length, 8), material)
      rail.rotation.x = Math.PI / 2
      rail.position.set(x, 0.82, (cursor + gapFrom) / 2)
      group.add(rail)
    }
    cursor = Math.max(cursor, gapTo)
  }
  if (cursor < 0) {
    const length = -cursor
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, length, 8), material)
    rail.rotation.x = Math.PI / 2
    rail.position.set(x, 0.82, cursor / 2)
    group.add(rail)
  }
}

export function buildLevel(): BuiltLevel {
  const group = new THREE.Group()
  const collidables: THREE.Box3[] = []
  const flickerLights: FlickerLight[] = []

  const wallMat = pbrMaterial('blue_plaster_weathered', { repeat: [4, 1], roughnessScale: 1 })
  const floorMatCorridor = pbrMaterial('anti_skid_tiles', { roughnessScale: 0.9 })
  const floorMatRoom = pbrMaterial('brushed_concrete', { roughnessScale: 1 })
  const ceilMat = new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 1 })
  const metalMat = pbrMaterial('blue_metal_plate', { repeat: [1, 1], roughnessScale: 0.6 })
  const doorMat = pbrMaterial('rusty_metal_02', { repeat: [1, 1], roughnessScale: 0.7 })

  // --- Corridoio ospedaliero: 3,2 m di larghezza e 68 m di lunghezza ---
  const corridorLen = 68
  const rooms: RoomSpec[] = [
    { side: 'west', z: -9, label: 'CAMERA 401', kind: 'ward' },
    { side: 'east', z: -9, label: 'CAMERA 402', kind: 'ward' },
    { side: 'west', z: -21, label: 'INFERMERIA', kind: 'nurse' },
    { side: 'east', z: -21, label: 'CAMERA 403', kind: 'ward' },
    { side: 'west', z: -33, label: 'DEPOSITO', kind: 'storage' },
    { side: 'east', z: -33, label: 'CAMERA 404', kind: 'ward' },
    { side: 'west', z: -45, label: 'TRATTAMENTI', kind: 'treatment' },
    { side: 'east', z: -45, label: 'ISOLAMENTO', kind: 'isolation' },
    { side: 'west', z: -57, label: 'CAMERA 405', kind: 'ward' },
    { side: 'east', z: -57, label: 'CAMERA 406', kind: 'ward' },
  ]
  const gapsBySide: Record<RoomSide, [number, number][]> = { east: [], west: [] }
  for (const room of rooms) gapsBySide[room.side].push([room.z - 0.95, room.z + 0.95])

  addFloorCeiling(group, 0, -corridorLen / 2, 3.2, corridorLen, floorMatCorridor, ceilMat, [1, corridorLen / 2])
  wallAlongZWithGaps(group, collidables, -1.6, -corridorLen, 0, wallMat, gapsBySide.west)
  wallAlongZWithGaps(group, collidables, 1.6, -corridorLen, 0, wallMat, gapsBySide.east)
  wallAlongX(group, collidables, 0, -1.6, 1.6, wallMat)

  for (let z = -4; z > -corridorLen; z -= 8) addCeilingLight(group, flickerLights, 0, z, Math.random() < 0.3)
  addGurney(group, collidables, -0.55, -3, 0, metalMat)
  addGurney(group, collidables, 0.55, -39, Math.PI / 2, metalMat)
  addLocker(group, collidables, -1.25, -17, 0, metalMat)
  addCorridorHandrails(group, 'west', corridorLen, gapsBySide.west)
  addCorridorHandrails(group, 'east', corridorLen, gapsBySide.east)

  const mattressMat = new THREE.MeshStandardMaterial({ color: 0x3a3f35, roughness: 0.95 })
  for (const room of rooms) {
    addSideRoom(group, collidables, flickerLights, room, wallMat, floorMatRoom, ceilMat, metalMat, mattressMat)
  }

  // --- Porta antincendio in fondo al corridoio ---
  wallAlongX(group, collidables, -corridorLen, -1.6, 1.6, wallMat, [-0.9, 0.9])
  const door = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 2.4), doorMat)
  door.position.set(0, 1.2, -corridorLen + 0.1)
  group.add(door)
  const exitSign = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.2), new THREE.MeshStandardMaterial({ color: 0x1a4d2e, emissive: 0x2ecc71, emissiveIntensity: 1.2 }))
  exitSign.position.set(0, 2.5, -corridorLen + 0.3)
  group.add(exitSign)
  const exitLight = new THREE.PointLight(0x2ecc71, 0.25 * LIGHT_SCALE, 3, 2)
  exitLight.position.set(0, 2.4, -corridorLen + 0.6)
  group.add(exitLight)
  flickerLights.push({ light: exitLight, baseIntensity: 0.25 * LIGHT_SCALE, seed: Math.random() * 1000 })

  const exitBox = new THREE.Box3(
    new THREE.Vector3(-0.9, 0, -corridorLen - 1),
    new THREE.Vector3(0.9, WALL_H, -corridorLen + 0.3),
  )

  const spawn = new THREE.Vector3(0, 1.6, -1.2)
  return {
    group,
    collidables,
    flickerLights,
    spawn,
    spawnYaw: 0, // la camera di default guarda -Z: a yaw=0 guarda già dentro il corridoio
    exitBox,
    entityWaypoints: [{ x: 0, z: -64 }, { x: 0, z: -7 }],
    entitySpawn: { x: 0, z: -51 },
  }
}
