/**
 * The act timeline — the single source of truth for the whole piece.
 *
 * Every act declares how long it lasts in viewport heights, where the camera
 * goes, what state the machine is in, and which lighting rig is active. The 3D
 * scene, the HUD, the overlay and the canvas opacity all read from this file.
 * Reordering or adding an act is a data edit, never a code edit.
 *
 * Two rules are load-bearing:
 *
 *  1. `camOut` of an act must equal `camIn` of the next one, so the camera never
 *     jumps across an act boundary. The geometry verification script checks this.
 *
 *  2. Keep the number of *ghosted* assemblies low — anything between 0.08 and 0.98
 *     renders as a transparent layer with depth writing off, which means it shades
 *     every pixel it covers, including all the geometry behind it. Three ghosted
 *     layers is a good ceiling; five will halve the frame rate. Assemblies that
 *     are fully opaque (1) or fully hidden (0) are cheap, and the hall is opaque
 *     everywhere for exactly this reason.
 */

import { MIDPLANE } from './iter.js'

/** Machine sub-system visibility targets, all normalised 0..1. */
const OFF = {
  /** The room stays opaque: ghosting a 180 m cylinder costs a full screen pass. */
  hall: 1,
  cryostat: 1,
  coils: 0,
  cs: 0,
  pf: 0,
  vessel: 0,
  blanket: 0,
  divertor: 0,
  plasma: 0,
  human: 0,
}

const state = (over = {}) => ({ ...OFF, ...over })

export const ACTS = [
  /* ------------------------------------------------------------------ 00 */
  {
    id: 'overture',
    kind: 'scene',
    label: 'Overture',
    vh: 220,
    canvasOpacity: 1,
    light: 'void',
    // An opaque cryostat hides the plasma behind it, and that costs almost
    // nothing: the depth buffer rejects the hidden fragments.
    machine: state({ plasma: 0.12 }),
    cam: [
      { at: 0, pos: [0, 21, 92], target: [0, 15, 0], fov: 30 },
      { at: 1, pos: [0, 14.5, 74], target: [0, MIDPLANE, 0], fov: 30 },
    ],
  },

  /* ------------------------------------------------------------------ 01 */
  {
    id: 'plate-01',
    kind: 'plate',
    label: 'Confinement',
    vh: 110,
    canvasOpacity: 0.12,
    light: 'void',
    machine: state({ plasma: 0.12 }),
    cam: [
      { at: 0, pos: [0, 14.5, 74], target: [0, MIDPLANE, 0], fov: 30 },
      { at: 1, pos: [2.5, 15.5, 70], target: [0, MIDPLANE, 0], fov: 30 },
    ],
  },

  /* ------------------------------------------------------------------ 02 */
  {
    id: 'scale',
    kind: 'scene',
    label: 'Real scale',
    vh: 340,
    canvasOpacity: 1,
    light: 'coldKey',
    machine: state({ plasma: 0.16, human: 1 }),
    cam: [
      { at: 0, pos: [2.5, 15.5, 70], target: [0, MIDPLANE, 0], fov: 30 },
      { at: 0.45, pos: [38, 4.2, 42], target: [9, 7.5, 0], fov: 36 },
      { at: 1, pos: [25, 3.0, 33], target: [6, 6.0, 0], fov: 40 },
    ],
  },

  /* ------------------------------------------------------------------ 03 */
  {
    id: 'plate-02',
    kind: 'plate',
    label: 'The numbers',
    vh: 120,
    canvasOpacity: 0.1,
    light: 'coldKey',
    machine: state({ plasma: 0.16, human: 1 }),
    cam: [
      { at: 0, pos: [25, 3.0, 33], target: [6, 6.0, 0], fov: 40 },
      { at: 1, pos: [22, 4.5, 30], target: [5, 7.0, 0], fov: 40 },
    ],
  },

  /* ------------------------------------------------------------------ 04 */
  {
    id: 'magnets',
    kind: 'scene',
    label: 'Magnets',
    vh: 340,
    canvasOpacity: 1,
    light: 'coldKey',
    // Coils, solenoid and PF rings are opaque here: this act is about their
    // solidity. Only the vessel is ghosted, so the coil cage reads as a cage.
    machine: state({ cryostat: 0, vessel: 0.16, coils: 1, cs: 1, pf: 1, plasma: 0.3 }),
    cam: [
      { at: 0, pos: [22, 4.5, 30], target: [5, 7.0, 0], fov: 40 },
      { at: 0.38, pos: [2, 32, 44], target: [0, 14, 0], fov: 34 },
      { at: 0.7, pos: [26, 18, 27], target: [0, 13, 0], fov: 42 },
      /*
       * Inside the coil cage at the mid-plane, running tangentially along the
       * array. The camera sits in the 10-degree gap between two coils, which is
       * the only place a 17 m D-coil leaves room.
       */
      { at: 1, pos: [13.0, 13.0, 2.3], target: [4.0, 13.0, 10.0], fov: 64 },
    ],
  },

  /* ------------------------------------------------------------------ 05 */
  {
    id: 'plate-03',
    kind: 'plate',
    label: 'Physics',
    vh: 130,
    canvasOpacity: 0.1,
    light: 'coldKey',
    machine: state({ cryostat: 0, vessel: 0.16, coils: 1, cs: 1, pf: 1, plasma: 0.3 }),
    cam: [
      { at: 0, pos: [13.0, 13.0, 2.3], target: [4.0, 13.0, 10.0], fov: 64 },
      { at: 1, pos: [12.6, 12.6, 3.4], target: [4.5, 13.0, 9.6], fov: 64 },
    ],
  },

  /* ------------------------------------------------------------------ 06 */
  {
    id: 'vessel',
    kind: 'scene',
    label: 'The vessel',
    vh: 340,
    canvasOpacity: 1,
    light: 'rim',
    // Everything here is solid — vessel, blanket and divertor at full opacity — so
    // this act is among the cheapest in the piece despite showing the most
    // geometry. Only the coil cage behind it is ghosted.
    machine: state({
      cryostat: 0,
      vessel: 1,
      blanket: 1,
      divertor: 1,
      coils: 0.16,
      plasma: 0.3,
    }),
    cam: [
      { at: 0, pos: [12.6, 12.6, 3.4], target: [4.5, 13.0, 9.6], fov: 64 },
      { at: 0.35, pos: [0, 13, 25], target: [0, MIDPLANE, 0], fov: 38 },
      { at: 0.7, pos: [4.5, 13, 4.7], target: [-1, MIDPLANE, 0], fov: 70 },
      { at: 1, pos: [4.6, 10.6, 4.0], target: [2.0, 8.4, 0], fov: 62 },
    ],
  },

  /* ------------------------------------------------------------------ 07 */
  {
    id: 'ignition',
    kind: 'scene',
    label: 'Ignition',
    vh: 360,
    canvasOpacity: 1,
    light: 'ignition',
    /*
     * The machine goes x-ray here: if the vessel stays opaque it simply hides the
     * plasma this whole act is built around, because the camera is outside 9.7 m
     * for most of it. Blanket and divertor are dropped rather than ghosted — they
     * would add two more transparent full-screen layers for detail that is
     * invisible behind the plasma.
     */
    machine: state({
      cryostat: 0.16,
      vessel: 0.3,
      blanket: 0,
      divertor: 0,
      /*
       * Coils stay fully opaque. They are thin D-rings with wide gaps, so an
       * opaque cage still reads and the plasma still shows between the coils —
       * while costing a depth-writing pass instead of a full-screen transparent
       * one. This single change is worth several frames per second here.
       */
      coils: 1,
      plasma: 1,
    }),
    cam: [
      { at: 0, pos: [4.6, 10.6, 4.0], target: [2.0, 8.4, 0], fov: 62 },
      { at: 0.34, pos: [0, 13, 30], target: [0, MIDPLANE, 0], fov: 36 },
      /*
       * The establishing shot, and the frame the whole piece is built toward: far
       * enough out that the entire 30 m machine fits, with the plasma burning
       * inside ghosted steel. Any closer and the torus stops reading as an object
       * and becomes a wash of light.
       */
      { at: 0.68, pos: [28, 19, 28], target: [0, MIDPLANE, 0], fov: 46 },
      { at: 1, pos: [0, 14.2, 25], target: [0, MIDPLANE, 0], fov: 36 },
    ],
  },

  /* ------------------------------------------------------------------ 08 */
  {
    id: 'plate-04',
    kind: 'plate',
    label: 'The work',
    vh: 120,
    canvasOpacity: 0.1,
    light: 'ignition',
    machine: state({ cryostat: 0.16, vessel: 0.3, coils: 0.5, plasma: 0.55 }),
    cam: [
      { at: 0, pos: [0, 14.2, 25], target: [0, MIDPLANE, 0], fov: 36 },
      { at: 1, pos: [2.5, 14.5, 24], target: [0, MIDPLANE, 0], fov: 36 },
    ],
  },

  /* --------------------------------------------------- 09..14 six projects */
  {
    id: 'project-humanity',
    kind: 'project',
    label: 'humanity',
    slug: 'humanity',
    vh: 220,
    canvasOpacity: 1,
    light: 'top',
    // Aerial, looking down into the magnet cage. The 440 blanket modules are
    // omitted: from 40 m up they are not resolvable, and ghosting them is not free.
    machine: state({ cryostat: 0.14, vessel: 0, coils: 0.9, cs: 0.75, plasma: 0.5 }),
    cam: [
      { at: 0, pos: [2.5, 14.5, 24], target: [0, MIDPLANE, 0], fov: 36 },
      { at: 0.5, pos: [12, 40, 30], target: [0, 16, 0], fov: 34 },
      { at: 1, pos: [-8, 30, 40], target: [0, 15, 0], fov: 34 },
    ],
  },
  {
    id: 'project-judas',
    kind: 'project',
    label: 'judas',
    slug: 'judas',
    vh: 220,
    canvasOpacity: 1,
    light: 'rim',
    // Low and close on the tungsten divertor, fully opaque so its roughness reads
    // against the polished Inconel used everywhere else.
    machine: state({ cryostat: 0, vessel: 0.5, divertor: 1, coils: 0.3, plasma: 0.45 }),
    cam: [
      { at: 0, pos: [-8, 30, 40], target: [0, 15, 0], fov: 34 },
      { at: 0.5, pos: [21, 5.6, 13], target: [5, 10.2, 0], fov: 48 },
      { at: 1, pos: [16, 9.0, 21], target: [3, 11.5, 0], fov: 48 },
    ],
  },
  {
    id: 'project-all-seeing-eye',
    kind: 'project',
    label: 'all-seeing-eye',
    slug: 'all-seeing-eye',
    vh: 220,
    canvasOpacity: 1,
    light: 'clinical',
    // Dead-on and symmetric. The vessel is nearly solid so its D-shaped
    // cross-section reads as a silhouette against the dark hall.
    machine: state({ cryostat: 0.2, vessel: 0.92, divertor: 0.4, coils: 0, plasma: 0.6 }),
    cam: [
      { at: 0, pos: [16, 9.0, 21], target: [3, 11.5, 0], fov: 48 },
      { at: 0.55, pos: [0, 12.6, 46], target: [0, 12.6, 0], fov: 18 },
      { at: 1, pos: [0, 12.6, 41], target: [0, 12.6, 0], fov: 18 },
    ],
  },
  {
    id: 'project-c-man',
    kind: 'project',
    label: 'c-man',
    slug: 'c-man',
    vh: 220,
    canvasOpacity: 1,
    light: 'coldKey',
    // A lateral track past the solenoid stack. The vessel is dropped entirely so
    // the 18 coils and 6 solenoid modules are unobstructed.
    machine: state({ cryostat: 0, vessel: 0, coils: 0.9, cs: 0.9, pf: 0.8, plasma: 0.4 }),
    cam: [
      { at: 0, pos: [0, 12.6, 41], target: [0, 12.6, 0], fov: 18 },
      { at: 0.5, pos: [-32, 10.5, 21], target: [-2, 12, 0], fov: 38 },
      { at: 1, pos: [-17, 12.5, 27], target: [0, 12.5, 0], fov: 38 },
    ],
  },
  {
    id: 'project-prometheus',
    kind: 'project',
    label: 'prometheus',
    slug: 'prometheus',
    vh: 220,
    canvasOpacity: 1,
    light: 'top',
    machine: state({ cryostat: 0.22, vessel: 0.45, divertor: 0, coils: 0.6, plasma: 0.7 }),
    cam: [
      { at: 0, pos: [-17, 12.5, 27], target: [0, 12.5, 0], fov: 38 },
      { at: 0.5, pos: [27, 28, 21], target: [0, 15, 0], fov: 44 },
      { at: 1, pos: [7, 21, 35], target: [0, 14, 0], fov: 44 },
    ],
  },
  {
    id: 'project-nana',
    kind: 'project',
    label: 'nana',
    slug: 'nana',
    vh: 220,
    canvasOpacity: 1,
    light: 'clinical',
    /*
     * A long lens from outside the machine. Every layer between the camera and the
     * plasma is glassed, so the compression stacks steel, then vessel, then the
     * glowing torus into one flat image — which is the point of the shot.
     */
    machine: state({
      cryostat: 0.14,
      vessel: 0.3,
      coils: 0.42,
      plasma: 1,
    }),
    cam: [
      { at: 0, pos: [7, 21, 35], target: [0, 14, 0], fov: 44 },
      { at: 0.5, pos: [0, 13.3, 46], target: [0, 13.15, 0], fov: 15 },
      { at: 1, pos: [0, 13.3, 39], target: [0, 13.15, 0], fov: 15 },
    ],
  },

  /* ------------------------------------------------------------------ 15 */
  {
    id: 'grid',
    kind: 'grid',
    label: 'All repositories',
    vh: 160,
    canvasOpacity: 0.1,
    light: 'void',
    // Almost entirely type, so the machine is reduced to a single ghosted layer.
    machine: state({ cryostat: 0.5, plasma: 0.3 }),
    cam: [
      { at: 0, pos: [0, 13.3, 39], target: [0, 13.15, 0], fov: 15 },
      { at: 1, pos: [0, 26, 68], target: [0, 15, 0], fov: 32 },
    ],
  },

  /* ------------------------------------------------------------------ 16 */
  {
    id: 'coda',
    kind: 'coda',
    label: 'Coda',
    vh: 220,
    canvasOpacity: 1,
    light: 'void',
    machine: state({ cryostat: 1, vessel: 0.3, coils: 0.4, plasma: 0.25 }),
    cam: [
      { at: 0, pos: [0, 26, 68], target: [0, 15, 0], fov: 32 },
      { at: 0.55, pos: [0, 31, 104], target: [0, 14, 0], fov: 30 },
      { at: 1, pos: [0, 35, 132], target: [0, 14, 0], fov: 28 },
    ],
  },
]

/* --------------------------------------------------------------------- */
/* Derived timeline. Nothing below needs editing when acts change.        */
/* --------------------------------------------------------------------- */

/** Total scroll length in viewport heights. */
export const TOTAL_VH = ACTS.reduce((sum, a) => sum + a.vh, 0)

/**
 * Adds `start`, `end` and `pStart`/`pEnd` progress ranges to each act.
 *
 * Note the reference: `pEnd` is measured against TOTAL_VH, which is exactly the
 * maximum scroll distance because App renders one extra viewport height of
 * run-out after the track. Without that spacer the final act could never reach
 * full progress, and the coda would never finish revealing itself.
 */
export const TIMELINE = (() => {
  let cursor = 0
  return ACTS.map((act) => {
    const start = cursor
    cursor += act.vh
    return {
      ...act,
      start,
      end: cursor,
      pStart: start / TOTAL_VH,
      pEnd: cursor / TOTAL_VH,
    }
  })
})()

/** Find the act containing a normalised document progress value. */
export function actAtProgress(progress) {
  const p = Math.min(Math.max(progress, 0), 1)
  for (let i = 0; i < TIMELINE.length; i += 1) {
    if (p < TIMELINE[i].pEnd || i === TIMELINE.length - 1) {
      return { act: TIMELINE[i], index: i }
    }
  }
  return { act: TIMELINE[TIMELINE.length - 1], index: TIMELINE.length - 1 }
}

/**
 * How many assemblies render as ghosted (transparent, depth-writing-off) layers
 * in this act. This is the frame-time budget: each one roughly costs a full
 * screen pass over everything behind it.
 */
export function ghostedLayerCount(act) {
  return Object.entries(act.machine).filter(
    ([key, value]) =>
      /*
       * The plasma and the human figure are excluded, on measurement rather than
       * convenience. The plasma is a thin additive torus — small screen coverage,
       * and it is the subject of the piece, so it is never negotiable. The figure
       * is a 1.8 m silhouette. Everything else in the machine is a large surface,
       * and those are what cost a full screen pass each.
       */
      key !== 'plasma' &&
      key !== 'human' &&
      value > 0.08 &&
      value < 0.98,
  ).length
}