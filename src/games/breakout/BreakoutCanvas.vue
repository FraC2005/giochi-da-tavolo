<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { FIELD_H, FIELD_W, type BreakoutState } from './engine'

const props = defineProps<{ state: BreakoutState }>()
const canvas = ref<HTMLCanvasElement | null>(null)

function draw() {
  const el = canvas.value
  const ctx = el?.getContext('2d')
  if (!el || !ctx) return
  const s = props.state

  ctx.fillStyle = '#171224'
  ctx.fillRect(0, 0, FIELD_W, FIELD_H)

  for (const b of s.bricks) {
    if (!b.alive) continue
    ctx.fillStyle = b.color
    ctx.globalAlpha = b.hits > 0 ? 0.55 : 1 // un colpo preso su un mattone rinforzato: un po' più spento
    ctx.fillRect(b.x, b.y, b.w, b.h)
  }
  ctx.globalAlpha = 1

  ctx.fillStyle = '#ff5da2'
  ctx.fillRect(s.paddle.x, s.paddle.y, s.paddle.w, s.paddle.h)

  ctx.fillStyle = '#fdf6ec'
  ctx.beginPath()
  ctx.arc(s.ball.x, s.ball.y, s.ball.r, 0, Math.PI * 2)
  ctx.fill()
}

watch(() => props.state, draw)
onMounted(draw)
</script>

<template>
  <canvas
    ref="canvas" :width="FIELD_W" :height="FIELD_H"
    class="mx-auto block w-full max-w-sm touch-none select-none rounded-box shadow-lg" style="aspect-ratio: 480 / 640"
  />
</template>
