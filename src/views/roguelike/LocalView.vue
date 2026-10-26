<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import BackPill from '@/components/BackPill.vue'
import { CHARACTERS, createGame, move, nextFloor, shoot, type Dir, type RoguelikeState } from '@/games/roguelike/engine'
import RoguelikeBoard from '@/games/roguelike/RoguelikeBoard.vue'
import { clearSave, loadGame, saveGame } from '@/games/roguelike/save'
import { leaderboardReady, useLeaderboard } from '@/lib/leaderboard'
import { playerName } from '@/lib/player'

const existingSave = loadGame()
const phase = ref<'select' | 'playing'>(existingSave && existingSave.status === 'playing' ? 'playing' : 'select')
const state = shallowRef<RoguelikeState | null>(existingSave)
const chosenCharacter = ref(CHARACTERS[0].id)

function startWith(characterId: string) {
  state.value = createGame(characterId)
  saveGame(state.value)
  phase.value = 'playing'
}
function resume() {
  phase.value = 'playing'
}

function persistAfterAction(next: RoguelikeState) {
  state.value = next
  if (next.status === 'playing') saveGame(next)
  else clearSave()
}
function doMove(dx: number, dy: number) {
  if (!state.value || state.value.status !== 'playing') return
  persistAfterAction(move(state.value, dx, dy))
}
function doShoot(dir: Dir) {
  if (!state.value || state.value.status !== 'playing') return
  persistAfterAction(shoot(state.value, dir))
}
function descend() {
  if (!state.value) return
  persistAfterAction(nextFloor(state.value))
}

const MOVE_KEYS: Record<string, [number, number]> = {
  w: [0, -1], W: [0, -1],
  s: [0, 1], S: [0, 1],
  a: [-1, 0], A: [-1, 0],
  d: [1, 0], D: [1, 0],
}
const SHOOT_KEYS: Record<string, Dir> = { ArrowUp: 'N', ArrowDown: 'S', ArrowLeft: 'W', ArrowRight: 'E' }

function onKeyDown(e: KeyboardEvent) {
  if (phase.value !== 'playing' || !state.value || state.value.status !== 'playing') return
  if (MOVE_KEYS[e.key]) {
    e.preventDefault()
    doMove(...MOVE_KEYS[e.key])
  } else if (SHOOT_KEYS[e.key]) {
    e.preventDefault()
    doShoot(SHOOT_KEYS[e.key])
  }
}
onMounted(() => window.addEventListener('keydown', onKeyDown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeyDown))

const character = computed(() => CHARACTERS.find((c) => c.id === state.value?.player.characterId))
const roomsVisited = computed(() => (state.value ? Object.values(state.value.rooms).filter((r) => r.visited).length : 0))
const score = computed(() => roomsVisited.value * 10 + ((state.value?.floor ?? 1) - 1) * 50 + (state.value?.status === 'won' ? 200 : 0))
const floorClear = computed(() => state.value?.status === 'floorClear')
const won = computed(() => state.value?.status === 'won')
const lost = computed(() => state.value?.status === 'lost')
const traits = computed(() => {
  const p = state.value?.player
  if (!p) return []
  const list: string[] = []
  if (p.piercing) list.push('🎯 Perforante')
  if (p.triShot) list.push('🔱 Triplo')
  if (p.armor > 0) list.push(`🛡️ Armatura ${p.armor}`)
  if (p.regen > 0) list.push('✨ Rigenerazione')
  return list
})

const lb = useLeaderboard('roguelike')
const name = ref(playerName())
const submitted = ref(false)
async function submitScore() {
  await lb.submit(name.value, score.value)
  submitted.value = true
}
function backToSelect() {
  clearSave()
  state.value = null
  phase.value = 'select'
  submitted.value = false
}
if (leaderboardReady) lb.refresh()
</script>

<template>
  <div class="page-gradient min-h-screen">
    <div class="mx-auto max-w-2xl px-4 py-4">
      <BackPill to="/" label="Tutti i giochi" />

      <template v-if="phase === 'select'">
        <h1 class="font-display mb-1 mt-4 text-center text-2xl font-bold">Dungeon ASCII</h1>
        <p class="mb-4 text-center text-sm opacity-60">
          Dungeon generato ogni volta diverso. Niente scontro corpo a corpo: spara ai nemici in linea.
          WASD per muoverti, le frecce per sparare. Le porte restano chiuse finché non liberi la stanza.
        </p>

        <button v-if="existingSave" class="btn btn-pop btn-block mb-4 rounded-full" @click="resume">Continua la partita salvata</button>

        <p class="mb-2 text-center text-sm font-semibold">Scegli un personaggio</p>
        <div class="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          <button
            v-for="c in CHARACTERS" :key="c.id" type="button"
            class="flex flex-col items-center gap-1 rounded-box bg-base-100 p-3 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            :class="chosenCharacter === c.id ? 'ring-2 ring-primary' : ''"
            @click="chosenCharacter = c.id"
          >
            <span class="text-3xl leading-none">{{ c.emoji }}</span>
            <span class="font-display text-sm font-bold">{{ c.name }}</span>
            <span class="text-[11px] opacity-60">❤️{{ c.hp }} ⚔️{{ c.attack }}</span>
            <span class="text-[11px] leading-snug opacity-70">{{ c.description }}</span>
          </button>
        </div>
        <button class="btn btn-pop btn-block mt-4 rounded-full" @click="startWith(chosenCharacter)">Inizia con questo personaggio</button>
      </template>

      <template v-else-if="state">
        <div class="mb-3 flex items-center justify-between rounded-box bg-base-100 px-4 py-2.5 text-sm font-semibold shadow-sm">
          <span>{{ character?.emoji }} ❤️ {{ state.player.hp }}/{{ state.player.maxHp }}</span>
          <span>⚔️ {{ state.player.attack }}</span>
          <span>Stanze: {{ roomsVisited }}</span>
        </div>
        <div v-if="traits.length" class="mb-3 flex flex-wrap justify-center gap-1.5">
          <span v-for="t in traits" :key="t" class="badge badge-sm badge-primary badge-outline">{{ t }}</span>
        </div>

        <RoguelikeBoard :state="state" />

        <div class="mt-3 rounded-box bg-base-100 px-4 py-2 text-xs shadow-sm">
          <p v-for="(line, i) in state.log" :key="i" class="opacity-70">{{ line }}</p>
        </div>

        <div class="mt-4 flex flex-wrap items-start justify-center gap-6">
          <div>
            <p class="mb-1 text-center text-[11px] font-semibold opacity-50">Muovi</p>
            <div class="grid w-32 grid-cols-3 gap-1.5">
              <div /><button class="btn btn-circle btn-sm" @click="doMove(0, -1)">▲</button><div />
              <button class="btn btn-circle btn-sm" @click="doMove(-1, 0)">◀</button>
              <button class="btn btn-circle btn-sm" @click="doMove(0, 1)">▼</button>
              <button class="btn btn-circle btn-sm" @click="doMove(1, 0)">▶</button>
            </div>
          </div>
          <div>
            <p class="mb-1 text-center text-[11px] font-semibold opacity-50">Spara</p>
            <div class="grid w-32 grid-cols-3 gap-1.5">
              <div /><button class="btn btn-circle btn-sm btn-secondary" @click="doShoot('N')">▲</button><div />
              <button class="btn btn-circle btn-sm btn-secondary" @click="doShoot('W')">◀</button>
              <button class="btn btn-circle btn-sm btn-secondary" @click="doShoot('S')">▼</button>
              <button class="btn btn-circle btn-sm btn-secondary" @click="doShoot('E')">▶</button>
            </div>
          </div>
        </div>
        <p class="mt-3 text-center text-xs opacity-50">WASD muove, le frecce sparano. I nemici bloccano il passo: colpiscili a distanza.</p>

        <div v-if="floorClear" class="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" style="animation: pop-in 0.12s ease-out">
          <div class="w-full max-w-sm rounded-box bg-base-100 p-6 text-center shadow-xl">
            <h2 class="font-display text-xl font-bold tracking-tight">Piano {{ state.floor }} superato!</h2>
            <p class="mt-1 text-sm opacity-60">Stanze esplorate: {{ roomsVisited }}</p>
            <button class="btn btn-pop btn-block mt-5 rounded-full" @click="descend">Scendi al piano successivo</button>
          </div>
        </div>

        <div v-if="won || lost" class="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" style="animation: pop-in 0.12s ease-out">
          <div class="w-full max-w-sm rounded-box bg-base-100 p-6 text-center shadow-xl">
            <h2 class="font-display text-xl font-bold tracking-tight">{{ won ? 'Hai ripulito tutto il dungeon!' : 'Sei stato sconfitto' }}</h2>
            <p class="mt-1 text-sm opacity-60">Piano {{ state.floor }} · Stanze esplorate: {{ roomsVisited }} · Punti: {{ score }}</p>

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
              <button class="btn btn-outline btn-block rounded-full" @click="backToSelect">Nuova partita</button>
              <button class="btn btn-ghost btn-block rounded-full" @click="$router.push('/')">Torna al menu</button>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
