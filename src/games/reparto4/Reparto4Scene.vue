<script setup lang="ts">
/**
 * Scena 3D di "Reparto 4": stesso schema di movimento/collisione/pointer-lock di L'Ultimo Piano,
 * ma con pipeline di rendering spinta al massimo che il browser permette senza un motore vero —
 * tone mapping cinematografico, bloom via post-processing, torcia con ombre proiettate e fascio
 * di luce volumetrico finto (un cono semitrasparente che segue la torcia).
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { catchPlayer, createGame, tickBattery, toggleFlashlight, winGame, type GameState } from './engine'
import { createEntity, distanceTo, stepEntity, CATCH_DISTANCE, type EntityState } from './entity'
import { buildLevel, type BuiltLevel } from './scene'
import { CONTROLS_TEXT } from './story'

const emit = defineEmits<{
  (e: 'battery', value: number): void
  (e: 'flashlight', on: boolean): void
  (e: 'ended', status: 'won' | 'caught'): void
}>()

const container = ref<HTMLDivElement | null>(null)
const locked = ref(false)
const controlsText = CONTROLS_TEXT

let renderer: THREE.WebGLRenderer | null = null
let composer: EffectComposer | null = null
let camera: THREE.PerspectiveCamera | null = null
let scene: THREE.Scene | null = null
let level: BuiltLevel | null = null
let raf = 0
let last = 0

let flashlight: THREE.SpotLight | null = null
let flashlightTarget: THREE.Object3D | null = null
let beamCone: THREE.Mesh | null = null
let entityMesh: THREE.Group | null = null

let game: GameState = createGame()
let entity: EntityState = createEntity({ x: 0, z: 0 })

const keys = new Set<string>()
let yaw = 0
let pitch = 0

const PLAYER_RADIUS = 0.32
const EYE_HEIGHT = 1.6
const SPEED = 2.7

function resolveCollision(pos: THREE.Vector3, radius = PLAYER_RADIUS) {
  if (!level) return
  for (const box of level.collidables) {
    const minX = box.min.x - radius, maxX = box.max.x + radius
    const minZ = box.min.z - radius, maxZ = box.max.z + radius
    if (pos.x <= minX || pos.x >= maxX || pos.z <= minZ || pos.z >= maxZ) continue
    const overlapX = Math.min(maxX - pos.x, pos.x - minX)
    const overlapZ = Math.min(maxZ - pos.z, pos.z - minZ)
    const center = box.getCenter(new THREE.Vector3())
    if (overlapX < overlapZ) pos.x += pos.x < center.x ? -overlapX : overlapX
    else pos.z += pos.z < center.z ? -overlapZ : overlapZ
  }
}

function buildEntityMesh(): THREE.Group {
  const g = new THREE.Group()
  const mat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.95 })
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 1.1, 4, 8), mat)
  body.position.y = 0.95
  body.castShadow = true
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), mat)
  head.position.y = 1.75
  head.castShadow = true
  g.add(body, head)
  return g
}

function onKeyDown(e: KeyboardEvent) {
  const k = e.key.toLowerCase()
  keys.add(k)
  if (k === 'f') {
    game = toggleFlashlight(game)
    emit('flashlight', game.flashlightOn)
  }
}
function onKeyUp(e: KeyboardEvent) { keys.delete(e.key.toLowerCase()) }

function onMouseMove(e: MouseEvent) {
  if (!locked.value) return
  yaw -= e.movementX * 0.0022
  pitch -= e.movementY * 0.0022
  pitch = Math.max(-1.2, Math.min(1.2, pitch))
}

function requestLock() { container.value?.requestPointerLock() }
function onPointerLockChange() { locked.value = document.pointerLockElement === container.value }

const raycaster = new THREE.Raycaster()

/** L'entità è "vista" se è dentro il cono della torcia (angolo + distanza) e la torcia è accesa. */
function isEntitySpotted(): boolean {
  if (!camera || !flashlight || !game.flashlightOn || !entityMesh || !level) return false
  const toEntity = entityMesh.position.clone().add(new THREE.Vector3(0, 1.1, 0)).sub(camera.position)
  const dist = toEntity.length()
  if (dist > flashlight.distance) return false
  const forward = new THREE.Vector3()
  camera.getWorldDirection(forward)
  const direction = toEntity.normalize()
  if (forward.angleTo(direction) >= flashlight.angle * 0.85) return false

  raycaster.ray.origin.copy(camera.position)
  raycaster.ray.direction.copy(direction)
  for (const obstacle of level.collidables) {
    const hit = raycaster.ray.intersectBox(obstacle, new THREE.Vector3())
    if (hit && hit.distanceTo(camera.position) < dist - 0.25) return false
  }
  return true
}

function loop(time: number) {
  raf = requestAnimationFrame(loop)
  if (!last) last = time
  const dt = Math.min((time - last) / 1000, 0.05)
  last = time
  if (!camera || !renderer || !composer || !scene || !level) return

  camera.rotation.order = 'YXZ'
  camera.rotation.y = yaw
  camera.rotation.x = pitch

  if (locked.value && game.status === 'playing') {
    let inputForward = 0, inputRight = 0
    if (keys.has('w') || keys.has('arrowup')) inputForward += 1
    if (keys.has('s') || keys.has('arrowdown')) inputForward -= 1
    if (keys.has('d') || keys.has('arrowright')) inputRight += 1
    if (keys.has('a') || keys.has('arrowleft')) inputRight -= 1
    if (inputForward !== 0 || inputRight !== 0) {
      const len = Math.hypot(inputForward, inputRight)
      inputForward /= len; inputRight /= len
      const forwardX = -Math.sin(yaw), forwardZ = -Math.cos(yaw)
      const rightX = Math.cos(yaw), rightZ = -Math.sin(yaw)
      const next = camera.position.clone()
      next.x += (forwardX * inputForward + rightX * inputRight) * SPEED * dt
      next.z += (forwardZ * inputForward + rightZ * inputRight) * SPEED * dt
      next.x = Math.max(-9.2, Math.min(9.2, next.x))
      next.z = Math.max(-69.5, Math.min(1.3, next.z))
      resolveCollision(next)
      camera.position.x = next.x
      camera.position.z = next.z
    }
  }

  // torcia: segue la camera, intensità legata alla batteria
  if (flashlight && flashlightTarget) {
    flashlight.position.copy(camera.position)
    const dir = new THREE.Vector3()
    camera.getWorldDirection(dir)
    flashlightTarget.position.copy(camera.position).add(dir.multiplyScalar(5))
    flashlight.intensity = game.flashlightOn ? 140 * (0.4 + 0.6 * (game.battery / 100)) : 0
    if (beamCone) {
      beamCone.visible = game.flashlightOn
      beamCone.position.copy(camera.position)
      beamCone.quaternion.copy(camera.quaternion)
      beamCone.rotateX(-Math.PI / 2)
    }
  }

  if (game.status === 'playing') {
    game = tickBattery(game, dt)
    emit('battery', game.battery)
    if (!game.flashlightOn) emit('flashlight', false)

    const spotted = isEntitySpotted()
    entity = stepEntity(entity, level.entityWaypoints, { x: camera.position.x, z: camera.position.z }, spotted, dt)
    const entityPosition = new THREE.Vector3(entity.position.x, 0, entity.position.z)
    resolveCollision(entityPosition, 0.22)
    entity = { ...entity, position: { x: entityPosition.x, z: entityPosition.z } }
    if (entityMesh) entityMesh.position.set(entity.position.x, 0, entity.position.z)

    if (distanceTo(entity, { x: camera.position.x, z: camera.position.z }) < CATCH_DISTANCE) {
      game = catchPlayer(game)
      emit('ended', 'caught')
    } else if (level.exitBox.containsPoint(camera.position)) {
      game = winGame(game)
      emit('ended', 'won')
    }
  }

  // plafoniere che tremolano
  const t = time / 1000
  for (const fl of level.flickerLights) {
    const wave = Math.sin(t * 1.6 + fl.seed) * 0.5 + Math.sin(t * 4.8 + fl.seed) * 0.15
    const flicker = Math.random() < 0.012 ? 0.25 : 1
    fl.light.intensity = fl.baseIntensity * (0.75 + 0.25 * wave) * flicker
  }

  composer.render()
}

function onResize() {
  if (!camera || !renderer || !composer || !container.value) return
  const w = container.value.clientWidth, h = container.value.clientHeight
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  renderer.setSize(w, h)
  composer.setSize(w, h)
}

onMounted(() => {
  if (!container.value) return
  scene = new THREE.Scene()
  const w = container.value.clientWidth, h = container.value.clientHeight
  camera = new THREE.PerspectiveCamera(74, w / h, 0.1, 100)

  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(w, h)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.6
  renderer.outputColorSpace = THREE.SRGBColorSpace
  container.value.appendChild(renderer.domElement)

  composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))
  const bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.55, 0.5, 0.82)
  composer.addPass(bloom)
  composer.addPass(new OutputPass())

  scene.add(new THREE.AmbientLight(0x2a3142, 1.1))

  level = buildLevel()
  scene.add(level.group)
  camera.position.copy(level.spawn)
  yaw = level.spawnYaw
  scene.fog = new THREE.FogExp2(0x050505, 0.03)
  scene.background = new THREE.Color(0x030303)

  flashlight = new THREE.SpotLight(0xfff2d9, 140, 13, Math.PI / 6.5, 0.45, 1.3)
  flashlight.castShadow = true
  flashlight.shadow.mapSize.set(1024, 1024)
  flashlight.shadow.bias = -0.0025
  flashlightTarget = new THREE.Object3D()
  scene.add(flashlight, flashlightTarget)
  flashlight.target = flashlightTarget

  beamCone = new THREE.Mesh(
    new THREE.ConeGeometry(2.6, 5, 24, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2d9, transparent: true, opacity: 0.045, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
  )
  beamCone.position.z = -2.5
  scene.add(beamCone)

  entity = createEntity(level.entitySpawn)
  entityMesh = buildEntityMesh()
  entityMesh.position.set(entity.position.x, 0, entity.position.z)
  scene.add(entityMesh)

  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('mousemove', onMouseMove)
  document.addEventListener('pointerlockchange', onPointerLockChange)
  window.addEventListener('resize', onResize)
  raf = requestAnimationFrame(loop)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  window.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('pointerlockchange', onPointerLockChange)
  window.removeEventListener('resize', onResize)
  if (document.pointerLockElement === container.value) document.exitPointerLock()
  renderer?.dispose()
})
</script>

<template>
  <div class="relative h-full w-full select-none overflow-hidden rounded-box bg-black">
    <div ref="container" class="h-full w-full cursor-crosshair" @click="requestLock" />

    <div v-if="!locked" class="absolute inset-0 grid cursor-pointer place-items-center bg-black/70 text-center" @click="requestLock">
      <div class="px-6">
        <p class="font-display text-lg font-bold">Clicca per entrare</p>
        <p class="mt-1 text-xs opacity-60">{{ controlsText }}</p>
      </div>
    </div>

    <template v-else>
      <div class="pointer-events-none absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/70" />
    </template>

    <div class="pointer-events-none absolute inset-0" style="background: radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.55) 100%)" />
    <div
      class="pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-overlay"
      style="background-image: url(&quot;data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E&quot;)"
    />
  </div>
</template>
