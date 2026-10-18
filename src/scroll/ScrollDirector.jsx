import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import Lenis from 'lenis'
import { TIMELINE, TOTAL_VH, actAtProgress } from '../data/acts.js'
import { ATTRACT, createAttractMode } from './attractMode.js'

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

    /*
     * Scroll smoothing.
     *
     * Tuned by feel against the two failure modes at either extreme. Too short a
     * duration and the camera jerks with each wheel tick, because a notched mouse
     * wheel delivers scroll in steps. Too long and it feels detached from the hand
     * — the camera keeps gliding after you have stopped asking it to.
     *
     * The easing is a saturating ease-out with a long tail: it leaves quickly and
     * arrives slowly, which is what makes a long document feel like it has weight
     * rather than friction. `wheelMultiplier` sits below 1 so that one notch is a
     * short move and the material takes several to cross, which is where the
     * unhurried quality of the piece comes from.
     */
    lenis = new Lenis({
      autoRaf: false,
      duration: 1.45,
      easing: (t) => 1 - Math.pow(1 - t, 3.6),
      smoothWheel: true,
      wheelMultiplier: 0.78,
      touchMultiplier: 1.7,
      syncTouch: false,
    })

    const onScroll = ({ velocity }) => {
      store.velocity = velocity || 0
    }
    lenis.on('scroll', onScroll)

    /*
     * The page starts moving on its own once nobody has touched it for a while.
     * `?autoplay=off` disables it; reduced motion never enables it, since the whole
     * point of that preference is that things stop moving unprompted.
     */
    const autoplayOff = new URLSearchParams(window.location.search).get('autoplay') === 'off'
    const attract = createAttractMode({
      lenis,
      enabled: !autoplayOff,
      // The timeline knows which act is on screen; the attract mode only needs to
      // know whether it is a 3D act or a text plate.
      getSpeedVh: () => {
        const act = TIMELINE[store.actIndex]
        const isTextAct = (act?.canvasOpacity ?? 1) < ATTRACT.textActOpacity
        return isTextAct ? ATTRACT.textSpeedVh : ATTRACT.speedVh
      },
    })

    let previous = 0
    const tick = (time) => {
      // Guard the first frame and any tab-switch gap: a huge dt would make the
      // attract mode jump.
      const dt = previous ? Math.min((time - previous) / 1000, 0.1) : 0
      previous = time

      attract.update(dt)
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
        attract,
        scrollToProgress(p) {
          const max = document.documentElement.scrollHeight - window.innerHeight
          lenis.scrollTo(max * p, { immediate: true })
        },
      }
    }

    return () => {
      cancelAnimationFrame(raf)
      attract.destroy()
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