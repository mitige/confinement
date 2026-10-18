/**
 * Motion verification.
 *
 * The camera's "life" — the idle drift and the pointer parallax — is invisible in a
 * screenshot, so it is measured instead: park the pointer and watch whether the
 * camera keeps moving, then move the pointer and watch whether the camera answers.
 *
 * Also checks that both are off under `prefers-reduced-motion`, and that the
 * parallax is expressed in the camera's own frame: a deflection to the right must
 * move the camera along its own right vector, whatever direction it is facing.
 *
 * Reads the camera from the dev-only `window.__r3f` handle, so it needs the dev
 * server.
 *
 * Usage: node scripts/motion.mjs [url]
 */

import { chromium } from 'playwright-core'
import { waitForApp } from './lib/ready.mjs'

const URL = process.argv[2] || 'http://127.0.0.1:5273/'

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome-stable',
  args: ['--use-gl=angle', '--use-angle=gl', '--ignore-gpu-blocklist', '--no-sandbox',
         '--disable-dev-shm-usage', '--hide-scrollbars'],
})

/** Park in the scale act, where the camera is slow and the framing is stable. */
async function settle(page) {
  await waitForApp(page)
  await page.evaluate(() => {
    const el = document.querySelector('[data-act="scale"]')
    if (!el) return
    const y = el.offsetTop + el.offsetHeight * 0.5
    if (window.__confinement?.lenis) window.__confinement.lenis.scrollTo(y, { immediate: true })
    else window.scrollTo(0, y)
  })
  await page.waitForTimeout(4000)
}

const readCamera = (page) =>
  page.evaluate(() => {
    const c = window.__r3f?.camera
    if (!c) return null
    return {
      position: c.position.toArray(),
      // The camera's own right vector, derived from its matrix.
      right: [c.matrixWorld.elements[0], c.matrixWorld.elements[1], c.matrixWorld.elements[2]],
    }
  })

const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

async function run(label, { reduced = false, query = '' } = {}) {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    reducedMotion: reduced ? 'reduce' : 'no-preference',
  })
  page.setDefaultTimeout(120_000)
  await page.goto(URL + query, { waitUntil: 'load', timeout: 60_000 })
  await settle(page)

  const first = await readCamera(page)
  if (!first) {
    console.log(`  ${label.padEnd(28)}  camera handle unavailable`)
    await page.close()
    return
  }

  // Idle drift: pointer parked, so any movement is the drift alone.
  await page.waitForTimeout(8000)
  const drifted = await readCamera(page)

  // Parallax: push the pointer hard to the right, then hard to the left.
  await page.mouse.move(1400, 450)
  await page.waitForTimeout(2500)
  const rightward = await readCamera(page)
  await page.mouse.move(40, 450)
  await page.waitForTimeout(2500)
  const leftward = await readCamera(page)

  const drift = distance(first.position, drifted.position)
  const swing = distance(rightward.position, leftward.position)

  // Did the swing happen along the camera's own right axis?
  const delta = rightward.position.map((v, i) => v - leftward.position[i])
  const length = Math.hypot(...delta) || 1
  const alongRight = Math.abs(
    (delta[0] * rightward.right[0] + delta[1] * rightward.right[1] + delta[2] * rightward.right[2]) /
      length,
  )

  console.log(
    `  ${label.padEnd(28)}  drift ${drift.toFixed(3)} m` +
      `   parallax ${swing.toFixed(3)} m` +
      `   along view-right ${(alongRight * 100).toFixed(0)}%`,
  )

  await page.close()
}

console.log(`\n  ${URL}\n`)
await run('normal')
await run('reduced motion', { reduced: true })
await run('?static=1', { query: '?static=1' })
await browser.close()
console.log(
  '\n  Expected: drift and parallax non-zero normally, near zero under reduced\n' +
    '  motion, and a swing that is almost entirely along the view-right axis.\n',
)
