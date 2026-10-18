/**
 * Click-target audit.
 *
 * Every 2D section is absolutely positioned to fill the viewport, and the links
 * inside them set `pointer-events: auto` — which an ancestor's `pointer-events:
 * none` cannot override. An invisible section therefore swallows clicks across the
 * whole screen, and this is exactly the bug it exists to catch: for each act, ask
 * the document what is actually at the centre of the viewport.
 *
 * Usage: node scripts/click-audit.mjs
 */

import { chromium } from 'playwright-core'
import { harnessUrl, waitForApp } from './lib/ready.mjs'

const BASE = 'http://127.0.0.1:5273/'
const ACTS = [
  'overture', 'plate-01', 'scale', 'plate-02', 'magnets', 'vessel', 'ignition',
  'project-humanity', 'project-judas', 'grid', 'coda',
]

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome-stable',
  args: ['--use-gl=angle', '--use-angle=gl', '--ignore-gpu-blocklist', '--no-sandbox',
         '--disable-dev-shm-usage', '--hide-scrollbars'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.setDefaultTimeout(120_000)
await page.goto(harnessUrl(BASE), { waitUntil: 'load', timeout: 60_000 })
await waitForApp(page)

let failures = 0
for (const act of ACTS) {
  const geometry = await page.evaluate((id) => {
    const el = document.querySelector(`[data-act="${id}"]`)
    return el ? { top: el.offsetTop, height: el.offsetHeight } : null
  }, act)
  if (!geometry) continue

  await page.evaluate((y) => {
    window.__confinement?.lenis.scrollTo(y, { immediate: true })
    window.scrollTo(0, y)
  }, geometry.top + geometry.height * 0.62)
  await page.waitForTimeout(2400)

  // Sample five points across the viewport, including the middle where text sits.
  const hits = await page.evaluate(() => {
    const points = [
      ['centre', 0.5, 0.5], ['left-mid', 0.25, 0.5], ['right-mid', 0.75, 0.5],
      ['upper', 0.5, 0.2], ['lower', 0.5, 0.85],
    ]
    return points.map(([label, fx, fy]) => {
      const el = document.elementFromPoint(window.innerWidth * fx, window.innerHeight * fy)
      const link = el?.closest('a')
      return {
        label,
        tag: el?.tagName ?? 'none',
        cls: (el?.className ?? '').toString().split(' ')[0],
        link: link ? link.getAttribute('href') : null,
      }
    })
  })

  // A click on empty space must not resolve to a repository link.
  const repoHits = hits.filter((h) => h.link && /github\.com\/mitige\/[a-z0-9-]+$/.test(h.link))
  const isRepoAct = act === 'grid'
  const suspicious = repoHits.length > 0 && !isRepoAct

  if (suspicious) failures += 1
  console.log(
    `  [${suspicious ? 'FAIL' : ' ok '}] ${act.padEnd(20)} ` +
      hits.map((h) => (h.link ? `LINK(${h.label})` : h.cls || h.tag)).join('  '),
  )
}

await browser.close()
console.log(
  failures === 0
    ? '\nNo act captures clicks it should not.'
    : `\n${failures} act(s) capture clicks outside their own links.`,
)
process.exitCode = failures === 0 ? 0 : 1
