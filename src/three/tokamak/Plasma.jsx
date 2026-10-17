import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { PLASMA, MIDPLANE } from '../../data/iter.js'
import { useDirectorStore } from '../../scroll/ScrollDirector.jsx'
import { TIMELINE } from '../../data/acts.js'
import { damp } from '../../lib/math.js'
import { fluxSurfaceOutline } from '../geometry/sweep.js'
import { tileableNoise } from '../materials/textures.js'

/**
 * The plasma.
 *
 * The only coloured thing in the entire piece. Two nested flux surfaces — the
 * separatrix at a = 2.0 m and a hotter core — each shaded with animated turbulence
 * and a Fresnel term so the surface reads as a volume of glowing gas rather than a
 * solid. Additive blending with depth writing disabled lets the shells accumulate
 * into a white-hot core.
 *
 * The colour grading is physical rather than decorative: hydrogen plasma radiates a
 * cold violet-white, brightest where the density is highest.
 *
 * Three decisions here are about frame time, because this shader runs on
 * overlapping additive shells and is the most expensive fragment work in the piece:
 *
 *  - **Turbulence comes from a texture, not from the shader.** Two lookups in a
 *    seamless tileable noise replace roughly eighty arithmetic operations. The
 *    frequencies are integers so the lookup wraps at the closed seam of the lathe.
 *  - **Two shells, not three.** The middle shell was nested between the other two,
 *    so it contributed a fraction of the emission while costing a third of the fill.
 *  - **Front faces only.** Rendering both faces doubles the fill, and the far side
 *    of each nested shell is behind its own near side anyway.
 *
 * Intensity is driven by the act timeline, so the machine visibly ignites during
 * the ignition act and cools again afterwards.
 */

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormalView;
  varying vec3 vViewDirection;

  void main() {
    vUv = uv;

    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vNormalView = normalize(normalMatrix * normal);
    vViewDirection = -viewPosition.xyz;

    gl_Position = projectionMatrix * viewPosition;
  }
`

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uIntensity;
  uniform float uGain;
  uniform sampler2D uNoise;
  uniform vec3 uCore;
  uniform vec3 uMid;
  uniform vec3 uEdge;

  varying vec2 vUv;
  varying vec3 vNormalView;
  varying vec3 vViewDirection;

  void main() {
    /*
     * Anisotropic sampling: the noise is stretched along u, which runs the long way
     * round the torus, so the filaments line up with the direction current actually
     * flows. Both frequencies are integers, which is what makes the lookup
     * seamless where the lathe closes.
     */
    float t = uTime * 0.012;

    float coarse = texture2D(uNoise, vec2(vUv.x * 3.0 + t, vUv.y * 2.0)).r;
    float fine = texture2D(uNoise, vec2(vUv.x * 7.0 - t * 1.7, vUv.y * 5.0 + t * 0.6)).r;
    float turbulence = coarse * 0.66 + fine * 0.34;

    float limb = pow(1.0 - abs(dot(normalize(vNormalView), normalize(vViewDirection))), 2.0);
    float density = 0.28 + 0.72 * turbulence;

    // Violet at the limb, white where the filaments bunch up.
    vec3 colour = mix(uMid, uEdge, limb * 0.75);
    colour = mix(colour, uCore, smoothstep(0.48, 1.0, turbulence) * 0.9);

    /*
     * Emission, not opacity. The gains are the exposure control for the whole
     * plasma and were set against measured frame luminance
     * scripts/exposure.mjs rather than by eye, because additive HDR emission is
     * extremely easy to clip.
     */
    float emission = density * (0.5 + 0.7 * limb) * uGain * uIntensity;

    gl_FragColor = vec4(colour * emission, 1.0);
  }
`

/** Nested flux surfaces: the separatrix and one hotter core. */
const SHELLS = [
  { a: PLASMA.a, gain: 0.11 },
  { a: PLASMA.a * 0.62, gain: 0.33 },
]

export function Plasma() {
  const store = useDirectorStore()
  const intensity = useRef(0)

  // One texture, shared by every shell: allocating it per shell would upload the
  // same data twice.
  const noise = useMemo(() => tileableNoise({ size: 256, octaves: 4, base: 8 }), [])

  const materials = useMemo(
    () =>
      SHELLS.map(
        (shell) =>
          new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader,
            uniforms: {
              uTime: { value: 0 },
              uIntensity: { value: 0 },
              uGain: { value: shell.gain },
              uNoise: { value: noise },
              uCore: { value: new THREE.Color('#ffffff') },
              uMid: { value: new THREE.Color('#9fdcff') },
              uEdge: { value: new THREE.Color('#6f56d8') },
            },
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.FrontSide,
            toneMapped: false,
          }),
      ),
    [noise],
  )

  const geometry = useMemo(
    () =>
      SHELLS.map(
        (shell) =>
          new THREE.LatheGeometry(
            fluxSurfaceOutline({
              R0: PLASMA.R0,
              a: shell.a,
              kappa: PLASMA.kappa,
              delta: PLASMA.delta,
              samples: 88,
              close: true,
            }),
            72,
          ),
      ),
    [],
  )

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    const act = TIMELINE[store.actIndex]
    const target = act?.machine?.plasma ?? 0

    // Damped, and biased so the plasma lingers a beat before dying after the
    // ignition act, which reads as cooling rather than as a switch being thrown.
    intensity.current = damp(
      intensity.current,
      target,
      target > intensity.current ? 2.6 : 1.1,
      dt,
    )

    const value = intensity.current
    for (let i = 0; i < materials.length; i += 1) {
      const uniform = materials[i].uniforms
      uniform.uTime.value += dt
      uniform.uIntensity.value = value
      materials[i].visible = value > 0.03
    }
  })

  return (
    <group renderOrder={6} position={[0, MIDPLANE, 0]}>
      {geometry.map((geo, i) => (
        <mesh key={i} geometry={geo} material={materials[i]} />
      ))}
    </group>
  )
}