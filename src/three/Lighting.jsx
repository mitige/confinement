import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useDirectorStore } from '../scroll/ScrollDirector.jsx'
import { TIMELINE } from '../data/acts.js'
import { MIDPLANE } from '../data/iter.js'
import { damp } from '../lib/math.js'

/**
 * The lighting rigs.
 *
 * The metals in this piece are lit almost entirely by the procedural
 * environment, so these lights exist for direction and contrast rather than for
 * base visibility. Each rig is a mood: `coldKey` isolates the machine with a hard
 * off-axis key, `rim` lights it from below for the interior acts, `clinical` is
 * flat and symmetric for the telephoto shot.
 *
 * Two conventions make this cheap and predictable:
 *  - The key, fill and rim lights use `decay={0}`, so they behave like directional
 *    lights without needing a target object to be parented into the scene.
 *  - Only the plasma light uses physical inverse-square falloff, because that is
 *    the one light that should pool on the blanket modules around it.
 */

const RIGS = {
  /**
   * Moodiest rig: the machine reads as a silhouette with a lit edge, nothing
   * more. The plasma is fully enclosed by an opaque cryostat here, so this rig
   * carries the whole frame — hence the strong backlight, which draws the
   * silhouette's rim and keeps the form from dissolving into black.
   */
  void: {
    ambient: 0.034,
    key: 1.9,
    keyPos: [-44, 34, 30],
    fill: 0.26,
    fillPos: [38, 15, 24],
    rim: 2.1,
    rimPos: [0, 26, -58],
    plasma: 55,
  },
  /** Hard off-axis key: maximum form on the cryostat. */
  coldKey: {
    ambient: 0.038,
    key: 2.6,
    keyPos: [-36, 32, 24],
    fill: 0.36,
    fillPos: [30, 16, 26],
    rim: 0.72,
    rimPos: [8, 2, -34],
    plasma: 70,
  },
  /** Lit from below, for the acts inside the vessel. */
  rim: {
    ambient: 0.021,
    key: 1.0,
    keyPos: [24, 32, -20],
    fill: 0.44,
    fillPos: [0, 6, 18],
    rim: 1.25,
    rimPos: [0, 2.5, 0],
    plasma: 95,
  },
  /** The plasma does the lighting. Everything else is turned down. */
  ignition: {
    ambient: 0.016,
    key: 1.05,
    keyPos: [0, 40, 32],
    fill: 0.17,
    fillPos: [16, 10, 18],
    rim: 0.3,
    rimPos: [0, 6, -22],
    plasma: 42,
  },
  /** Soft overhead, for the aerial shot. */
  top: {
    ambient: 0.044,
    key: 2.15,
    keyPos: [6, 46, 10],
    fill: 0.48,
    fillPos: [-24, 20, -14],
    rim: 0.34,
    rimPos: [0, 3, 30],
    plasma: 100,
  },
  /** Flat and symmetric, for the telephoto shot. */
  clinical: {
    ambient: 0.066,
    key: 2.35,
    keyPos: [0, 22, 36],
    fill: 1.25,
    fillPos: [0, 22, -36],
    rim: 0.22,
    rimPos: [0, 10, 0],
    plasma: 120,
  },
}
const KEY_COLOUR = '#dfe9f5'
const FILL_COLOUR = '#9fb4cc'
const RIM_COLOUR = '#7d93b3'
const PLASMA_COLOUR = '#9fdcff'

export function Lighting() {
  const store = useDirectorStore()
  const key = useRef(null)
  const fill = useRef(null)
  const rim = useRef(null)
  const plasma = useRef(null)
  const ambient = useRef(null)

  const smooth = useRef({
    ambient: RIGS.void.ambient,
    key: RIGS.void.key,
    fill: RIGS.void.fill,
    rim: RIGS.void.rim,
    plasma: 0,
    keyPos: [...RIGS.void.keyPos],
    fillPos: [...RIGS.void.fillPos],
    rimPos: [...RIGS.void.rimPos],
    initialised: false,
  })

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    const act = TIMELINE[store.actIndex]
    const forced = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('rig')
    const rig = RIGS[forced || act.light] || RIGS.void
    const exposure =
      (typeof window !== 'undefined' && Number(new URLSearchParams(window.location.search).get('exposure'))) || 1
    const s = smooth.current

    const lambda = 2.4

    if (!s.initialised) {
      s.ambient = rig.ambient
      s.key = rig.key
      s.fill = rig.fill
      s.rim = rig.rim
      s.keyPos = [...rig.keyPos]
      s.fillPos = [...rig.fillPos]
      s.rimPos = [...rig.rimPos]
      s.initialised = true
    } else {
      s.ambient = damp(s.ambient, rig.ambient, lambda, dt)
      s.key = damp(s.key, rig.key, lambda, dt)
      s.fill = damp(s.fill, rig.fill, lambda, dt)
      s.rim = damp(s.rim, rig.rim, lambda, dt)
      for (let i = 0; i < 3; i += 1) {
        s.keyPos[i] = damp(s.keyPos[i], rig.keyPos[i], lambda, dt)
        s.fillPos[i] = damp(s.fillPos[i], rig.fillPos[i], lambda, dt)
        s.rimPos[i] = damp(s.rimPos[i], rig.rimPos[i], lambda, dt)
      }
    }

    // The plasma light follows the plasma's own visibility, and is scaled by the
    // rig so the ignition act can let it take over completely.
    const plasmaVisibility = act.machine?.plasma ?? 0
    s.plasma = damp(s.plasma, rig.plasma * plasmaVisibility * exposure, 1.6, dt)

    if (ambient.current) ambient.current.intensity = s.ambient * exposure
    if (key.current) {
      key.current.intensity = s.key * exposure
      key.current.position.set(...s.keyPos)
    }
    if (fill.current) {
      fill.current.intensity = s.fill * exposure
      fill.current.position.set(...s.fillPos)
    }
    if (rim.current) {
      rim.current.intensity = s.rim * exposure
      rim.current.position.set(...s.rimPos)
    }
    if (plasma.current) {
      plasma.current.intensity = s.plasma
      plasma.current.position.set(0, MIDPLANE, 0)
    }
  })

  return (
    <>
      <ambientLight ref={ambient} intensity={0.012} />
      <pointLight ref={key} color={KEY_COLOUR} decay={0} intensity={0.5} />
      <pointLight ref={fill} color={FILL_COLOUR} decay={0} intensity={0.08} />
      <pointLight ref={rim} color={RIM_COLOUR} decay={0} intensity={0.05} />
      {/*
        Inverse-square falloff, so the glow pools on the blanket modules and the
        inner vessel wall instead of lighting the room evenly.
      */}
      <pointLight ref={plasma} color={PLASMA_COLOUR} intensity={0} distance={44} decay={2} />
    </>
  )
}