import { useEffect, useRef, useState } from 'react'
import { QUALITY_LABEL } from '../lib/quality.js'

/**
 * The preloader.
 *
 * Honest about what it is measuring: there are no assets to download — every mesh
 * and texture in this piece is generated at runtime — so the real gates are the
 * font finishing loading and the renderer producing its first frames. The bar
 * creeps while it waits and completes the moment both are done, with a floor on
 * the total duration so the reveal never flashes.
 */

const MINIMUM_DURATION = 1100
const COMPLETE_DURATION = 520
const EXIT_DURATION = 900

export function Loader({ sceneReady, quality, onExited }) {
  const [progress, setProgress] = useState(0)
  const [leaving, setLeaving] = useState(false)
  const [gone, setGone] = useState(false)

  const state = useRef({
    started: performance.now(),
    fontsReady: false,
    value: 0,
  })

  useEffect(() => {
    let cancelled = false
    document.fonts?.ready?.then(() => {
      if (!cancelled) state.current.fontsReady = true
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let raf = 0
    let previous = performance.now()

    const tick = (now) => {
      const s = state.current
      // Clamp the step so a background tab does not jump the bar on return.
      const dt = Math.min(now - previous, 64)
      previous = now

      const elapsed = now - s.started
      const gatesOpen = s.fontsReady && sceneReady

      // Creep toward 86% while gated; run to completion once both gates open.
      // Rates are per millisecond, so the bar is frame-rate independent.
      const ceiling = gatesOpen ? 1 : 0.86
      const rate = gatesOpen ? 1 / COMPLETE_DURATION : 1 / 2400
      s.value = Math.min(ceiling, s.value + rate * dt)

      if (gatesOpen && elapsed > MINIMUM_DURATION && s.value >= 0.999) {
        setProgress(1)
        setLeaving(true)
        window.setTimeout(() => {
          setGone(true)
          onExited?.()
        }, EXIT_DURATION)
        return
      }

      setProgress(s.value)
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [sceneReady, onExited])

  if (gone) return null

  const percent = Math.round(progress * 100)

  return (
    <div className={`loader${leaving ? ' loader--leaving' : ''}`} role="status" aria-live="polite">
      <div className="loader__title">Confinement</div>

      <div className="loader__track">
        <div className="loader__fill" style={{ transform: `scaleX(${progress})` }} />
      </div>

      <div className="loader__meta">
        <span>{QUALITY_LABEL[quality] ?? 'pipeline'}</span>
        <span>{String(percent).padStart(3, '0')}</span>
      </div>

      <span className="sr-only">
        Loading the tokamak. {percent} percent.
      </span>
    </div>
  )
}