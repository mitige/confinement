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
 */

import { chromium } from 'playwright-core'

const BASE = 'http://127.0.0.1:5273/'

/** The heaviest act: the plasma at full intensity inside ghosted steel. */
const HEAVY_ACT = 'ignition'
const HEAVY_AT = 0.68

const CASES = [
  { label: '1440x900  governor OFF', width: 1440, height: 900, dpr: 1, query: '?res=1' },
  { label: '1440x900  governor ON', width: 1440, height: 900, dpr: 1 },
  { label: '1440x900  dpr 2  governor ON', width: 1440, height: 900, dpr: 2 },
  { label: '1920x1080 governor ON', width: 1920, height: 1080, dpr: 1 },
  { label: ' 390x844  dpr 3  governor ON', width: 390, height: 844, dpr: 3, mobile: true },
  { label: '1440x900  reduced-motion', width: 1440, height: 900, dpr: 1, reduced: true },
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

/** Average the app's rAF loop over `ms`. */
const measure = (page, ms) =>
  page.evaluate(
    (duration) =>
      new Promise((resolve) => {
        let frames = 0
        const start = performance.now()
        const tick = () => {
          frames += 1
          const elapsed = performance.now() - start
          if (elapsed > duration) resolve((frames / elapsed) * 1000)
          else requestAnimationFrame(tick)
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
    '\n  case                              fps   final dpr   resolution   geometries textures',
  )
  console.log('  ' + '-'.repeat(86))

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
      await page.goto(BASE + (testCase.query ?? ''), { waitUntil: 'load', timeout: 60_000 })
      await page.waitForSelector('.loader', { state: 'detached', timeout: 120_000 })

      await page.evaluate(
        ({ act, at }) => {
          const el = document.querySelector(`[data-act="${act}"]`)
          if (el) window.__confinement?.lenis.scrollTo(el.offsetTop + el.offsetHeight * at, { immediate: true })
        },
        { act: HEAVY_ACT, at: HEAVY_AT },
      )

      /*
       * Let the governor converge before measuring: it steps in 0.5s windows and
       * climbs slowly, so it needs several seconds to settle from a cold start.
       */
      await page.waitForTimeout(10_000)

      const fps = await measure(page, 5000)
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
        `  ${testCase.label.padEnd(34)}${fps.toFixed(1).padStart(5)}` +
          `   ${(info?.dpr ?? 0).toFixed(2).padStart(9)}` +
          `   ${`${info?.width}x${info?.height}`.padStart(11)}` +
          `   ${String(info?.geometries ?? '-').padStart(10)}` +
          `   ${String(info?.textures ?? '-').padStart(8)}`,
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
