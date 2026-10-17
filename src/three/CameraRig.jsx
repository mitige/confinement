import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useDirectorStore } from '../scroll/ScrollDirector.jsx'
import { TIMELINE } from '../data/acts.js'
import { clamp, damp, easeInOutCubic, invLerp } from '../lib/math.js'

/**
 * Drives the camera from the act timeline.
 *
 * Each act declares a small set of camera keys. They are threaded onto a
 * Catmull-Rom spline so the camera swings through arcs rather than snapping
 * between points, and the parameter along that spline is advanced linearly —
 * because a spline is already C1 continuous, linear parameterisation keeps the
 * motion smooth without the velocity collapsing to zero at every key. Easing per
 * segment would make the camera stop dead at each keyframe.
 *
 * On top of that the resulting position is critically damped, which absorbs the
 * velocity discontinuities at act boundaries and gives the whole piece its
 * weighted, physical feel.
 */
export function CameraRig({ reducedMotion = false }) {
  const camera = useThree((s) => s.camera)
  const store = useDirectorStore()

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
    initialised: false,
  })

  const scratch = useRef({
    splinePosition: new THREE.Vector3(),
    splineTarget: new THREE.Vector3(),
  })

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    const act = TIMELINE[store.actIndex]
    const s = state.current
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

    const targetFov =
      s.fovs.length > 1
        ? s.fovs[segment] +
          (s.fovs[segment + 1] - s.fovs[segment]) * easeInOutCubic(local)
        : s.fovs[0]

    const lambda = reducedMotion ? 22 : 3.6

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

    camera.position.copy(s.current)
    camera.lookAt(s.lookAt)

    if (Math.abs(camera.fov - s.fov) > 0.002) {
      camera.fov = s.fov
      camera.updateProjectionMatrix()
    }
  })

  return null
}