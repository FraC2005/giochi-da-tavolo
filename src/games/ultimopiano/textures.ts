/**
 * Texture (colore + bump) generate via canvas 2D, non immagini esterne: coerente con l'approccio
 * del resto del sito (niente asset di cui tracciare la licenza). Ogni superficie ha una texture a
 * colori e una in scala di grigi usata come bumpMap, così le luci ravvicinate (il punto forte di
 * una scena quasi al buio) fanno risaltare la grana invece di scivolare su plastica piatta.
 */
import * as THREE from 'three'

function canvas(size = 512): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  return { canvas: c, ctx: c.getContext('2d')! }
}

function noise(ctx: CanvasRenderingContext2D, size: number, amount: number, alpha: number) {
  for (let i = 0; i < amount; i++) {
    const x = Math.random() * size
    const y = Math.random() * size
    const r = Math.random() * 1.6
    ctx.fillStyle = `rgba(0,0,0,${alpha * Math.random()})`
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
}

function wrap(tex: THREE.CanvasTexture, repeat?: [number, number]) {
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.anisotropy = 4
  if (repeat) tex.repeat.set(...repeat)
  return tex
}

export interface SurfaceTextures {
  map: THREE.CanvasTexture
  bumpMap: THREE.CanvasTexture
}

/** Carta da parati vecchia: righe verticali in rilievo + macchie di umidità + grana della carta. */
export function wallpaperTexture(baseColor = '#8a7a6b', stripeColor = '#7a6a5c'): SurfaceTextures {
  const size = 512
  const { canvas: c, ctx } = canvas(size)
  ctx.fillStyle = baseColor
  ctx.fillRect(0, 0, size, size)
  ctx.fillStyle = stripeColor
  for (let x = 0; x < size; x += 44) ctx.fillRect(x, 0, 20, size)
  for (let i = 0; i < 10; i++) {
    const x = Math.random() * size
    const y = Math.random() * size
    const r = 30 + Math.random() * 60
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r)
    grad.addColorStop(0, 'rgba(40,35,25,0.28)')
    grad.addColorStop(1, 'rgba(40,35,25,0)')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  noise(ctx, size, 5000, 0.05)

  const { canvas: bc, ctx: bctx } = canvas(size)
  bctx.fillStyle = '#808080'
  bctx.fillRect(0, 0, size, size)
  bctx.fillStyle = '#656565'
  for (let x = 0; x < size; x += 44) bctx.fillRect(x, 0, 20, size)
  noise(bctx, size, 6000, 0.12)

  return { map: wrap(new THREE.CanvasTexture(c), [2, 1]), bumpMap: wrap(new THREE.CanvasTexture(bc), [2, 1]) }
}

/** Muro spoglio/intonaco scrostato, usato nella stanza vuota del capitolo 3. */
export function bareWallTexture(): SurfaceTextures {
  const size = 512
  const { canvas: c, ctx } = canvas(size)
  ctx.fillStyle = '#5d5953'
  ctx.fillRect(0, 0, size, size)
  const { canvas: bc, ctx: bctx } = canvas(size)
  bctx.fillStyle = '#707070'
  bctx.fillRect(0, 0, size, size)
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * size
    const y = Math.random() * size
    const w = 16 + Math.random() * 120
    const h = 6 + Math.random() * 40
    const a = 0.18 + Math.random() * 0.3
    ctx.fillStyle = `rgba(70,65,58,${a})`
    ctx.fillRect(x, y, w, h)
    bctx.fillStyle = `rgba(0,0,0,${a * 0.9})`
    bctx.fillRect(x, y, w, h)
  }
  // crepe sottili
  for (let i = 0; i < 14; i++) {
    ctx.strokeStyle = 'rgba(20,18,15,0.35)'
    bctx.strokeStyle = 'rgba(0,0,0,0.6)'
    ctx.lineWidth = bctx.lineWidth = 1
    let x = Math.random() * size, y = Math.random() * size
    ctx.beginPath(); bctx.beginPath()
    ctx.moveTo(x, y); bctx.moveTo(x, y)
    for (let s = 0; s < 6; s++) {
      x += (Math.random() - 0.5) * 60
      y += (Math.random() - 0.5) * 60
      ctx.lineTo(x, y); bctx.lineTo(x, y)
    }
    ctx.stroke(); bctx.stroke()
  }
  noise(ctx, size, 7000, 0.08)
  noise(bctx, size, 7000, 0.18)
  return { map: wrap(new THREE.CanvasTexture(c), [2, 1]), bumpMap: wrap(new THREE.CanvasTexture(bc), [2, 1]) }
}

/** Parquet consumato, con fughe fra le assi in rilievo. */
export function floorTexture(): SurfaceTextures {
  const size = 512
  const { canvas: c, ctx } = canvas(size)
  const { canvas: bc, ctx: bctx } = canvas(size)
  ctx.fillStyle = '#4a3726'
  ctx.fillRect(0, 0, size, size)
  bctx.fillStyle = '#606060'
  bctx.fillRect(0, 0, size, size)
  const plankH = 26
  for (let y = 0; y < size; y += plankH) {
    const shade = (Math.floor(y / plankH) % 2 === 0) ? '#51402c' : '#453322'
    ctx.fillStyle = shade
    ctx.fillRect(0, y, size, plankH - 2)
    bctx.fillStyle = '#787878'
    bctx.fillRect(0, y, size, plankH - 2)
    bctx.fillStyle = '#202020'
    bctx.fillRect(0, y + plankH - 2, size, 2) // fuga incisa
    // venatura del legno
    for (let i = 0; i < 4; i++) {
      const ly = y + 4 + Math.random() * (plankH - 8)
      ctx.strokeStyle = 'rgba(0,0,0,0.12)'
      ctx.beginPath()
      ctx.moveTo(0, ly)
      for (let x = 0; x < size; x += 24) ctx.lineTo(x, ly + (Math.random() - 0.5) * 4)
      ctx.stroke()
    }
  }
  noise(ctx, size, 3500, 0.06)
  noise(bctx, size, 3500, 0.1)
  return {
    map: wrap(new THREE.CanvasTexture(c), [5, 5]),
    bumpMap: wrap(new THREE.CanvasTexture(bc), [5, 5]),
  }
}

/** Soffitto piatto, leggermente sporco. */
export function ceilingTexture(): THREE.CanvasTexture {
  const size = 256
  const { canvas: c, ctx } = canvas(size)
  ctx.fillStyle = '#3a362f'
  ctx.fillRect(0, 0, size, size)
  noise(ctx, size, 1200, 0.05)
  return wrap(new THREE.CanvasTexture(c))
}

/** Porta dipinta dello stesso colore del muro: quasi invisibile, solo la cornice e la maniglia la tradiscono. */
export function sealedDoorTexture(baseColor: string): THREE.CanvasTexture {
  const { canvas: c, ctx } = canvas(256)
  ctx.fillStyle = baseColor
  ctx.fillRect(0, 0, 256, 256)
  ctx.strokeStyle = 'rgba(0,0,0,0.18)'
  ctx.lineWidth = 4
  ctx.strokeRect(14, 10, 228, 236)
  ctx.strokeRect(28, 26, 200, 95)
  ctx.strokeRect(28, 135, 200, 95)
  noise(ctx, 256, 1200, 0.05)
  return new THREE.CanvasTexture(c)
}

/** Legno scuro per infissi, battiscopa e cornici: più stretta, ripetuta orizzontalmente. */
export function woodTrimTexture(): THREE.CanvasTexture {
  const { canvas: c, ctx } = canvas(128)
  ctx.fillStyle = '#2e2117'
  ctx.fillRect(0, 0, 128, 128)
  for (let i = 0; i < 10; i++) {
    ctx.strokeStyle = `rgba(0,0,0,${0.15 + Math.random() * 0.15})`
    ctx.lineWidth = 1 + Math.random()
    const y = Math.random() * 128
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(128, y + (Math.random() - 0.5) * 10)
    ctx.stroke()
  }
  return wrap(new THREE.CanvasTexture(c), [3, 1])
}
