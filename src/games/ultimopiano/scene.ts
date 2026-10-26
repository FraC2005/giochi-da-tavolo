/**
 * Costruzione procedurale dell'appartamento in Three.js: nessun modello esterno, solo
 * geometrie primitive (box/cilindri/coni) + le texture di textures.ts (colore + bump) + luci con
 * ombre. Ogni capitolo ha una propria planimetria: stesso appartamento, ma il corridoio e la
 * cameretta di Dario esistono solo dal capitolo 2 in poi, e al capitolo 3 tutto è più spoglio.
 */
import * as THREE from 'three'
import { bareWallTexture, ceilingTexture, floorTexture, sealedDoorTexture, wallpaperTexture, woodTrimTexture, type SurfaceTextures } from './textures'

export interface Interactable {
  object: THREE.Object3D
  clueId: string
}

export interface FlickerLight {
  light: THREE.PointLight
  baseIntensity: number
  seed: number
}

export interface BuiltScene {
  group: THREE.Group
  collidables: THREE.Box3[]
  interactables: Interactable[]
  flickerLights: FlickerLight[]
  /** Area (in coordinate mondo, lungo z) da attraversare per uscire/rientrare dalla porta principale. */
  frontDoorZ: number
  spawn: THREE.Vector3
}

const WALL_H = 3
const WALL_T = 0.3

function surfaceMat(tex: SurfaceTextures, roughness: number, bumpScale: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ map: tex.map, bumpMap: tex.bumpMap, bumpScale, roughness })
}

function addBox(
  group: THREE.Group,
  collidables: THREE.Box3[],
  opts: { x: number; y: number; z: number; w: number; h: number; d: number; material: THREE.Material; collide?: boolean; castShadow?: boolean },
): THREE.Mesh {
  const geo = new THREE.BoxGeometry(opts.w, opts.h, opts.d)
  const mesh = new THREE.Mesh(geo, opts.material)
  mesh.position.set(opts.x, opts.y, opts.z)
  mesh.receiveShadow = true
  mesh.castShadow = opts.castShadow !== false
  group.add(mesh)
  if (opts.collide !== false) collidables.push(new THREE.Box3().setFromObject(mesh))
  return mesh
}

/** Muro lungo l'asse X (a z fissa) con un'eventuale apertura centrata in x (porta/corridoio). */
function wallAlongX(
  group: THREE.Group, collidables: THREE.Box3[], z: number, xFrom: number, xTo: number,
  material: THREE.Material, gap?: [number, number],
) {
  if (!gap) {
    addBox(group, collidables, { x: (xFrom + xTo) / 2, y: WALL_H / 2, z, w: xTo - xFrom, h: WALL_H, d: WALL_T, material, castShadow: false })
    return
  }
  const [gFrom, gTo] = gap
  if (gFrom > xFrom) addBox(group, collidables, { x: (xFrom + gFrom) / 2, y: WALL_H / 2, z, w: gFrom - xFrom, h: WALL_H, d: WALL_T, material, castShadow: false })
  if (xTo > gTo) addBox(group, collidables, { x: (gTo + xTo) / 2, y: WALL_H / 2, z, w: xTo - gTo, h: WALL_H, d: WALL_T, material, castShadow: false })
}

/** Muro lungo l'asse Z (a x fissa) con un'eventuale apertura centrata in z. */
function wallAlongZ(
  group: THREE.Group, collidables: THREE.Box3[], x: number, zFrom: number, zTo: number,
  material: THREE.Material, gap?: [number, number],
) {
  if (!gap) {
    addBox(group, collidables, { x, y: WALL_H / 2, z: (zFrom + zTo) / 2, w: WALL_T, h: WALL_H, d: zTo - zFrom, material, castShadow: false })
    return
  }
  const [gFrom, gTo] = gap
  if (gFrom > zFrom) addBox(group, collidables, { x, y: WALL_H / 2, z: (zFrom + gFrom) / 2, w: WALL_T, h: WALL_H, d: gFrom - zFrom, material, castShadow: false })
  if (zTo > gTo) addBox(group, collidables, { x, y: WALL_H / 2, z: (gTo + zTo) / 2, w: WALL_T, h: WALL_H, d: zTo - gTo, material, castShadow: false })
}

/** Battiscopa decorativo (non collide: il muro dietro già blocca) lungo un segmento orizzontale. */
function addBaseboard(group: THREE.Group, axis: 'x' | 'z', fixed: number, from: number, to: number, trimMat: THREE.Material) {
  const len = to - from
  const mid = (from + to) / 2
  const geo = axis === 'x' ? new THREE.BoxGeometry(len, 0.14, 0.04) : new THREE.BoxGeometry(0.04, 0.14, len)
  const mesh = new THREE.Mesh(geo, trimMat)
  mesh.position.set(axis === 'x' ? mid : fixed, 0.07, axis === 'x' ? fixed : mid)
  mesh.receiveShadow = true
  group.add(mesh)
}

/** Cornice in legno intorno a un'apertura (porta/corridoio) sulla parete nord/sud a z fissa. */
function addDoorFrameX(group: THREE.Group, z: number, gapCenter: number, gapWidth: number, trimMat: THREE.Material) {
  const half = gapWidth / 2
  const jamb = (x: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.08, WALL_H, 0.1), trimMat)
    m.position.set(x, WALL_H / 2, z)
    m.castShadow = true
    group.add(m)
  }
  jamb(gapCenter - half - 0.02)
  jamb(gapCenter + half + 0.02)
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(gapWidth + 0.3, 0.1, 0.1), trimMat)
  lintel.position.set(gapCenter, WALL_H - 0.05, z)
  group.add(lintel)
}

function addFloorAndCeiling(group: THREE.Group, x: number, z: number, w: number, d: number, floorMat: THREE.Material, ceilMat: THREE.Material) {
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), floorMat)
  floor.rotation.x = -Math.PI / 2
  floor.position.set(x, 0, z)
  floor.receiveShadow = true
  group.add(floor)
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(w, d), ceilMat)
  ceiling.rotation.x = Math.PI / 2
  ceiling.position.set(x, WALL_H, z)
  group.add(ceiling)
}

function addInteractable(group: THREE.Group, interactables: Interactable[], clueId: string, x: number, y: number, z: number, color: number, scale = 0.14) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(scale, 14, 14),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.7, roughness: 0.35 }),
  )
  mesh.position.set(x, y, z)
  mesh.userData.clueId = clueId
  group.add(mesh)
  interactables.push({ object: mesh, clueId })
}

/** Cornice piatta intorno a un punto interattivo a parete (es. una foto), per dargli più presenza. */
function addWallFrame(group: THREE.Group, x: number, y: number, z: number, rotY: number, w: number, h: number, trimMat: THREE.Material) {
  const frame = new THREE.Group()
  const top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, 0.03), trimMat)
  top.position.y = h / 2
  const bottom = top.clone(); bottom.position.y = -h / 2
  const left = new THREE.Mesh(new THREE.BoxGeometry(0.06, h, 0.03), trimMat)
  left.position.x = -w / 2
  const right = left.clone(); right.position.x = w / 2
  frame.add(top, bottom, left, right)
  frame.position.set(x, y, z)
  frame.rotation.y = rotY
  frame.children.forEach((c) => { c.castShadow = true })
  group.add(frame)
}

function furnitureMat(color: number) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85 })
}

/** Lampada a sospensione visibile nel punto in cui si trova una luce: senza, le luci sembrano fluttuare nel vuoto. */
function addLampFixture(group: THREE.Group, x: number, y: number, z: number, color: number) {
  const cordTop = WALL_H
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, cordTop - y, 6), new THREE.MeshStandardMaterial({ color: 0x1a1a1a }))
  cord.position.set(x, (cordTop + y) / 2, z)
  group.add(cord)
  const shade = new THREE.Mesh(
    new THREE.ConeGeometry(0.22, 0.22, 16, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x2a2520, emissive: color, emissiveIntensity: 0.15, side: THREE.DoubleSide, roughness: 0.6 }),
  )
  shade.position.set(x, y + 0.05, z)
  shade.castShadow = true
  group.add(shade)
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 10), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.4 }))
  bulb.position.set(x, y - 0.03, z)
  group.add(bulb)
}

/** Three.js recente usa unità fotometriche per PointLight: un'intensità "1" vecchio stile è quasi invisibile, va moltiplicata. */
const LIGHT_SCALE = 60

function addFlicker(
  group: THREE.Group, flickerLights: FlickerLight[], x: number, y: number, z: number, color: number,
  intensity: number, distance: number, withShadow = false,
) {
  const light = new THREE.PointLight(color, intensity * LIGHT_SCALE, distance, 2)
  light.position.set(x, y, z)
  if (withShadow) {
    light.castShadow = true
    light.shadow.mapSize.set(512, 512)
    light.shadow.bias = -0.003
  }
  group.add(light)
  flickerLights.push({ light, baseIntensity: intensity * LIGHT_SCALE, seed: Math.random() * 1000 })
  addLampFixture(group, x, y, z, color)
}

export function buildChapter(chapterId: 1 | 2 | 3): BuiltScene {
  const group = new THREE.Group()
  const collidables: THREE.Box3[] = []
  const interactables: Interactable[] = []
  const flickerLights: FlickerLight[] = []

  const decayed = chapterId === 3
  const wallTex = decayed ? bareWallTexture() : wallpaperTexture()
  const wallMat = surfaceMat(wallTex, 0.95, decayed ? 0.06 : 0.03)
  const floorTex = floorTexture()
  const floorMat = surfaceMat(floorTex, 0.82, 0.05)
  const ceilMat = new THREE.MeshStandardMaterial({ map: ceilingTexture(), roughness: 1 })
  const trimMat = new THREE.MeshStandardMaterial({ map: woodTrimTexture(), roughness: 0.6 })

  // --- Stanza principale: x -6..6, z -5..5 ---
  addFloorAndCeiling(group, 0, 0, 12, 10, floorMat, ceilMat)
  wallAlongX(group, collidables, 5, -6, 6, wallMat, [-1, 1]) // sud: porta d'ingresso, sempre aperta
  wallAlongZ(group, collidables, -6, -5, 5, wallMat) // ovest, piena
  wallAlongZ(group, collidables, 6, -5, 5, wallMat) // est, piena
  addDoorFrameX(group, 5, 0, 2, trimMat)
  addBaseboard(group, 'x', -5, -6, 6, trimMat)
  addBaseboard(group, 'x', 5, -6, -1, trimMat)
  addBaseboard(group, 'x', 5, 1, 6, trimMat)
  addBaseboard(group, 'z', -6, -5, 5, trimMat)
  addBaseboard(group, 'z', 6, -5, 5, trimMat)

  const hasCorridor = chapterId >= 2
  wallAlongX(group, collidables, -5, -6, 6, wallMat, hasCorridor ? [-1, 1] : undefined) // nord

  if (!hasCorridor) {
    // capitolo 1: porta sigillata, dipinta dello stesso colore del muro, solo decorativa
    const doorMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.4), new THREE.MeshStandardMaterial({ map: sealedDoorTexture('#8a7a6b') }))
    doorMesh.position.set(0, 1.2, -4.84)
    group.add(doorMesh)
    addInteractable(group, interactables, 'porta-sigillata', 0, 1.3, -4.8, 0x3a3228, 0.18)
  }

  // arredo stanza principale
  addBox(group, collidables, { x: -4, y: 0.4, z: 3.5, w: 2.2, h: 0.8, d: 1, material: furnitureMat(0x3c3f52) }) // divano
  addBox(group, collidables, { x: -4, y: 0.25, z: 3.5, w: 2.6, h: 0.08, d: 1.4, material: furnitureMat(0x23262e), collide: false, castShadow: false }) // tappeto sotto il divano
  addBox(group, collidables, { x: 3.5, y: 0.35, z: 3.8, w: 1.4, h: 0.7, d: 1.2, material: furnitureMat(0x5a4632) }) // tavolo cucina
  addBox(group, collidables, { x: 5.4, y: 0.9, z: -2, w: 0.3, h: 1.8, d: 2.4, material: furnitureMat(0x4a3b2a) }) // libreria
  addBox(group, collidables, { x: 5.4, y: 1.4, z: -2, w: 0.32, h: 0.04, d: 2.4, material: furnitureMat(0x6b5a44), collide: false }) // ripiano libreria
  addBox(group, collidables, { x: 5.4, y: 0.6, z: -2, w: 0.32, h: 0.04, d: 2.4, material: furnitureMat(0x6b5a44), collide: false }) // ripiano libreria

  addWallFrame(group, -4.85, 1.5, 1.2, Math.PI / 2, 0.7, 0.55, trimMat)
  addInteractable(group, interactables, 'foto-famiglia', -4.85, 1.5, 1.2, 0xd8cba0)
  addInteractable(group, interactables, 'calendario', 5.3, 1.6, -3.4, 0xb6c6d8)
  addInteractable(group, interactables, 'segreteria', 3.6, 0.78, 3.4, 0xc83c3c)
  if (hasCorridor) addInteractable(group, interactables, 'disegno-nascosto', -5.85, 1.1, 2, 0xe0533e)

  addFlicker(group, flickerLights, 0, 2.6, 0, 0xffcf9e, 1.1, 10, true)
  addFlicker(group, flickerLights, 4, 2.6, 3, 0xffcf9e, 0.5, 6)

  if (hasCorridor) {
    // --- Corridoio: x -1..1, z -5..-9 ---
    addFloorAndCeiling(group, 0, -7, 2, 4, floorMat, ceilMat)
    wallAlongZ(group, collidables, -1, -9, -5, wallMat)
    wallAlongZ(group, collidables, 1, -9, -5, wallMat)
    addBaseboard(group, 'z', -1, -9, -5, trimMat)
    addBaseboard(group, 'z', 1, -9, -5, trimMat)
    addFlicker(group, flickerLights, 0, 2.4, -7, 0xaab4ff, decayed ? 0.6 : 0.8, 7)

    // --- Cameretta di Dario: x -4..4, z -15..-9 ---
    addFloorAndCeiling(group, 0, -12, 8, 6, floorMat, ceilMat)
    wallAlongX(group, collidables, -15, -4, 4, wallMat)
    wallAlongX(group, collidables, -9, -4, 4, wallMat, [-1, 1])
    wallAlongZ(group, collidables, -4, -15, -9, wallMat)
    wallAlongZ(group, collidables, 4, -15, -9, wallMat)
    addDoorFrameX(group, -9, 0, 2, trimMat)
    addBaseboard(group, 'x', -15, -4, 4, trimMat)
    addBaseboard(group, 'x', -9, -4, -1, trimMat)
    addBaseboard(group, 'x', -9, 1, 4, trimMat)
    addBaseboard(group, 'z', -4, -15, -9, trimMat)
    addBaseboard(group, 'z', 4, -15, -9, trimMat)
    addFlicker(group, flickerLights, 0, 2.4, -12, 0x9ab0ff, decayed ? 0.4 : 0.7, 8, !decayed)

    if (!decayed) {
      // capitolo 2: la stanza è ancora "arredata" dai ricordi
      addBox(group, collidables, { x: -2.6, y: 0.5, z: -13.5, w: 1.6, h: 1, d: 2.2, material: furnitureMat(0x2e3a52) }) // letto a castello
      addBox(group, collidables, { x: -2.6, y: 1.05, z: -13.5, w: 1.5, h: 0.08, d: 2.1, material: furnitureMat(0x1e2740), collide: false }) // materasso superiore
      addBox(group, collidables, { x: 2.6, y: 0.35, z: -10.5, w: 1.2, h: 0.7, d: 0.6, material: furnitureMat(0x4a3b2a) }) // cassettiera
      addInteractable(group, interactables, 'cameretta', -2.6, 1.1, -13.5, 0xdcdcdc)
      addInteractable(group, interactables, 'disegni-muro', -3.85, 1.4, -12, 0xe0533e)
      addInteractable(group, interactables, 'carillon', 2.6, 0.72, -10.5, 0xd8b84a, 0.1)
    } else {
      // capitolo 3: la stanza è vuota, resta solo un disegno per terra
      const drawing = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ color: 0xe8ddc0, roughness: 0.8 }))
      drawing.rotation.x = -Math.PI / 2
      drawing.position.set(0, 0.01, -12)
      drawing.receiveShadow = true
      group.add(drawing)
      addInteractable(group, interactables, 'stanza-piena', 0, 0.3, -12, 0xe0533e, 0.12)
    }
  }

  if (decayed) {
    // capitolo 3: due porte false sulle pareti laterali (dipinte, il muro dietro resta pieno)
    for (const sign of [-1, 1] as const) {
      const doorMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.3), new THREE.MeshStandardMaterial({ map: sealedDoorTexture('#4a4640') }))
      doorMesh.position.set(sign * 5.84, 1.2, 3)
      doorMesh.rotation.y = sign * Math.PI / 2
      group.add(doorMesh)
    }
    addInteractable(group, interactables, 'ultima-nota', -5.3, 1, 4.3, 0xe8ddc0, 0.1)
  }

  const spawn = new THREE.Vector3(0, 1.6, 4)
  return { group, collidables, interactables, flickerLights, frontDoorZ: 5, spawn }
}
