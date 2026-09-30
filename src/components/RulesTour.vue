<script setup lang="ts">
/**
 * Tutorial guidato "come si gioca", condiviso da tutti i giochi: un modale DaisyUI con
 * l'indicatore a passi (`steps`) che segna l'avanzamento e un passo alla volta di regole.
 * Ogni gioco passa solo il proprio elenco di `steps` (vedi es. games/tris/rules.ts).
 */
import { ref, watch } from 'vue'
import type { TourStep } from '@/lib/tour'

const props = defineProps<{ open: boolean; title: string; steps: TourStep[] }>()
const emit = defineEmits<{ (e: 'update:open', value: boolean): void }>()

const dialog = ref<HTMLDialogElement | null>(null)
const stepIndex = ref(0)

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      stepIndex.value = 0
      dialog.value?.showModal()
    } else {
      dialog.value?.close()
    }
  },
)

function close() {
  emit('update:open', false)
}
function next() {
  if (stepIndex.value < props.steps.length - 1) stepIndex.value++
  else close()
}
function prev() {
  if (stepIndex.value > 0) stepIndex.value--
}
</script>

<template>
  <dialog ref="dialog" class="modal" @close="close">
    <div class="modal-box max-w-md">
      <h3 class="font-display pr-6 text-lg font-bold tracking-tight">{{ title }}</h3>

      <ul class="steps steps-horizontal mt-4 w-full text-xs">
        <li v-for="(s, i) in steps" :key="s.title" class="step" :class="i <= stepIndex ? 'step-primary' : ''">{{ i + 1 }}</li>
      </ul>

      <div class="mt-4 min-h-28">
        <h4 class="font-display text-base font-semibold">{{ steps[stepIndex]?.title }}</h4>
        <p class="mt-1.5 text-sm leading-relaxed opacity-75">{{ steps[stepIndex]?.text }}</p>
      </div>

      <div class="modal-action items-center justify-between">
        <button type="button" class="btn btn-ghost btn-sm rounded-full" @click="close">Chiudi</button>
        <div class="flex gap-2">
          <button type="button" class="btn btn-outline btn-sm rounded-full" :disabled="stepIndex === 0" @click="prev">Indietro</button>
          <button type="button" class="btn btn-pop btn-sm rounded-full" @click="next">{{ stepIndex === steps.length - 1 ? 'Ho capito' : 'Avanti' }}</button>
        </div>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop"><button>chiudi</button></form>
  </dialog>
</template>
