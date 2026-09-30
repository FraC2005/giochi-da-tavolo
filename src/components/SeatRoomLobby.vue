<script setup lang="ts">
import { ref } from 'vue'
import type { Seat } from '@/lib/supabase'

const props = defineProps<{
  playerOptions: number[]
  code: string | null
  seats: Seat[]
  maxPlayers: number
  connecting: boolean
  error: string
  shareLink: string | null
  copied: boolean
}>()
const emit = defineEmits<{ (e: 'create', maxPlayers: number): void; (e: 'join', code: string): void; (e: 'copy'): void }>()

const chosenPlayers = ref(props.playerOptions[0])
const joinCode = ref('')
function submitJoin() {
  if (joinCode.value.trim()) emit('join', joinCode.value)
}
</script>

<template>
  <div class="mx-auto max-w-sm">
    <div v-if="!code" class="rounded-box bg-base-100 p-5 shadow-md">
      <p class="mb-2 text-center text-sm font-medium">Quanti giocatori?</p>
      <div class="join mb-4 w-full">
        <button
          v-for="n in playerOptions" :key="n" type="button" class="btn join-item flex-1"
          :class="chosenPlayers === n ? 'btn-primary' : 'btn-outline'" @click="chosenPlayers = n"
        >{{ n }} giocatori</button>
      </div>
      <button class="btn btn-pop btn-block rounded-full" :disabled="connecting" @click="emit('create', chosenPlayers)">
        <span v-if="connecting" class="loading loading-spinner loading-sm" />Crea una nuova stanza
      </button>
      <div class="divider text-xs opacity-40">oppure</div>
      <form class="join w-full" @submit.prevent="submitJoin">
        <input v-model="joinCode" class="input join-item flex-1 rounded-l-full uppercase tracking-widest" placeholder="Codice stanza" maxlength="6" aria-label="Codice stanza" />
        <button class="btn btn-outline join-item rounded-r-full" :disabled="connecting || !joinCode.trim()">Entra</button>
      </form>
    </div>

    <div v-else class="rounded-box bg-base-100 p-5 text-center shadow-md">
      <p class="text-sm font-medium">In attesa di altri giocatori…</p>
      <p class="font-display mt-3 text-3xl font-bold tracking-[0.3em] text-primary">{{ code }}</p>
      <button v-if="shareLink" class="btn btn-outline btn-sm mt-4 rounded-full" @click="emit('copy')">{{ copied ? 'Link copiato' : 'Copia link da mandare' }}</button>

      <ul class="mt-5 flex flex-col gap-1.5 text-left">
        <li v-for="n in maxPlayers" :key="n" class="flex items-center gap-2 rounded-field bg-base-200 px-3 py-1.5 text-sm">
          <span class="badge badge-sm badge-primary badge-outline">{{ n }}</span>
          <span v-if="seats[n - 1]" class="truncate font-medium">{{ seats[n - 1].name }}</span>
          <span v-else class="opacity-40">In attesa…</span>
        </li>
      </ul>
    </div>

    <p v-if="error" class="mt-3 text-center text-sm text-error">{{ error }}</p>
    <p v-if="!code" class="mt-4 text-center text-xs opacity-45">Crea una stanza e manda il link o il codice ai tuoi amici, oppure inserisci il codice che ti hanno mandato.</p>
  </div>
</template>
