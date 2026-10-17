import { useMemo } from 'react'
import * as THREE from 'three'
import { PF_COILS, MIDPLANE } from '../../data/iter.js'
import { useFade } from '../useFade.js'
import { circleCenterline, roundedRectProfile, sweepClosed } from '../geometry/sweep.js'

/**
 * The six poloidal field coils.
 *
 * These are the rings that shape the plasma column: PF1 and PF6 sit closest to the
 * axis, PF3 and PF4 are the widest at 11.2 and 11.9 m radius. Each is swept from
 * the same kernel as the TF coils, which gives them a squared-off winding-pack
 * section instead of a torus tube — the detail that makes them look wound rather
 * than modelled.
 *
 * The sweep is built in the radial/vertical plane and then laid flat, because the
 * kernel's out-of-plane axis is fixed.
 */
export function PFCoils() {
  const [coilCase] = useFade(['coilCasePF'], 'pf')

  const coils = useMemo(
    () =>
      PF_COILS.map((coil) => ({
        ...coil,
        geometry: sweepClosed(
          circleCenterline(coil.radius, 200),
          roundedRectProfile(coil.section, coil.section * 0.92, 0.14, 4),
          { uvRepeat: 14 },
        ),
      })),
    [],
  )

  return (
    <group renderOrder={2}>
      {coils.map((coil) => (
        <mesh
          key={coil.name}
          geometry={coil.geometry}
          material={coilCase}
          // Lay the vertical-plane sweep flat, then lift it to the coil's height.
          rotation={[Math.PI / 2, 0, 0]}
          position={[0, MIDPLANE + coil.y, 0]}
        />
      ))}
    </group>
  )
}