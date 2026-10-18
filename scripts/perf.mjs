/**
 * Performance check.
 *
 * Measures the app's own animation loop at the resolutions that matter, including
 * a simulated retina display, because the quality tier clamps DPR to 2 on capable
 * machines and that quadruples the fragment work.
 *
 * Reports two things per case: the frame rate once the dynamic-resolution
 * governor has settled, and the device pixel ratio it settled on. The second
 * number is the interesting one — it says how much resolution the machine was
 * willing to give up to reach a smooth frame rate.
 *
 * Also reports live GPU resource counts, which is where a scene like this usually
 * goes wrong: a geometry allocated inside a render body, or a texture rebuilt
 * every frame, shows up here as a count that grows.
 *
 * Usage: node scripts/perf.mjs
 *        PREVIEW_URL=http://127.0.0.1:5277/ node scripts/perf.mjs
 */

import { chromium } from 'playwright-core'
import { harnessUrl, waitForApp } from './lib/ready.mjs'

// Same override as the screenshot harness, so either can point at a preview
// build, a dev server or the deployed site.
const BASE = process.env.PREVIEW_URL || 'http://127.0.0.1:5273/'

/** The heaviest act: the plasma at full intensity inside ghosted steel. */
const HEAVY_ACT = 'ignition'
const HEAVY_AT = 0.68

const CASES = [
  // The default across display densities: the lower rows are the machines where
  // adaptation costs nothing, because the screen never had that detail to show.
  { label: '1920x1080 dpr 1.00 default', width: 1920, height: 1080, dpr: 1 },
  { label: '1920x1080 dpr 1.25 default', width: 1920, height: 1080, dpr: 1.25 },
  { label: '1440x900  dpr 2.00 default', width: 1440, height: 900, dpr: 2 },
  { label: '1920x1080 ?static=1', width: 1920, height: 1080, dpr: 1, query: '?static=1' },
  { label: '1920x1080 ?adaptive=1', width: 1920, height: 1080, dpr: 1, query: '?adaptive=1' },
  { label: '1920x1080 msaa=4 (old AA)', width: 1920, height: 1080, dpr: 1, query: '?msaa=4&aa=off' },
  { label: ' 390x844  dpr 3  default', width: 390, height: 844, dpr: 3, mobile: true },
  { label: '1920x1080 reduced-motion', width: 1920, height: 1080, dpr: 1, reduced: true },
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

/**
 * Sample the app's rAF loop and report the shape of the frame time, not just its
 * mean.
 *
 * Mean frame rate hides the thing that actually reads as "not smooth": a handful
 * of long frames. A run averaging 55 fps with a 2% tail of 90 ms hitches looks far
 * worse than a steady 45 fps. So this reports the median, the 95th and 99th
 * percentiles, the worst single frame, and p95 over median. A steady 30 fps lock is
 * smooth; a run averaging 40 fps while alternating 20 and 80 ms frames is not, and
 * only the distribution shows the difference. A p95/median of 1.00 means perfectly
 * even pacing.
 */
const measure = (page, ms) =>
  page.evaluate(
    (duration) =>
      new Promise((resolve) => {
        const times = []
        let last = performance.now()
        const start = last
        const tick = (now) => {
          times.push(now - last)
          last = now
          if (now - start > duration) {
            // Drop the first sample: it spans the setup between frames.
            const deltas = times.slice(1).sort((a, b) => a - b)
            const at = (q) => deltas[Math.min(deltas.length - 1, Math.floor(deltas.length * q))]
            const total = deltas.reduce((sum, d) => sum + d, 0)
            resolve({
              fps: (deltas.length / total) * 1000,
              median: at(0.5),
              p95: at(0.95),
              p99: at(0.99),
              worst: deltas[deltas.length - 1],
              /* p95 over median: 1.00 is a perfectly even lock, 1.5 means every
                 tenth frame runs half again as long. This is the number that
                 actually correlates with the motion reading as smooth. */
              evenness: at(0.95) / at(0.5),
              frames: deltas.length,
            })
          } else {
            requestAnimationFrame(tick)
          }
        }
        requestAnimationFrame(tick)
      }),
    ms,
  )

async function main() {
  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome-stable',
    args: BASE_ARGS,
  })

  console.log(
    '\n  case                              fps   median    p95    p99   worst  p95/med   dpr',
  )
  console.log('  ' + '-'.repeat(96))

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
    page.setDefaultTimeout(180_000)

    try {
      await page.goto(harnessUrl(BASE, testCase.query ?? ''), { waitUntil: 'load', timeout: 60_000 })
      await waitForApp(page)

      await page.evaluate(
        ({ act, at }) => {
          const el = document.querySelector(`[data-act="${act}"]`)
          if (!el) return
          const y = el.offsetTop + el.offsetHeight * at
          // Drive Lenis when it exists, and fall back to the native scroll
          // otherwise: the reduced-motion path has no Lenis instance, and without
          // this the case silently measured the opening act instead of the
          // heaviest one.
          if (window.__confinement?.lenis) window.__confinement.lenis.scrollTo(y, { immediate: true })
          else window.scrollTo(0, y)
        },
        { act: HEAVY_ACT, at: HEAVY_AT },
      )

      /*
       * Let the governor converge before measuring: it steps in 0.5s windows and
       * climbs slowly, so it needs several seconds to settle from a cold start.
       */
      await page.waitForTimeout(10_000)

      const timing = await measure(page, 6000)
      const info = await page.evaluate(() => {
        const renderer = window.__r3f?.gl
        if (!renderer) return null
        const dpr = renderer.getPixelRatio()
        return {
          dpr,
          width: Math.round(window.innerWidth * dpr),
          height: Math.round(window.innerHeight * dpr),
          geometries: renderer.info.memory.geometries,
          textures: renderer.info.memory.textures,
        }
      })

      console.log(
        `  ${testCase.label.padEnd(34)}${timing.fps.toFixed(1).padStart(5)}` +
          `  ${timing.median.toFixed(1).padStart(6)}` +
          `  ${timing.p95.toFixed(1).padStart(5)}` +
          `  ${timing.p99.toFixed(1).padStart(5)}` +
          `  ${timing.worst.toFixed(0).padStart(6)}` +
          `  ${timing.evenness.toFixed(2).padStart(5)}` +
          `  ${(info?.dpr ?? 0).toFixed(2).padStart(4)}`,
      )
    } catch (error) {
      console.log(`  ${testCase.label.padEnd(34)}  failed: ${error.message.split('\n')[0]}`)
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
