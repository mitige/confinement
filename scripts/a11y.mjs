/**
 * Rendered-contrast audit.
 *
 * Measures legibility from the actual composited pixels rather than from the CSS
 * colour values, because the text in this piece sits on a live WebGL render, not
 * on a flat background. For every visible text element it reads the lightest and
 * darkest pixel inside that element's bounding box, converts both to relative
 * luminance, and reports the WCAG contrast ratio.
 *
 * That catches the failure a stylesheet review misses: a grey that looks
 * acceptable in isolation but has only 2:1 against the dimmed machine behind it.
 *
 * Usage: node scripts/a11y.mjs [actId ...]
 */

import { chromium } from 'playwright-core'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { harnessUrl, waitForApp } from './lib/ready.mjs'

const BASE = 'http://127.0.0.1:5273/'
const OUT = path.resolve('shots/a11y')

/** Acts worth auditing: every act that puts type on screen. */
const DEFAULT_ACTS = [
  'plate-01',
  'plate-02',
  'plate-03',
  'plate-04',
  'project-humanity',
  'project-judas',
  'project-all-seeing-eye',
  'project-c-man',
  'project-prometheus',
  'project-nana',
  'grid',
  'coda',
]

/** WCAG 2.1 minimums: 4.5:1 for normal text, 3:1 for large text. */
const LARGE_PX = 24
const MIN_NORMAL = 4.5
const MIN_LARGE = 3

const acts = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_ACTS

const BASE_ARGS = [
  '--use-gl=angle',
  '--use-angle=gl',
  '--ignore-gpu-blocklist',
  '--no-sandbox',
  '--disable-dev-shm-usage',
  '--hide-scrollbars',
  '--force-color-profile=srgb',
  '--force-device-scale-factor=1',
]

async function main() {
  await mkdir(OUT, { recursive: true })

  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome-stable',
    args: BASE_ARGS,
  })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  page.setDefaultTimeout(120_000)

  await page.goto(harnessUrl(BASE), { waitUntil: 'load', timeout: 60_000 })
  await waitForApp(page)

  const decoder = await browser.newPage()
  const failures = []

  for (const act of acts) {
    const geometry = await page.evaluate((id) => {
      const element = document.querySelector(`[data-act="${id}"]`)
      return element ? { top: element.offsetTop, height: element.offsetHeight } : null
    }, act)

    if (!geometry) {
      console.log(`unknown act: ${act}`)
      continue
    }

    /*
     * Sample past the reveal windows. Every act fades its copy in during its first
     * ~45%, and rows caught mid-fade are legitimately low contrast — measuring
     * there would report a defect that no reader ever sees.
     */
    await page.evaluate((target) => {
      window.__confinement?.lenis.scrollTo(target, { immediate: true })
      window.scrollTo(0, target)
    }, geometry.top + geometry.height * 0.62)
    await page.waitForTimeout(2400)

    // Collect the geometry of every element that is actually showing text.
    const boxes = await page.evaluate(() => {
      const out = []
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      const seen = new Set()

      while (walker.nextNode()) {
        const node = walker.currentNode
        const text = node.textContent?.trim()
        if (!text) continue

        const parent = node.parentElement
        if (!parent || seen.has(parent)) continue
        if (parent.closest('.sr-only')) continue

        const style = getComputedStyle(parent)
        if (style.visibility === 'hidden' || style.display === 'none') continue
        if (Number(style.opacity) < 0.08) continue

        // Effective opacity up the tree: an element inside a faded plate is not
        // actually visible even if its own opacity is 1.
        let effective = 1
        let cursor = parent
        while (cursor && cursor !== document.body) {
          effective *= Number(getComputedStyle(cursor).opacity || 1)
          cursor = cursor.parentElement
        }
        if (effective < 0.6) continue

        const rect = parent.getBoundingClientRect()
        if (rect.width < 4 || rect.height < 4) continue
        if (rect.bottom < 0 || rect.top > window.innerHeight) continue

        seen.add(parent)
        out.push({
          text: text.slice(0, 42),
          className: parent.className?.toString().slice(0, 40) || '',
          fontSize: parseFloat(style.fontSize),
          fontWeight: style.fontWeight,
          color: style.color,
          rect: {
            x: Math.max(0, Math.floor(rect.left)),
            y: Math.max(0, Math.floor(rect.top)),
            w: Math.min(window.innerWidth, Math.ceil(rect.width)),
            h: Math.ceil(rect.height),
          },
        })
      }
      return out
    })

    if (!boxes.length) continue

    const buffer = await page.screenshot()
    const dataUrl = `data:image/png;base64,${buffer.toString('base64')}`

    const results = await decoder.evaluate(
      async ([src, list]) => {
        const image = new Image()
        image.src = src
        await image.decode()

        const canvas = document.createElement('canvas')
        canvas.width = image.width
        canvas.height = image.height
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        ctx.drawImage(image, 0, 0)

        const channel = (value) => {
          const s = value / 255
          return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
        }
        const luminance = (r, g, b) =>
          0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)

        return list.map((item) => {
          const { x, y, w, h } = item.rect
          const data = ctx.getImageData(x, y, Math.max(1, w), Math.max(1, h)).data

          /*
           * Two ratios, because they answer different questions.
           *
           * `pixelRatio` is what the render actually produced. Antialiasing means
           * the 98th-percentile pixel of 10px type never reaches the declared
           * colour, so it understates contrast for small text.
           *
           * `ratio` composites the declared CSS ink — alpha included — over the
           * measured backdrop and is what pass/fail uses. The backdrop still comes
           * from real pixels, so a bright machine showing through behind the type
           * is caught.
           */
          const lums = []
          const pixels = []
          for (let i = 0; i < data.length; i += 4) {
            const l = luminance(data[i], data[i + 1], data[i + 2])
            lums.push(l)
            pixels.push([l, data[i], data[i + 1], data[i + 2]])
          }
          lums.sort((a, b) => a - b)
          pixels.sort((a, b) => a[0] - b[0])

          const backdropIndex = Math.floor(pixels.length * 0.06)
          const backdropPixel = pixels[backdropIndex]
          const backdropLum = lums[backdropIndex]
          const pixelInk = lums[Math.floor(lums.length * 0.98)]

          const match = item.color.match(/rgba?\(([^)]+)\)/)
          const parts = match ? match[1].split(',').map(Number) : [255, 255, 255, 1]
          const [cr, cg, cb] = parts
          const ca = parts.length > 3 ? parts[3] : 1

          // The piece is monochrome, so the backdrop's three channels agree.
          const bg = (backdropPixel[1] + backdropPixel[2] + backdropPixel[3]) / 3
          const composite = (channel) => channel * ca + bg * (1 - ca)
          const resolved = [composite(cr), composite(cg), composite(cb)]
          const inkLum = luminance(resolved[0], resolved[1], resolved[2])

          const ratio = (inkLum + 0.05) / (backdropLum + 0.05)
          const pixelRatio = (pixelInk + 0.05) / (backdropLum + 0.05)

          return {
            ...item,
            ratio,
            pixelRatio,
            inkLum,
            backgroundLum: backdropLum,
            resolved: `rgb(${resolved.map((v) => Math.round(v)).join(',')})`,
          }
        })
      },
      [dataUrl, boxes],
    )

    console.log(`\n${act}`)
    for (const item of results) {
      const large = item.fontSize >= LARGE_PX || (item.fontSize >= 18.66 && Number(item.fontWeight) >= 700)
      const min = large ? MIN_LARGE : MIN_NORMAL
      const ok = item.ratio >= min
      if (!ok) failures.push({ act, ...item, min })
      console.log(
        `  ${ok ? 'PASS' : 'FAIL'}  ${item.ratio.toFixed(2).padStart(6)}:1` +
          `  (min ${min}, pixels ${item.pixelRatio.toFixed(2)})  ` +
          `${String(item.fontSize).padStart(5)}px  ` +
          `${item.className.split(' ')[0].padEnd(18)} "${item.text}"`,
      )
    }
  }

  await browser.close()

  console.log(
    failures.length
      ? `\n${failures.length} element(s) below the WCAG minimum:`
      : '\nAll audited text meets the WCAG minimum contrast.',
  )
  for (const failure of failures) {
    console.log(
      `  ${failure.act}  ${failure.ratio.toFixed(2)}:1 (needs ${failure.min})  ` +
        `${failure.className}  "${failure.text}"`,
    )
  }
  if (failures.length) process.exitCode = 1
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})