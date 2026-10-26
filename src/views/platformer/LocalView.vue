<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import BackPill from '@/components/BackPill.vue'
import PlatformerCanvas from '@/games/platformer/PlatformerCanvas.vue'
import { createGame, nextLevel, step, type PlatformerState } from '@/games/platformer/engine'
import { LEVELS } from '@/games/platformer/levels'
import { leaderboardReady, useLeaderboard } from '@/lib/leaderboard'
import { playerName } from '@/lib/player'

const state = shallowRef<PlatformerState>(createGame(LEVELS))
const pressed = new Set<string>()
let raf = 0
let last = 0

const MOVE_KEYS = ['ArrowLeft', 'ArrowRight', 'a', 'd', 'A', 'D']
const JUMP_KEYS = ['ArrowUp', 'w', 'W', ' ']

function onKeyDown(e: KeyboardEvent) {
  if (MOVE_KEYS.includes(e.key) || JUMP_KEYS.includes(e.key)) e.preventDefault()
  pressed.add(e.key)
}
function onKeyUp(e: KeyboardEvent) {
  pressed.delete(e.key)
}

function currentInput() {
  return {
    left: pressed.has('ArrowLeft') || pressed.has('a') || pressed.has('A') || pressed.has('touch-left'),
    right: pressed.has('ArrowRight') || pressed.has('d') || pressed.has('D') || pressed.has('touch-right'),
    jump: JUMP_KEYS.some((k) => pressed.has(k)) || pressed.has('touch-jump'),
  }
}

function loop(time: number) {
  if (!last) last = time
  const dt = Math.min((time - last) / 1000, 0.035)
  last = time
  state.value = step(state.value, dt, currentInput())
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

function touchPress(key: string) { pressed.add(key) }
function touchRelease(key: string) { pressed.delete(key) }

const levelComplete = computed(() => state.value.status === 'levelComplete')
const lost = computed(() => state.value.status === 'lost')
const won = computed(() => state.value.status === 'won')
const livesDots = computed(() => '●'.repeat(state.value.lives) + '○'.repeat(Math.max(0, 3 - state.value.lives)))

function playAgain() {
  state.value = createGame(LEVELS)
  submitted.value = false
}
function advance() {
  state.value = nextLevel(LEVELS, state.value)
}

const lb = useLeaderboard('platformer')
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
    <div class="mx-auto max-w-2xl px-4 py-4">
      <BackPill to="/" label="Tutti i giochi" />

      <div class="mt-3 flex items-center justify-between rounded-box bg-base-100 px-4 py-2.5 text-sm font-semibold shadow-sm">
        <span>Punti: {{ state.score }}</span>
        <span>Livello {{ state.levelIndex + 1 }} / {{ LEVELS.length }}</span>
        <span class="tracking-widest">{{ livesDots }}</span>
      </div>

      <div class="my-4">
        <PlatformerCanvas :state="state" />
      </div>

      <div class="flex items-center justify-between gap-3">
        <div class="flex gap-2">
          <button
            class="btn btn-circle btn-lg" @pointerdown="touchPress('touch-left')" @pointerup="touchRelease('touch-left')"
            @pointerleave="touchRelease('touch-left')" @contextmenu.prevent
          >◀</button>
          <button
            class="btn btn-circle btn-lg" @pointerdown="touchPress('touch-right')" @pointerup="touchRelease('touch-right')"
            @pointerleave="touchRelease('touch-right')" @contextmenu.prevent
          >▶</button>
        </div>
        <button
          class="btn btn-circle btn-lg btn-primary" @pointerdown="touchPress('touch-jump')" @pointerup="touchRelease('touch-jump')"
          @pointerleave="touchRelease('touch-jump')" @contextmenu.prevent
        >▲</button>
      </div>
      <p class="mt-2 text-center text-xs opacity-50">Frecce o A/D per muoverti, Spazio/freccia su per saltare — oppure i pulsanti sopra.</p>

      <div v-if="levelComplete" class="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" style="animation: pop-in 0.12s ease-out">
        <div class="w-full max-w-sm rounded-box bg-base-100 p-6 text-center shadow-xl">
          <h2 class="font-display text-xl font-bold tracking-tight">Livello completato!</h2>
          <p class="mt-1 text-sm opacity-60">Punti: {{ state.score }}</p>
          <button class="btn btn-pop btn-block mt-5 rounded-full" @click="advance">Livello successivo</button>
        </div>
      </div>

      <div v-if="won" class="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" style="animation: pop-in 0.12s ease-out">
        <div class="w-full max-w-sm rounded-box bg-base-100 p-6 text-center shadow-xl">
          <h2 class="font-display text-xl font-bold tracking-tight">Hai finito tutti i livelli!</h2>
          <p class="mt-1 text-sm opacity-60">Punti finali: {{ state.score }}</p>

          <template v-if="leaderboardReady">
            <div v-if="!submitted" class="mt-4 flex flex-col gap-2">
              <input v-model="name" class="input input-bordered w-full" maxlength="24" placeholder="Il tuo nome" />
              <button class="btn btn-pop btn-block rounded-full" @click="submitScore">Salva il punteggio</button>
            </div>
            <ul v-else class="mt-4 flex flex-col gap-1 text-left text-sm">
              <li v-for="(s, i) in lb.scores.value" :key="i" class="flex items-center justify-between rounded-field bg-base-200 px-3 py-1.5">
                <span class="truncate">{{ i + 1 }}. {{ s.player_name }}</span><span class="tabular shrink-0 pl-2 font-semibold">{{ s.score }}</span>
              </li>
            </ul>
          </template>

          <div class="mt-5 flex flex-col gap-2">
            <button class="btn btn-outline btn-block rounded-full" @click="playAgain">Rigioca</button>
            <button class="btn btn-ghost btn-block rounded-full" @click="$router.push('/')">Torna al menu</button>
          </div>
        </div>
      </div>

      <div v-if="lost" class="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" style="animation: pop-in 0.12s ease-out">
        <div class="w-full max-w-sm rounded-box bg-base-100 p-6 text-center shadow-xl">
          <h2 class="font-display text-xl font-bold tracking-tight">Game over</h2>
          <p class="mt-1 text-sm opacity-60">Punti: {{ state.score }} · Livello {{ state.levelIndex + 1 }}</p>
          <div class="mt-5 flex flex-col gap-2">
            <button class="btn btn-outline btn-block rounded-full" @click="playAgain">Rigioca</button>
            <button class="btn btn-ghost btn-block rounded-full" @click="$router.push('/')">Torna al menu</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
