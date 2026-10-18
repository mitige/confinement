import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useDirectorStore } from '../scroll/ScrollDirector.jsx'
import { TIMELINE } from '../data/acts.js'

/**
 * Performance budget.
 *
 * Two levers, spent in this order:
 *
 *  1. **Render resolution.** Frame time is measured in short windows and a scale
 *     between 0.5 and 1.0 is applied to the canvas device pixel ratio. This is the
 *     lever that actually guarantees smoothness, because the cost of this scene is
 *     dominated by fragment work — full-screen ghosted layers plus the additive
 *     plasma shader — which scales linearly with pixels. A tier guessed at startup
 *     cannot know how fast the GPU really is; measuring can.
 *
 *  2. **Feature tier.** Only once resolution has bottomed out and the frame rate is
 *     still bad do we shed bloom, vignette and MSAA. Resolution goes first because
 *     losing sharpness is far less noticeable than losing the glow.
 *
 * The scale is reported upward and applied as the Canvas `dpr` prop rather than by
 * writing to the renderer. R3F re-applies `viewport.dpr` from that prop whenever the
 * Canvas re-renders — which happens on every act change — so a value pushed
 * straight into the renderer is silently reverted.
 *
 * Two details that matter in practice:
 *
 *  - The scale is quantised to steps of 0.1. Continuous adjustment makes the image
 *    breathe; six discrete levels do not.
 *  - Text acts run the canvas at 10-12% opacity, so resolution there is nearly free
 *    to give away. Those acts get an extra allowance while the barely-visible
 *    machine renders cheap — and because only the canvas softens, never the DOM,
 *    the plate typography stays perfectly sharp either way.
 */

export const BUDGET = {
  /** Frames discarded before measuring; these include shader compilation. */
  warmupFrames: 12,
  /** Measurement window. Short enough to react, long enough to be stable. */
  windowSeconds: 0.5,
  /** How long to stay above target before spending pixels again. */
  climbSeconds: 1.6,
  /**
   * Floor for the default, gentle mode. A 28% linear reduction is 0.52x the pixels
   * — roughly 1.8x the frame rate — and is close to invisible under bloom and film
   * grain, where the full range down to 0.5 is not.
   */
  gentleMinScale: 0.72,
  /** Floor when adaptation is explicitly asked for in full. */
  minScale: 0.5,
  maxScale: 1,
  stepDown: 0.1,
  stepUp: 0.05,
  /** Below this frame rate, reduce resolution. */
  lowerFps: 50,
  /** Above this, resolution may be increased. */
  upperFps: 58,
  /** At minimum resolution and still below this, shed features instead. */
  tierFloorFps: 38,
  /** Extra resolution allowance for acts that barely show the machine. */
  textActScale: 0.65,
  /** Canvas opacity below which an act counts as a text act. */
  textActOpacity: 0.2,
  /** Minimum seconds between two feature downgrades. */
  downgradeCooldownSeconds: 3,
}

/** Quantise so the image changes in visible steps rather than continuously. */
const quantise = (value) => Math.round(value * 10) / 10

export function PerformanceGovernor({ tier, minScale = BUDGET.gentleMinScale, onScaleChange, onDowngrade }) {
  const store = useDirectorStore()

  const state = useRef({
    frames: 0,
    elapsed: 0,
    climbElapsed: 0,
    /** The governor's own target, independent of what the parent last applied. */
    target: BUDGET.maxScale,
    /** What the parent has actually been told, so we only notify on change. */
    reported: -1,
    /** Timestamp of the last feature downgrade, so steps cannot cascade. */
    lastDowngrade: -Infinity,
    elapsedTotal: 0,
  })

  useFrame((_, delta) => {
    const s = state.current
    // Clamp so a background tab does not produce a bogus average on return.
    const dt = Math.min(delta, 0.1)

    s.frames += 1
    s.elapsed += dt
    s.elapsedTotal += dt
    if (s.frames < BUDGET.warmupFrames) return
    if (s.elapsed < BUDGET.windowSeconds) return

    const fps = s.frames / s.elapsed
    s.frames = 0
    s.elapsed = 0

    if (fps < BUDGET.lowerFps) {
      s.climbElapsed = 0
      if (s.target > minScale) {
        s.target = Math.max(minScale, s.target - BUDGET.stepDown)
      } else if (
        // Only shed features once the floor for THIS mode is reached, not the
        // global one, or gentle mode would downgrade the tier while barely
        // having touched resolution.
        fps < BUDGET.tierFloorFps * (minScale / BUDGET.gentleMinScale) &&
        tier !== 'low' &&
        s.elapsedTotal - s.lastDowngrade > BUDGET.downgradeCooldownSeconds
      ) {
        /*
         * Resolution is spent and it is still slow: give up features instead.
         * Repeatable, because a machine may need to shed two tiers — but rate
         * limited, so it cannot cascade and leave the piece at minimum quality
         * because of one bad measurement.
         */
        s.lastDowngrade = s.elapsedTotal
        onDowngrade?.()
      }
    } else if (fps > BUDGET.upperFps) {
      s.climbElapsed += BUDGET.windowSeconds
      if (s.climbElapsed >= BUDGET.climbSeconds) {
        s.climbElapsed = 0
        s.target = Math.min(BUDGET.maxScale, s.target + BUDGET.stepUp)
      }
    } else {
      s.climbElapsed = 0
    }

    /*
     * Report at most once per measurement window, and only on a real change. The
     * text-act allowance is folded in here so the parent applies one number.
     */
    const act = TIMELINE[store.actIndex]
    const isTextAct = (act?.canvasOpacity ?? 1) < BUDGET.textActOpacity
    const effective = quantise(s.target * (isTextAct ? BUDGET.textActScale : 1))

    if (effective !== s.reported) {
      s.reported = effective
      onScaleChange?.(effective)
    }
  })

  return null
}