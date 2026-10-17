/**
 * Quality tiers.
 *
 * The tier is chosen in two stages, because a static guess is not good enough:
 *
 *  1. A cheap startup heuristic (`detectQuality`) from core count, pointer type
 *     and user agent. This is fast and usually right about form factor, but it
 *     cannot tell a fast integrated GPU from a slow one.
 *  2. Measured adaptation (`PerformanceGovernor`). The real frame time then decides
 *     the render resolution, and only if resolution bottoms out does the tier drop.
 *     A 2023 ultrabook and a desktop with the same core count differ enormously, and
 *     only measurement distinguishes them.
 *
 * The tier sets the base device pixel ratio, the post-processing chain, and MSAA.
 * It is a starting point now, not a verdict.
 */

export function detectQuality() {
  if (typeof window === 'undefined') return 'medium'

  const cores = navigator.hardwareConcurrency || 4
  const narrow = window.innerWidth < 900
  const coarse = window.matchMedia('(pointer: coarse)').matches
  const mobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)

  if (mobile || (coarse && narrow) || cores <= 4) return 'medium'

  return 'high'
}

/**
 * Device pixel ratio per tier.
 *
 * The ceiling matters more than it looks: at dpr 2 a 1440x900 viewport shades
 * 5.2 megapixels, four times the dpr 1 cost, and the fragment-heavy plasma is
 * exactly the kind of shader that scales with pixels.
 *
 * The low tier renders *below* 1 and lets the browser upscale. On a display that
 * already reports dpr 1 there is otherwise nothing for the governor to take away,
 * which would leave a weak GPU stuck at a frame rate it cannot sustain.
 */
export function dprFor(quality) {
  if (typeof window === 'undefined') return 1
  const device = window.devicePixelRatio || 1
  if (quality === 'high') return Math.min(device, 2)
  if (quality === 'medium') return Math.min(device, 1.5)
  /*
   * Caps at 1 on purpose. The tier used to return 0.75 here, which compounded
   * with the governor's own scale — a downgraded tier plus a 0.5 scale produced
   * 0.375 and an image that was simply soft. Resolution belongs to the governor;
   * a tier change is about shedding features.
   */
  return Math.min(device, 1)
}

/** Hard floor on the final device pixel ratio, whatever the levers produce. */
export const MIN_DPR = 0.42

/** Wireframe MSAA sample count. Ignored when the post chain is disabled. */
export function samplesFor(quality) {
  return quality === 'high' ? 4 : 0
}


