import {
  EffectComposer,
  Bloom,
  Vignette,
  ToneMapping,
  SMAA,
  FXAA,
} from '@react-three/postprocessing'
import { BlendFunction, KernelSize, ToneMappingMode } from 'postprocessing'

/**
 * Post-processing.
 *
 * Order matters, and it is the whole reason the canvas renders with tone mapping
 * disabled (`flat` on the Canvas):
 *
 *   scene (linear HDR) -> bloom -> ACES -> vignette
 *
 * The composer renders into a half-float buffer, so the plasma shader can push
 * values above 1.0 and bloom them as genuine HDR highlights. Only then does ACES
 * compress the range. If tone mapping ran inside the materials instead, those
 * values would clip before bloom ever saw them and the plasma would stop glowing.
 *
 * Bloom is selective: the threshold sits above the brightest metal highlight, so
 * only the plasma and the thin white line work bleed.
 */
/**
 * Post-processing switches, for measuring what the chain costs.
 *
 *   ?msaa=0|2|4                multisample count, 0 by default
 *   ?aa=off|fxaa|smaa          antialiasing mode
 *   ?bloom=off|small|medium|large
 *
 * Absent, the tier decides. These exist so the cost of each part can be measured
 * rather than assumed — which is how MSAA turned out to be the single most
 * expensive thing in the entire pipeline, at 4.5x the cost of not having it.
 */
function postSwitches() {
  if (typeof window === 'undefined') return {}
  const params = new URLSearchParams(window.location.search)
  const msaa = params.get('msaa')
  return {
    msaa: msaa === null ? null : Number(msaa),
    bloom: params.get('bloom'),
    aa: params.get('aa'),
  }
}

const BLOOM_KERNELS = {
  small: KernelSize.SMALL,
  medium: KernelSize.MEDIUM,
  large: KernelSize.LARGE,
}

export function Effects({ quality = 'high' }) {
  const high = quality === 'high'
  const medium = quality === 'medium'
  const switches = postSwitches()
  const bloomChoice = switches.bloom ?? (high ? 'large' : medium ? 'small' : 'off')
  /*
   * Antialiasing is done in post, not in the framebuffer.
   *
   * MSAA was the most expensive thing in the pipeline by a wide margin: on a
   * half-float buffer at 1920x1080 this GPU went from 6.9 to 31.2 fps when it was
   * switched off, and dropping from 4 samples to 2 changed nothing — it is a
   * bandwidth cost, not a sample-count cost. SMAA costs a fraction of that and
   * covers the same edges.
   */
  const aa = switches.aa ?? (quality === 'low' ? 'off' : 'smaa')
  const msaa = switches.msaa ?? 0

  /*
   * The composer is present on every tier, because ACES tone mapping is not
   * optional: the scene renders in linear HDR with the renderer's tone mapping
   * disabled, so removing the composer would remove the grade as well as the glow.
   * The tiers only shed bloom quality, the vignette and MSAA.
   */
  return (
    <EffectComposer multisampling={msaa} enableNormalPass={false}>
      {bloomChoice !== 'off' && (
        <Bloom
          mipmapBlur
          intensity={high ? 1.15 : 0.85}
          luminanceThreshold={high ? 0.72 : 0.8}
          luminanceSmoothing={0.3}
          radius={high ? 0.78 : 0.55}
          kernelSize={BLOOM_KERNELS[bloomChoice] ?? KernelSize.LARGE}
          blendFunction={BlendFunction.ADD}
        />
      )}
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      {(high || medium) && (
        <Vignette offset={0.22} darkness={0.58} blendFunction={BlendFunction.NORMAL} />
      )}
      {/* Last, on the graded image, which is where edge detection belongs. */}
      {aa === 'smaa' && <SMAA />}
      {aa === 'fxaa' && <FXAA />}
    </EffectComposer>
  )
}