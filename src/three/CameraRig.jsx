import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useDirectorStore } from '../scroll/ScrollDirector.jsx'
import { TIMELINE } from '../data/acts.js'
import { clamp, damp, easeInOutCubic, invLerp } from '../lib/math.js'

/**
 * Drives the camera from the act timeline.
 *
 * The rig is built in three layers, and keeping them separate is what makes the
 * motion read as authored rather than as a value being interpolated:
 *
 *  1. **Choreography.** Each act declares camera keys, threaded onto a Catmull-Rom
 *     spline so the camera swings through arcs instead of snapping between points.
 *     The parameter along that spline advances *linearly*, because a spline is
 *     already C1 continuous and easing every segment would make the camera stop
 *     dead at each keyframe. Only the field of view eases: a zoom that starts and
 *     stops abruptly is far more noticeable than a dolly that does.
 *
 *  2. **Life.** A slow, incommensurate drift and a pointer parallax are added on
 *     top. Both are small — under a metre on a 30 m machine — but they are the
 *     difference between a camera and a slideshow: the framing is never perfectly
 *     still, and it answers the cursor. The drift periods are deliberately not
 *     whole multiples of each other, so the movement never visibly repeats.
 *
 *  3. **Weight.** The result is damped before it reaches the camera, which absorbs
 *     the velocity discontinuities at act boundaries and gives the piece a
 *     physical feel. A velocity-driven field-of-view accent adds a sense of speed
 *     and settles on its own. The pointer adds a fraction of a degree of roll,
 *     applied through the camera's up vector so it cannot fight `lookAt`.
 *
 * All of layer 2 and the roll are disabled under `prefers-reduced-motion`, which
 * pins the camera to the choreography alone.
 */

/** How far the pointer can push the camera, in metres. */
const PARALLAX_POSITION = 0.85
const PARALLAX_TARGET = 0.3
/** Degrees of roll at full horizontal deflection. */
const PARALLAX_ROLL = 0.85
/** Idle drift, in metres and seconds. Mutually prime periods so it never loops. */
const DRIFT = [
  { axis: 'x', amplitude: 0.34, period: 23.7, phase: 0 },
  { axis: 'y', amplitude: 0.22, period: 37.3, phase: 1.9 },
  { axis: 'z', amplitude: 0.28, period: 29.1, phase: 3.4 },
]
/** Degrees added at full scroll speed. */
const SPEED_FOV = 1.5
/** The camera's reference up, used to build the view basis. */
const WORLD_UP = new THREE.Vector3(0, 1, 0)

/**
 * A fixed camera override, for inspecting a piece of the machine without hunting
 * for a scroll position that happens to frame it.
 *
 *   ?cam=0,40,34&target=0,28,0&fov=40
 *
 * Present only when asked for; absent, the rig behaves exactly as before.
 */
function cameraOverride() {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  const cam = params.get('cam')
  const target = params.get('target')
  if (!cam || !target) return null
  const parse = (value) => value.split(',').map(Number)
  const position = parse(cam)
  const look = parse(target)
  if (position.some(Number.isNaN) || look.some(Number.isNaN)) return null
  return { position, target: look, fov: Number(params.get('fov')) || 40 }
}

export function CameraRig({ reducedMotion = false }) {
  const camera = useThree((s) => s.camera)
  const store = useDirectorStore()
  const override = cameraOverride()

  const state = useRef({
    actId: null,
    position: null,
    target: null,
    fovs: null,
    ats: null,
    /** Smoothed values actually written to the camera. */
    current: new THREE.Vector3(0, 21, 92),
    lookAt: new THREE.Vector3(0, 15, 0),
    fov: 30,
    /** Smoothed parallax and speed accents. */
    parallax: new THREE.Vector2(),
    roll: 0,
    speedFov: 0,
    elapsed: 0,
    initialised: false,
  })

  const scratch = useRef({
    splinePosition: new THREE.Vector3(),
    splineTarget: new THREE.Vector3(),
    drift: new THREE.Vector3(),
    forward: new THREE.Vector3(),
    right: new THREE.Vector3(),
    up: new THREE.Vector3(),
  })

  useFrame((frameState, delta) => {
    const dt = Math.min(delta, 0.05)
    const s = state.current
    s.elapsed += dt

    // Inspection mode: hold the requested framing and ignore everything else.
    if (override) {
      camera.position.set(...override.position)
      camera.lookAt(...override.target)
      camera.up.set(0, 1, 0)
      if (Math.abs(camera.fov - override.fov) > 0.002) {
        camera.fov = override.fov
        camera.updateProjectionMatrix()
      }
      return
    }

    const act = TIMELINE[store.actIndex]
    const keys = act.cam

    // Rebuild the splines only when the act changes.
    if (s.actId !== act.id) {
      s.actId = act.id
      s.position = new THREE.CatmullRomCurve3(
        keys.map((k) => new THREE.Vector3(...k.pos)),
        false,
        'catmullrom',
        0.5,
      )
      s.target = new THREE.CatmullRomCurve3(
        keys.map((k) => new THREE.Vector3(...k.target)),
        false,
        'catmullrom',
        0.5,
      )
      s.fovs = keys.map((k) => k.fov)
      s.ats = keys.map((k) => k.at)
    }

    const u = clamp(store.local, 0, 1)

    // Locate the segment this progress falls in, then map to spline parameter.
    let segment = 0
    while (segment < s.ats.length - 2 && u > s.ats[segment + 1]) segment += 1
    const span = s.ats[segment + 1] - s.ats[segment] || 1
    const local = clamp(invLerp(s.ats[segment], s.ats[segment] + span, u), 0, 1)
    const t = (segment + local) / (s.ats.length - 1)

    s.position.getPoint(t, scratch.current.splinePosition)
    s.target.getPoint(t, scratch.current.splineTarget)

    // --- layer 2: life -------------------------------------------------------
    if (!reducedMotion) {
      const { drift, forward, right, up } = scratch.current

      /*
       * Both offsets are expressed in the camera's own frame, not in world axes.
       * Offsetting world X would shove the camera sideways relative to the room,
       * which reads as the framing sliding when the camera faces along Z and as
       * nothing at all when it faces along X. Working from the view basis means a
       * given pointer deflection moves the framing by the same amount on screen
       * from every angle, which is the whole point of a parallax.
       */
      forward.subVectors(scratch.current.splineTarget, scratch.current.splinePosition).normalize()
      right.crossVectors(forward, WORLD_UP).normalize()
      up.crossVectors(right, forward).normalize()

      drift.set(0, 0, 0)
      for (const wave of DRIFT) {
        const value =
          Math.sin((s.elapsed / wave.period) * Math.PI * 2 + wave.phase) * wave.amplitude
        drift[wave.axis] += value
      }

      /*
       * The pointer is smoothed rather than followed directly: a parallax that
       * tracks the cursor exactly feels attached to the mouse, while one that
       * trails it feels like the camera has mass.
       */
      s.parallax.x = damp(s.parallax.x, frameState.pointer.x, 2.2, dt)
      s.parallax.y = damp(s.parallax.y, frameState.pointer.y, 2.2, dt)

      const lateral = drift.x + s.parallax.x * PARALLAX_POSITION
      const vertical = drift.y + s.parallax.y * PARALLAX_POSITION * 0.6
      const along = drift.z

      scratch.current.splinePosition.addScaledVector(right, lateral)
      scratch.current.splinePosition.addScaledVector(up, vertical)
      scratch.current.splinePosition.addScaledVector(forward, along)

      // The aim point follows a fraction of the same motion, which keeps the
      // subject roughly centred while the framing breathes around it.
      scratch.current.splineTarget.addScaledVector(right, s.parallax.x * PARALLAX_TARGET)
      scratch.current.splineTarget.addScaledVector(
        up,
        s.parallax.y * PARALLAX_TARGET * 0.6,
      )
    }

    const baseFov =
      s.fovs.length > 1
        ? s.fovs[segment] +
          (s.fovs[segment + 1] - s.fovs[segment]) * easeInOutCubic(local)
        : s.fovs[0]

    /*
     * Scrolling fast opens the lens very slightly. It reads as speed without
     * anything as crude as motion blur, and it settles back on its own.
     */
    // Uses the measured speed, not Lenis's velocity, so the lens also opens during
    // the attract mode.
    const speed = clamp(Math.abs(store.scrollSpeed) / 900, 0, 1)
    s.speedFov = damp(s.speedFov, reducedMotion ? 0 : speed * SPEED_FOV, 3, dt)
    const targetFov = baseFov + s.speedFov

    // --- layer 3: weight -----------------------------------------------------
    /*
     * The damping adapts to how fast the page is moving.
     *
     * A fixed rate has to compromise: tight enough to keep up with a fast dolly
     * (the attract mode crosses the machine at 650 px/s, and a lag that reads as
     * weight at walking pace reads as the camera trailing behind at that speed) and
     * loose enough to feel heavy when scrolling slowly. Letting the rate follow the
     * scroll velocity gives both, and it applies to a fast manual flick as much as
     * to the attract mode.
     */
    // Pixels per second, from the scroll director: about 900 px/s is already the
    // attract mode at full tilt.
    const pace = clamp(Math.abs(store.scrollSpeed) / 900, 0, 1)
    const lambda = reducedMotion ? 22 : 5 + pace * 8

    if (!s.initialised) {
      // Land exactly on the opening frame rather than flying in from the origin.
      s.current.copy(scratch.current.splinePosition)
      s.lookAt.copy(scratch.current.splineTarget)
      s.fov = targetFov
      s.initialised = true
    } else {
      s.current.set(
        damp(s.current.x, scratch.current.splinePosition.x, lambda, dt),
        damp(s.current.y, scratch.current.splinePosition.y, lambda, dt),
        damp(s.current.z, scratch.current.splinePosition.z, lambda, dt),
      )
      s.lookAt.set(
        damp(s.lookAt.x, scratch.current.splineTarget.x, lambda, dt),
        damp(s.lookAt.y, scratch.current.splineTarget.y, lambda, dt),
        damp(s.lookAt.z, scratch.current.splineTarget.z, lambda, dt),
      )
      s.fov = damp(s.fov, targetFov, lambda, dt)
    }

    // Roll through the up vector rather than by rotating after lookAt, so it
    // cannot fight the orientation lookAt just computed.
    const targetRoll = reducedMotion
      ? 0
      : -s.parallax.x * (PARALLAX_ROLL * Math.PI) / 180
    s.roll = damp(s.roll, targetRoll, 3, dt)

    camera.position.copy(s.current)
    camera.up.set(Math.sin(s.roll), Math.cos(s.roll), 0)
    camera.lookAt(s.lookAt)

    if (Math.abs(camera.fov - s.fov) > 0.002) {
      camera.fov = s.fov
      camera.updateProjectionMatrix()
    }
  })

  return null
}