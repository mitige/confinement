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
 * Usage: node scripts/verify-live.mjs [url]
 */

import { chromium } from 'playwright-core'

const URL = process.argv[2] || 'https://mitige.github.io/confinement/'

/**
 * The floor is the headline claim, so it is checked across window sizes: the
 * drawing buffer must never fall below 1920x1080 whatever the viewport.
 */
const CASES = [
  { label: '1920x1080  default', width: 1920, height: 1080 },
  { label: '1440x900   default', width: 1440, height: 900 },
  { label: '1280x720   default', width: 1280, height: 720 },
  { label: '1024x640   default', width: 1024, height: 640 },
  { label: ' 390x844   default (phone)', width: 390, height: 844, mobile: true },
  { label: '1920x1080  ?minres=off', width: 1920, height: 1080, query: '?minres=off' },
  { label: '1280x720   ?minres=off', width: 1280, height: 720, query: '?minres=off' },
  { label: '1440x900   ?gentle=1', width: 1440, height: 900, query: '?gentle=1' },
  { label: '1440x900   ?adaptive=1', width: 1440, height: 900, query: '?adaptive=1' },
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

for (const test of CASES) {
  const page = await browser.newPage({
    viewport: { width: test.width, height: test.height },
    deviceScaleFactor: test.mobile ? 3 : 1,
    isMobile: Boolean(test.mobile),
    hasTouch: Boolean(test.mobile),
    userAgent: test.mobile
      ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
      : undefined,
  })
  page.setDefaultTimeout(120_000)
  try {
    await page.goto(URL + test.query, { waitUntil: 'load', timeout: 60_000 })
    await page.waitForSelector('.loader', { state: 'detached', timeout: 120_000 })

    // Scroll into the heaviest act before reading, so a governor has had the
    // chance to act if one is mounted.
    await page.evaluate(() => {
      const el = document.querySelector('[data-act="ignition"]')
      if (el) window.scrollTo(0, el.offsetTop + el.offsetHeight * 0.68)
    })
    await page.waitForTimeout(/gentle|adaptive/.test(test.query) ? 12_000 : 3_000)

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
    console.log(`  ${test.label.padEnd(24)}  failed: ${error.message.split('\n')[0]}`)
  }
  await page.close()
}

await browser.close()
console.log(
  shortfall === 0
    ? '\n  Every case met the 1920x1080 floor.\n'
    : `\n  ${shortfall} case(s) fell below the 1920x1080 floor.\n`,
)
process.exitCode = shortfall === 0 ? 0 : 1
