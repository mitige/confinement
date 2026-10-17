import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import Lenis from 'lenis'
import { TIMELINE, TOTAL_VH, actAtProgress } from '../data/acts.js'

/**
 * Owns all scroll state for the document.
 *
 * Two channels on purpose:
 *
 *  - Mutable refs (`progress`, `local`, `actIndex`) update every frame and are
 *    read by the WebGL render loop. They never trigger a React render.
 *  - `activeIndex` is React state and only changes when the current act changes,
 *    which is a handful of renders over the whole document.
 *
 * DOM components that need per-frame values subscribe instead of re-rendering.
 */

const DirectorContext = createContext(null)

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export function ScrollProvider({ children }) {
  const ref = useRef({
    progress: 0,
    local: 0,
    actIndex: 0,
    velocity: 0,
    /** Act whose reveal state the 2D layer should currently show, or null. */
    subscribers: new Set(),
  })

  const [activeIndex, setActiveIndex] = useState(0)
  const [reduced, setReduced] = useState(prefersReducedMotion)

  // Track the reduced-motion preference so the 3D tier can react to it live.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = (e) => setReduced(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    const store = ref.current
    let raf = 0
    let lenis = null

    // Reduced motion: native scrolling, no interpolation, no Lenis.
    if (reduced) {
      const tick = () => {
        publish(store, setActiveIndex)
        raf = requestAnimationFrame(tick)
      }
      tick()
      return () => cancelAnimationFrame(raf)
    }

    lenis = new Lenis({
      autoRaf: false,
      duration: 1.15,
      // Long, decelerating ease. Apple-like: never springy, never bouncy.
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 0.9,
      touchMultiplier: 1.4,
      lerp: undefined,
    })

    const onScroll = ({ velocity }) => {
      store.velocity = velocity || 0
    }
    lenis.on('scroll', onScroll)

    const tick = (time) => {
      lenis.raf(time)
      publish(store, setActiveIndex)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    // Dev-only handle so the screenshot harness can drive scroll deterministically
    // instead of synthesising wheel events, which Lenis would smooth differently
    // from run to run. Stripped from production builds by the DEV guard.
    if (import.meta.env.DEV) {
      window.__confinement = {
        lenis,
        store,
        scrollToProgress(p) {
          const max = document.documentElement.scrollHeight - window.innerHeight
          lenis.scrollTo(max * p, { immediate: true })
        },
      }
    }

    return () => {
      cancelAnimationFrame(raf)
      lenis.off('scroll', onScroll)
      lenis.destroy()
      store.velocity = 0
      if (import.meta.env.DEV) delete window.__confinement
    }
  }, [reduced])

  const value = useMemo(
    () => ({ store: ref.current, activeIndex, reduced, timeline: TIMELINE, totalVh: TOTAL_VH }),
    [activeIndex, reduced],
  )

  return <DirectorContext.Provider value={value}>{children}</DirectorContext.Provider>
}

/** Recompute the refs and flush subscribers. Called once per frame. */
function publish(store, setActiveIndex) {
  const doc = document.documentElement
  const max = doc.scrollHeight - window.innerHeight
  const progress = max > 0 ? Math.min(Math.max(window.scrollY / max, 0), 1) : 0

  store.progress = progress

  const { act, index } = actAtProgress(progress)
  const span = act.pEnd - act.pStart
  store.local = span > 0 ? Math.min(Math.max((progress - act.pStart) / span, 0), 1) : 0

  if (index !== store.actIndex) {
    store.actIndex = index
    setActiveIndex(index)
  }

  for (const fn of store.subscribers) fn(store)
}

export function useDirector() {
  const ctx = useContext(DirectorContext)
  if (!ctx) throw new Error('useDirector must be used inside <ScrollProvider>')
  return ctx
}

/** The mutable store. Safe to read inside useFrame; never causes a render. */
export function useDirectorStore() {
  return useDirector().store
}

/**
 * Subscribe to the per-frame scroll loop. The callback receives the live store
 * and is expected to write to the DOM imperatively. Returns nothing.
 */
export function useScrollFrame(callback) {
  const { store } = useDirector()
  const cb = useRef(callback)
  cb.current = callback
  useEffect(() => {
    const fn = (s) => cb.current(s)
    store.subscribers.add(fn)
    fn(store)
    return () => store.subscribers.delete(fn)
  }, [store])
}

/** Current act record, re-rendering only when the act changes. */
export function useActiveAct() {
  const { activeIndex, timeline } = useDirector()
  return timeline[activeIndex]
}