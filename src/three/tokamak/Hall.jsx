import { useMemo } from 'react'
import * as THREE from 'three'
import { HALL, CRYOSTAT } from '../../data/iter.js'
import { useFade } from '../useFade.js'
import { radialFalloff } from '../materials/textures.js'

/**
 * The hall the machine stands in.
 *
 * Two surfaces: a polished floor and a baked contact shadow. There is no wall.
 *
 * A 180 m radius concrete cylinder was removed for frame time: the camera stands
 * inside it, so it covered every pixel the machine did not, and being double-sided
 * PBR concrete it cost a full-screen shaded pass in order to render a surface that
 * is nearly black. Against a black clear colour and exponential fog, its absence is
 * invisible and the background is cleaner for it.
 *
 * The shadow is a static radial falloff rather than a real shadow map. At this
 * scale a shadow map would need a footprint wide enough to cover the whole floor,
 * which costs a large render target for a result that is barely visible from the
 * angles this piece actually uses. A baked gradient grounds the machine for free.
 */
export function Hall() {
  const [floor] = useFade(['floorPolish'], 'hall')

  const geometry = useMemo(
    () => ({
      floor: new THREE.CircleGeometry(HALL.radius, 96),
      shadow: new THREE.PlaneGeometry(
        CRYOSTAT.baseRingRadius * 3.4,
        CRYOSTAT.baseRingRadius * 3.4,
      ),
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
        geometry={geometry.shadow}
        material={shadowMaterial}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.05, 0]}
      />
    </group>
  )
}