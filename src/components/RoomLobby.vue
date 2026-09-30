<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  code: string | null
  status: 'waiting' | 'playing' | 'finished'
  connecting: boolean
  error: string
  shareLink: string | null
  copied: boolean
}>()
const emit = defineEmits<{ (e: 'create'): void; (e: 'join', code: string): void; (e: 'copy'): void }>()

const joinCode = ref('')
function submitJoin() {
  if (joinCode.value.trim()) emit('join', joinCode.value)
}
void props
</script>

<template>
  <div class="mx-auto max-w-sm">
    <div v-if="!code" class="rounded-box bg-base-100 p-5 shadow-md">
      <button class="btn btn-pop btn-block rounded-full" :disabled="connecting" @click="emit('create')">
        <span v-if="connecting" class="loading loading-spinner loading-sm" />Crea una nuova stanza
      </button>
      <div class="divider text-xs opacity-40">oppure</div>
      <form class="join w-full" @submit.prevent="submitJoin">
        <input v-model="joinCode" class="input join-item flex-1 rounded-l-full uppercase tracking-widest" placeholder="Codice stanza" maxlength="6" aria-label="Codice stanza" />
        <button class="btn btn-outline join-item rounded-r-full" :disabled="connecting || !joinCode.trim()">Entra</button>
      </form>
    </div>

    <div v-else class="rounded-box bg-base-100 p-5 text-center shadow-md">
      <p class="text-sm font-medium">{{ status === 'waiting' ? 'In attesa che un amico entri…' : 'Connesso' }}</p>
      <p class="font-display mt-3 text-3xl font-bold tracking-[0.3em] text-primary">{{ code }}</p>
      <button v-if="shareLink" class="btn btn-outline btn-sm mt-4 rounded-full" @click="emit('copy')">{{ copied ? 'Link copiato' : 'Copia link da mandare' }}</button>
    </div>

    <p v-if="error" class="mt-3 text-center text-sm text-error">{{ error }}</p>
    <p v-if="!code" class="mt-4 text-center text-xs opacity-45">Crea una stanza e manda il link o il codice a un amico, oppure inserisci il codice che ti hanno mandato.</p>
  </div>
</template>
