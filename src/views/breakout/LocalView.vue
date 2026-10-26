<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import BackPill from '@/components/BackPill.vue'
import BreakoutCanvas from '@/games/breakout/BreakoutCanvas.vue'
import {
  createGame, FIELD_W, launch, movePaddle, nextLevel, PADDLE_SPEED, setPaddleX, step, type BreakoutState,
} from '@/games/breakout/engine'
import { leaderboardReady, useLeaderboard } from '@/lib/leaderboard'
import { playerName } from '@/lib/player'

const state = shallowRef<BreakoutState>(createGame())
const pressed = new Set<string>()
let raf = 0
let last = 0

const MOVE_KEYS = ['ArrowLeft', 'ArrowRight', 'a', 'd', 'A', 'D']

function onKeyDown(e: KeyboardEvent) {
  if (MOVE_KEYS.includes(e.key) || e.key === ' ') e.preventDefault()
  pressed.add(e.key)
  if (e.key === ' ') state.value = launch(state.value)
}
function onKeyUp(e: KeyboardEvent) {
  pressed.delete(e.key)
}

function loop(time: number) {
  if (!last) last = time
  const dt = Math.min((time - last) / 1000, 0.035) // tetto al delta: evita salti bruschi dopo una scheda in background
  last = time

  let next = state.value
  let dx = 0
  if (pressed.has('ArrowLeft') || pressed.has('a') || pressed.has('A')) dx -= PADDLE_SPEED * dt
  if (pressed.has('ArrowRight') || pressed.has('d') || pressed.has('D')) dx += PADDLE_SPEED * dt
  if (dx !== 0) next = movePaddle(next, dx)
  state.value = step(next, dt)

  raf = requestAnimationFrame(loop)
}

onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  raf = requestAnimationFrame(loop)
})
onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
})

function onPointerMove(e: PointerEvent) {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const ratio = FIELD_W / rect.width
  const x = (e.clientX - rect.left) * ratio - state.value.paddle.w / 2
  state.value = setPaddleX(state.value, x)
}
function onPointerDown() {
  state.value = launch(state.value)
}

const gameOver = computed(() => state.value.status === 'lost')
const levelWon = computed(() => state.value.status === 'won')
const livesDots = computed(() => '●'.repeat(state.value.lives) + '○'.repeat(Math.max(0, 3 - state.value.lives)))

function playAgain() {
  state.value = createGame()
  submitted.value = false
}
function playNextLevel() {
  state.value = nextLevel(state.value)
}

const lb = useLeaderboard('breakout')
const name = ref(playerName())
const submitted = ref(false)
async function submitScore() {
  await lb.submit(name.value, state.value.score)
  submitted.value = true
}
if (leaderboardReady) lb.refresh()
</script>

<template>
  <div class="page-gradient min-h-screen">
    <div class="mx-auto max-w-md px-4 py-4">
      <BackPill to="/" label="Tutti i giochi" />

      <div class="mt-3 flex items-center justify-between rounded-box bg-base-100 px-4 py-2.5 text-sm font-semibold shadow-sm">
        <span>Punti: {{ state.score }}</span>
        <span>Livello {{ state.level }}</span>
        <span class="tracking-widest">{{ livesDots }}</span>
      </div>

      <div class="relative my-4 touch-none" @pointerdown="onPointerDown" @pointermove="onPointerMove">
        <BreakoutCanvas :state="state" />
        <div v-if="state.status === 'ready'" class="pointer-events-none absolute inset-0 grid place-items-center">
          <span class="rounded-full bg-black/55 px-4 py-2 text-center text-sm font-semibold text-white">Tocca o premi Spazio per lanciare</span>
        </div>
      </div>

      <p class="text-center text-xs opacity-50">Frecce o A/D per muovere il paddle, oppure trascina col mouse o il dito.</p>

      <div v-if="levelWon" class="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" style="animation: pop-in 0.12s ease-out">
        <div class="w-full max-w-sm rounded-box bg-base-100 p-6 text-center shadow-xl">
          <h2 class="font-display text-xl font-bold tracking-tight">Livello superato!</h2>
          <p class="mt-1 text-sm opacity-60">Punti: {{ state.score }}</p>
          <button class="btn btn-pop btn-block mt-5 rounded-full" @click="playNextLevel">Livello successivo</button>
        </div>
      </div>

      <div v-if="gameOver" class="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" style="animation: pop-in 0.12s ease-out">
        <div class="w-full max-w-sm rounded-box bg-base-100 p-6 text-center shadow-xl">
          <h2 class="font-display text-xl font-bold tracking-tight">Game over</h2>
          <p class="mt-1 text-sm opacity-60">Punti: {{ state.score }} · Livello {{ state.level }}</p>

          <template v-if="leaderboardReady">
            <div v-if="!submitted" class="mt-4 flex flex-col gap-2">
              <input v-model="name" class="input input-bordered w-full" maxlength="24" placeholder="Il tuo nome" />
              <button class="btn btn-pop btn-block rounded-full" @click="submitScore">Salva il punteggio</button>
            </div>
            <ul v-else class="mt-4 flex flex-col gap-1 text-left text-sm">
              <li v-for="(s, i) in lb.scores.value" :key="i" class="flex items-center justify-between rounded-field bg-base-200 px-3 py-1.5">
                <span class="truncate">{{ i + 1 }}. {{ s.player_name }}</span><span class="tabular shrink-0 pl-2 font-semibold">{{ s.score }}</span>
              </li>
              <li v-if="lb.scores.value.length === 0" class="text-center text-xs opacity-50">Nessun punteggio ancora in classifica.</li>
            </ul>
          </template>
          <p v-else class="mt-3 text-xs opacity-50">Classifica non disponibile: il sito non ha le chiavi Supabase configurate.</p>

          <div class="mt-5 flex flex-col gap-2">
            <button class="btn btn-outline btn-block rounded-full" @click="playAgain">Rigioca</button>
            <button class="btn btn-ghost btn-block rounded-full" @click="$router.push('/')">Torna al menu</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
