import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { PLASMA, MIDPLANE } from '../../data/iter.js'
import { useDirectorStore } from '../../scroll/ScrollDirector.jsx'
import { TIMELINE } from '../../data/acts.js'
import { damp } from '../../lib/math.js'
import { fluxSurfaceOutline } from '../geometry/sweep.js'

/**
 * The plasma.
 *
 * The only coloured thing in the entire piece. Three nested flux surfaces — the
 * separatrix at a = 2.0 m and two inner shells — each shaded with animated
 * turbulence and a Fresnel term so the surface reads as a volume of glowing gas
 * rather than a solid. Additive blending with depth writing disabled lets the
 * shells accumulate into a white-hot core.
 *
 * The colour grading is physical rather than decorative: hydrogen plasma radiates
 * a cold violet-white, brightest where the density is highest.
 *
 * Intensity is driven by the act timeline, so the machine visibly ignites during
 * the ignition act and cools again afterwards.
 */

const vertexShader = /* glsl */ `
  varying vec3 vPosition;
  varying vec3 vNormalView;
  varying vec3 vViewDirection;

  void main() {
    vPosition = position;

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
  uniform vec3 uCore;
  uniform vec3 uMid;
  uniform vec3 uEdge;

  varying vec3 vPosition;
  varying vec3 vNormalView;
  varying vec3 vViewDirection;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float valueNoise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i + vec3(0.0, 0.0, 0.0)), hash(i + vec3(1.0, 0.0, 0.0)), f.x),
          mix(hash(i + vec3(0.0, 1.0, 0.0)), hash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
      mix(mix(hash(i + vec3(0.0, 0.0, 1.0)), hash(i + vec3(1.0, 0.0, 1.0)), f.x),
          mix(hash(i + vec3(0.0, 1.0, 1.0)), hash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
      f.z);
  }

  /*
   * Three octaves, not five. This shader is evaluated several times per pixel on
   * additive, overlapping shells, so octave count is the single biggest lever on
   * frame time in the whole piece — and the 4th and 5th octaves were finer than
   * the bloom radius and never survived to the screen.
   */
  float fbm(vec3 p) {
    float amplitude = 0.5;
    float sum = 0.0;
    for (int i = 0; i < 3; i++) {
      sum += amplitude * valueNoise(p);
      p *= 2.02;
      amplitude *= 0.5;
    }
    return sum;
  }

  void main() {
    // Anisotropic sampling: filaments stretched along the toroidal axis, which is
    // the direction current actually flows in the plasma.
    vec3 p = vec3(vPosition.x * 0.34, vPosition.y * 0.62, vPosition.z * 0.34);
    float t = uTime * 0.055;

    float filaments = fbm(p + vec3(0.0, t, 0.0));
    float fine = fbm(p * 2.7 - vec3(t * 0.8, 0.0, t * 0.5));
    float turbulence = filaments * 0.68 + fine * 0.32;

    float limb = pow(1.0 - abs(dot(normalize(vNormalView), normalize(vViewDirection))), 2.0);
    float density = 0.28 + 0.72 * turbulence;

    // Violet at the limb, white where the filaments bunch up.
    vec3 colour = mix(uMid, uEdge, limb * 0.75);
    colour = mix(colour, uCore, smoothstep(0.48, 1.0, turbulence) * 0.9);

    /*
     * Emission, not opacity. Only front faces are drawn: rendering both faces
     * doubles the fill cost on the most expensive shader here, and the far side of
     * each nested shell is hidden behind its own near side anyway. The gains below
     * are scaled up to match the single-sided contribution.
     */
    float emission = density * (0.5 + 0.7 * limb) * uGain * uIntensity;

    gl_FragColor = vec4(colour * emission, 1.0);
  }
`

/**
 * Nested flux surfaces: the separatrix and two progressively hotter cores.
 *
 * The gains are the exposure control for the whole plasma. They were set against
 * measured frame luminance (`scripts/exposure.mjs`) rather than by eye, because
 * additive HDR emission is extremely easy to clip.
 */
const SHELLS = [
  { a: PLASMA.a, gain: 0.08 },
  { a: PLASMA.a * 0.8, gain: 0.135 },
  { a: PLASMA.a * 0.52, gain: 0.26 },
]

export function Plasma() {
  const store = useDirectorStore()
  const intensity = useRef(0)
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
    [],
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
              samples: 112,
              close: true,
            }),
            96,
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
    intensity.current = damp(intensity.current, target, target > intensity.current ? 2.6 : 1.1, dt)

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