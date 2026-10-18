import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { DIVERTOR, MIDPLANE } from '../../data/iter.js'
import { useFade } from '../useFade.js'

/**
 * The divertor: 54 tungsten cassettes in the bottom of the vessel.
 *
 * This is the component that takes the exhaust, so it is deliberately the darkest,
 * roughest surface in the machine — tungsten at 0.7 roughness against the
 * cryostat's polished Inconel. Each cassette is tilted about the toroidal axis so
 * the array forms the angled V that the scrape-off layer lands on.
 *
 * A support ring underneath ties the cassettes together, so the assembly reads as
 * a structure rather than as floating blocks.
 */
export function Divertor() {
  const group = useRef(null)
  const [tungsten, support] = useFade(['tungsten', 'blanketSteel'], 'divertor', {
    groupRef: group,
  })
  const mesh = useRef(null)

  const { geometry, placements } = useMemo(() => {
    const { count, radius, y, tilt, width, height, depth } = DIVERTOR
    const placements = []

    const qY = new THREE.Quaternion()
    const qX = new THREE.Quaternion()
    const quaternion = new THREE.Quaternion()
    const position = new THREE.Vector3()
    const scale = new THREE.Vector3(width, height, depth)

    for (let i = 0; i < count; i += 1) {
      const phi = (i / count) * Math.PI * 2
      position.set(radius * Math.cos(phi), MIDPLANE + y, radius * Math.sin(phi))

      // Rotate into position around the axis, then lean the cassette in the
      // poloidal plane so it faces up and inward toward the plasma.
      qY.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -phi)
      qX.setFromAxisAngle(new THREE.Vector3(1, 0, 0), tilt)
      quaternion.multiplyQuaternions(qY, qX)

      placements.push({
        position: position.clone(),
        quaternion: quaternion.clone(),
        scale: scale.clone(),
      })
    }

    return { geometry: new THREE.BoxGeometry(1, 1, 1), placements }
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

  const ringGeometry = useMemo(
    () => new THREE.TorusGeometry(DIVERTOR.radius, 0.22, 8, 128),
    [],
  )

  return (
    <group ref={group} renderOrder={5}>
      <instancedMesh
        ref={mesh}
        args={[geometry, tungsten, placements.length]}
        frustumCulled={false}
      />
      <mesh
        geometry={ringGeometry}
        material={support}
        position={[0, MIDPLANE + DIVERTOR.y - DIVERTOR.height * 0.55, 0]}
        rotation={[Math.PI / 2, 0, 0]}
      />
    </group>
  )
}