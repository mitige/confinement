import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useDirectorStore } from '../scroll/ScrollDirector.jsx'
import { TIMELINE } from '../data/acts.js'
import { damp } from '../lib/math.js'
import { material, setOpacity } from './materials/pbr.js'

/**
 * Drive material opacity from the act timeline.
 *
 * Each assembly declares which machine sub-system it belongs to (`key`). Every
 * frame we read that sub-system's target visibility from the current act and
 * damp toward it, so cutaways reveal and conceal smoothly and never pop across an
 * act boundary. The store is read from a ref, so this costs no React renders.
 *
 * @param names  material names owned exclusively by this assembly
 * @param key    machine sub-system key in the act timeline
 * @param opts.onUpdate  called each frame with (opacity, act, delta)
 */
export function useFade(names, key, opts = {}) {
  const { lambda = 4.2, onUpdate } = opts
  const store = useDirectorStore()
  const keyOfNames = names.join('|')

  // Stable progress slots, one per material.
  const progress = useRef(null)
  if (progress.current === null || progress.current.length !== names.length) {
    progress.current = names.map(() => 0)
  }

  const resolved = useMemo(
    () => names.map((n) => material(n)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [keyOfNames],
  )

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    const act = TIMELINE[store.actIndex]
    const target = act?.machine?.[key] ?? 1

    for (let i = 0; i < resolved.length; i += 1) {
      progress.current[i] = damp(progress.current[i], target, lambda, dt)
      setOpacity(resolved[i], progress.current[i])
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