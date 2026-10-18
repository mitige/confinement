import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { BLANKET, VESSEL, MIDPLANE } from '../../data/iter.js'
import { useFade } from '../useFade.js'
import { fluxSurfaceOutline } from '../geometry/sweep.js'

/**
 * The 440 first-wall blanket modules.
 *
 * 44 toroidal positions by 10 poloidal positions. Each module is oriented from the
 * local wall frame — its thickness along the wall normal, its width along the
 * toroidal direction, its depth along the poloidal tangent — so the array wraps
 * the D-shaped wall properly instead of facing outward from the axis.
 *
 * They stop short of the bottom of the vessel, where the divertor sits, which is
 * exactly how the real first wall is arranged. All 440 are one instanced draw.
 */

/** Poloidal coverage: the top and both flanks, leaving the divertor region bare. */
const THETA_START = -Math.PI / 3
const THETA_SPAN = (Math.PI * 5) / 3

export function Blanket() {
  const group = useRef(null)
  const [steel] = useFade(['blanketSteel'], 'blanket', { groupRef: group })
  const mesh = useRef(null)

  const { geometry, placements } = useMemo(() => {
    const kappa = VESSEL.halfHeight / VESSEL.halfWidth
    const contour = fluxSurfaceOutline({
      R0: VESSEL.radialCentre,
      a: VESSEL.halfWidth - VESSEL.thickness,
      kappa,
      delta: VESSEL.delta,
      samples: 480,
    })
    const n = contour.length

    // Wall normal at a contour index, pointing out of the vessel interior.
    const normalAt = (index) => {
      const prev = contour[(index - 1 + n) % n]
      const next = contour[(index + 1) % n]
      const tr = next.x - prev.x
      const tz = next.y - prev.y
      const len = Math.hypot(tr, tz) || 1
      // (tz, -tr) is the outward direction for this winding order.
      return new THREE.Vector2(tz / len, -tr / len)
    }

    const { toroidal, poloidal } = BLANKET
    const half = BLANKET.thickness / 2

    // Pre-compute every poloidal station so depth can be measured from neighbours.
    const stations = []
    for (let p = 0; p < poloidal; p += 1) {
      const t = (p + 0.5) / poloidal
      const theta = THETA_START + t * THETA_SPAN
      const index = Math.round(((theta / (Math.PI * 2)) % 1 + 1) % 1 * n) % n
      const point = contour[index]
      const normal = normalAt(index)
      stations.push({ point, normal, theta })
    }

    const localDepth = stations.map((station, p) => {
      const a = stations[(p - 1 + poloidal) % poloidal].point
      const b = stations[(p + 1) % poloidal].point
      return a.distanceTo(b) / 2
    })

    const placements = []
    const eR = new THREE.Vector3()
    const eT = new THREE.Vector3()
    const eP = new THREE.Vector3()
    const basis = new THREE.Matrix4()
    const quaternion = new THREE.Quaternion()
    const position = new THREE.Vector3()
    const scale = new THREE.Vector3()

    for (let t = 0; t < toroidal; t += 1) {
      const phi = (t / toroidal) * Math.PI * 2
      const cos = Math.cos(phi)
      const sin = Math.sin(phi)

      for (let p = 0; p < poloidal; p += 1) {
        const { point, normal } = stations[p]
        // Centre of the module: pushed off the wall, into the vessel.
        const r = point.x - normal.x * half
        const z = point.y - normal.y * half

        position.set(r * cos, MIDPLANE + z, r * sin)

        // Outward wall normal, lifted into 3D at this toroidal angle.
        eR.set(normal.x * cos, normal.y, normal.x * sin).normalize()
        eT.set(-sin, 0, cos).normalize()
        eP.crossVectors(eT, eR).normalize()

        basis.makeBasis(eT, eR, eP)
        quaternion.setFromRotationMatrix(basis)

        const circumference = Math.PI * 2 * r
        scale.set((circumference / toroidal) * 0.88, BLANKET.thickness, localDepth[p] * 0.88)

        placements.push({
          position: position.clone(),
          quaternion: quaternion.clone(),
          scale: scale.clone(),
        })
      }
    }

    return {
      geometry: new THREE.BoxGeometry(1, 1, 1),
      placements,
    }
  }, [])

  useEffect(() => {
    const inst = mesh.current
    if (!inst) return
    const matrix = new THREE.Matrix4()
    for (let i = 0; i < placements.length; i += 1) {
      const { position, quaternion, scale } = placements[i]
      matrix.compose(position, quaternion, scale)
      inst.setMatrixAt(i, matrix)
    }
    inst.instanceMatrix.needsUpdate = true
  }, [placements])

  /*
   * Wrapped in a group even though it holds a single mesh: the ghost swap
   * reaches assemblies by traversing one, and an InstancedMesh cannot be its
   * own ancestor.
   */
  return (
    <group ref={group}>
      <instancedMesh
        ref={mesh}
        args={[geometry, steel, placements.length]}
        renderOrder={4}
        frustumCulled={false}
      />
    </group>
  )
}