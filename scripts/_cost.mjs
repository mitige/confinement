import { chromium } from 'playwright-core'
import { waitForApp } from './lib/ready.mjs'

const BASE = process.env.PREVIEW_URL || 'http://127.0.0.1:5277/'
const ARGS = ['--use-gl=angle','--use-angle=gl','--ignore-gpu-blocklist','--no-sandbox','--disable-dev-shm-usage','--hide-scrollbars','--force-device-scale-factor=1']
const CASES = [
  ['bloom levels 8 (default)', ''],
  ['bloom levels 6', '?bloomlevels=6'],
  ['bloom levels 5', '?bloomlevels=5'],
  ['bloom levels 4', '?bloomlevels=4'],
  ['bloom off', '?bloom=off'],
  ['aniso 1 (vs 4)', '?aniso=1'],
]

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome-stable', args: ARGS })
console.log('\n  config                          fps   median    p95   worst   buffer')
console.log('  ' + '-'.repeat(76))
for (const [label, query] of CASES) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })
  page.setDefaultTimeout(180000)
  try {
    await page.goto(BASE + query, { waitUntil: 'load', timeout: 60000 })
    await waitForApp(page)
    await page.evaluate(() => {
      const el = document.querySelector('[data-act="ignition"]')
      if (!el) return
      const y = el.offsetTop + el.offsetHeight * 0.68
      if (window.__confinement?.lenis) window.__confinement.lenis.scrollTo(y, { immediate: true })
      else window.scrollTo(0, y)
    })
    await page.waitForTimeout(6000)
    const r = await page.evaluate(() => new Promise((res) => {
      const t = []; let last = performance.now(); const start = last
      const tick = (now) => {
        t.push(now - last); last = now
        if (now - start > 5000) {
          const d = t.slice(1).sort((a, b) => a - b)
          const at = (q) => d[Math.min(d.length - 1, Math.floor(d.length * q))]
          const total = d.reduce((s, v) => s + v, 0)
          const c = document.querySelector('canvas')
          res({ fps: (d.length / total) * 1000, median: at(0.5), p95: at(0.95), worst: d[d.length - 1],
                buffer: `${c.width}x${c.height}` })
        } else requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }))
    console.log(`  ${label.padEnd(30)}${r.fps.toFixed(1).padStart(5)}  ${r.median.toFixed(1).padStart(6)}  ${r.p95.toFixed(1).padStart(5)}  ${r.worst.toFixed(0).padStart(5)}   ${r.buffer.padStart(10)}`)
  } catch (e) {
    console.log(`  ${label.padEnd(30)}  failed: ${e.message.split('\n')[0].slice(0, 50)}`)
  }
  await page.close()
}
await browser.close()
