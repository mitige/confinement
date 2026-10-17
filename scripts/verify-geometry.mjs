/**
 * Geometry verification.
 *
 * Run with: node scripts/verify-geometry.mjs
 *
 * Proves three things the render cannot tell us on its own:
 *   1. The hand-built sweep has outward-facing normals (signed volume > 0).
 *   2. The generated D-shaped coil really is at ITER scale and orientation.
 *   3. The plasma flux surface matches the published major/minor radius,
 *      elongation and triangularity.
 */

import * as THREE from 'three'
import {
  dShapeCenterline,
  roundedRectProfile,
  sweepClosed,
  fluxSurfaceOutline,
  signedVolume,
} from '../src/three/geometry/sweep.js'
import { TF_COILS, PLASMA, VESSEL, BLANKET, CENTRAL_SOLENOID } from '../src/data/iter.js'
import { TIMELINE, TOTAL_VH, ghostedLayerCount } from '../src/data/acts.js'

let failures = 0

function check(label, actual, expected, tolerance) {
  const ok = Math.abs(actual - expected) <= tolerance
  if (!ok) failures += 1
  const mark = ok ? 'PASS' : 'FAIL'
  console.log(
    `  [${mark}] ${label}: ${actual.toFixed(3)} (expected ${expected.toFixed(3)} ±${tolerance})`,
  )
}

function assert(label, condition, detail = '') {
  if (!condition) failures += 1
  console.log(`  [${condition ? 'PASS' : 'FAIL'}] ${label}${detail ? `: ${detail}` : ''}`)
}

/* ------------------------------------------------------- toroidal field coil */

console.log('\nTF coil — D-shaped sweep')
const centerline = dShapeCenterline({
  innerRadius: TF_COILS.innerRadius,
  arcCentre: TF_COILS.arcCentre,
  semiR: TF_COILS.semiR,
  semiZ: TF_COILS.semiZ,
})
const profile = roundedRectProfile(
  TF_COILS.packRadial,
  TF_COILS.packToroidal,
  0.22,
  5,
)
const geometry = sweepClosed(centerline, profile)

const volume = signedVolume(geometry)
console.log(`  centreline points: ${centerline.length}, profile points: ${profile.length}`)
console.log(`  triangles: ${geometry.index.count / 3}, signed volume: ${volume.toFixed(2)} m³`)
assert('winding faces outward (volume > 0)', volume > 0, `${volume.toFixed(2)} m³`)

geometry.computeBoundingBox()
const bb = geometry.boundingBox
const size = new THREE.Vector3()
bb.getSize(size)

check('total height (m)', size.y, 2 * TF_COILS.semiZ + TF_COILS.packRadial, 0.05)
check('toroidal thickness (m)', size.z, TF_COILS.packToroidal, 0.01)
check(
  'inboard face radius (m)',
  bb.min.x,
  TF_COILS.innerRadius - TF_COILS.packRadial / 2,
  0.05,
)
check('outboard face radius (m)', bb.max.x, TF_COILS.arcCentre + TF_COILS.semiR + TF_COILS.packRadial / 2, 0.05)

// Published ITER figure: the TF coil is about 17 m tall and 9 m wide.
check('height near the published 17 m', size.y, 17.0, 0.3)
check('radial width near the published 9 m', size.x, 9.0, 0.5)

// The swept solid must be planar in z and centred on the mid-plane.
check('symmetric about z = 0', bb.min.z + bb.max.z, 0, 1e-6)
check('symmetric about y = 0', bb.min.y + bb.max.y, 0, 1e-6)

// A closed manifold's volume should match profile area x path length closely.
const profileArea = TF_COILS.packRadial * TF_COILS.packToroidal
const pathLength = geometry.userData.sweepClosed.totalLength
const estimated = profileArea * pathLength
assert(
  'volume consistent with profile area x path length',
  Math.abs(volume - estimated) / estimated < 0.15,
  `${volume.toFixed(2)} vs ~${estimated.toFixed(2)} m³`,
)

/* --------------------------------------------------------------- plasma */

console.log('\nPlasma — last closed flux surface')
const plasma = fluxSurfaceOutline({
  R0: PLASMA.R0,
  a: PLASMA.a,
  kappa: PLASMA.kappa,
  delta: PLASMA.delta,
})
let minZ = Infinity
let maxZ = -Infinity
let outboardAtMid = 0
let inboardAtMid = 0
for (const p of plasma) {
  minZ = Math.min(minZ, p.y)
  maxZ = Math.max(maxZ, p.y)
  if (Math.abs(p.y) < 1e-9) {
    if (p.x > PLASMA.R0) outboardAtMid = p.x
    else inboardAtMid = p.x
  }
}

check('outboard midplane radius (m)', outboardAtMid, PLASMA.R0 + PLASMA.a, 0.02)
check('inboard midplane radius (m)', inboardAtMid, PLASMA.R0 - PLASMA.a, 0.02)
check('total height (m)', maxZ - minZ, 2 * PLASMA.kappa * PLASMA.a, 0.02)

// Triangularity: at the top the surface is pulled inboard of the geometric top.
const topRadius = plasma.reduce((best, p) => (p.y > best.y ? p : best), plasma[0]).x
assert(
  'top of the surface is shifted inboard (triangularity)',
  topRadius < PLASMA.R0,
  `top at R = ${topRadius.toFixed(3)}, axis at R = ${PLASMA.R0}`,
)

/* --------------------------------------------------------------- vessel */

console.log('\nVacuum vessel')
const vesselOuter = fluxSurfaceOutline({
  R0: VESSEL.radialCentre,
  a: VESSEL.halfWidth,
  kappa: VESSEL.halfHeight / VESSEL.halfWidth,
  delta: VESSEL.delta,
})
const vesselInner = fluxSurfaceOutline({
  R0: VESSEL.radialCentre,
  a: VESSEL.halfWidth - VESSEL.thickness,
  kappa: VESSEL.halfHeight / VESSEL.halfWidth,
  delta: VESSEL.delta,
})

const maxOuter = Math.max(...vesselOuter.map((p) => p.x))
const maxInner = Math.max(...vesselInner.map((p) => p.x))
const inboardOuter = Math.min(...vesselOuter.map((p) => p.x))
const inboardInner = Math.min(...vesselInner.map((p) => p.x))

check('vessel outer radius matches the published 19.4 m diameter', maxOuter, VESSEL.outerRadius, 0.05)
check('vessel total height (m)', 2 * VESSEL.halfHeight, 11.4, 0.01)
check('wall thickness on the inboard side (m)', inboardInner - inboardOuter, VESSEL.thickness, 0.02)

/* ------------------------------------------------- radial build integrity */

/*
 * The property that actually matters: nothing interpenetrates, and the plasma
 * sits strictly inside the blanket, which sits strictly inside the vessel wall,
 * which sits strictly inside the TF coil. This is what keeps the cutaway acts
 * legible instead of turning into a pile of intersecting metal.
 */
console.log('\nRadial build at the mid-plane (metres)')

const cs = CENTRAL_SOLENOID.outerRadius
const tfInner = TF_COILS.innerRadius - TF_COILS.packRadial / 2
const tfOuter = TF_COILS.arcCentre + TF_COILS.semiR + TF_COILS.packRadial / 2
const tfLegInner = TF_COILS.innerRadius - TF_COILS.packRadial / 2
const tfLegOuter = TF_COILS.innerRadius + TF_COILS.packRadial / 2

const build = [
  ['central solenoid', 0, cs],
  ['TF coil inner leg', tfLegInner, tfLegOuter],
  ['vessel inboard wall', inboardOuter, inboardInner],
  ['inboard blanket', inboardInner, inboardInner + BLANKET.thickness],
  ['plasma', PLASMA.R0 - PLASMA.a, PLASMA.R0 + PLASMA.a],
  ['outboard blanket', maxInner - BLANKET.thickness, maxInner],
  ['vessel outboard wall', maxInner, maxOuter],
]

for (const [name, lo, hi] of build) {
  console.log(`  ${name.padEnd(22)} ${lo.toFixed(3).padStart(7)} -> ${hi.toFixed(3).padStart(7)}`)
}

for (let i = 0; i < build.length - 1; i += 1) {
  const [nameA, , hiA] = build[i]
  const [nameB, loB] = build[i + 1]
  assert(
    `${nameA} does not interpenetrate ${nameB}`,
    hiA <= loB + 1e-6,
    `gap ${(loB - hiA).toFixed(3)} m`,
  )
}

assert(
  'TF coil wraps around the vessel outboard wall',
  tfOuter > maxOuter,
  `${tfOuter.toFixed(2)} m vs ${maxOuter.toFixed(2)} m`,
)
assert(
  'plasma clears the vessel inboard wall',
  PLASMA.R0 - PLASMA.a >= inboardInner,
  `plasma inboard ${(PLASMA.R0 - PLASMA.a).toFixed(2)}, wall inner ${inboardInner.toFixed(2)}`,
)
assert(
  'plasma clears the vessel outboard wall',
  PLASMA.R0 + PLASMA.a <= maxInner,
  `plasma outboard ${(PLASMA.R0 + PLASMA.a).toFixed(2)}, wall inner ${maxInner.toFixed(2)}`,
)

/* ---------------------------------------------------- timeline integrity */

console.log('\nAct timeline')

check('TOTAL_VH is the sum of act lengths', TOTAL_VH, TIMELINE.reduce((s, a) => s + a.vh, 0), 0)
check('acts are contiguous', TIMELINE[TIMELINE.length - 1].end, TOTAL_VH, 0)

// The camera must not jump across an act boundary: the last key of one act has to
// equal the first key of the next, or the damped rig will visibly snap.
let discontinuities = 0
for (let i = 0; i < TIMELINE.length - 1; i += 1) {
  const out = TIMELINE[i].cam[TIMELINE[i].cam.length - 1]
  const into = TIMELINE[i + 1].cam[0]
  const same =
    JSON.stringify(out.pos) === JSON.stringify(into.pos) &&
    JSON.stringify(out.target) === JSON.stringify(into.target) &&
    out.fov === into.fov
  if (!same) {
    discontinuities += 1
    console.log(`  [FAIL] camera jump: ${TIMELINE[i].id} -> ${TIMELINE[i + 1].id}`)
  }
}
assert('camera chain is continuous across every act', discontinuities === 0)

/*
 * Ghosted-layer budget.
 *
 * A ghosted assembly (0.08 < visibility < 0.98) renders as a transparent layer
 * with depth writing disabled, so it shades every pixel it covers including all
 * the geometry behind it. More than three of these and frame time collapses — this
 * was measured, not assumed: going from six to three roughly doubled the frame
 * rate in the heaviest act.
 */
const GHOST_BUDGET = 3
let overBudget = 0
for (const act of TIMELINE) {
  const count = ghostedLayerCount(act)
  const flag = count > GHOST_BUDGET ? 'FAIL' : 'ok'
  if (count > GHOST_BUDGET) overBudget += 1
  console.log(`  [${flag.padStart(4)}] ${act.id.padEnd(24)} ${count} ghosted layer(s)`)
}
assert(`no act exceeds ${GHOST_BUDGET} ghosted layers`, overBudget === 0)

/* ---------------------------------------------------------------- summary */

console.log(
  failures === 0
    ? '\nAll geometry checks passed.\n'
    : `\n${failures} geometry check(s) FAILED.\n`,
)
process.exit(failures === 0 ? 0 : 1)