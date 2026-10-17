/**
 * Quality tiers.
 *
 * The tier is chosen in two stages, because a static guess is not good enough:
 *
 *  1. A cheap startup heuristic (`detectQuality`) from core count, pointer type
 *     and user agent. This is fast and usually right about form factor, but it
 *     cannot tell a fast integrated GPU from a slow one.
 *  2. A measured downgrade (`PerformanceGovernor`). After the opening frames have
 *     been drawn, the real frame time decides whether the tier survives. A 2023
 *     ultrabook and a desktop with the same core count differ enormously, and only
 *     measurement distinguishes them.
 *
 * The tier controls device pixel ratio, the post-processing chain, and MSAA.
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
  if (quality === 'medium') return Math.min(device, 1.25)
  return Math.min(device, 0.75)
}

/** Wireframe MSAA sample count. Ignored when the post chain is disabled. */
export function samplesFor(quality) {
  return quality === 'high' ? 4 : 0
}

export const QUALITY_LABEL = {
  high: 'full pipeline',
  medium: 'reduced pipeline',
  low: 'minimal pipeline',
}

/**
 * Frame-time governor.
 *
 * Skips the first frames, which are dominated by shader compilation, then judges
 * the tier on a rolling average. Downgrades only — never upgrades — so the piece
 * cannot oscillate between tiers mid-scroll.
 */
export const GOVERNOR = {
  /**
   * Frames to discard before sampling; these include shader compilation, which is
   * far slower than any steady-state frame and would otherwise force a downgrade
   * on hardware that does not need one.
   */
  warmup: 24,
  /**
   * Frames to average. Sixty frames at 60 fps is one second, which is a stable
   * enough average — and at 17 fps it is three and a half seconds, which is the
   * point: the slower the machine, the sooner it adapts.
   */
  sample: 36,
  /** Below this average frame rate, step down a tier. */
  thresholds: { high: 32, medium: 20 },
}

export function nextTier(tier, fps) {
  const threshold = GOVERNOR.thresholds[tier]
  if (!threshold || fps >= threshold) return null
  if (tier === 'high') return 'medium'
  if (tier === 'medium') return 'low'
  return null
}