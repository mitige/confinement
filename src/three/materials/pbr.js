import * as THREE from 'three'
import {
  brushedRoughness,
  softNoise,
  weldSeams,
  machinedSurface,
} from './textures.js'

/**
 * The material library.
 *
 * Materials are singletons looked up by name, so a component can fade "its"
 * surface without holding a reference. Each visible assembly gets its own
 * instance even when two assemblies share a surface treatment, because the act
 * timeline fades them independently.
 *
 * Values are tuned for a metal-dominant scene under the procedural studio
 * environment: full metalness, moderate roughness, and a slight cool cast so the
 * greys sit together under cold key light.
 */

const BUILDERS = {
  /** Cryostat: brushed Inconel 316, the largest surface in the piece. */
  inconel: () => {
    const m = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#6d7278'),
      metalness: 1.0,
      roughness: 0.38,
      roughnessMap: brushedRoughness({ base: 0.4, streak: 0.18, direction: 'horizontal' }),
      envMapIntensity: 1.25,
    })
    return m
  },

  /**
   * The cryostat's cylindrical shells. Double-sided, so the same mesh shows its
   * outer skin from outside the machine and its inner skin from inside, and the
   * visible rim between the two shells gives the wall real thickness.
   */
  inconelShell: () =>
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#6d7278'),
      metalness: 1.0,
      roughness: 0.4,
      roughnessMap: brushedRoughness({ base: 0.42, streak: 0.18, direction: 'vertical', key: 'shell' }),
      envMapIntensity: 1.25,
      side: THREE.DoubleSide,
    }),

  /** Polished hall floor. A low-roughness metal gives a wet-floor sheen that
   *  grounds the machine instead of leaving it floating in black. */
  floorPolish: () =>
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#0a0b0d'),
      metalness: 0.72,
      roughness: 0.3,
      envMapIntensity: 0.9,
    }),

  /** Cryostat lid and base ring: heavier, less polished plate work. */
  inconelHeavy: () =>
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#5f646a'),
      metalness: 1.0,
      roughness: 0.52,
      roughnessMap: brushedRoughness({ base: 0.55, streak: 0.14, direction: 'vertical', key: 'heavy' }),
      envMapIntensity: 1.05,
    }),

  /** TF coil case: dark anodised steel. */
  coilCaseTF: () =>
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#4f565e'),
      metalness: 1.0,
      roughness: 0.4,
      roughnessMap: brushedRoughness({ base: 0.42, streak: 0.2, key: 'tf' }),
      envMapIntensity: 1.55,
    }),

  /** PF coil case: slightly lighter, so the two coil families read apart. */
  coilCasePF: () =>
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#5a626a'),
      metalness: 1.0,
      roughness: 0.42,
      roughnessMap: brushedRoughness({ base: 0.46, streak: 0.2, key: 'pf' }),
      envMapIntensity: 1.5,
    }),

  /** Central solenoid stack: stacked steel modules with visible disc seams. */
  coilCaseCS: () =>
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#666e77'),
      metalness: 1.0,
      roughness: 0.36,
      roughnessMap: weldSeams({ sectors: 1, ribs: 16, key: 'cs-seams' }),
      envMapIntensity: 1.6,
    }),

  /**
   * Winding packs. Real niobium-tin strands sit in a copper matrix, so the
   * exposed conductor bands are a muted copper — desaturated enough that under
   * cold light they read as warm grey rather than as a colour accent.
   */
  windingCopper: () =>
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#7a5540'),
      metalness: 1.0,
      roughness: 0.42,
      roughnessMap: brushedRoughness({ base: 0.44, streak: 0.24, key: 'cu' }),
      envMapIntensity: 1.0,
    }),

  /** Vacuum vessel: welded steel sectors with visible seams. */
  vesselSteel: () => {
    const seams = weldSeams({ sectors: 9, ribs: 4 })
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color('#7b8189'),
      metalness: 1.0,
      roughness: 0.5,
      roughnessMap: seams,
      bumpMap: seams,
      bumpScale: 0.05,
      envMapIntensity: 1.1,
      side: THREE.DoubleSide,
    })
  },

  /** First wall blanket modules: machined, slightly brighter than the vessel. */
  blanketSteel: () =>
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#8d939a'),
      metalness: 1.0,
      roughness: 0.44,
      roughnessMap: machinedSurface(),
      envMapIntensity: 1.15,
    }),

  /** Divertor: tungsten, deliberately rough and dark because it takes the heat. */
  tungsten: () =>
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#34363a'),
      metalness: 0.92,
      roughness: 0.7,
      roughnessMap: machinedSurface({ key: 'tungsten' }),
      envMapIntensity: 0.8,
    }),

  /** The 1.8 m reference figure. Matte black, so it reads as pure silhouette. */
  figureBlack: () =>
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#050506'),
      metalness: 0.1,
      roughness: 0.92,
      envMapIntensity: 0.35,
    }),

  /** Thin white line work for the technical overlays. */
  annotation: () =>
    new THREE.LineBasicMaterial({
      color: new THREE.Color('#ffffff'),
      transparent: true,
      opacity: 0.5,
      depthTest: false,
      depthWrite: false,
    }),
}

const registry = new Map()

/** Look up a material by name, building it on first use. */
export function material(name) {
  if (!registry.has(name)) {
    const build = BUILDERS[name]
    if (!build) throw new Error(`Unknown material: ${name}`)
    registry.set(name, build())
  }
  return registry.get(name)
}

/**
 * Apply a normalised fade to a material.
 *
 * Fully opaque surfaces keep depth writing, so solids occlude correctly. As soon
 * as a surface starts to fade we drop depth writing, which turns it into an
 * x-ray layer and is exactly the look a cutaway wants.
 */
export function setOpacity(mat, value) {
  const o = value < 0 ? 0 : value > 1 ? 1 : value
  mat.visible = o > 0.02
  if (mat.opacity === o) return

  mat.opacity = o
  const shouldBeTransparent = o < 0.995
  if (mat.transparent !== shouldBeTransparent) {
    mat.transparent = shouldBeTransparent
    mat.depthWrite = !shouldBeTransparent
    mat.needsUpdate = true
  }
}

/** Emissive boost used during the ignition act. */
export function setEmissiveBoost(mat, amount) {
  if (!mat.emissive) return
  mat.emissiveIntensity = amount
}

export function disposeMaterials() {
  for (const m of registry.values()) {
    for (const key of ['map', 'roughnessMap', 'bumpMap', 'normalMap', 'metalnessMap']) {
      m[key]?.dispose?.()
    }
    m.dispose()
  }
  registry.clear()
}