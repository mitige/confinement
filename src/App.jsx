import { useCallback, useEffect, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ScrollProvider, useDirector } from './scroll/ScrollDirector.jsx'
import { TIMELINE } from './data/acts.js'
import { Scene } from './three/Scene.jsx'
import { Plates } from './ui/Plates.jsx'
import { ProjectAct } from './ui/ProjectAct.jsx'
import { RepoGrid } from './ui/RepoGrid.jsx'
import { Coda } from './ui/Coda.jsx'
import { Hud } from './ui/Hud.jsx'
import { Loader } from './ui/Loader.jsx'
import { detectQuality, dprFor, nextTier, GOVERNOR } from './lib/quality.js'

/**
 * Signals that the renderer is actually producing frames.
 *
 * There are no assets to load in this piece, so "ready" genuinely means the first
 * few frames have been drawn and the shaders are compiled. Counting real frames is
 * the honest gate; a timer would show a bar that completes before anything is on
 * screen.
 */
function FrameGate({ onReady }) {
  const frames = useRef(0)
  const reported = useRef(false)

  useFrame(() => {
    if (reported.current) return
    frames.current += 1
    if (frames.current >= 4) {
      reported.current = true
      onReady()
    }
  })

  return null
}

/**
 * Debug switches, read from the query string.
 *
 *   ?fx=0        skip post-processing entirely (isolates lighting from the composer)
 *   ?exposure=2  scale every light, for finding the right level quickly
 *   ?rig=top     force a lighting rig, to compare moods without scrolling
 *
 * Harmless in production: absent parameters change nothing.
 */
function debugParams() {
  if (typeof window === 'undefined') return {}
  const params = new URLSearchParams(window.location.search)
  return {
    effects: params.get('fx') !== '0',
    exposure: Number(params.get('exposure')) || 1,
    forcedRig: params.get('rig') || null,
  }
}

/**
 * Measures real frame time and steps the quality tier down if the static guess was
 * optimistic. Downgrades only, with a warm-up window that discards the frames
 * spent compiling shaders.
 */
function PerformanceGovernor({ tier, onDowngrade }) {
  const samples = useRef([])
  const frames = useRef(0)
  const settled = useRef(false)

  useFrame((_, delta) => {
    if (settled.current) return
    frames.current += 1
    if (frames.current <= GOVERNOR.warmup) return

    samples.current.push(delta)
    if (samples.current.length < GOVERNOR.sample) return

    settled.current = true
    const total = samples.current.reduce((sum, value) => sum + value, 0)
    const fps = samples.current.length / total
    const downgrade = nextTier(tier, fps)
    if (downgrade) onDowngrade(downgrade, fps)
  })

  // A tier change starts a fresh measurement, so the governor can step twice.
  useEffect(() => {
    samples.current = []
    frames.current = 0
    settled.current = false
  }, [tier])

  return null
}

function Experience() {
  const [quality, setQuality] = useState(detectQuality)
  const [debug] = useState(debugParams)
  const [sceneReady, setSceneReady] = useState(false)
  const { activeIndex, timeline, reduced } = useDirector()

  const act = timeline[activeIndex]
  const handleReady = useCallback(() => setSceneReady(true), [])

  // Always open on the first frame, never mid-piece after a reload.
  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
    window.scrollTo(0, 0)
  }, [])

  return (
    <>
      {/*
        The canvas is fixed and lives for the whole session. Its opacity is driven
        by the act so the plates can recede it without ever unmounting WebGL state,
        which is what makes the alternation feel continuous rather than like a
        slideshow.
      */}
      <div
        className="canvas-layer"
        style={{
          opacity: act.canvasOpacity,
          transition: 'opacity 800ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <Canvas
          flat
          dpr={dprFor(quality)}
          camera={{ position: [0, 21, 92], fov: 30, near: 0.1, far: 900 }}
          gl={{
            antialias: false,
            alpha: false,
            powerPreference: 'high-performance',
            stencil: false,
          }}
          onCreated={({ gl, scene, camera }) => {
            gl.setClearColor(new THREE.Color('#000000'), 1)
            // Dev-only handle for the performance harness.
            if (import.meta.env.DEV) window.__r3f = { gl, scene, camera }
          }}
        >
          <Scene quality={quality} reducedMotion={reduced} effects={debug.effects} />
          <FrameGate onReady={handleReady} />
          <PerformanceGovernor
            tier={quality}
            onDowngrade={(tier, fps) => {
              setQuality(tier)
              if (import.meta.env.DEV) {
                console.info(
                  `[quality] ${fps.toFixed(1)} fps measured, stepping down to "${tier}"`,
                )
              }
            }}
          />
        </Canvas>
      </div>

      {/* Invisible spacers: the document's length is the act timeline. */}
      <div className="scroll-track">
        {TIMELINE.map((entry) => (
          <div
            key={entry.id}
            className="scroll-act"
            style={{ height: `${entry.vh}vh` }}
            data-act={entry.id}
          />
        ))}

        {/*
          One extra viewport height of run-out.

          Without it the last screenful of the track can never be scrolled to —
          maximum scroll is (document height - viewport height) — so the final act
          tops out around 55% of its own progress and the coda never finishes
          revealing itself. This spacer makes the maximum scroll distance exactly
          TOTAL_VH viewport heights, which is the reference the act percentages in
          data/acts.js are measured against.
        */}
        <div className="scroll-runout" style={{ height: '100vh' }} aria-hidden="true" />
      </div>

      <main className="plate-layer">
        <Plates />
        <ProjectAct />
        <RepoGrid />
        <Coda />
      </main>

      <Hud />
      <div className="vignette" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />

      <Loader sceneReady={sceneReady} quality={quality} />
    </>
  )
}

export default function App() {
  return (
    <ScrollProvider>
      <Experience />
    </ScrollProvider>
  )
}