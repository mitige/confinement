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
 * The trunk stops at 28.4 m and the top cap occupies the last 0.9 m, so the cap can
 * be wider than the trunk without the machine growing past its published height.
 * Vertical stiffener ribs and horizontal ring bands are what actually sell the
 * scale: without panelling, a cylinder this large reads as an untextured tube.
 */

const RIB_COUNT = 24
/** Evenly spread over the trunk, not over the total height. */
const RING_BANDS = [7.1, 14.2, 21.3]

export function Cryostat() {
  const [shell, solid, heavy] = useFade(
    ['inconelShell', 'inconel', 'inconelHeavy'],
    'cryostat',
  )

  const ribs = useRef(null)

  const geometry = useMemo(() => {
    const {
      radius,
      thickness,
      shellHeight,
      height,
      capRadius,
      flangeHeight,
      plateInset,
      baseRingRadius,
      baseRingHeight,
    } = CRYOSTAT

    // The ribs run a little past the trunk so their top face ends up buried inside
    // the flange. Stopping them exactly at the flange's underside would leave two
    // coplanar faces touching, which is the same artefact the cap used to cause.
    const ribHeight = shellHeight + 0.3

    return {
      outer: new THREE.CylinderGeometry(radius, radius, shellHeight, 96, 1, true),
      inner: new THREE.CylinderGeometry(
        radius - thickness,
        radius - thickness,
        shellHeight,
        96,
        1,
        true,
      ),
      // The cap. Wider than the trunk so it overhangs it, and stepped rather than
      // flush so the flange reads as a lip.
      flange: new THREE.CylinderGeometry(capRadius, capRadius, flangeHeight, 128),
      plate: new THREE.CylinderGeometry(
        capRadius - plateInset,
        capRadius - plateInset,
        height - shellHeight - flangeHeight,
        128,
      ),
      baseRing: new THREE.CylinderGeometry(
        baseRingRadius,
        baseRingRadius,
        baseRingHeight,
        128,
      ),
      rib: new THREE.BoxGeometry(0.42, ribHeight, 0.5),
      band: new THREE.TorusGeometry(radius + 0.12, 0.16, 8, 128),
      ribHeight,
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
        geometry.ribHeight / 2,
        Math.cos(angle) * (CRYOSTAT.radius + 0.12),
      )
      dummy.rotation.set(0, angle, 0)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [geometry.ribHeight])

  const flangeY = CRYOSTAT.shellHeight + CRYOSTAT.flangeHeight / 2
  const plateHeight = CRYOSTAT.height - CRYOSTAT.shellHeight - CRYOSTAT.flangeHeight
  const plateY = CRYOSTAT.height - plateHeight / 2

  return (
    <group renderOrder={1}>
      <mesh
        geometry={geometry.outer}
        material={shell}
        position={[0, CRYOSTAT.shellHeight / 2, 0]}
      />
      <mesh
        geometry={geometry.inner}
        material={shell}
        position={[0, CRYOSTAT.shellHeight / 2, 0]}
      />

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

      <mesh geometry={geometry.flange} material={heavy} position={[0, flangeY, 0]} />
      <mesh geometry={geometry.plate} material={heavy} position={[0, plateY, 0]} />

      <mesh
        geometry={geometry.baseRing}
        material={heavy}
        position={[0, CRYOSTAT.baseRingHeight / 2, 0]}
      />
    </group>
  )
}