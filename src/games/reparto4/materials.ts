/**
 * Materiali PBR reali (foto, non procedurali): diffuse + normal + roughness + ambient occlusion,
 * scaricati da Poly Haven (poly haven.com), libreria di texture fotografiche a licenza CC0 —
 * pubblico dominio, pensata apposta per essere usata liberamente in qualsiasi progetto. I file
 * sono in public/textures/reparto4/<nome>/{diff,nor_gl,rough,ao}.jpg. Vedi
 * public/textures/reparto4/README.md per le fonti esatte.
 */
import * as THREE from 'three'

const loader = new THREE.TextureLoader()
const cache = new Map<string, THREE.Texture>()

function load(path: string, srgb: boolean): THREE.Texture {
  const cached = cache.get(path)
  if (cached) return cached
  const tex = loader.load(path)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.anisotropy = 8
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace
  cache.set(path, tex)
  return tex
}

export interface PbrOptions {
  repeat?: [number, number]
  roughnessScale?: number
  color?: number
}

/** Costruisce un MeshStandardMaterial da un set di texture reali in public/textures/reparto4/<name>/. */
export function pbrMaterial(name: string, opts: PbrOptions = {}): THREE.MeshStandardMaterial {
  const base = `/textures/reparto4/${name}`
  const map = load(`${base}/diff.jpg`, true)
  const normalMap = load(`${base}/nor_gl.jpg`, false)
  const roughnessMap = load(`${base}/rough.jpg`, false)
  const aoMap = load(`${base}/ao.jpg`, false)
  for (const t of [map, normalMap, roughnessMap, aoMap]) {
    if (opts.repeat) t.repeat.set(...opts.repeat)
  }
  const mat = new THREE.MeshStandardMaterial({ map, normalMap, roughnessMap, aoMap, roughness: opts.roughnessScale ?? 1 })
  if (opts.color !== undefined) mat.color.set(opts.color)
  return mat
}

/** aoMap in three.js legge le coordinate uv2: le nostre geometrie primitive non la hanno, riusiamo la uv principale. */
export function enableAoUv2(geometry: THREE.BufferGeometry) {
  const uv = geometry.getAttribute('uv')
  if (uv) geometry.setAttribute('uv2', uv)
}
