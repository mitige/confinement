/**
 * Headless verification harness.
 *
 * Screenshots each act at a deterministic scroll position so framing, exposure and
 * material believability can actually be reviewed rather than assumed. Also fails
 * loudly on console errors and page exceptions, which is the cheapest way to catch
 * a broken shader or a bad geometry attribute.
 *
 * Usage:
 *   node scripts/shoot.mjs                     # every act
 *   node scripts/shoot.mjs ignition magnets    # named acts only
 *   node scripts/shoot.mjs --width 390 --height 844   # mobile pass
 */

import { chromium } from 'playwright-core'
import { mkdir, readdir, rm } from 'node:fs/promises'
import path from 'node:path'

const URL = process.env.PREVIEW_URL || 'http://127.0.0.1:5273/'
const OUT = path.resolve('shots')

/** Viewport and settle time are overridable so the same harness runs mobile. */
const args = process.argv.slice(2)
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? Number(args[i + 1]) : fallback
}
const WIDTH = flag('width', 1440)
const HEIGHT = flag('height', 900)
const SETTLE = flag('settle', 2600)
const MOBILE = args.includes('--mobile')
const REDUCED = args.includes('--reduced')
const SUFFIX = MOBILE ? '-mobile' : REDUCED ? '-reduced' : ''

const requested = args.filter((a) => !a.startsWith('--') && Number.isNaN(Number(a)))

/**
 * Each entry is a scroll fraction through the act, chosen to land on the moment
 * that act exists for rather than on its first frame.
 *
 * Note: an act's progress range is half-open, so a fraction of exactly 1.0 lands
 * on the first frame of the NEXT act. End-of-act shots use 0.94-0.96.
 */
const SHOTS = [
  { id: 'overture', at: 0.85 },
  { id: 'plate-01', at: 0.5 },
  { id: 'scale', at: 0.62 },
  { id: 'plate-02', at: 0.5 },
  { id: 'magnets', at: 0.55 },
  { id: 'magnets', at: 0.96, name: 'magnets-close' },
  { id: 'plate-03', at: 0.5 },
  { id: 'vessel', at: 0.72 },
  { id: 'ignition', at: 0.68 },
  { id: 'ignition', at: 0.94, name: 'ignition-close' },
  { id: 'plate-04', at: 0.5 },
  { id: 'project-humanity', at: 0.75 },
  { id: 'project-judas', at: 0.8 },
  { id: 'project-all-seeing-eye', at: 0.85 },
  { id: 'project-c-man', at: 0.85 },
  { id: 'project-prometheus', at: 0.8 },
  { id: 'project-nana', at: 0.85 },
  { id: 'grid', at: 0.6 },
  { id: 'coda', at: 0.9 },
]

const selected = requested.length
  ? SHOTS.filter((shot) => requested.includes(shot.id) || requested.includes(shot.name))
  : SHOTS

async function main() {
  await mkdir(OUT, { recursive: true })

  /*
   * Clear only this pass's own screenshots. Wiping the directory wholesale would
   * mean the mobile and reduced-motion passes each destroy the desktop pass's
   * output, which makes it impossible to review them side by side.
   */
  const suffixOf = (name) =>
    name.includes('-mobile') ? '-mobile' : name.includes('-reduced') ? '-reduced' : ''
  for (const entry of await readdir(OUT)) {
    if (!entry.endsWith('.png')) continue
    if (suffixOf(entry) === SUFFIX) await rm(path.join(OUT, entry), { force: true })
  }

  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome-stable',
    args: [
      /*
       * Reach the real GPU through ANGLE over EGL. This machine has a Radeon 610M
       * with a render node, and headless Chrome can use it — which matters,
       * because software rasterisation of this scene is far too slow to review
       * dozens of acts. scripts/probe.mjs verifies which backend is in use.
       */
      '--use-gl=angle',
      '--use-angle=gl',
      '--ignore-gpu-blocklist',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--hide-scrollbars',
      '--force-color-profile=srgb',
      '--force-device-scale-factor=1',
    ],
  })

  const page = await browser.newPage({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
    /*
     * Reduced motion is a real code path, not a flag on the renderer: the scroll
     * director skips Lenis entirely and the camera rig drops its damping. It has
     * to be screenshotted like any other configuration.
     */
    reducedMotion: REDUCED ? 'reduce' : 'no-preference',
  })
  page.setDefaultTimeout(120_000)

  const problems = []
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      problems.push(`[console.${message.type()}] ${message.text()}`)
    }
  })
  page.on('pageerror', (error) => {
    problems.push(`[pageerror] ${error.message}`)
  })

  await page.goto(URL, { waitUntil: 'load', timeout: 60_000 })

  // Wait for the preloader to unmount, which only happens once frames are on screen.
  await page.waitForSelector('.loader', { state: 'detached', timeout: 90_000 })

  // Guard against the app crashing before render: 'detached' also matches a
  // selector that never existed, which would otherwise look like success.
  const actCount = await page.evaluate(
    () => document.querySelectorAll('[data-act]').length,
  )
  if (actCount === 0) {
    await page.screenshot({ path: path.join(OUT, 'FAILED-render.png') })
    console.error(
      '\nThe app never rendered its scroll track. A screenshot of the failure was saved.',
    )
    for (const problem of problems) console.error(`  ${problem}`)
    await browser.close()
    process.exit(1)
  }
  console.log(`Rendered ${actCount} acts.`)

  const actGeometry = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-act]')).map((el) => ({
      id: el.dataset.act,
      top: el.offsetTop,
      height: el.offsetHeight,
    })),
  )
  const byId = new Map(actGeometry.map((entry) => [entry.id, entry]))

  const results = []
  for (const shot of selected) {
    const act = byId.get(shot.id)
    if (!act) {
      problems.push(`[harness] unknown act: ${shot.id}`)
      continue
    }

    const target = act.top + act.height * shot.at
    await page.evaluate((y) => {
      window.__confinement?.lenis.scrollTo(y, { immediate: true })
      window.scrollTo(0, y)
    }, target)

    // The camera, machine fades and lighting rigs are all damped; let them settle.
    await page.waitForTimeout(SETTLE)

    const name = shot.name || shot.id
    await page.screenshot({ path: path.join(OUT, `${name}${SUFFIX}.png`) })
    results.push(`${name}${SUFFIX}.png`)
  }

  // A whole-document scroll pass, to catch anything that only breaks in motion.
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(400)

  await browser.close()

  console.log(`\nScreenshots written to ${OUT}`)
  for (const name of results) console.log(`  ${name}`)

  if (problems.length) {
    console.log(`\n${problems.length} problem(s) reported by the page:`)
    for (const problem of [...new Set(problems)]) console.log(`  ${problem}`)
    process.exitCode = 1
  } else {
    console.log('\nNo console errors or page exceptions.')
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})