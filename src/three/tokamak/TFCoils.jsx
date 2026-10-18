import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { TF_COILS, MIDPLANE } from '../../data/iter.js'
import { useFade } from '../useFade.js'
import { dShapeCenterline, roundedRectProfile, sweepClosed } from '../geometry/sweep.js'

/**
 * The 18 toroidal field coils.
 *
 * Each is a 17 m tall, 360 tonne D-shaped winding pack in a steel case, swept from
 * the hand-built geometry kernel so the cross-section stays a true rectangle all
 * the way round a closed planar path.
 *
 * All 18 share one geometry and one instanced draw call. They are rotated about
 * the vertical axis only, so a single instance matrix per coil is enough.
 */
export function TFCoils() {
  const group = useRef(null)
  const [coilCase] = useFade(['coilCaseTF'], 'coils', { groupRef: group })
  const mesh = useRef(null)

  const geometry = useMemo(
    () =>
      sweepClosed(
        dShapeCenterline({
          innerRadius: TF_COILS.innerRadius,
          arcCentre: TF_COILS.arcCentre,
          semiR: TF_COILS.semiR,
          semiZ: TF_COILS.semiZ,
        }),
        roundedRectProfile(TF_COILS.packRadial, TF_COILS.packToroidal, 0.2, 5),
        { uvRepeat: 8 },
      ),
    [],
  )

  useEffect(() => {
    const inst = mesh.current
    if (!inst) return
    const dummy = new THREE.Object3D()
    for (let i = 0; i < TF_COILS.count; i += 1) {
      // The geometry is built in the radial/vertical plane, so a rotation about
      // the vertical axis places each coil around the torus.
      dummy.position.set(0, MIDPLANE, 0)
      dummy.rotation.set(0, (i / TF_COILS.count) * Math.PI * 2, 0)
      dummy.scale.setScalar(1)
      dummy.updateMatrix()
      inst.setMatrixAt(i, dummy.matrix)
    }
    inst.instanceMatrix.needsUpdate = true
  }, [])

  /*
   * Wrapped in a group even though it holds a single mesh: the ghost swap
   * reaches assemblies by traversing one, and an InstancedMesh cannot be its
   * own ancestor.
   */
  return (
    <group ref={group}>
      <instancedMesh
        ref={mesh}
        args={[geometry, coilCase, TF_COILS.count]}
        renderOrder={2}
        frustumCulled={false}
      />
    </group>
  )
}