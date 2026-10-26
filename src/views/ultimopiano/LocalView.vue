<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import BackPill from '@/components/BackPill.vue'
import ThreeApartment from '@/games/ultimopiano/ThreeApartment.vue'
import { CHAPTERS, CONTROLS_TEXT, ENDING_TEXT, INTRO_TEXT, type ClueDef, type Ending } from '@/games/ultimopiano/story'

const router = useRouter()
type Phase = 'intro' | 'playing' | 'ended'
const phase = ref<Phase>('intro')

const chapterTitle = ref('')
const objective = ref('')
const activeClue = ref<ClueDef | null>(null)
const journal = ref<ClueDef[]>([])
const ending = ref<Ending | null>(null)

function start() {
  phase.value = 'playing'
}
function onChapter(id: 1 | 2 | 3, title: string) {
  chapterTitle.value = title
  objective.value = CHAPTERS.find((c) => c.id === id)?.objective ?? ''
}
function onClue(clue: ClueDef) {
  activeClue.value = clue
  journal.value = [...journal.value, clue]
}
function onEnded(e: Ending) {
  ending.value = e
  phase.value = 'ended'
}
function restart() {
  phase.value = 'intro'
  journal.value = []
  activeClue.value = null
  ending.value = null
}
</script>

<template>
  <div class="min-h-screen bg-black text-[#e8ddc0]">
    <div class="mx-auto flex h-screen max-w-4xl flex-col px-4 py-4">
      <BackPill to="/" label="Tutti i giochi" class="!text-[#e8ddc0]" />

      <template v-if="phase === 'intro'">
        <div class="flex flex-1 flex-col items-center justify-center gap-6 text-center">
          <h1 class="font-display whitespace-pre-line text-2xl font-bold tracking-wide">{{ INTRO_TEXT }}</h1>
          <p class="max-w-md text-sm opacity-60">{{ CONTROLS_TEXT }}</p>
          <button type="button" class="btn btn-block max-w-xs rounded-full border-[#e8ddc0]/30 bg-transparent text-[#e8ddc0] hover:bg-[#e8ddc0]/10" @click="start">
            Entra
          </button>
        </div>
      </template>

      <template v-else-if="phase === 'playing'">
        <div class="mb-2 flex items-center justify-between text-xs opacity-70">
          <span>{{ chapterTitle }} · {{ objective }}</span>
          <span>{{ journal.length }} ricordi</span>
        </div>
        <div class="relative min-h-0 flex-1">
          <ThreeApartment @chapter="onChapter" @clue="onClue" @ended="onEnded" />
        </div>
      </template>

      <template v-else>
        <div class="flex flex-1 flex-col items-center justify-center gap-6 px-4 text-center">
          <h1 class="font-display text-2xl font-bold">{{ ending ? ENDING_TEXT[ending].title : '' }}</h1>
          <p class="max-w-xl whitespace-pre-line text-sm leading-relaxed opacity-80">{{ ending ? ENDING_TEXT[ending].body : '' }}</p>
          <div class="flex gap-3">
            <button type="button" class="btn rounded-full border-[#e8ddc0]/30 bg-transparent text-[#e8ddc0] hover:bg-[#e8ddc0]/10" @click="restart">
              Ricomincia
            </button>
            <button type="button" class="btn btn-ghost rounded-full text-[#e8ddc0]" @click="router.push('/')">Torna al menu</button>
          </div>
        </div>
      </template>
    </div>

    <!-- Modale indizio: non blocca il pointer lock sottostante, appare e si chiude al tocco -->
    <div v-if="activeClue" class="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4" @click="activeClue = null">
      <div class="max-w-md rounded-box border border-[#e8ddc0]/15 bg-[#13100d] p-6 text-left shadow-xl" @click.stop>
        <p class="font-display mb-2 text-sm font-bold uppercase tracking-wider text-[#c89a5a]">{{ activeClue.title }}</p>
        <p class="whitespace-pre-line text-sm leading-relaxed opacity-90">{{ activeClue.body }}</p>
        <button type="button" class="btn btn-sm mt-4 rounded-full border-[#e8ddc0]/30 bg-transparent text-[#e8ddc0] hover:bg-[#e8ddc0]/10" @click="activeClue = null">
          Chiudi
        </button>
      </div>
    </div>
  </div>
</template>
