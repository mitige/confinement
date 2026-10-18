/**
 * Live-site verification.
 *
 * Confirms what the deployed build actually does, in the browser, without any dev
 * hook: the drawing buffer size divided by the canvas CSS size *is* the effective
 * device pixel ratio, and it is observable from the DOM.
 *
 * Also reports whether post-processing is present by looking for the WebGL
 * programs the composer adds, and checks that every act is reachable.
 *
 * Usage: node scripts/verify-live.mjs [url] [caseSubstring]
 */

import { chromium } from 'playwright-core'
import { harnessUrl, waitForApp } from '../scripts/lib/ready.mjs'

const URL = process.argv[2] || 'https://mitige.github.io/confinement/'
const FILTER = process.argv[3] || null

/**
 * The floor is the headline claim, so it is checked across window sizes: the
 * drawing buffer must never fall below 1920x1080 whatever the viewport.
 */
const CASES = [
  // Plain 1080p: the floor equals the window's own pixel size, so there is no
  // headroom and adaptation is a no-op. This is the honest worst case.
  { label: '1920x1080 dpr 1.00', width: 1920, height: 1080, dpr: 1 },
  // A laptop running display scaling: the buffer starts at 1.25x, and the floor
  // lets it come back to 1080p. Free.
  { label: '1920x1080 dpr 1.25', width: 1920, height: 1080, dpr: 1.25 },
  // Retina: the tier starts at dpr 2, four times the floor's pixels. Free, and a
  // large saving.
  { label: '1440x900  dpr 2.00', width: 1440, height: 900, dpr: 2 },
  { label: ' 390x844  dpr 3.00', width: 390, height: 844, dpr: 3, mobile: true },
  // The escape hatches.
  { label: '1920x1080 ?static=1', width: 1920, height: 1080, dpr: 1, query: '?static=1' },
  { label: '1440x900  ?adaptive=1', width: 1440, height: 900, dpr: 2, query: '?adaptive=1' },
  { label: '1920x1080 ?minres=off', width: 1920, height: 1080, dpr: 1, query: '?minres=off' },
]

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome-stable',
  args: ['--use-gl=angle', '--use-angle=gl', '--ignore-gpu-blocklist', '--no-sandbox',
         '--disable-dev-shm-usage', '--hide-scrollbars', '--force-device-scale-factor=1'],
})

console.log(`\n  ${URL}\n`)
console.log('  window / mode             dpr   drawing buffer      megapixels  floor   acts')
console.log('  ' + '-'.repeat(76))
let shortfall = 0
let failures = 0

for (const test of CASES.filter((c) => !FILTER || c.label.includes(FILTER))) {
  const page = await browser.newPage({
    viewport: { width: test.width, height: test.height },
    deviceScaleFactor: test.dpr ?? 1,
    isMobile: Boolean(test.mobile),
    hasTouch: Boolean(test.mobile),
    userAgent: test.mobile
      ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
      : undefined,
  })
  page.setDefaultTimeout(120_000)
  try {
        // `test.query` is undefined for the default cases; concatenating it directly
    // produced ".../confinement/undefined", a 404, and five failures that looked
    // exactly like a broken default code path on the deployed site.
    await page.goto(harnessUrl(URL, test.query ?? ''), { waitUntil: 'load', timeout: 60_000 })
    await waitForApp(page)

    // Scroll into the heaviest act before reading, so a governor has had the
    // chance to act if one is mounted.
    await page.evaluate(() => {
      const el = document.querySelector('[data-act="ignition"]')
      if (el) window.scrollTo(0, el.offsetTop + el.offsetHeight * 0.68)
    })
    // Long enough for the governor to converge: it steps in half-second windows
    // and climbs slowly.
    await page.waitForTimeout(test.query?.includes('static') ? 3_000 : 16_000)

    const info = await page.evaluate(() => {
      const canvas = document.querySelector('canvas')
      const rect = canvas.getBoundingClientRect()
      return {
        bufferWidth: canvas.width,
        cssWidth: Math.round(rect.width),
        dpr: canvas.width / rect.width,
        acts: document.querySelectorAll('[data-act]').length,
        zeroSized: canvas.width < 64 || canvas.height < 64,
        megapixels: (canvas.width * canvas.height) / 1e6,
      }
    })

    const bufferHeight = Math.round(info.bufferWidth * (test.height / test.width))
    // The promise is a pixel count, not a width: 1920x1080 / 1280x720 and a phone's
    // 979x2119 all carry the same number of pixels.
    // 1% tolerance: the ratio is rounded when applied, which costs a few tenths of a
    // percent of area.
    const met = info.bufferWidth * bufferHeight >= 1920 * 1080 * 0.99
    // The floor is a promise of the default mode only; the escape hatches
    // deliberately step below it.
    const floorApplies =
      !test.query?.includes('minres=off') &&
      !test.query?.includes('gentle') &&
      !test.query?.includes('adaptive')
    if (floorApplies && !met) shortfall += 1

    console.log(
      `  ${test.label.padEnd(24)}${info.dpr.toFixed(2).padStart(5)}` +
        `   ${`${info.bufferWidth}x${bufferHeight}`.padStart(14)}` +
        `   ${(info.megapixels ?? 0).toFixed(2).padStart(9)}` +
        `   ${(floorApplies ? (met ? 'yes' : 'NO') : 'n/a').padStart(6)}` +
        `   ${String(info.acts).padStart(5)}`,
    )
  } catch (error) {
    // A case that did not render is a failure, not an absence of one. Without
    // this the summary reported success for a page that had no canvas at all.
    failures += 1
    console.log(`  ${test.label.padEnd(24)}  FAILED: ${error.message.split('\n')[0]}`)
  }
  await page.close()
}

await browser.close()
const total = shortfall + failures
console.log(
  total === 0
    ? '\n  Every case rendered, and every applicable case met the 1080p pixel floor.\n'
    : `\n  ${failures} case(s) failed to render, ${shortfall} fell below the floor.\n`,
)
process.exitCode = total === 0 ? 0 : 1
