/**
 * Exposure probe.
 *
 * Renders the same act under several pipeline variants and reports measured
 * luminance for each, so the exposure problem can be localised instead of guessed
 * at. Answers two questions directly:
 *
 *   1. Is the darkness coming from the post-processing chain or from the lights?
 *      Compare `?fx=0` (no composer) against `?fx=1`.
 *   2. What light scale actually produces a well-exposed frame?
 *
 * Usage: node scripts/exposure.mjs [actId] [scrollFraction]
 */

import { chromium } from 'playwright-core'
import { harnessUrl, waitForApp } from './lib/ready.mjs'

const ACT = process.argv[2] || 'scale'
const AT = Number(process.argv[3] ?? 0.62)
const BASE = 'http://127.0.0.1:5273/'

const VARIANTS = [
  { label: 'fx=1  (bloom+ACES)      ', query: '?fx=1' },
  { label: 'fx=0  (no composer)     ', query: '?fx=0' },
  { label: 'fx=1  exposure=3        ', query: '?fx=1&exposure=3' },
  { label: 'fx=1  exposure=8        ', query: '?fx=1&exposure=8' },
  { label: 'fx=0  exposure=3        ', query: '?fx=0&exposure=3' },
]

const BASE_ARGS = [
  '--use-gl=angle',
  '--use-angle=gl',
  '--ignore-gpu-blocklist',
  '--no-sandbox',
  '--disable-dev-shm-usage',
  '--hide-scrollbars',
  '--force-color-profile=srgb',
  '--force-device-scale-factor=1',
]

async function capture(browser, query) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  page.setDefaultTimeout(120_000)
  await page.goto(harnessUrl(BASE, query), { waitUntil: 'load', timeout: 60_000 })
  await waitForApp(page)

  const geometry = await page.evaluate((id) => {
    const el = document.querySelector(`[data-act="${id}"]`)
    return el ? { top: el.offsetTop, height: el.offsetHeight } : null
  }, ACT)

  if (geometry) {
    const y = geometry.top + geometry.height * AT
    await page.evaluate((target) => {
      window.__confinement?.lenis.scrollTo(target, { immediate: true })
      window.scrollTo(0, target)
    }, y)
    await page.waitForTimeout(2600)
  }

  const buffer = await page.screenshot()
  await page.close()
  return buffer.toString('base64')
}

async function measure(browser, base64) {
  const page = await browser.newPage()
  const stats = await page.evaluate(async (src) => {
    const image = new Image()
    image.src = src
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(image, 0, 0)
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data

    let sum = 0
    let max = 0
    let min = 255
    let lit = 0
    let blown = 0
    const total = canvas.width * canvas.height
    for (let i = 0; i < total; i += 1) {
      const v = 0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2]
      sum += v
      if (v > max) max = v
      if (v < min) min = v
      if (v > 40) lit += 1
      if (v > 240) blown += 1
    }
    return { mean: sum / total, min, max, lit: lit / total, blown: blown / total }
  }, `data:image/png;base64,${base64}`)
  await page.close()
  return stats
}

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome-stable',
  args: BASE_ARGS,
})

console.log(`\nExposure probe — act "${ACT}" at ${AT * 100}% of its scroll length\n`)
console.log('  variant                      mean    min    max    lit>40   blown>240')
console.log('  ' + '-'.repeat(70))

for (const variant of VARIANTS) {
  try {
    const base64 = await capture(browser, variant.query)
    const stats = await measure(browser, base64)
    console.log(
      `  ${variant.label} ${stats.mean.toFixed(1).padStart(6)} ${String(stats.min).padStart(6)}` +
        ` ${String(stats.max).padStart(6)} ${(stats.lit * 100).toFixed(1).padStart(7)}%` +
        ` ${(stats.blown * 100).toFixed(2).padStart(9)}%`,
    )
  } catch (error) {
    console.log(`  ${variant.label} failed: ${error.message.split('\n')[0]}`)
  }
}

await browser.close()
console.log()