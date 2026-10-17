import { EffectComposer, Bloom, Vignette, ToneMapping } from '@react-three/postprocessing'
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
export function Effects({ quality = 'high' }) {
  const high = quality === 'high'
  const medium = quality === 'medium'

  /*
   * The composer is present on every tier, because ACES tone mapping is not
   * optional: the scene renders in linear HDR with the renderer's tone mapping
   * disabled, so removing the composer would remove the grade as well as the glow.
   * The tiers only shed bloom quality, the vignette and MSAA.
   */
  return (
    <EffectComposer multisampling={high ? 4 : 0} enableNormalPass={false}>
      {quality !== 'low' && (
        <Bloom
          mipmapBlur
          intensity={high ? 1.15 : 0.85}
          luminanceThreshold={high ? 0.72 : 0.8}
          luminanceSmoothing={0.3}
          radius={high ? 0.78 : 0.55}
          kernelSize={high ? KernelSize.LARGE : KernelSize.SMALL}
          blendFunction={BlendFunction.ADD}
        />
      )}
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      {(high || medium) && (
        <Vignette offset={0.22} darkness={0.58} blendFunction={BlendFunction.NORMAL} />
      )}
    </EffectComposer>
  )
}