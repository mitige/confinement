/**
 * GPU / performance probe.
 *
 * The verification harness needs real frames, and software rasterisation of this
 * scene is far too slow to review dozens of acts. This finds out which GL backend
 * headless Chrome can actually reach on this machine, and how fast the scene runs
 * once it gets there.
 *
 * Usage: node scripts/probe.mjs
 */

import { chromium } from 'playwright-core'

const CANDIDATES = [
  {
    name: 'hardware: ANGLE over EGL',
    args: ['--use-gl=angle', '--use-angle=gl', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'],
  },
  {
    name: 'hardware: ANGLE over Vulkan',
    args: ['--use-gl=angle', '--use-angle=vulkan', '--ignore-gpu-blocklist', '--enable-features=Vulkan'],
  },
  {
    name: 'hardware: native EGL',
    args: ['--use-gl=egl', '--ignore-gpu-blocklist'],
  },
  {
    name: 'software: SwiftShader',
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  },
]

const BASE = ['--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars', '--force-device-scale-factor=1']

async function rendererInfo(args) {
  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome-stable',
    args: [...BASE, ...args],
  })
  try {
    const page = await browser.newPage({ viewport: { width: 640, height: 400 } })
    return await page.evaluate(() => {
      const canvas = document.createElement('canvas')
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
      if (!gl) return 'no webgl context'
      const ext = gl.getExtension('WEBGL_debug_renderer_info')
      return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '(renderer hidden)'
    })
  } finally {
    await browser.close()
  }
}

console.log('WebGL backend per flag set:\n')
const working = []
for (const candidate of CANDIDATES) {
  let renderer
  try {
    renderer = await rendererInfo(candidate.args)
  } catch (error) {
    renderer = `launch failed: ${error.message.split('\n')[0]}`
  }
  const isSoftware = /swiftshader|llvmpipe|software/i.test(renderer)
  console.log(`  ${candidate.name.padEnd(28)} -> ${renderer}`)
  if (!isSoftware && !/no webgl|failed/i.test(renderer)) working.push(candidate)
}

console.log(
  working.length
    ? `\nUsable hardware backend(s): ${working.map((c) => c.name).join(', ')}`
    : '\nNo hardware backend. Verification will run on SwiftShader; keep the viewport small.',
)

/* ------------------------------------------------------------------ frame rate */

async function measureFps(args, label) {
  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome-stable',
    args: [...BASE, ...args],
  })
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
    await page.goto('http://127.0.0.1:5273/', { waitUntil: 'load', timeout: 60_000 })
    await page.waitForSelector('.loader', { state: 'detached', timeout: 120_000 })

    // Sample the app's own rAF loop, which is what the camera rides on.
    const fps = await page.evaluate(
      () =>
        new Promise((resolve) => {
          let frames = 0
          const start = performance.now()
          const tick = () => {
            frames += 1
            if (performance.now() - start > 3000) {
              resolve((frames / (performance.now() - start)) * 1000)
            } else {
              requestAnimationFrame(tick)
            }
          }
          requestAnimationFrame(tick)
        }),
    )
    console.log(`  ${label}: ${fps.toFixed(1)} fps at 1280x800`)
    return fps
  } finally {
    await browser.close()
  }
}

console.log('\nFrame rate at 1280x800:')
const probe = working[0] ?? CANDIDATES[3]
try {
  await measureFps(probe.args, probe.name)
} catch (error) {
  console.log(`  measurement failed: ${error.message.split('\n')[0]}`)
}