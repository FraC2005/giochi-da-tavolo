<script setup lang="ts">
import { computed } from 'vue'
import { CHARACTERS, ROOM_H, ROOM_W, type Dir, type ItemKind, type RoguelikeState, type Room } from './engine'

const props = defineProps<{ state: RoguelikeState }>()

const CX = Math.floor(ROOM_W / 2)
const CY = Math.floor(ROOM_H / 2)

const ITEM_GLYPH: Record<ItemKind, string> = { heal: '💊', attack: '⚔️', maxhp: '❤️', piercing: '🎯', trishot: '🔱', armor: '🛡️', regen: '✨' }

interface Cell { ch: string; cls: string }

function doorDirAt(x: number, y: number): Dir | null {
  if (y === 0 && x === CX) return 'N'
  if (y === ROOM_H - 1 && x === CX) return 'S'
  if (x === 0 && y === CY) return 'W'
  if (x === ROOM_W - 1 && y === CY) return 'E'
  return null
}

const playerGlyph = computed(() => CHARACTERS.find((c) => c.id === props.state.player.characterId)?.emoji ?? '🧑')

function cellAt(x: number, y: number, room: Room): Cell {
  const isBorder = x === 0 || x === ROOM_W - 1 || y === 0 || y === ROOM_H - 1
  if (isBorder) {
    const dir = doorDirAt(x, y)
    if (dir && room.doors[dir]) {
      const cleared = room.enemies.every((e) => e.hp <= 0)
      return { ch: '◆', cls: cleared ? 'text-success' : 'text-error animate-pulse' }
    }
    return { ch: '▓', cls: 'opacity-25' }
  }
  if (props.state.player.x === x && props.state.player.y === y) return { ch: playerGlyph.value, cls: 'scale-125' }
  const liveEnemy = room.enemies.find((e) => e.hp > 0 && e.x === x && e.y === y)
  if (liveEnemy) {
    const hurt = liveEnemy.hp < liveEnemy.maxHp
    return { ch: liveEnemy.glyph, cls: `scale-125 ${hurt ? 'opacity-70' : ''} ${liveEnemy.ranged ? 'drop-shadow-[0_0_6px_rgba(239,71,111,0.8)]' : ''}` }
  }
  const item = room.items.find((i) => !i.taken && i.x === x && i.y === y)
  if (item) return { ch: ITEM_GLYPH[item.kind], cls: 'scale-110 animate-bounce' }
  return { ch: '·', cls: 'opacity-15' }
}

const grid = computed<Cell[][]>(() => {
  const room = props.state.rooms[props.state.player.roomKey]
  const rows: Cell[][] = []
  for (let y = 0; y < ROOM_H; y++) {
    const row: Cell[] = []
    for (let x = 0; x < ROOM_W; x++) row.push(cellAt(x, y, room))
    rows.push(row)
  }
  return rows
})

const roomLabel = computed(() => {
  const room = props.state.rooms[props.state.player.roomKey]
  if (room.kind === 'boss') return room.enemies.every((e) => e.hp <= 0) ? '👑 Boss sconfitto' : '💀 Stanza del boss'
  if (room.kind === 'item') return '✨ Stanza del tesoro'
  if (room.kind === 'start') return '🚪 Ingresso del dungeon'
  return room.enemies.every((e) => e.hp <= 0) ? '✓ Stanza liberata' : '⚔️ Stanza con nemici'
})
</script>

<template>
  <div class="mx-auto w-fit max-w-full overflow-x-auto rounded-box p-4 shadow-inner" style="background: radial-gradient(ellipse at center, #2c2244 0%, #171224 100%)">
    <p class="mb-2 text-center text-xs font-semibold opacity-70">{{ roomLabel }} · Piano {{ state.floor }}</p>
    <div class="font-mono leading-none" style="font-size: clamp(14px, 3.6vw, 23px)">
      <div v-for="(row, y) in grid" :key="y" class="flex">
        <span v-for="(cell, x) in row" :key="x" class="inline-block text-center transition-transform" :class="cell.cls" style="width: 1.2em">{{ cell.ch }}</span>
      </div>
    </div>
  </div>
</template>
