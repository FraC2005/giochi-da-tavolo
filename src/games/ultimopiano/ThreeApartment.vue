<script setup lang="ts">
/**
 * Il "motore" imperativo di gioco: scena Three.js, movimento in prima persona, collisioni,
 * interazione via raggio dal centro schermo. A differenza dei giochi a turni del sito, qui non
 * c'è un pure step(state, input) sensato da estrarre — il loop per-frame è tutto trasformazioni
 * di camera e raycasting, senza logica interessante da testare. Quello che conta narrativamente
 * (indizi, capitoli, finali) resta in engine.ts, puro e testato; questo componente lo chiama sui
 * pochi eventi discreti del gioco (trovato un indizio, rientrato dalla porta, raggiunta l'uscita).
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'
import * as THREE from 'three'
import { HorrorAudio } from './audio'
import { confrontRoom, createGame, currentChapter, findClue, reachExit, readyToAdvance, reenterApartment, type UltimoPianoState } from './engine'
import { buildChapter, type BuiltScene } from './scene'
import { CONTROLS_TEXT, type ClueDef, type Ending } from './story'

const emit = defineEmits<{
  (e: 'clue', clue: ClueDef): void
  (e: 'chapter', chapterId: 1 | 2 | 3, title: string): void
  (e: 'ended', ending: Ending): void
}>()

const container = ref<HTMLDivElement | null>(null)
const locked = ref(false)
const prompt = ref('')
const controlsText = CONTROLS_TEXT

let renderer: THREE.WebGLRenderer | null = null
let camera: THREE.PerspectiveCamera | null = null
let scene: THREE.Scene | null = null
let built: BuiltScene | null = null
let raf = 0
let last = 0

const audio = new HorrorAudio()
let state: UltimoPianoState = createGame()

const keys = new Set<string>()
let yaw = 0
let pitch = 0
let wasOutside = false

const PLAYER_RADIUS = 0.35
const EYE_HEIGHT = 1.6
const SPEED = 2.6

function rebuildScene(chapterId: 1 | 2 | 3) {
  if (!scene) return
  if (built) scene.remove(built.group)
  built = buildChapter(chapterId)
  scene.add(built.group)
  const fogColor = chapterId === 3 ? 0x0a0808 : 0x0f0d12
  scene.fog = new THREE.FogExp2(fogColor, chapterId === 3 ? 0.11 : 0.075)
  scene.background = new THREE.Color(fogColor)
  camera!.position.set(built.spawn.x, EYE_HEIGHT, built.spawn.z)
  yaw = 0 // la camera di default guarda verso -Z, cioè verso l'interno della stanza: corretto così com'è
  pitch = 0
  wasOutside = false
  const chapter = currentChapter(state)
  emit('chapter', chapterId, chapter.title)
}

function resolveCollision(pos: THREE.Vector3) {
  if (!built) return
  for (const box of built.collidables) {
    const minX = box.min.x - PLAYER_RADIUS
    const maxX = box.max.x + PLAYER_RADIUS
    const minZ = box.min.z - PLAYER_RADIUS
    const maxZ = box.max.z + PLAYER_RADIUS
    if (pos.x <= minX || pos.x >= maxX || pos.z <= minZ || pos.z >= maxZ) continue
    const overlapX = Math.min(maxX - pos.x, pos.x - minX)
    const overlapZ = Math.min(maxZ - pos.z, pos.z - minZ)
    const center = box.getCenter(new THREE.Vector3())
    if (overlapX < overlapZ) pos.x += pos.x < center.x ? -overlapX : overlapX
    else pos.z += pos.z < center.z ? -overlapZ : overlapZ
  }
}

function handleClueFound(clueId: string) {
  const chapter = currentChapter(state)
  const clue = chapter.clues.find((c) => c.id === clueId)
  if (!clue) return
  const already = state.found.includes(clueId)
  state = findClue(state, clueId)
  if (clueId === 'stanza-piena') state = confrontRoom(state)
  if (!already) {
    emit('clue', clue)
    if (clue.unlocksNextChapter) audio.playDiscoveryStinger()
  }
}

function onKeyDown(e: KeyboardEvent) {
  keys.add(e.key.toLowerCase())
  if (e.key.toLowerCase() === 'e' && hoveredClueId) handleClueFound(hoveredClueId)
}
function onKeyUp(e: KeyboardEvent) {
  keys.delete(e.key.toLowerCase())
}

let hoveredClueId: string | null = null
const raycaster = new THREE.Raycaster()
const screenCenter = new THREE.Vector2(0, 0)

function onMouseMove(e: MouseEvent) {
  if (!locked.value) return
  yaw -= e.movementX * 0.0022
  pitch -= e.movementY * 0.0022
  pitch = Math.max(-1.2, Math.min(1.2, pitch))
}

function requestLock() {
  container.value?.requestPointerLock()
  audio.start()
}

function onPointerLockChange() {
  locked.value = document.pointerLockElement === container.value
}

function loop(time: number) {
  raf = requestAnimationFrame(loop)
  if (!last) last = time
  const dt = Math.min((time - last) / 1000, 0.05)
  last = time
  if (!camera || !renderer || !scene || !built) return

  camera.rotation.order = 'YXZ'
  camera.rotation.y = yaw
  camera.rotation.x = pitch

  if (locked.value) {
    // inputForward: 1 = W (avanti), -1 = S (indietro). inputRight: 1 = D, -1 = A.
    let inputForward = 0, inputRight = 0
    if (keys.has('w') || keys.has('arrowup')) inputForward += 1
    if (keys.has('s') || keys.has('arrowdown')) inputForward -= 1
    if (keys.has('d') || keys.has('arrowright')) inputRight += 1
    if (keys.has('a') || keys.has('arrowleft')) inputRight -= 1
    if (inputForward !== 0 || inputRight !== 0) {
      const len = Math.hypot(inputForward, inputRight)
      inputForward /= len; inputRight /= len
      // la camera di default guarda -Z: a yaw=0 "avanti" è (0,0,-1) e "destra" è (1,0,0).
      const forwardX = -Math.sin(yaw), forwardZ = -Math.cos(yaw)
      const rightX = Math.cos(yaw), rightZ = -Math.sin(yaw)
      const next = camera.position.clone()
      next.x += (forwardX * inputForward + rightX * inputRight) * SPEED * dt
      next.z += (forwardZ * inputForward + rightZ * inputRight) * SPEED * dt
      next.x = Math.max(-7.4, Math.min(7.4, next.x))
      next.z = Math.max(-16, Math.min(7.5, next.z))
      resolveCollision(next)
      camera.position.x = next.x
      camera.position.z = next.z
    }
  }

  // porta d'ingresso: uscire e rientrare fa avanzare la storia; al capitolo 3 uscire chiude il gioco
  const outside = camera.position.z > built.frontDoorZ + 0.25
  if (state.status === 'playing' && state.chapterId === 3 && outside) {
    state = reachExit(state)
    if (state.ending) emit('ended', state.ending)
  } else if (outside && !wasOutside) {
    wasOutside = true
  } else if (!outside && wasOutside) {
    wasOutside = false
    if (readyToAdvance(state)) {
      state = reenterApartment(state)
      rebuildScene(state.chapterId)
    }
  }

  // raycast dal centro schermo per evidenziare un oggetto esaminabile
  raycaster.setFromCamera(screenCenter, camera)
  const hits = raycaster.intersectObjects(built.interactables.map((i) => i.object))
  const hit = hits.find((h) => h.distance < 2.3)
  hoveredClueId = (hit?.object.userData.clueId as string | undefined) ?? null
  prompt.value = hoveredClueId ? 'E · Esamina' : ''

  // luci che tremolano
  const t = time / 1000
  for (const fl of built.flickerLights) {
    const wave = Math.sin(t * 1.7 + fl.seed) * 0.5 + Math.sin(t * 5.3 + fl.seed) * 0.15
    const flicker = Math.random() < 0.01 ? 0.3 : 1
    fl.light.intensity = fl.baseIntensity * (0.78 + 0.22 * wave) * flicker
  }

  renderer.render(scene, camera)
}

function onResize() {
  if (!camera || !renderer || !container.value) return
  const w = container.value.clientWidth
  const h = container.value.clientHeight
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  renderer.setSize(w, h)
}

onMounted(() => {
  if (!container.value) return
  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(72, container.value.clientWidth / container.value.clientHeight, 0.1, 60)
  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(container.value.clientWidth, container.value.clientHeight)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap // VSM non è supportato dalle PointLight
  container.value.appendChild(renderer.domElement)

  scene.add(new THREE.AmbientLight(0x404050, 0.35))

  rebuildScene(1)

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
  audio.stop()
  renderer?.dispose()
})
</script>

<template>
  <div class="relative h-full w-full select-none overflow-hidden rounded-box bg-black">
    <div ref="container" class="h-full w-full cursor-crosshair" @click="requestLock" />

    <!-- vignettatura + grana: trattamento "da pellicola", costa zero in geometria -->
    <div
      class="pointer-events-none absolute inset-0"
      style="background: radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.75) 100%)"
    />
    <div
      class="pointer-events-none absolute inset-0 opacity-[0.07] mix-blend-overlay"
      style="background-image: url(&quot;data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E&quot;)"
    />

    <div v-if="!locked" class="absolute inset-0 grid cursor-pointer place-items-center bg-black/70 text-center" @click="requestLock">
      <div class="px-6">
        <p class="font-display text-lg font-bold">Clicca per entrare</p>
        <p class="mt-1 text-xs opacity-60">{{ controlsText }}</p>
      </div>
    </div>

    <template v-else>
      <div class="pointer-events-none absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/70" />
      <div v-if="prompt" class="pointer-events-none absolute left-1/2 top-[58%] -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-white">
        {{ prompt }}
      </div>
    </template>
  </div>
</template>
