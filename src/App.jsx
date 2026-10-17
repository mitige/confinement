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
import { detectQuality, dprFor, MIN_DPR } from './lib/quality.js'
import { PerformanceGovernor } from './three/PerformanceGovernor.jsx'

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
 * Switches, read from the query string.
 *
 *   ?adaptive=1        let the render resolution fall to hold the frame rate
 *   ?quality=medium    cap the feature tier (bloom quality, MSAA, dpr ceiling)
 *   ?res=1             pin an exact render scale, 0.5 to 1
 *   ?fx=0              skip post-processing entirely
 *   ?exposure=2        scale every light, for finding a level quickly
 *   ?rig=top           force a lighting rig, to compare moods without scrolling
 *
 * The defaults are maximum quality and full resolution. That is a deliberate
 * choice against smoothness: the adaptive governor exists and works, but it is
 * opt-in, because a portfolio that looks soft by default is a worse failure than
 * one that occasionally drops a frame.
 *
 * Harmless in production: absent parameters change nothing.
 */
function debugParams() {
  if (typeof window === 'undefined') return {}
  const params = new URLSearchParams(window.location.search)
  const tier = params.get('quality')
  return {
    effects: params.get('fx') !== '0',
    exposure: Number(params.get('exposure')) || 1,
    forcedRig: params.get('rig') || null,
    /** Pins the render scale, 1 means native. */
    forcedScale: params.has('res') ? Number(params.get('res')) : null,
    /** Off by default: resolution is spent only when explicitly asked for. */
    adaptive: params.get('adaptive') === '1',
    /** Anything other than high is an explicit request to spend features. */
    tier: tier === 'medium' || tier === 'low' ? tier : 'high',
  }
}

function Experience() {
  /*
   * Maximum by default. `detectQuality` is still used as the starting point when
   * the adaptive governor is switched on, where a wrong guess only costs a couple
   * of seconds of adaptation.
   */
  const [quality, setQuality] = useState(() => {
    // An explicit request downward always wins.
    if (debug.tier !== 'high') return debug.tier
    // Otherwise: a startup guess is only worth making when the governor is there
    // to correct it. Without the governor, maximum is the answer.
    return debug.adaptive ? detectQuality() : 'high'
  })
  /*
   * Render scale, owned here because it is applied as the Canvas `dpr` prop — the
   * only channel R3F will not overwrite. It changes a handful of times per
   * session, in steps of 0.1, so re-rendering on change is free.
   */
  const [renderScale, setRenderScale] = useState(1)
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
          dpr={
            debug.forcedScale ??
            Math.max(MIN_DPR, dprFor(quality) * (debug.adaptive ? renderScale : 1))
          }
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
          {/*
            Mounted only on request. With it absent the renderer always runs at the
            full device pixel ratio and nothing ever changes resolution mid-scroll.
          */}
          {debug.adaptive && (
            <PerformanceGovernor
              tier={quality}
              onScaleChange={setRenderScale}
              onDowngrade={() => {
                // Resolution is already at its floor; the only thing left to give
                // up is a feature tier.
                setQuality((current) => {
                  const next = current === 'high' ? 'medium' : current === 'medium' ? 'low' : 'low'
                  if (import.meta.env.DEV && next !== current) {
                    console.info(`[quality] resolution floor reached, stepping down to "${next}"`)
                  }
                  return next
                })
              }}
            />
          )}
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

      <Loader sceneReady={sceneReady} />
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