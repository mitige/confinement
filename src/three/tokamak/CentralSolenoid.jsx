import { useMemo } from 'react'
import * as THREE from 'three'
import { CENTRAL_SOLENOID, MIDPLANE } from '../../data/iter.js'
import { useFade } from '../useFade.js'

/**
 * The central solenoid: six stacked modules, 13 m tall and 1000 tonnes, that
 * induce the plasma current.
 *
 * The stack is laid out by accumulating module and gap heights from the published
 * total height, so the assembly always fills exactly 13 m regardless of how the
 * module count is changed. Copper bands sit in the gaps between modules, where the
 * conductor joints are on the real machine.
 */
export function CentralSolenoid() {
  const [steel, copper] = useFade(['coilCaseCS', 'windingCopper'], 'cs')

  const { modules, bands } = useMemo(() => {
    const { modules: count, height, outerRadius } = CENTRAL_SOLENOID
    const gap = 0.3
    const moduleHeight = (height - gap * (count - 1)) / count

    const y0 = MIDPLANE - height / 2
    const moduleGeometry = new THREE.CylinderGeometry(
      outerRadius,
      outerRadius,
      moduleHeight,
      72,
      1,
      false,
    )
    const bandGeometry = new THREE.CylinderGeometry(
      outerRadius * 0.965,
      outerRadius * 0.965,
      gap,
      72,
    )

    const mods = []
    const bnds = []
    let cursor = y0
    for (let i = 0; i < count; i += 1) {
      mods.push({ y: cursor + moduleHeight / 2 })
      cursor += moduleHeight
      if (i < count - 1) {
        bnds.push({ y: cursor + gap / 2 })
        cursor += gap
      }
    }

    return { modules: { list: mods, geometry: moduleGeometry }, bands: { list: bnds, geometry: bandGeometry } }
  }, [])

  return (
    <group renderOrder={2}>
      {modules.list.map((m, i) => (
        <mesh key={`mod-${i}`} geometry={modules.geometry} material={steel} position={[0, m.y, 0]} />
      ))}
      {bands.list.map((b, i) => (
        <mesh key={`band-${i}`} geometry={bands.geometry} material={copper} position={[0, b.y, 0]} />
      ))}
    </group>
  )
}