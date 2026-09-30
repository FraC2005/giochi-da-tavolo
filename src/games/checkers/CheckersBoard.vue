<script setup lang="ts">
import { computed } from 'vue'
import { isDark, samePos, SIZE, type Board, type Pos } from './engine'

const props = defineProps<{
  board: Board
  selected: Pos | null
  legalTargets: Pos[]
  lastMove: { from: Pos; to: Pos } | null
  orientation: 'w' | 'b'
  interactive: boolean
}>()
const emit = defineEmits<{ (e: 'square-click', pos: Pos): void }>()

interface Cell { pos: Pos; piece: Board[number]; dark: boolean }

const rows = computed<Cell[][]>(() => {
  const grid: Cell[][] = []
  for (let r = 0; r < SIZE; r++) {
    const row: Cell[] = []
    for (let c = 0; c < SIZE; c++) {
      const realRow = props.orientation === 'w' ? r : SIZE - 1 - r
      const realCol = props.orientation === 'w' ? c : SIZE - 1 - c
      row.push({ pos: { row: realRow, col: realCol }, piece: props.board[realRow * SIZE + realCol], dark: isDark(realRow, realCol) })
    }
    grid.push(row)
  }
  return grid
})

const isTarget = (pos: Pos) => props.legalTargets.some((t) => samePos(t, pos))
const isSelected = (pos: Pos) => !!props.selected && samePos(props.selected, pos)
const isLastMove = (pos: Pos) => !!props.lastMove && (samePos(props.lastMove.from, pos) || samePos(props.lastMove.to, pos))

// Solo le caselle scure (rosa) sono giocabili in dama: i suggerimenti cadono sempre lì,
// quindi bastano colori fissi scelti per contrastare col rosa, senza dipendere dal tema.
const MOVE_MARK = '#fffaf0'
const SELECTED_RING = '#4b3a8a'
</script>

<template>
  <div class="mx-auto aspect-square w-full max-w-[560px] select-none overflow-hidden rounded-box shadow-lg" role="grid" aria-label="Scacchiera della dama">
    <div v-for="(line, ri) in rows" :key="ri" class="grid grid-cols-8" role="row">
      <button
        v-for="cell in line" :key="cell.pos.row * 8 + cell.pos.col" role="gridcell" type="button"
        :data-sq="`${cell.pos.row}-${cell.pos.col}`" :aria-label="`riga ${cell.pos.row + 1}, colonna ${cell.pos.col + 1}`"
        class="relative flex aspect-square items-center justify-center"
        :class="[cell.dark ? 'bg-[#ff8fb3]' : 'bg-[#fff3d6]', cell.dark && interactive ? 'cursor-pointer' : 'cursor-default']"
        @click="cell.dark && interactive && emit('square-click', cell.pos)"
      >
        <span v-if="isLastMove(cell.pos)" class="hl-darken pointer-events-none absolute inset-0" />
        <span v-if="isSelected(cell.pos)" class="pointer-events-none absolute inset-0" :style="{ boxShadow: `inset 0 0 0 3px ${SELECTED_RING}` }" />
        <span v-if="isTarget(cell.pos) && !cell.piece" class="pointer-events-none absolute h-1/4 w-1/4 rounded-full" :style="{ background: MOVE_MARK }" />
        <span v-if="isTarget(cell.pos) && cell.piece" class="pointer-events-none absolute inset-1 rounded-full" :style="{ boxShadow: `inset 0 0 0 3px ${MOVE_MARK}` }" />

        <span
          v-if="cell.piece"
          class="relative z-10 grid h-[74%] w-[74%] place-items-center rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.4),inset_0_2px_3px_rgba(255,255,255,0.3)]"
          :class="cell.piece.color === 'w' ? 'bg-[#fffaf0] text-[#b3577a]' : 'bg-[#2a1832] text-[#ffd1e6]'"
        >
          <span v-if="cell.piece.king" class="text-[clamp(1rem,3.5vw,1.6rem)] leading-none">♛</span>
        </span>
      </button>
    </div>
  </div>
</template>
