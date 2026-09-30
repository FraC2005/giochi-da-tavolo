<script setup lang="ts">
import { computed } from 'vue'
import type { BoardSquare } from './engine'

const props = defineProps<{
  board: (BoardSquare | null)[][]
  selected: string | null
  legalTargets: string[]
  lastMove: { from: string; to: string } | null
  checkSquare: string | null
  orientation: 'w' | 'b'
  interactive: boolean
}>()
const emit = defineEmits<{ (e: 'square-click', square: string): void }>()

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
const GLYPH: Record<string, string> = { wk: '♔', wq: '♕', wr: '♖', wb: '♗', wn: '♘', wp: '♙', bk: '♚', bq: '♛', br: '♜', bb: '♝', bn: '♞', bp: '♟' }

/**
 * Le caselle hanno colori fissi (non seguono il tema chiaro/scuro), quindi anche i colori dei
 * suggerimenti devono essere fissi e scelti in base alla casella sotto, non al tema: altrimenti
 * in modalità scura un puntino chiaro finisce su una casella già chiara e sparisce.
 */
const DOT_ON_DARK_SQ = '#fdf6ec'
const DOT_ON_LIGHT_SQ = '#3d2f78'
const ALERT = 'rgba(255,45,85,.55)'
const dotColor = (dark: boolean) => (dark ? DOT_ON_DARK_SQ : DOT_ON_LIGHT_SQ)

interface Cell { square: string; piece: BoardSquare | null; dark: boolean; file: string; rank: number }

const rows = computed<Cell[][]>(() => {
  const grid: Cell[][] = []
  for (let r = 0; r < 8; r++) {
    const rank = props.orientation === 'w' ? 8 - r : r + 1
    const line: Cell[] = []
    for (let c = 0; c < 8; c++) {
      const fileIdx = props.orientation === 'w' ? c : 7 - c
      const file = FILES[fileIdx]
      const square = `${file}${rank}`
      const boardRow = 8 - rank
      line.push({ square, piece: props.board[boardRow]?.[fileIdx] ?? null, dark: (fileIdx + rank) % 2 === 0, file, rank })
    }
    grid.push(line)
  }
  return grid
})

function onDragStart(e: DragEvent, cell: Cell) {
  if (!cell.piece || !props.interactive) { e.preventDefault(); return }
  emit('square-click', cell.square)
  e.dataTransfer?.setData('text/plain', cell.square)
  e.dataTransfer!.effectAllowed = 'move'
}
function onDrop(e: DragEvent, cell: Cell) {
  const from = e.dataTransfer?.getData('text/plain')
  if (from && props.legalTargets.includes(cell.square)) emit('square-click', cell.square)
}
</script>

<template>
  <div class="mx-auto aspect-square w-full max-w-[560px] select-none overflow-hidden rounded-box shadow-lg" role="grid" aria-label="Scacchiera">
    <div v-for="(line, ri) in rows" :key="ri" class="grid grid-cols-8" role="row">
      <button
        v-for="cell in line" :key="cell.square" role="gridcell" :aria-label="cell.square" type="button"
        class="relative flex aspect-square items-center justify-center text-[clamp(1.6rem,6vw,3rem)] leading-none"
        :class="cell.dark ? 'bg-[#7c8ee0]' : 'bg-[#eef1fb]'"
        :style="{ cursor: interactive ? 'pointer' : 'default' }"
        @click="interactive && emit('square-click', cell.square)"
        @dragover.prevent
        @drop.prevent="onDrop($event, cell)"
      >
        <span v-if="ri === 7" class="pointer-events-none absolute bottom-0.5 left-1 text-[10px] font-semibold opacity-60" :class="cell.dark ? 'text-[#eef1fb]' : 'text-[#7c8ee0]'">{{ cell.file }}</span>
        <span v-if="cell.file === (orientation === 'w' ? 'a' : 'h')" class="pointer-events-none absolute right-1 top-0.5 text-[10px] font-semibold opacity-60" :class="cell.dark ? 'text-[#eef1fb]' : 'text-[#7c8ee0]'">{{ cell.rank }}</span>

        <span v-if="lastMove && (lastMove.from === cell.square || lastMove.to === cell.square)" class="pointer-events-none absolute inset-0" :class="cell.dark ? 'hl-lighten' : 'hl-darken'" />
        <span v-if="checkSquare === cell.square" class="pointer-events-none absolute inset-0" :style="{ background: ALERT }" />
        <span v-if="selected === cell.square" class="pointer-events-none absolute inset-0" style="box-shadow: inset 0 0 0 3px #ff5da2" />

        <span
          v-if="cell.piece" draggable="true"
          class="relative z-10 drop-shadow-[0_1px_1px_rgba(0,0,0,0.45)]"
          :class="cell.piece.color === 'w' ? 'text-white' : 'text-neutral-900'"
          @dragstart="onDragStart($event, cell)"
        >{{ GLYPH[cell.piece.color + cell.piece.type] }}</span>

        <span v-else-if="legalTargets.includes(cell.square)" class="pointer-events-none absolute h-1/4 w-1/4 rounded-full" :style="{ background: dotColor(cell.dark) }" />
        <span v-if="cell.piece && legalTargets.includes(cell.square)" class="pointer-events-none absolute inset-1 rounded-full" :style="{ boxShadow: `inset 0 0 0 3px ${dotColor(cell.dark)}` }" />
      </button>
    </div>
  </div>
</template>
