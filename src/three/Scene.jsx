import { StudioEnvironment } from './materials/StudioEnvironment.jsx'
import { CameraRig } from './CameraRig.jsx'
import { Lighting } from './Lighting.jsx'
import { Overlays3D } from './Overlays3D.jsx'
import { Effects } from './Effects.jsx'
import { Hall } from './tokamak/Hall.jsx'
import { Cryostat } from './tokamak/Cryostat.jsx'
import { TFCoils } from './tokamak/TFCoils.jsx'
import { PFCoils } from './tokamak/PFCoils.jsx'
import { CentralSolenoid } from './tokamak/CentralSolenoid.jsx'
import { VacuumVessel } from './tokamak/VacuumVessel.jsx'
import { Blanket } from './tokamak/Blanket.jsx'
import { Divertor } from './tokamak/Divertor.jsx'
import { Plasma } from './tokamak/Plasma.jsx'
import { HumanScale } from './tokamak/HumanScale.jsx'

/**
 * The scene.
 *
 * A single persistent canvas for the whole document. Every assembly is mounted
 * for the entire session and never unmounts: the act timeline changes what is
 * visible by fading materials, which is what allows a cutaway to be a continuous
 * camera move rather than a scene swap.
 *
 * Draw order is fixed here rather than left to distance sorting. Since the faded
 * assemblies are transparent, deterministic ordering is what keeps the x-ray
 * cutaways reading as deliberate technical layering instead of as z-fighting.
 */
export function Scene({ quality = 'high', reducedMotion = false, effects = true }) {
  return (
    <>
      {/* Exponential fog gives the 62 m hall depth without a visible horizon. */}
      <fogExp2 attach="fog" args={[0x000000, 0.0034]} />

      <StudioEnvironment intensity={1} />
      <Lighting />
      <CameraRig reducedMotion={reducedMotion} />

      <Hall />
      <Cryostat />
      <TFCoils />
      <PFCoils />
      <CentralSolenoid />
      <VacuumVessel />
      <Blanket />
      <Divertor />
      <Plasma />
      <HumanScale />
      <Overlays3D />

      {effects && <Effects quality={quality} />}
    </>
  )
}