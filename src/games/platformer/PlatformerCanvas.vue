<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import type { PlatformerState } from './engine'

const props = defineProps<{ state: PlatformerState }>()
const canvas = ref<HTMLCanvasElement | null>(null)

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

/** Collinette e nuvole di sfondo: posizioni derivate in modo deterministico dalla larghezza del livello, non casuali, così il disegno resta identico a ogni ridisegno. */
function drawBackdrop(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, height)
  sky.addColorStop(0, '#241a38')
  sky.addColorStop(1, '#3d2f6b')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, width, height)

  ctx.fillStyle = 'rgba(255,255,255,0.08)'
  for (let i = 0; i < 5; i++) {
    const cx = (i * 211 + 60) % (width + 120) - 60
    const cy = 50 + ((i * 73) % 80)
    ctx.beginPath()
    ctx.ellipse(cx, cy, 34, 14, 0, 0, Math.PI * 2)
    ctx.ellipse(cx + 24, cy + 4, 24, 11, 0, 0, Math.PI * 2)
    ctx.ellipse(cx - 22, cy + 5, 20, 10, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.fillStyle = 'rgba(142,202,230,0.12)'
  for (let i = 0; i < 4; i++) {
    const hx = (i * 320 + 140) % (width + 300) - 150
    ctx.beginPath()
    ctx.ellipse(hx, height, 220, 110, 0, Math.PI, 0)
    ctx.fill()
  }
}

function drawPlatform(ctx: CanvasRenderingContext2D, p: { x: number; y: number; w: number; h: number }) {
  roundRect(ctx, p.x, p.y, p.w, p.h, 8)
  ctx.fillStyle = '#5b4a8a'
  ctx.fill()
  ctx.fillStyle = '#7dd3a0'
  roundRect(ctx, p.x, p.y, p.w, Math.min(7, p.h), 8)
  ctx.fill()
}

function drawGoal(ctx: CanvasRenderingContext2D, goal: { x: number; y: number; w: number; h: number }, t: number) {
  const poleX = goal.x + goal.w * 0.5
  ctx.strokeStyle = '#fdf6ec'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(poleX, goal.y + goal.h)
  ctx.lineTo(poleX, goal.y - 34)
  ctx.stroke()

  const wave = Math.sin(t / 220) * 5
  ctx.fillStyle = '#ffd166'
  ctx.beginPath()
  ctx.moveTo(poleX, goal.y - 34)
  ctx.lineTo(poleX + 26 + wave, goal.y - 27)
  ctx.lineTo(poleX, goal.y - 20)
  ctx.fill()

  roundRect(ctx, goal.x, goal.y, goal.w, goal.h, 6)
  ctx.fillStyle = 'rgba(52,201,138,0.35)'
  ctx.fill()
}

function drawEnemy(ctx: CanvasRenderingContext2D, e: { x: number; y: number; w: number; h: number; dir: number }, t: number) {
  const squish = Math.abs(Math.sin(t / 150 + e.x)) * 3
  const x = e.x
  const y = e.y + squish
  const h = e.h - squish
  roundRect(ctx, x, y, e.w, h, 10)
  ctx.fillStyle = '#ef476f'
  ctx.fill()
  ctx.fillStyle = '#fdf6ec'
  const eyeOffset = e.dir === 1 ? e.w - 10 : 4
  ctx.beginPath()
  ctx.ellipse(x + eyeOffset + 2, y + h * 0.4, 3.5, 4, 0, 0, Math.PI * 2)
  ctx.ellipse(x + eyeOffset - 6, y + h * 0.4, 3.5, 4, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#241832'
  ctx.beginPath()
  ctx.arc(x + eyeOffset + 2, y + h * 0.4, 1.6, 0, Math.PI * 2)
  ctx.arc(x + eyeOffset - 6, y + h * 0.4, 1.6, 0, Math.PI * 2)
  ctx.fill()
}

function drawPlayer(ctx: CanvasRenderingContext2D, p: PlatformerState['player'], t: number) {
  const walking = p.vx !== 0 && p.onGround
  const legSwing = walking ? Math.sin(t / 60) * 6 : 0

  ctx.fillStyle = '#d6467f'
  ctx.fillRect(p.x + 4, p.y + p.h - 8, 7, 8 + Math.max(0, legSwing))
  ctx.fillRect(p.x + p.w - 11, p.y + p.h - 8, 7, 8 + Math.max(0, -legSwing))

  roundRect(ctx, p.x, p.y, p.w, p.h - 4, 9)
  const body = ctx.createLinearGradient(p.x, p.y, p.x, p.y + p.h)
  body.addColorStop(0, '#ff8fb3')
  body.addColorStop(1, '#ff5da2')
  ctx.fillStyle = body
  ctx.fill()

  ctx.fillStyle = '#fdf6ec'
  const eyeX = p.facing === 1 ? p.x + p.w - 12 : p.x + 5
  ctx.beginPath()
  ctx.ellipse(eyeX + 3.5, p.y + 11, 4, 5, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#241832'
  ctx.beginPath()
  ctx.arc(eyeX + (p.facing === 1 ? 5 : 2), p.y + 11, 1.8, 0, Math.PI * 2)
  ctx.fill()
}

function draw() {
  const el = canvas.value
  const ctx = el?.getContext('2d')
  if (!el || !ctx) return
  const s = props.state
  const { level } = s
  const t = performance.now()

  drawBackdrop(ctx, level.width, level.height)
  for (const p of level.platforms) drawPlatform(ctx, p)
  drawGoal(ctx, level.goal, t)
  for (const e of s.enemies) if (e.alive) drawEnemy(ctx, e, t)
  drawPlayer(ctx, s.player, t)
}

watch(() => props.state, draw)
onMounted(draw)
</script>

<template>
  <canvas
    ref="canvas" :width="state.level.width" :height="state.level.height"
    class="mx-auto block w-full touch-none select-none rounded-box shadow-lg" :style="{ aspectRatio: `${state.level.width} / ${state.level.height}` }"
  />
</template>
