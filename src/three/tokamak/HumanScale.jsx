import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { HUMAN } from '../../data/iter.js'
import { useFade } from '../useFade.js'
import { makeLabelSprite, makeDimensionLine } from '../geometry/labels.js'

/**
 * A 1.8 m human figure, standing on the hall floor beside the cryostat.
 *
 * This is the single most important object in the piece for credibility. A 30 m
 * machine is impossible to judge in isolation — with a person next to it, the
 * claim "real scale" becomes something the viewer verifies with their own eye
 * instead of taking on faith.
 *
 * Rendered in matte black so it reads as a pure silhouette, and dimensioned with a
 * proper engineering span line and a 3D billboard label that is occluded by the
 * machine like any other object.
 */

/** Placed just outside the cryostat's base ring, on the +x/+z side. */
const POSITION = [14.0, 0, 16.0]

export function HumanScale() {
  const groupRef = useRef(null)
  const labelRef = useRef(null)
  const lineRef = useRef(null)

  const parts = useMemo(() => {
    const total = HUMAN.height
    return {
      head: {
        geometry: new THREE.SphereGeometry(0.108, 20, 16),
        position: [0, total - 0.11, 0],
      },
      torso: {
        geometry: new THREE.CapsuleGeometry(0.152, 0.6, 6, 16),
        position: [0, total - 0.46, 0],
      },
      hips: {
        geometry: new THREE.CapsuleGeometry(0.13, 0.16, 4, 12),
        position: [0, total - 0.86, 0],
      },
      legs: [-1, 1].map((side) => ({
        geometry: new THREE.CapsuleGeometry(0.082, 0.72, 5, 12),
        position: [side * 0.093, total - 1.3, 0],
      })),
      arms: [-1, 1].map((side) => ({
        geometry: new THREE.CapsuleGeometry(0.06, 0.58, 5, 12),
        position: [side * 0.245, total - 0.5, 0],
      })),
    }
  }, [])

  // Offset the dimension line sideways so it never overlaps the figure, using the
  // tangential direction at the figure's position.
  const { lineObject, labelObject } = useMemo(() => {
    const [x, , z] = POSITION
    const radius = Math.hypot(x, z)
    const tangent = [-z / radius, 0, x / radius]
    const offset = -0.95

    const ax = x + tangent[0] * offset
    const az = z + tangent[2] * offset

    const lineObject = makeDimensionLine([ax, 0, az], [ax, HUMAN.height, az])
    const labelObject = makeLabelSprite('1.8 m', {
      worldHeight: 0.42,
      fontSize: 72,
      weight: 500,
      tracking: 2,
      opacity: 0.72,
    })
    labelObject.position.set(
      ax + tangent[0] * 0.55,
      HUMAN.height * 0.5,
      az + tangent[2] * 0.55,
    )

    return { lineObject, labelObject }
  }, [])

  const [figure] = useFade(['figureBlack'], 'human', {
    onUpdate: (value) => {
      if (groupRef.current) groupRef.current.visible = value > 0.01
      if (lineRef.current) lineRef.current.material.opacity = 0.42 * value
      if (labelRef.current) labelRef.current.material.opacity = 0.72 * value
    },
  })

  return (
    <group ref={groupRef} position={POSITION} renderOrder={20}>
      <mesh geometry={parts.head.geometry} material={figure} position={parts.head.position} />
      <mesh geometry={parts.torso.geometry} material={figure} position={parts.torso.position} />
      <mesh geometry={parts.hips.geometry} material={figure} position={parts.hips.position} />
      {parts.legs.map((leg, i) => (
        <mesh key={`leg-${i}`} geometry={leg.geometry} material={figure} position={leg.position} />
      ))}
      {parts.arms.map((arm, i) => (
        <mesh key={`arm-${i}`} geometry={arm.geometry} material={figure} position={arm.position} />
      ))}

      <primitive ref={lineRef} object={lineObject} />
      <primitive ref={labelRef} object={labelObject} />
    </group>
  )
}