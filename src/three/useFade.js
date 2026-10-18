import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useDirectorStore } from '../scroll/ScrollDirector.jsx'
import { TIMELINE } from '../data/acts.js'
import { damp } from '../lib/math.js'
import { applyGhost, ghostMaterial, material, setOpacity } from './materials/pbr.js'

/**
 * Crossing point for the ghost swap.
 *
 * `?ghost=N` forces it, which is how the two appearances are compared at the same
 * opacity — the thing that actually decides whether the swap is visible.
 */
export const DEFAULT_GHOST_THRESHOLD = 0.85

function ghostThreshold() {
  if (typeof window === 'undefined') return DEFAULT_GHOST_THRESHOLD
  const value = Number(new URLSearchParams(window.location.search).get('ghost'))
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_GHOST_THRESHOLD
}

/**
 * Drive an assembly's visibility from the act timeline.
 *
 * Each assembly declares which machine sub-system it belongs to (`key`). Every
 * frame we read that sub-system's target visibility from the current act and damp
 * toward it, so cutaways reveal and conceal smoothly and never pop across an act
 * boundary. The store is read from a ref, so this costs no React renders.
 *
 * Below the ghost threshold the assembly's meshes are switched to a deliberately
 * cheap material — no environment sampling, no roughness or normal maps, no PBR
 * lighting loop — because a transparent surface with depth writing off shades
 * everything behind it, and at low opacity the expensive shading was invisible
 * anyway. The swap is a traversal that happens only when the boolean flips, never
 * per frame.
 *
 * @param names     material names owned exclusively by this assembly
 * @param key       machine sub-system key in the act timeline
 * @param opts.groupRef  the group holding this assembly's meshes, for the ghost swap
 * @param opts.onUpdate  called each frame with (opacity, act, delta)
 */
export function useFade(names, key, opts = {}) {
  const { lambda = 4.2, onUpdate, groupRef } = opts
  const store = useDirectorStore()
  const keyOfNames = names.join('|')

  // Stable progress slots, one per material.
  const progress = useRef(null)
  if (progress.current === null || progress.current.length !== names.length) {
    progress.current = names.map(() => 0)
  }

  /*
   * Keyed on the joined names rather than on the array, which is a fresh identity
   * on every render. `names` is a literal at each call site and cannot change.
   */
  const resolved = useMemo(() => names.map((n) => material(n)), [keyOfNames])
  const ghosts = useMemo(() => names.map((n) => ghostMaterial(n)), [keyOfNames])
  const pairs = useMemo(
    () => resolved.map((pbr, i) => ({ pbr, ghost: ghosts[i] })),
    [resolved, ghosts],
  )

  const ghosted = useRef(false)
  const anchor = useRef(null)
  const threshold = useRef(ghostThreshold())

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    const act = TIMELINE[store.actIndex]
    const target = act?.machine?.[key] ?? 1

    for (let i = 0; i < resolved.length; i += 1) {
      progress.current[i] = damp(progress.current[i], target, lambda, dt)
      setOpacity(resolved[i], progress.current[i])
      ghosts[i].uniforms.uOpacity.value = progress.current[i]
      // A ghost at zero opacity would still shade every pixel it covers.
      ghosts[i].visible = progress.current[i] > 0.02
    }

    /*
     * The swap happens at a fairly high opacity on purpose. Waiting until the
     * assembly was nearly invisible would leave the expensive path in place for
     * most of the fade, which is exactly the range that costs the most.
     */
    if (groupRef?.current) {
      const shouldGhost = progress.current[0] < threshold.current
      // Also repaired when React has re-applied the material prop, which it does
      // on any re-render of the owning component.
      const stale = anchor.current && anchor.current.object.material !== anchor.current.assigned
      if (shouldGhost !== ghosted.current || stale || !anchor.current) {
        ghosted.current = shouldGhost
        anchor.current = applyGhost(groupRef.current, shouldGhost, pairs)
      }
    }

    onUpdate?.(progress.current[0], act, dt)
  })

  return resolved
}

/**
 * Read the current act inside useFrame without re-rendering.
 * Returns the live store; callers index TIMELINE themselves.
 */
export function useActFrame(callback) {
  const store = useDirectorStore()
  useFrame((state, delta) => {
    callback(TIMELINE[store.actIndex], store, Math.min(delta, 0.05), state)
  })
  return store
}
