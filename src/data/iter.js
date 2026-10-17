/**
 * ITER reference dimensions.
 *
 * The ONLY place physical dimensions live. Geometry components consume these
 * values; none of them hard-code a radius or a height. Everything is in metres,
 * and 1 world unit === 1 metre, so "real scale" is a structural property of the
 * scene rather than a claim in the copy.
 *
 * Sources: public ITER project figures.
 */

/** Vertical centre of the plasma / machine mid-plane, measured from the floor. */
export const MIDPLANE = 13.0

export const PLASMA = {
  /** Major radius (m). */
  R0: 6.2,
  /** Minor radius (m). */
  a: 2.0,
  /** Elongation. */
  kappa: 1.85,
  /** Triangularity. */
  delta: 0.5,
  volume: 840,
  currentMA: 15,
  temperatureC: 150_000_000,
  /** Magnetic field at plasma centre (T). */
  fieldT: 11.8,
}

export const CRYOSTAT = {
  /** Outer radius of the cylindrical trunk: the published 28.6 m diameter. */
  radius: 14.3,
  /** Shell wall thickness, visible as a rim where the trunk is cut away. */
  thickness: 0.35,
  /**
   * Height of the cylindrical trunk alone. The top cap sits above it, and the two
   * together make up `height`.
   */
  shellHeight: 28.4,
  /** Total height, trunk plus cap: the published 29.3 m. */
  height: 29.3,
  /**
   * Radius of the top flange, which is deliberately larger than the trunk so the
   * cap overhangs it exactly as the base ring does. It used to equal the trunk
   * radius, which put the cap's side wall and the shell on the same surface — two
   * coplanar faces, so the depth buffer flickered between them and the top of the
   * machine appeared to punch in and out of its own wall.
   */
  capRadius: 14.9,
  /** Thickness of the top flange. */
  flangeHeight: 0.5,
  /**
   * How far the lid plate is inset behind the flange rim, so the rim reads as a
   * lip rather than as a flush surface.
   */
  plateInset: 0.35,
  /** The support plinth. Protrudes by the same 0.6 m as the top flange. */
  baseRingRadius: 14.9,
  baseRingHeight: 1.6,
}

/**
 * Radial build at the mid-plane.
 *
 * Every component has to nest without intersecting, and the published outer
 * dimensions have to survive at the same time. Working outward from the axis:
 *
 *   R 0.00 - 2.15  central solenoid      (4.3 m outer diameter)
 *   R 2.15 - 2.35  gap
 *   R 2.35 - 3.25  TF coil inner leg     (0.90 m winding pack)
 *   R 3.25 - 3.70  vacuum vessel wall    (0.45 m)
 *   R 3.70 - 4.10  inboard blanket       (0.40 m)
 *   R 4.10 - 4.20  scrape-off layer
 *   R 4.20 - 8.20  plasma                (R0 6.2, a 2.0)
 *   R 8.20 - 8.85  outboard blanket
 *   R 8.85 - 9.25  vacuum vessel wall
 *
 * which puts the vessel's outer surface at exactly 9.70 m radius, i.e. the
 * published 19.4 m outer diameter, and keeps the TF coil's straight inner leg
 * clear of the vessel. `scripts/verify-geometry.mjs` asserts all of this.
 *
 * Note the TF coil is a classic Princeton D: its inboard leg sits at the centre
 * of the outer arc, so the leg meets the arc tangentially and the swept surface
 * has no crease anywhere.
 */
export const VESSEL = {
  /** Centre of the D-shaped cross-section in the radial direction. */
  radialCentre: 6.5,
  /** Radial half-width; outer radius = radialCentre + halfWidth = 9.70 m. */
  halfWidth: 3.2,
  /** Vertical half-height, 11.4 m tall. */
  halfHeight: 5.7,
  /** Wall thickness. */
  thickness: 0.45,
  /** Published outer diameter 19.4 m. */
  outerRadius: 9.7,
  /** Triangularity of the vessel cross-section. */
  delta: 0.4,
  massTonnes: 5000,
}

export const TF_COILS = {
  count: 18,
  /** Winding-pack centreline on the straight inboard leg. Also the arc centre. */
  innerRadius: 2.8,
  /** Centre of the outer arc; equal to innerRadius for a tangent D. */
  arcCentre: 2.8,
  /** Radial semi-axis of the outboard arc; max centreline radius 11.25 m. */
  semiR: 8.45,
  /** Vertical semi-axis; 2 * semiZ + packRadial = 17.0 m total height. */
  semiZ: 8.05,
  /** Winding-pack cross-section, radial extent. */
  packRadial: 0.9,
  /** Winding-pack cross-section, toroidal extent. */
  packToroidal: 0.85,
  massTonnesEach: 360,
}

/**
 * Poloidal field coils. Radii and heights relative to the mid-plane are the
 * published ITER values.
 */
export const PF_COILS = [
  { name: 'PF1', radius: 3.96, y: 7.53, section: 1.0 },
  { name: 'PF2', radius: 8.29, y: 6.34, section: 1.4 },
  { name: 'PF3', radius: 11.18, y: 3.32, section: 1.5 },
  { name: 'PF4', radius: 11.87, y: -2.22, section: 1.5 },
  { name: 'PF5', radius: 8.51, y: -5.96, section: 1.4 },
  { name: 'PF6', radius: 4.23, y: -7.57, section: 1.3 },
]

export const CENTRAL_SOLENOID = {
  /** 6 stacked modules. */
  modules: 6,
  /** 4.3 m outer diameter. */
  outerRadius: 2.15,
  /** Total stack height. */
  height: 13.0,
  massTonnes: 1000,
  fieldT: 13,
}

export const BLANKET = {
  /** 440 modules. */
  count: 440,
  /** Toroidal divisions. */
  toroidal: 44,
  /** Poloidal divisions; 44 x 10 = 440. */
  poloidal: 10,
  /** Module thickness, proud of the vessel's inner wall. */
  thickness: 0.4,
}

export const DIVERTOR = {
  /** 54 tungsten cassettes. */
  count: 54,
  /** Ring radius at which cassettes sit. */
  radius: 5.85,
  /** Vertical offset from the mid-plane; the plasma's lower edge is at -3.70. */
  y: -4.35,
  /** Tilt of the cassette toward the plasma. */
  tilt: -0.62,
  width: 0.9,
  height: 1.5,
  depth: 1.7,
}

/**
 * The enclosing hall.
 *
 * This radius is a framing constraint, not decoration: the camera pulls back to
 * 130 m in the coda act, and if the hall were smaller the camera would end up
 * outside it looking at a concrete wall instead of at the machine. Everything the
 * camera can reach has to stay inside.
 */
export const HALL = {
  radius: 180,
  height: 100,
}

/** A 1.8 m human figure, used only to make the scale claim legible. */
export const HUMAN = { height: 1.8 }

export const MACHINE = {
  massTonnes: 23_000,
  fusionPowerMW: 500,
  inputPowerMW: 50,
  /** Fusion gain Q. */
  q: 10,
}
