/**
 * Close-up inspection.
 *
 * Frames an arbitrary point of the machine with the camera override and reports
 * the rendered result, so a specific piece of geometry can be looked at instead of
 * hunted for. Used to confirm the cryostat's top cap before and after the fix.
 *
 * The machine's *state* comes from the act timeline, which is driven by scroll — so
 * an act has to be scrolled to, even though the camera override ignores where the
 * timeline would have put the camera. Without this the tool silently inspects the
 * opening act, where nothing is ghosted.
 *
 * Usage: node scripts/inspect.mjs "<url-with-camera-params>" <output-name> [actId] [fraction]
 */

import { chromium } from 'playwright-core'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { readFile } from 'node:fs/promises'

const url = process.argv[2]
const name = process.argv[3] || 'inspect'
const act = process.argv[4] || null
const at = Number(process.argv[5] ?? 0.6)
if (!url) {
  console.error('usage: node scripts/inspect.mjs "<url>" <name> [actId] [fraction]')
  process.exit(1)
}

const OUT = path.resolve('shots/inspect')
await mkdir(OUT, { recursive: true })

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome-stable',
  args: ['--use-gl=angle', '--use-angle=gl', '--ignore-gpu-blocklist', '--no-sandbox',
         '--disable-dev-shm-usage', '--hide-scrollbars', '--force-device-scale-factor=1'],
})
const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1 })
page.setDefaultTimeout(120_000)

const problems = []
page.on('pageerror', (e) => problems.push(`[pageerror] ${e.message}`))
page.on('console', (m) => { if (m.type() === 'error') problems.push(`[console] ${m.text()}`) })

await page.goto(url, { waitUntil: 'load', timeout: 60_000 })
await page.waitForSelector('.loader', { state: 'detached', timeout: 90_000 })

// Put the machine into the requested act's state, then let the fades settle.
if (act) {
  await page.evaluate(
    ({ id, fraction }) => {
      const el = document.querySelector(`[data-act="${id}"]`)
      if (!el) return
      const y = el.offsetTop + el.offsetHeight * fraction
      if (window.__confinement?.lenis) window.__confinement.lenis.scrollTo(y, { immediate: true })
      else window.scrollTo(0, y)
    },
    { id: act, fraction: at },
  )
  await page.waitForTimeout(3500)
} else {
  await page.waitForTimeout(3000)
}

const file = path.join(OUT, `${name}.png`)
await page.screenshot({ path: file })

// Reuse the analyser's decoder to report luminance and detail for the frame.
const stats = await page.evaluate(async (src) => {
  const image = new Image()
  image.src = src
  await image.decode()
  const W = 96
  const H = Math.round((image.height / image.width) * W * 0.46)
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(image, 0, 0, W, H)
  const d = ctx.getImageData(0, 0, W, H).data
  const lum = []
  let sum = 0, max = 0
  for (let i = 0; i < W * H; i += 1) {
    const v = 0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2]
    lum.push(v); sum += v; if (v > max) max = v
  }
  let grad = 0, n = 0
  for (let y = 1; y < H; y += 1) for (let x = 1; x < W; x += 1) {
    const i = y * W + x
    grad += Math.abs(lum[i] - lum[i - 1]) + Math.abs(lum[i] - lum[i - W]); n += 2
  }
  return { W, H, mean: sum / (W * H), max, detail: grad / n, ascii: lum }
}, `data:image/png;base64,${(await readFile(file)).toString('base64')}`)

const RAMP = ' .:-=+*#%@'
console.log(`\n${name}.png  mean ${stats.mean.toFixed(1)}  max ${stats.max.toFixed(0)}  detail ${stats.detail.toFixed(2)}`)
console.log('-'.repeat(stats.W))
for (let y = 0; y < stats.H; y += 1) {
  let line = ''
  for (let x = 0; x < stats.W; x += 1) {
    const t = Math.pow(Math.min(stats.ascii[y * stats.W + x], 255) / 255, 0.65)
    line += RAMP[Math.min(RAMP.length - 1, Math.round(t * (RAMP.length - 1)))]
  }
  console.log(line)
}
if (problems.length) {
  console.log('\nproblems:')
  for (const p of [...new Set(problems)]) console.log('  ' + p)
}
await browser.close()
