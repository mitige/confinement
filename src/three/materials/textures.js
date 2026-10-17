import * as THREE from 'three'

/**
 * Procedurally generated textures.
 *
 * Everything here is drawn into a canvas at runtime: the piece ships no image
 * files, so the repository stays clean and the first paint is fast. Textures are
 * memoised by key because several components share the same surface treatment.
 */

const cache = new Map()

function memo(key, build) {
  if (!cache.has(key)) cache.set(key, build())
  return cache.get(key)
}

function makeCanvas(size) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  return { canvas, ctx: canvas.getContext('2d') }
}

function finish(canvas, { repeat = 1, srgb = false } = {}) {
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(repeat, repeat)
  tex.anisotropy = 4
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  return tex
}

/**
 * Fine directional streaks, used as a roughness map. This is what makes a metal
 * read as brushed rather than plastic: the highlight breaks up along one axis.
 */
export function brushedRoughness({
  size = 1024,
  base = 0.42,
  streak = 0.16,
  direction = 'horizontal',
  key = 'brushed',
} = {}) {
  return memo(`${key}-${size}-${base}-${streak}-${direction}`, () => {
    const { canvas, ctx } = makeCanvas(size)
    const level = Math.round(base * 255)
    ctx.fillStyle = `rgb(${level},${level},${level})`
    ctx.fillRect(0, 0, size, size)

    // Long, thin, mostly-coherent strokes along the brushing direction.
    const lines = Math.round(size * 1.6)
    for (let i = 0; i < lines; i += 1) {
      const t = Math.random()
      const v = Math.round(level + (t - 0.5) * 2 * streak * 255)
      const grey = Math.max(0, Math.min(255, v))
      ctx.strokeStyle = `rgba(${grey},${grey},${grey},${0.14 + Math.random() * 0.3})`
      ctx.lineWidth = Math.random() < 0.86 ? 1 : 2

      if (direction === 'horizontal') {
        const y = Math.random() * size
        const x = Math.random() * size
        const len = size * (0.15 + Math.random() * 0.7)
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(x + len, y + (Math.random() - 0.5) * 2.5)
        ctx.stroke()
      } else {
        const x = Math.random() * size
        const y = Math.random() * size
        const len = size * (0.15 + Math.random() * 0.7)
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(x + (Math.random() - 0.5) * 2.5, y + len)
        ctx.stroke()
      }
    }

    // A few broad blotches break the regularity of the strokes.
    for (let i = 0; i < 26; i += 1) {
      const x = Math.random() * size
      const y = Math.random() * size
      const r = size * (0.03 + Math.random() * 0.16)
      const g = ctx.createRadialGradient(x, y, 0, x, y, r)
      const delta = (Math.random() - 0.5) * streak * 255
      const mid = Math.round(Math.max(0, Math.min(255, level + delta)))
      g.addColorStop(0, `rgba(${mid},${mid},${mid},0.4)`)
      g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = g
      ctx.fillRect(x - r, y - r, r * 2, r * 2)
    }

    return finish(canvas, { repeat: 3 })
  })
}

/**
 * Soft multi-scale value noise, used for subtle surface irregularity and as a
 * bump map. Real fabrications are never perfectly smooth.
 */
export function softNoise({ size = 512, cells = 6, octaves = 5, key = 'noise' } = {}) {
  return memo(`${key}-${size}-${cells}-${octaves}`, () => {
    const { canvas, ctx } = makeCanvas(size)

    // Per-octave random lattice, drawn as blurred radial blobs and summed.
    ctx.fillStyle = 'rgb(128,128,128)'
    ctx.fillRect(0, 0, size, size)

    for (let o = 0; o < octaves; o += 1) {
      const n = cells * Math.pow(2, o)
      const cell = size / n
      const alpha = 0.5 / (o + 1.35)
      for (let iy = 0; iy < n; iy += 1) {
        for (let ix = 0; ix < n; ix += 1) {
          const x = (ix + 0.5) * cell
          const y = (iy + 0.5) * cell
          const r = cell * (0.9 + Math.random() * 0.6)
          const v = Math.random()
          const grey = v > 0.5 ? 255 : 0
          const g = ctx.createRadialGradient(x, y, 0, x, y, r)
          g.addColorStop(0, `rgba(${grey},${grey},${grey},${alpha})`)
          g.addColorStop(1, 'rgba(0,0,0,0)')
          ctx.fillStyle = g
          ctx.fillRect(x - r, y - r, r * 2, r * 2)
        }
      }
    }

    return finish(canvas, { repeat: 2 })
  })
}

/**
 * Weld seams and plate joints for the vacuum vessel sectors: nine sectors, so
 * nine vertical seams plus horizontal ribs.
 */
export function weldSeams({ size = 1024, sectors = 9, ribs = 4, key = 'weld' } = {}) {
  return memo(`${key}-${size}-${sectors}-${ribs}`, () => {
    const { canvas, ctx } = makeCanvas(size)
    ctx.fillStyle = 'rgb(96,96,96)'
    ctx.fillRect(0, 0, size, size)

    // Vertical sector seams.
    for (let i = 0; i < sectors; i += 1) {
      const x = (i / sectors) * size
      const g = ctx.createLinearGradient(x - 14, 0, x + 14, 0)
      g.addColorStop(0, 'rgba(80,80,80,0)')
      g.addColorStop(0.5, 'rgba(196,196,196,0.85)')
      g.addColorStop(1, 'rgba(80,80,80,0)')
      ctx.fillStyle = g
      ctx.fillRect(x - 14, 0, 28, size)
    }

    // Horizontal reinforcement ribs.
    for (let i = 0; i < ribs; i += 1) {
      const y = ((i + 0.5) / ribs) * size
      const g = ctx.createLinearGradient(0, y - 9, 0, y + 9)
      g.addColorStop(0, 'rgba(80,80,80,0)')
      g.addColorStop(0.5, 'rgba(150,150,150,0.55)')
      g.addColorStop(1, 'rgba(80,80,80,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, y - 9, size, 18)
    }

    // Sparse pitting so the surface is not mathematically clean.
    for (let i = 0; i < 2400; i += 1) {
      const x = Math.random() * size
      const y = Math.random() * size
      const r = Math.random() * 1.9 + 0.3
      const v = Math.random() > 0.5 ? 190 : 60
      ctx.fillStyle = `rgba(${v},${v},${v},${Math.random() * 0.35})`
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }

    return finish(canvas, { repeat: 1 })
  })
}

/**
 * Instanced blanket modules and divertor cassettes share one material, so this
 * gives them per-part wear rather than a uniform surface.
 */
export function machinedSurface({ size = 512, key = 'machined' } = {}) {
  return memo(`${key}-${size}`, () => {
    const { canvas, ctx } = makeCanvas(size)
    ctx.fillStyle = 'rgb(118,118,118)'
    ctx.fillRect(0, 0, size, size)

    // Concentric tooling marks.
    for (let i = 0; i < 420; i += 1) {
      const r = Math.random() * size * 0.75
      const x = Math.random() * size
      const y = Math.random() * size
      const g = ctx.createRadialGradient(x, y, r * 0.8, x, y, r)
      const v = Math.random() > 0.5 ? 175 : 72
      g.addColorStop(0, 'rgba(0,0,0,0)')
      g.addColorStop(1, `rgba(${v},${v},${v},0.16)`)
      ctx.fillStyle = g
      ctx.fillRect(0, 0, size, size)
    }

    // Edge darkening to fake cast shadow in the crevices.
    for (let i = 0; i < 900; i += 1) {
      const x = Math.random() * size
      const y = Math.random() * size
      ctx.fillStyle = `rgba(40,40,40,${Math.random() * 0.28})`
      ctx.fillRect(x, y, Math.random() * 5 + 1, Math.random() * 2 + 0.5)
    }

    return finish(canvas, { repeat: 4 })
  })
}

/**
 * Periodic value noise, seamless on both axes.
 *
 * Seamlessness is the whole point: the plasma shader uses this in place of a
 * computed FBM, sampling it by UV, and the plasma is a closed torus. A tiling
 * texture sampled at integer frequencies wraps without a visible seam, where a
 * non-tiling one would draw a bright line down the machine.
 *
 * Allocating this once and reading it is dramatically cheaper per fragment than
 * evaluating noise in the shader: two texture fetches replace roughly eighty
 * arithmetic operations, and this shader runs on overlapping additive shells.
 */
export function tileableNoise({ size = 256, octaves = 4, base = 8, key = 'tileable' } = {}) {
  return memo(`${key}-${size}-${octaves}-${base}`, () => {
    const { canvas, ctx } = makeCanvas(size)
    const image = ctx.createImageData(size, size)
    const data = image.data

    // A cheap integer hash. Deterministic, so the texture is identical on every
    // run and the plasma never looks different between reloads.
    const hash = (x, y, seed) => {
      let h = x * 374761393 + y * 668265263 + seed * 362437
      h = (h ^ (h >> 13)) * 1274126177
      h ^= h >> 16
      return ((h >>> 0) % 100000) / 100000
    }

    const smooth = (t) => t * t * (3 - 2 * t)

    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        let value = 0
        let total = 0
        let amplitude = 0.5

        for (let o = 0; o < octaves; o += 1) {
          // Each octave wraps at its own lattice size, which is what keeps the
          // result tileable at every frequency.
          const lattice = base * 2 ** o
          const fx = (x / size) * lattice
          const fy = (y / size) * lattice
          const x0 = Math.floor(fx)
          const y0 = Math.floor(fy)
          const tx = smooth(fx - x0)
          const ty = smooth(fy - y0)

          const x0w = ((x0 % lattice) + lattice) % lattice
          const y0w = ((y0 % lattice) + lattice) % lattice
          const x1w = (x0w + 1) % lattice
          const y1w = (y0w + 1) % lattice

          const v00 = hash(x0w, y0w, o)
          const v10 = hash(x1w, y0w, o)
          const v01 = hash(x0w, y1w, o)
          const v11 = hash(x1w, y1w, o)

          const top = v00 + (v10 - v00) * tx
          const bottom = v01 + (v11 - v01) * tx
          value += amplitude * (top + (bottom - top) * ty)
          total += amplitude
          amplitude *= 0.5
        }

        const grey = Math.round((value / total) * 255)
        const i = (y * size + x) * 4
        data[i] = grey
        data[i + 1] = grey
        data[i + 2] = grey
        data[i + 3] = 255
      }
    }

    ctx.putImageData(image, 0, 0)

    const tex = new THREE.CanvasTexture(canvas)
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.RepeatWrapping
    tex.minFilter = THREE.LinearMipmapLinearFilter
    tex.magFilter = THREE.LinearFilter
    tex.generateMipmaps = true
    // Data, not colour: leaving it linear is what keeps the noise unbiased.
    tex.needsUpdate = true
    return tex
  })
}

/**
 * A soft radial falloff, opaque at the centre and fully transparent at the rim.
 * Used as a baked contact shadow under the machine.
 */
export function radialFalloff({ size = 512, power = 1.9, key = 'radial' } = {}) {
  return memo(`${key}-${size}-${power}`, () => {
    const { canvas, ctx } = makeCanvas(size)
    const half = size / 2
    const gradient = ctx.createRadialGradient(half, half, 0, half, half, half)
    // Several stops approximate a smooth, non-linear falloff better than two.
    for (let i = 0; i <= 10; i += 1) {
      const t = i / 10
      const alpha = Math.pow(1 - t, power)
      gradient.addColorStop(t, `rgba(0,0,0,${alpha})`)
    }
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, size, size)

    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.needsUpdate = true
    return tex
  })
}

/** Free every cached texture. Only used on hot-reload teardown. */
export function disposeTextures() {
  for (const tex of cache.values()) tex.dispose?.()
  cache.clear()
}