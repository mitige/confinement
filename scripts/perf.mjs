/**
 * Performance check.
 *
 * Measures the app's own animation loop at the resolutions that matter, including
 * a simulated retina display (devicePixelRatio 2), because the quality tier clamps
 * DPR to 2 on capable machines and that quadruples the fragment work.
 *
 * Also reports live GPU resource counts — geometries, textures and compiled
 * programs — which is where a scene like this usually goes wrong: a geometry
 * allocated inside a render body, or a texture rebuilt every frame, shows up here
 * as a count that grows.
 *
 * Usage: node scripts/perf.mjs
 */

import { chromium } from 'playwright-core'

const BASE = 'http://127.0.0.1:5273/'

const CASES = [
  { label: '1440x900  dpr 1  (high)', width: 1440, height: 900, dpr: 1 },
  { label: '1440x900  dpr 2  (high, retina)', width: 1440, height: 900, dpr: 2 },
  { label: '1920x1080 dpr 1  (high)', width: 1920, height: 1080, dpr: 1 },
  { label: ' 390x844  dpr 3  (mobile)', width: 390, height: 844, dpr: 3, mobile: true },
  { label: '1440x900  dpr 1  reduced-motion', width: 1440, height: 900, dpr: 1, reduced: true },
]

const BASE_ARGS = [
  '--use-gl=angle',
  '--use-angle=gl',
  '--ignore-gpu-blocklist',
  '--no-sandbox',
  '--disable-dev-shm-usage',
  '--hide-scrollbars',
  '--force-color-profile=srgb',
]

async function main() {
  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome-stable',
    args: BASE_ARGS,
  })

  console.log('\n  case                                  fps    geometries  textures  programs')
  console.log('  ' + '-'.repeat(74))

  for (const testCase of CASES) {
    const context = await browser.newContext({
      viewport: { width: testCase.width, height: testCase.height },
      deviceScaleFactor: testCase.dpr,
      reducedMotion: testCase.reduced ? 'reduce' : 'no-preference',
      userAgent: testCase.mobile
        ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
        : undefined,
      isMobile: Boolean(testCase.mobile),
      hasTouch: Boolean(testCase.mobile),
    })
    const page = await context.newPage()
    page.setDefaultTimeout(120_000)

    try {
      await page.goto(BASE, { waitUntil: 'load', timeout: 60_000 })
      await page.waitForSelector('.loader', { state: 'detached', timeout: 90_000 })

      // Measure during the heaviest act, not the opening frame.
      await page.evaluate(() => {
        const el = document.querySelector('[data-act="ignition"]')
        if (el) {
          const y = el.offsetTop + el.offsetHeight * 0.68
          window.__confinement?.lenis.scrollTo(y, { immediate: true })
        }
      })
      await page.waitForTimeout(2600)

      const result = await page.evaluate(
        () =>
          new Promise((resolve) => {
            let frames = 0
            const start = performance.now()
            const tick = () => {
              frames += 1
              const elapsed = performance.now() - start
              if (elapsed > 4000) resolve((frames / elapsed) * 1000)
              else requestAnimationFrame(tick)
            }
            requestAnimationFrame(tick)
          }),
      )

      // three.js keeps its own per-frame counters on the renderer.
      const info = await page.evaluate(() => {
        const renderer = window.__r3f?.gl
        if (!renderer) return null
        return {
          geometries: renderer.info.memory.geometries,
          textures: renderer.info.memory.textures,
          programs: renderer.info.programs?.length ?? 0,
        }
      })

      console.log(
        `  ${testCase.label.padEnd(38)}${result.toFixed(1).padStart(5)}` +
          `    ${String(info?.geometries ?? '-').padStart(10)}` +
          `  ${String(info?.textures ?? '-').padStart(8)}` +
          `  ${String(info?.programs ?? '-').padStart(8)}`,
      )

      /*
       * Verify the adaptive path actually engages, rather than assuming it does.
       * Give the governor time to finish sampling, then check whether the device
       * pixel ratio moved — that is the observable effect of a tier change.
       */
      const before = await page.evaluate(() => window.__r3f?.gl?.getPixelRatio() ?? null)
      await page.waitForTimeout(9000)
      const after = await page.evaluate(() => window.__r3f?.gl?.getPixelRatio() ?? null)
      if (before !== null && after !== null && after !== before) {
        const adapted = await page.evaluate(
          () =>
            new Promise((resolve) => {
              let frames = 0
              const start = performance.now()
              const tick = () => {
                frames += 1
                const elapsed = performance.now() - start
                if (elapsed > 3000) resolve((frames / elapsed) * 1000)
                else requestAnimationFrame(tick)
              }
              requestAnimationFrame(tick)
            }),
        )
        console.log(
          `  ${'  └ governor stepped down'.padEnd(38)}` +
            ` dpr ${before.toFixed(2)} -> ${after.toFixed(2)}, ${adapted.toFixed(1)} fps`,
        )
      }
    } catch (error) {
      console.log(`  ${testCase.label.padEnd(38)}  failed: ${error.message.split('\n')[0]}`)
    }

    await context.close()
  }

  await browser.close()
  console.log()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})