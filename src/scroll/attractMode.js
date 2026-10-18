import { damp } from '../lib/math.js'

/**
 * Attract mode.
 *
 * If nobody touches the page for a while, it starts moving on its own — a slow,
 * even dolly through the timeline. The moment the mouse moves, it stops dead.
 *
 * Three decisions worth stating:
 *
 *  - **The scroll signal is generated here, not by Lenis.** Lenis smooths by
 *    animating an internal value toward a target it captured when the animation
 *    started, so nudging its target each frame would mean fighting that animation
 *    and inheriting its lag. Writing an exact position each frame instead means the
 *    velocity is perfectly even — which is what reads as fluid — and stopping is
 *    simply not writing the next position. No coasting, no easing out.
 *
 *  - **The ramp is on the way in only.** Starting at full speed would jerk the
 *    camera; ending at full speed and stopping instantly is exactly what was asked
 *    for, so the stop is immediate by construction rather than by tuning.
 *
 *  - **Any input resets the clock.** Mouse movement, wheel, touch, a key, or the
 *    window losing focus all stop it and restart the countdown, so it behaves the
 *    same on a second look as on the first.
 */

export const ATTRACT = {
  /** Silence before the page starts moving on its own. */
  idleSeconds: 5,
  /**
   * Approach rate for the spin-up, in the same units as the damping helper.
   * Reaches about 95% of full speed in 2.8 s, which is quick enough not to feel
   * broken and slow enough not to jerk.
   */
  rampLambda: 1.05,
  /**
   * Speed in screen heights per second. At 1080p this is about 97 px/s: a 120vh
   * text plate takes roughly 13 seconds to cross, and the whole timeline about
   * seven minutes.
   */
  speedVh: 9,
  /** Inputs that count as "the user is here". */
  activityEvents: ['mousemove', 'pointerdown', 'pointermove', 'wheel', 'touchstart', 'touchmove', 'keydown'],
}

export function createAttractMode({ lenis, enabled = true }) {
  let idle = 0
  let engaged = 0
  let finished = false
  let blurred = false

  /** Stop instantly: from here on, no further position is written. */
  function halt() {
    engaged = 0
  }

  function onActivity() {
    idle = 0
    halt()
    // Re-arm if the reader has scrolled back up out of the ending.
    if (lenis && lenis.progress < 0.99) finished = false
  }

  function onVisibility() {
    if (document.hidden) halt()
  }

  function onBlur() {
    blurred = true
    halt()
  }

  function onFocus() {
    blurred = false
    idle = 0
  }

  const listeners = []
  if (enabled) {
    for (const event of ATTRACT.activityEvents) {
      window.addEventListener(event, onActivity, { passive: true })
      listeners.push([event, onActivity])
    }
    document.addEventListener('visibilitychange', onVisibility)
    listeners.push(['visibilitychange', onVisibility, document])
    window.addEventListener('blur', onBlur)
    window.addEventListener('focus', onFocus)
    listeners.push(['blur', onBlur])
    listeners.push(['focus', onFocus])
  }

  return {
    /** @param dt seconds since the previous frame */
    update(dt) {
      if (!enabled || !lenis) return

      idle += dt

      if (finished || blurred || document.hidden) return

      // Nothing left to show.
      if (lenis.progress >= 0.999) {
        finished = true
        halt()
        return
      }

      if (idle < ATTRACT.idleSeconds) return

      // Spin up gently, then hold a constant speed.
      engaged = damp(engaged, 1, ATTRACT.rampLambda, dt)

      const screenHeight = window.innerHeight
      const step = (screenHeight / 100) * ATTRACT.speedVh * engaged * dt
      if (step <= 0) return

      const next = Math.min(lenis.animatedScroll + step, lenis.limit)
      // Written directly rather than handed to Lenis's animator, so the position
      // is exact and the stop is exact.
      lenis.scrollTo(next, { immediate: true, force: true })
    },

    /** 0 when idle-still, 1 at full auto speed. For tests and diagnostics. */
    get engagement() {
      return engaged
    },

    destroy() {
      for (const [event, handler, target = window] of listeners) {
        target.removeEventListener(event, handler)
      }
      listeners.length = 0
      halt()
    },
  }
}