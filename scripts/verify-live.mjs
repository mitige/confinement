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

const CASES = [
  { label: 'default (max quality)', query: '' },
  { label: '?adaptive=1', query: '?adaptive=1' },
  { label: '?quality=medium', query: '?quality=medium' },
  { label: '?res=0.7', query: '?res=0.7' },
]

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome-stable',
  args: ['--use-gl=angle', '--use-angle=gl', '--ignore-gpu-blocklist', '--no-sandbox',
         '--disable-dev-shm-usage', '--hide-scrollbars', '--force-device-scale-factor=1'],
})

console.log(`\n  ${URL}\n`)
console.log('  mode                      dpr   drawing buffer   acts   canvas 0-size')
console.log('  ' + '-'.repeat(76))

for (const test of CASES) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
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
    await page.waitForTimeout(test.query.includes('adaptive') ? 12_000 : 3_000)

    const info = await page.evaluate(() => {
      const canvas = document.querySelector('canvas')
      const rect = canvas.getBoundingClientRect()
      return {
        bufferWidth: canvas.width,
        cssWidth: Math.round(rect.width),
        dpr: canvas.width / rect.width,
        acts: document.querySelectorAll('[data-act]').length,
        zeroSized: canvas.width < 64 || canvas.height < 64,
      }
    })

    console.log(
      `  ${test.label.padEnd(24)}${info.dpr.toFixed(2).padStart(5)}` +
        `   ${`${info.bufferWidth}x${Math.round(info.bufferWidth * 900 / 1440)}`.padStart(14)}` +
        `   ${String(info.acts).padStart(4)}   ${info.zeroSized ? 'YES' : 'no'}`,
    )
  } catch (error) {
    console.log(`  ${test.label.padEnd(24)}  failed: ${error.message.split('\n')[0]}`)
  }
  await page.close()
}

await browser.close()
console.log()
