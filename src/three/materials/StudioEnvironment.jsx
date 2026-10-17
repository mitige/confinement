import { useEffect } from 'react'
import * as THREE from 'three'
import { useThree } from '@react-three/fiber'

/**
 * A procedural studio environment.
 *
 * Metal has no diffuse response — it is nothing but reflected environment. A flat
 * ambient light would make every surface in this piece look like grey plastic, so
 * instead we build a small emissive "room", render it through PMREMGenerator, and
 * hand the result to `scene.environment`.
 *
 * The rig is deliberately asymmetric, with a large bright ceiling softbox and
 * unequal side strips, so cylindrical surfaces pick up a moving highlight as the
 * camera orbits instead of a uniform sheen. Nothing is downloaded: this replaces
 * an HDRI.
 *
 * The lux values are HDR and were tuned against measured frame luminance, not by
 * eye: metals in this scene have almost no diffuse response, so if the
 * environment is dim the whole machine reads as grey plastic in near-darkness.
 */

/** Brightness here is HDR — values above 1 survive into the half-float target. */
const PANELS = [
  // Ceiling softbox: the dominant key, and the long highlight on the cryostat.
  { size: [46, 46], pos: [0, 27, 0], rot: [Math.PI / 2, 0, 0], lux: 7.6 },
  // Inboard strip, brightest of the side lights.
  { size: [5, 30], pos: [-24, 12, 0], rot: [0, Math.PI / 2, 0], lux: 4.3 },
  // Outboard strip, weaker, for contrast across the machine.
  { size: [5, 30], pos: [24, 12, 0], rot: [0, -Math.PI / 2, 0], lux: 2.6 },
  // Rear bounce, gives the far side of the vessel some separation from black.
  { size: [34, 22], pos: [0, 13, -27], rot: [0, 0, 0], lux: 1.8 },
  // Front fill, kept low so the machine never flattens.
  { size: [34, 22], pos: [0, 13, 27], rot: [0, Math.PI, 0], lux: 0.95 },
  // Floor bounce.
  { size: [40, 40], pos: [0, -14, 0], rot: [-Math.PI / 2, 0, 0], lux: 0.5 },
  /*
   * Horizon fill.
   *
   * These matter more than they look. A rough metal surface reflects a narrow
   * cone of the environment, so at close range — the camera 1.5 m from a coil
   * face — it samples one small patch. If the gaps between the bright panels are
   * pure black, the surface reads as black metal in a void. Four mid-level panels
   * on the diagonals give every reflection direction something to return.
   */
  { size: [26, 20], pos: [-19, 6, -19], rot: [0, Math.PI / 4, 0], lux: 1.15 },
  { size: [26, 20], pos: [19, 6, -19], rot: [0, -Math.PI / 4, 0], lux: 1.15 },
  { size: [26, 20], pos: [-19, 6, 19], rot: [0, (3 * Math.PI) / 4, 0], lux: 1.15 },
  { size: [26, 20], pos: [19, 6, 19], rot: [0, (-3 * Math.PI) / 4, 0], lux: 1.15 },
]

export function StudioEnvironment({ intensity = 1 }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)

  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl)

    const envScene = new THREE.Scene()
    // A dark grey room rather than a black void: reflections need a floor value.
    envScene.background = new THREE.Color(0.1, 0.1, 0.11)

    const disposables = []
    for (const panel of PANELS) {
      const geo = new THREE.PlaneGeometry(panel.size[0], panel.size[1])
      const mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(panel.lux, panel.lux, panel.lux),
        side: THREE.DoubleSide,
        toneMapped: false,
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(...panel.pos)
      mesh.rotation.set(...panel.rot)
      envScene.add(mesh)
      disposables.push(geo, mat)
    }

    const target = pmrem.fromScene(envScene, 0.03)
    scene.environment = target.texture
    // three >= r163 exposes environmentIntensity on the scene.
    if ('environmentIntensity' in scene) scene.environmentIntensity = intensity

    for (const d of disposables) d.dispose()
    pmrem.dispose()

    return () => {
      scene.environment = null
      target.dispose()
    }
  }, [gl, scene, intensity])

  return null
}