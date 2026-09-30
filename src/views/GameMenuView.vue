<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import BackPill from '@/components/BackPill.vue'
import RulesTour from '@/components/RulesTour.vue'
import { gameById } from '@/games/registry'
import { rulesByGame } from '@/games/rules'
import { supabaseReady } from '@/lib/onlineRoom'

const props = defineProps<{ game: 'chess' | 'checkers' | 'tris' }>()
const router = useRouter()
const meta = computed(() => gameById(props.game))
const iconBg = computed(() => `linear-gradient(135deg, ${meta.value.accent[0]}, ${meta.value.accent[1]})`)
const rules = computed(() => rulesByGame[props.game])
const tourOpen = ref(false)
</script>

<template>
  <div class="page-gradient min-h-screen">
    <div class="mx-auto max-w-md px-6 py-6">
      <BackPill to="/" label="Tutti i giochi" />
      <div class="mt-10 flex flex-col items-center text-center">
        <span class="grid h-16 w-16 place-items-center rounded-field text-3xl leading-none shadow-md" :style="{ background: iconBg }">{{ meta.glyph }}</span>
        <h1 class="font-display mt-3 text-2xl font-bold tracking-tight">{{ meta.title }}</h1>
        <p class="mt-1 text-sm opacity-65">{{ meta.tagline }}</p>
      </div>

      <div class="mt-10 flex flex-col gap-2.5">
        <button class="btn btn-pop btn-lg rounded-full justify-between" @click="router.push(`/${meta.slug}/locale`)">
          Stesso schermo, a turni <span>→</span>
        </button>
        <button class="btn btn-outline btn-lg rounded-full justify-between border-base-content/20" @click="router.push(`/${meta.slug}/online`)">
          Online con un amico <span>→</span>
        </button>
        <button v-if="rules" class="btn btn-ghost btn-lg rounded-full justify-between" @click="tourOpen = true">
          Come si gioca <span>📖</span>
        </button>
        <p v-if="!supabaseReady" class="mt-1 text-center text-xs opacity-50">La modalità online richiede la configurazione di Supabase (vedi il README del progetto).</p>
      </div>
    </div>

    <RulesTour v-if="rules" v-model:open="tourOpen" :title="`Come si gioca a ${meta.title}`" :steps="rules" />
  </div>
</template>
