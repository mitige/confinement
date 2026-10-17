/**
 * Screenshot analyser.
 *
 * This model cannot view images, so composition has to be measured instead of
 * looked at. Chrome decodes each PNG, and this reports:
 *
 *   - An ASCII luminance map, which is enough to judge framing, silhouette and
 *     whether the machine is where the camera keys claim it is.
 *   - Exposure statistics, so a frame that is accidentally black or blown out
 *     cannot pass review.
 *   - Detail density (mean gradient), which distinguishes real geometry from a
 *     flat wash of fog.
 *   - Regional contrast for the type areas, which is how text legibility over a
 *     render gets verified rather than hoped for.
 *
 * Usage: node scripts/analyze.mjs [name ...]
 */

import { chromium } from 'playwright-core'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const OUT = path.resolve('shots')
const RAMP = ' .:-=+*#%@'

const argv = process.argv.slice(2)
const BRIEF = argv.includes('--brief')
/**
 * --zoom=x0,y0,x1,y1 samples that rectangle at NATIVE resolution instead of
 * downsampling the whole frame. Small type is invisible in a 96-column map, so
 * this is how text legibility actually gets checked.
 */
const ZOOM = (() => {
  const entry = argv.find((a) => a.startsWith('--zoom='))
  if (!entry) return null
  const [x0, y0, x1, y1] = entry.slice(7).split(',').map(Number)
  return { x0, y0, x1, y1 }
})()
const wanted = argv.filter((a) => !a.startsWith('--'))

async function main() {
  const files = (await readdir(OUT)).filter((f) => f.endsWith('.png')).sort()
  const selected = wanted.length ? files.filter((f) => wanted.some((w) => f.includes(w))) : files

  if (!selected.length) {
    console.log('No screenshots found. Run scripts/shoot.mjs first.')
    return
  }

  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files'],
  })
  const page = await browser.newPage()

  for (const file of selected) {
    // Pass the PNG as a data URL: a file:// image cannot be decoded from an
    // about:blank origin.
    const bytes = await readFile(path.join(OUT, file))
    const dataUrl = `data:image/png;base64,${bytes.toString('base64')}`

    const stats = await page.evaluate(async ([src, zoomRect]) => {
      const image = new Image()
      image.src = src
      await image.decode()

      const zoom = zoomRect
      const W = zoom ? 108 : 96
      // Zoomed crops keep square-ish cells; full frames compensate for the
      // terminal's character aspect ratio.
      const H = zoom
        ? Math.max(1, Math.round(((zoom.y1 - zoom.y0) / (zoom.x1 - zoom.x0)) * W * 0.5))
        : Math.max(1, Math.round((image.height / image.width) * W * 0.46))

      const canvas = document.createElement('canvas')
      canvas.width = W
      canvas.height = H
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (zoom) {
        ctx.drawImage(
          image,
          zoom.x0, zoom.y0, zoom.x1 - zoom.x0, zoom.y1 - zoom.y0,
          0, 0, W, H,
        )
      } else {
        ctx.drawImage(image, 0, 0, W, H)
      }
      const data = ctx.getImageData(0, 0, W, H).data

      const lum = new Float32Array(W * H)
      let sum = 0
      let min = 255
      let max = 0
      let bright = 0
      let veryBright = 0

      for (let i = 0; i < W * H; i += 1) {
        const r = data[i * 4]
        const g = data[i * 4 + 1]
        const b = data[i * 4 + 2]
        // Rec. 709 luma, matching how the eye weights the channels.
        const v = 0.2126 * r + 0.7152 * g + 0.0722 * b
        lum[i] = v
        sum += v
        if (v < min) min = v
        if (v > max) max = v
        if (v > 24) bright += 1
        if (v > 200) veryBright += 1
      }

      // Mean absolute gradient, a cheap proxy for "is there real detail here".
      let gradient = 0
      let gradientCount = 0
      for (let y = 1; y < H; y += 1) {
        for (let x = 1; x < W; x += 1) {
          const i = y * W + x
          gradient += Math.abs(lum[i] - lum[i - 1]) + Math.abs(lum[i] - lum[i - W])
          gradientCount += 2
        }
      }

      // Regional statistics, used to check that type areas have contrast.
      const region = (x0, y0, x1, y1) => {
        let lo = 255
        let hi = 0
        let total = 0
        let n = 0
        for (let y = y0; y < y1; y += 1) {
          for (let x = x0; x < x1; x += 1) {
            const v = lum[y * W + x]
            if (v < lo) lo = v
            if (v > hi) hi = v
            total += v
            n += 1
          }
        }
        return { min: lo, max: hi, mean: total / n }
      }

      return {
        width: image.width,
        height: image.height,
        ascii: Array.from({ length: H }, (_, y) =>
          Array.from({ length: W }, (_, x) => lum[y * W + x]),
        ),
        mean: sum / (W * H),
        min,
        max,
        brightFraction: bright / (W * H),
        veryBrightFraction: veryBright / (W * H),
        detail: gradient / gradientCount,
        leftTextZone: region(2, Math.round(H * 0.3), Math.round(W * 0.3), Math.round(H * 0.75)),
        centreZone: region(Math.round(W * 0.35), Math.round(H * 0.25), Math.round(W * 0.65), Math.round(H * 0.8)),
        topLeft: region(0, 0, Math.round(W * 0.25), Math.round(H * 0.12)),
      }
    }, [dataUrl, ZOOM])

    console.log(`\n${'='.repeat(100)}`)
    console.log(`${file}   ${stats.width}x${stats.height}`)
    console.log(
      `mean ${stats.mean.toFixed(1)}  min ${stats.min.toFixed(0)}  max ${stats.max.toFixed(0)}` +
        `  lit ${(stats.brightFraction * 100).toFixed(1)}%  blown ${(stats.veryBrightFraction * 100).toFixed(2)}%` +
        `  detail ${stats.detail.toFixed(2)}`,
    )
    console.log(
      `zones  left(type) mean ${stats.leftTextZone.mean.toFixed(0)} [${stats.leftTextZone.min.toFixed(0)}-${stats.leftTextZone.max.toFixed(0)}]` +
        `   centre mean ${stats.centreZone.mean.toFixed(0)} [${stats.centreZone.min.toFixed(0)}-${stats.centreZone.max.toFixed(0)}]`,
    )
    if (ZOOM) {
      console.log(`zoom ${ZOOM.x0},${ZOOM.y0} -> ${ZOOM.x1},${ZOOM.y1}  (native pixels)`)
    }
    console.log(`${'-'.repeat(100)}`)

    if (BRIEF) continue

    for (const row of stats.ascii) {
      let line = ''
      for (const v of row) {
        // Gamma-lift so midtones are distinguishable in text.
        const t = Math.pow(Math.min(v, 255) / 255, 0.65)
        line += RAMP[Math.min(RAMP.length - 1, Math.round(t * (RAMP.length - 1)))]
      }
      console.log(line)
    }
  }

  await browser.close()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})