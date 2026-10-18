import * as THREE from 'three'
import { brushedRoughness, weldSeams, machinedSurface } from './textures.js'

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

/**
 * Ghost variants.
 *
 * A transparent assembly with depth writing disabled shades every pixel it covers,
 * including all the geometry behind it — that is the single largest cost in the
 * scene. When an assembly is ghosted, its PBR shading is almost entirely wasted
 * anyway: at 15% opacity you are looking at a silhouette, not at brushed Inconel.
 *
 * So a ghost gets its own material, and it is deliberately primitive: no
 * environment sampling, no roughness or normal maps, no PBR lighting loop. Just a
 * Fresnel edge over a flattish body. That is a handful of instructions instead of a
 * few hundred, and it happens to suit the piece — a ghosted cryostat should read as
 * a line drawing of a cryostat, not as a dim photograph of one.
 *
 * The body term is what keeps the swap invisible. It is tuned so that a ghost at
 * 85% opacity — the point at which an assembly crosses over — is about as bright as
 * the lit PBR surface it replaces, so nothing pops.
 */
const GHOST_VERTEX = /* glsl */ `
  varying vec3 vGhostNormal;
  varying vec3 vGhostView;

  void main() {
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vGhostNormal = normalize(normalMatrix * normal);
    vGhostView = -viewPosition.xyz;
    gl_Position = projectionMatrix * viewPosition;
  }
`

const GHOST_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uRimColor;
  uniform float uOpacity;
  uniform float uBody;
  uniform float uRim;

  varying vec3 vGhostNormal;
  varying vec3 vGhostView;

  void main() {
    float facing = abs(dot(normalize(vGhostNormal), normalize(vGhostView)));
    // Bright at the silhouette, nearly clear across the face.
    float rim = pow(1.0 - facing, 2.4);

    float alpha = uOpacity * clamp(uBody + uRim * rim, 0.0, 1.0);
    vec3 colour = mix(uColor, uRimColor, rim * 0.85);

    gl_FragColor = vec4(colour, alpha);
  }
`

/** Tuned against the lit PBR appearances; see the note above. */
const GHOST_BODY = 0.52
const GHOST_RIM = 0.8
const GHOST_RIM_COLOUR = '#c6d0da'

const ghostRegistry = new Map()

/** The ghost material paired with a PBR material name. */
export function ghostMaterial(name) {
  if (!ghostRegistry.has(name)) {
    const base = material(name)
    ghostRegistry.set(
      name,
      new THREE.ShaderMaterial({
        vertexShader: GHOST_VERTEX,
        fragmentShader: GHOST_FRAGMENT,
        uniforms: {
          uColor: { value: base.color ? base.color.clone() : new THREE.Color('#8a939c') },
          uRimColor: { value: new THREE.Color(GHOST_RIM_COLOUR) },
          uOpacity: { value: 0 },
          uBody: { value: GHOST_BODY },
          uRim: { value: GHOST_RIM },
        },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    )
  }
  return ghostRegistry.get(name)
}

/**
 * Swap every mesh in a group between its PBR materials and their ghost variants.
 *
 * Called only when an assembly crosses the ghost threshold, never per frame: the
 * traversal costs a moment, and the state flips a handful of times per session.
 */
export function applyGhost(group, ghosted, pairs) {
  if (!group) return null

  /*
   * React re-applies the `material` prop whenever a component re-renders, which
   * would silently undo this swap. So the first mesh touched is returned as an
   * anchor, and useFade checks that one mesh each frame: if its material is no
   * longer the one that was assigned, the swap is redone. One comparison per
   * frame, instead of a traversal.
   */
  let anchor = null

  group.traverse((object) => {
    if (!object.isMesh && !object.isInstancedMesh && !object.isLine) return
    const current = object.material
    let assigned = null

    if (ghosted) {
      assigned = pairs.find((pair) => pair.pbr === current)?.ghost ?? null
      if (assigned) object.material = assigned
    } else {
      assigned = pairs.find((pair) => pair.ghost === current)?.pbr ?? null
      if (assigned) object.material = assigned
    }

    if (!anchor && (assigned || current)) {
      anchor = { object, assigned: assigned ?? current }
    }
  })

  return anchor
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
 *
 * The crossover sits at 94%, not at 100%. An assembly at 90% opacity is a solid
 * with a faint darkening over it, and rendering it as a depth-writing opaque
 * surface is both cheaper — early-Z rejects everything behind it — and visually
 * indistinguishable. Treating it as transparent would buy a full unpoccluded pass
 * for an 10% blend nobody can see.
 */
export function setOpacity(mat, value) {
  const o = value < 0 ? 0 : value > 1 ? 1 : value
  mat.visible = o > 0.02
  if (mat.opacity === o) return

  mat.opacity = o
  const shouldBeTransparent = o < 0.94
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