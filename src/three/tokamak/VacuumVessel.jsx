import { useMemo } from 'react'
import * as THREE from 'three'
import { VESSEL, MIDPLANE } from '../../data/iter.js'
import { useFade } from '../useFade.js'
import { fluxSurfaceOutline } from '../geometry/sweep.js'

/**
 * The vacuum vessel: 19.4 m across, 11.4 m tall, 5000 tonnes of welded steel.
 *
 * Modelled as two closed surfaces of revolution — the outer skin and the inner
 * skin. Each is a D-torus, so both are watertight and the depth buffer sorts them
 * correctly from either side: outside the machine you see the outer skin, and from
 * inside the vessel you see the inner one. No boolean geometry, no z-fighting.
 *
 * The profile is sampled with the flux-surface parametrisation rather than being a
 * stretched torus, so the vessel's elongation and triangularity match the plasma's.
 *
 * It is the largest surface in the piece and it is double-sided, so its
 * tessellation is kept to the point where the silhouette stops improving — 144
 * profile points by 112 segments — rather than to a round number.
 */
export function VacuumVessel() {
  const [steel] = useFade(['vesselSteel'], 'vessel')

  const { outer, inner } = useMemo(() => {
    const kappa = VESSEL.halfHeight / VESSEL.halfWidth
    const common = {
      R0: VESSEL.radialCentre,
      kappa,
      delta: VESSEL.delta,
      samples: 144,
      close: true,
    }
    return {
      outer: new THREE.LatheGeometry(
        fluxSurfaceOutline({ ...common, a: VESSEL.halfWidth }),
        112,
      ),
      inner: new THREE.LatheGeometry(
        fluxSurfaceOutline({ ...common, a: VESSEL.halfWidth - VESSEL.thickness }),
        112,
      ),
    }
  }, [])

  return (
    <group renderOrder={3} position={[0, MIDPLANE, 0]}>
      <mesh geometry={outer} material={steel} />
      <mesh geometry={inner} material={steel} />
    </group>
  )
}