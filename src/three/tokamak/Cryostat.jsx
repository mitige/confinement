import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { CRYOSTAT } from '../../data/iter.js'
import { useFade } from '../useFade.js'

/**
 * The cryostat: a 28.6 m diameter, 29.3 m tall stainless steel vessel that
 * encloses the whole tokamak.
 *
 * Built as two concentric open cylinders rather than one thin shell, so the rim
 * between them shows a real 350 mm wall when the camera looks at the top, and the
 * interior is already correct for the acts that fly inside.
 *
 * Vertical stiffener ribs and horizontal ring bands are what actually sell the
 * scale: without panelling, a cylinder this large reads as an untextured tube.
 */

const RIB_COUNT = 24
const RING_BANDS = [7.2, 14.65, 22.1]

export function Cryostat() {
  const [shell, solid, heavy] = useFade(
    ['inconelShell', 'inconel', 'inconelHeavy'],
    'cryostat',
  )

  const ribs = useRef(null)

  const geometry = useMemo(() => {
    const { radius, thickness, height, lid, baseRingRadius, baseRingHeight } = CRYOSTAT
    return {
      outer: new THREE.CylinderGeometry(radius, radius, height, 96, 1, true),
      inner: new THREE.CylinderGeometry(
        radius - thickness,
        radius - thickness,
        height,
        96,
        1,
        true,
      ),
      lid: new THREE.CylinderGeometry(radius, radius, lid, 128),
      lidHub: new THREE.CylinderGeometry(radius * 0.34, radius * 0.4, 3.2, 64),
      baseRing: new THREE.CylinderGeometry(
        baseRingRadius,
        baseRingRadius,
        baseRingHeight,
        128,
      ),
      rib: new THREE.BoxGeometry(0.42, height, 0.5),
      band: new THREE.TorusGeometry(radius + 0.12, 0.16, 8, 128),
    }
  }, [])

  // Ribs are placed once: 24 equally spaced vertical stiffeners on the outside.
  useEffect(() => {
    const mesh = ribs.current
    if (!mesh) return
    const dummy = new THREE.Object3D()
    for (let i = 0; i < RIB_COUNT; i += 1) {
      const angle = (i / RIB_COUNT) * Math.PI * 2
      dummy.position.set(
        Math.sin(angle) * (CRYOSTAT.radius + 0.12),
        CRYOSTAT.height / 2,
        Math.cos(angle) * (CRYOSTAT.radius + 0.12),
      )
      dummy.rotation.set(0, angle, 0)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [])

  return (
    <group renderOrder={1}>
      <mesh geometry={geometry.outer} material={shell} position={[0, CRYOSTAT.height / 2, 0]} />
      <mesh geometry={geometry.inner} material={shell} position={[0, CRYOSTAT.height / 2, 0]} />

      <instancedMesh
        ref={ribs}
        args={[geometry.rib, solid, RIB_COUNT]}
        frustumCulled={false}
      />

      {RING_BANDS.map((y) => (
        <mesh
          key={y}
          geometry={geometry.band}
          material={solid}
          position={[0, y, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        />
      ))}

      <mesh
        geometry={geometry.lid}
        material={heavy}
        position={[0, CRYOSTAT.height - CRYOSTAT.lid / 2, 0]}
      />
      <mesh geometry={geometry.lidHub} material={heavy} position={[0, CRYOSTAT.height + 1.4, 0]} />
      <mesh
        geometry={geometry.baseRing}
        material={heavy}
        position={[0, CRYOSTAT.baseRingHeight / 2, 0]}
      />
    </group>
  )
}