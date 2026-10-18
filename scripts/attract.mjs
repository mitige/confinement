/**
 * Attract-mode verification.
 *
 * The behaviour is a timing contract, so it is measured rather than eyeballed:
 *
 *   - with the mouse untouched, the page starts moving about five seconds in;
 *   - the moment the mouse moves, it stops — not soon, not quickly, but within a
 *     frame, with no coasting;
 *   - it never runs under prefers-reduced-motion or with `?autoplay=off`;
 *   - and it re-arms, so a second idle period behaves like the first.
 *
 * Needs the dev server, because it reads the live attract state from the
 * dev-only handle.
 *
 * Usage: node scripts/attract.mjs [url]
 */

import { chromium } from 'playwright-core'
import { waitForApp } from './lib/ready.mjs'

const URL = process.argv[2] || 'http://127.0.0.1:5273/'

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome-stable',
  args: ['--use-gl=angle', '--use-angle=gl', '--ignore-gpu-blocklist', '--no-sandbox',
         '--disable-dev-shm-usage', '--hide-scrollbars'],
})

const readY = (page) => page.evaluate(() => window.scrollY)

/** Sample scrollY repeatedly and report the total distance travelled. */
async function travel(page, ms, step = 250) {
  const start = await readY(page)
  let previous = start
  const samples = []
  const until = Date.now() + ms
  while (Date.now() < until) {
    await page.waitForTimeout(step)
    const now = await readY(page)
    samples.push(now - previous)
    previous = now
  }
  return { distance: previous - start, samples }
}

let failures = 0
const expect = (label, ok, detail) => {
  if (!ok) failures += 1
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${label}${detail ? `: ${detail}` : ''}`)
}

async function open(query = '', reduced = false) {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    reducedMotion: reduced ? 'reduce' : 'no-preference',
  })
  page.setDefaultTimeout(120_000)
  await page.goto(URL + query, { waitUntil: 'load', timeout: 60_000 })
  await waitForApp(page)
  return page
}

/* --------------------------------------------------- 1. it starts on its own */
console.log('\n  idle behaviour')
{
  const page = await open()
  // Before the threshold: nothing should move.
  const early = await travel(page, 3000, 500)
  expect('stays still for the first seconds', early.distance === 0, `${early.distance} px`)

  // Past the threshold: it should be moving.
  const engaged = await travel(page, 9000, 500)
  expect('starts moving on its own after the idle delay', engaged.distance > 200,
    `${engaged.distance} px in 9 s`)

  const rate = engaged.distance / 9
  console.log(`         speed ${rate.toFixed(0)} px/s (${(rate / 9).toFixed(1)} vh/s)`)

  /* ------------------------------------------------ 2. it stops immediately */
  await page.mouse.move(700, 450)
  await page.waitForTimeout(60)
  const immediately = await travel(page, 1200, 200)
  expect('stops within a frame of the mouse moving', Math.abs(immediately.distance) <= 2,
    `${immediately.distance} px over the next 1.2 s`)

  // The dev build exposes the internal engagement; the production bundle does not,
  // so this check is skipped rather than failed when running against the live site.
  const engagement = await page.evaluate(() => window.__confinement?.attract?.engagement ?? null)
  if (engagement !== null) {
    expect('engagement returns to zero', engagement === 0, String(engagement))
  }

  /* --------------------------------------------------- 3. it re-arms */
  const second = await travel(page, 9000, 500)
  expect('re-arms after the mouse settles again', second.distance > 200,
    `${second.distance} px in 9 s`)

  await page.close()
}

/* ------------------------------------------ 4. reduced motion and opt-out */
console.log('\n  opt-outs')
{
  const page = await open('', true)
  const still = await travel(page, 9000, 500)
  expect('never runs under prefers-reduced-motion', still.distance === 0, `${still.distance} px`)
  await page.close()
}
{
  const page = await open('?autoplay=off')
  const still = await travel(page, 9000, 500)
  expect('never runs with ?autoplay=off', still.distance === 0, `${still.distance} px`)
  await page.close()
}

await browser.close()
console.log(
  failures === 0
    ? '\n  Attract mode behaves as specified.\n'
    : `\n  ${failures} check(s) failed.\n`,
)
process.exitCode = failures === 0 ? 0 : 1
