/** Small numeric helpers. No dependencies, deliberately tiny. */

export const clamp = (v, min = 0, max = 1) => (v < min ? min : v > max ? max : v)

export const lerp = (a, b, t) => a + (b - a) * t

/** Inverse lerp, clamped. Maps v from [a,b] onto [0,1]. */
export const invLerp = (a, b, v) => clamp((v - a) / (b - a || 1))

export const easeInOutCubic = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3)

export const easeOutExpo = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t))

export const easeInOutQuint = (t) =>
  t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2

/**
 * Frame-rate independent exponential damping.
 * `lambda` is the decay rate; higher converges faster.
 */
export const damp = (current, target, lambda, dt) =>
  lerp(current, target, 1 - Math.exp(-lambda * Math.min(dt, 0.05)))

/**
 * A trapezoidal visibility window over a 0..1 progress value.
 * Ramps up across [inStart, inEnd], holds, ramps down across [outStart, outEnd].
 */
export function window01(t, inStart, inEnd, outStart, outEnd) {
  if (t <= inStart) return 0
  if (t < inEnd) return easeOutCubic(invLerp(inStart, inEnd, t))
  if (t <= outStart) return 1
  if (t < outEnd) return 1 - easeInOutCubic(invLerp(outStart, outEnd, t))
  return 0
}

/** Index-weighted stagger delay, clamped so long lists still finish in time. */
export const stagger = (index, count, total = 0.5) =>
  count <= 1 ? 0 : (index / (count - 1)) * total