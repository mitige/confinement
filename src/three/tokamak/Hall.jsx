import { useMemo } from 'react'
import * as THREE from 'three'
import { HALL, CRYOSTAT } from '../../data/iter.js'
import { useFade } from '../useFade.js'
import { radialFalloff } from '../materials/textures.js'

/**
 * The hall the machine stands in.
 *
 * Three surfaces: a polished floor, a matte cylindrical wall, and a baked contact
 * shadow under the machine. The wall is double-sided so it never disappears when
 * the camera swings wide, and its radius is deliberately far larger than any
 * camera position — if the camera ever leaves the hall it ends up looking at a
 * concrete wall instead of at the machine.
 *
 * The shadow is a static radial falloff rather than a real shadow map. At this
 * scale a shadow map would need a footprint wide enough to cover the whole hall,
 * which costs a large render target for a result that is barely visible from the
 * angles this piece actually uses. A baked gradient grounds the machine for free.
 */
export function Hall() {
  const [concrete, floor] = useFade(['concrete', 'floorPolish'], 'hall')

  const geometry = useMemo(
    () => ({
      floor: new THREE.CircleGeometry(HALL.radius, 128),
      wall: new THREE.CylinderGeometry(HALL.radius, HALL.radius, HALL.height, 128, 1, true),
      shadow: new THREE.PlaneGeometry(CRYOSTAT.baseRingRadius * 3.4, CRYOSTAT.baseRingRadius * 3.4),
    }),
    [],
  )

  const shadowMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: radialFalloff({ power: 1.7 }),
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  )

  return (
    <group renderOrder={0}>
      <mesh
        geometry={geometry.floor}
        material={floor}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.02, 0]}
      />
      <mesh
        geometry={geometry.wall}
        material={concrete}
        position={[0, HALL.height / 2, 0]}
      />
      <mesh
        geometry={geometry.shadow}
        material={shadowMaterial}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.05, 0]}
      />
    </group>
  )
}