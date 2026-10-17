# CONFINEMENT

Portfolio for **Evan** — [`github.com/mitige`](https://github.com/mitige).

A scroll-driven descent into a real-scale ITER tokamak, built entirely in code, alternating
cinematic 3D acts with sober monochrome 2D text plates.

```bash
npm install
npm run dev        # http://127.0.0.1:5273
npm run build      # static bundle in dist/
npm run verify     # assert the machine's geometry and radial build
```

## What it is

Seventeen acts. The camera flies from outside a dark hall, into the cryostat, through the
magnet cage, inside the vacuum vessel, and finally into the plasma — then out again to a wide
coda. Between the 3D acts, four typographic plates sit on black while the machine recedes to a
twelfth of its brightness.

The only colour in the entire piece is emitted by the plasma shader. The interface is strictly
black, white and grey.

## The machine is real

The tokamak is generated parametrically from published ITER figures. One world unit is one
metre, so "real scale" is a structural property of the scene rather than a claim in the copy.

| Component | Value |
|---|---|
| Plasma major radius R | 6.2 m |
| Plasma minor radius a | 2.0 m |
| Elongation / triangularity | 1.85 / 0.5 |
| Cryostat | 28.6 Ø × 29.3 m |
| Toroidal field coils | 18 × D-shaped, 17 m tall |
| Poloidal field coils | 6, published radii |
| Central solenoid | 6 modules, 13 m, 13 T |
| Vacuum vessel | 19.4 Ø × 11.4 m |
| Blanket modules | 440 (instanced) |
| Divertor cassettes | 54, tungsten (instanced) |
| Machine mass | 23 000 t |

`npm run verify` proves the radial build nests without interpenetration and that the swept coil
geometry has outward-facing normals, by integrating the mesh's signed volume. It is not a visual
check — it is arithmetic:

```
central solenoid         0.000 ->   2.150
TF coil inner leg        2.350 ->   3.250
vessel inboard wall      3.300 ->   3.750
inboard blanket          3.750 ->   4.150
plasma                   4.200 ->   8.200
outboard blanket         8.850 ->   9.250
vessel outboard wall     9.250 ->   9.700
```

A 1.8 m human figure stands at the base of the cryostat in the second act, so the scale claim
can be checked by eye rather than taken on faith.

## Architecture

```
src/
  data/          acts timeline, ITER dimensions, projects, repo snapshot, plate copy
  scroll/        Lenis smooth scroll + the scroll director
  three/         scene, camera rig, lighting, overlays, materials, tokamak assemblies
  ui/            loader, HUD, plates, project acts, repo grid, coda
  lib/           math, quality tiers
scripts/         geometry verification, GPU probe, screenshot harness, image analyser
```

Three decisions shape everything else:

**`data/acts.js` is the single source of truth.** Each act declares its scroll length, camera
keys, machine sub-system visibilities and lighting rig. The 3D scene, the HUD, the overlays and
the canvas opacity all read from it. Adding or reordering an act is a data edit. The camera
chain is verified to be continuous across act boundaries.

**Nothing unmounts.** Every assembly is mounted once and the timeline changes what is visible by
fading materials. That is what makes a cutaway a continuous camera move rather than a scene
swap. Faded surfaces drop depth writing and become x-ray layers, which is a deliberate look, not
an artefact.

**Two channels of scroll state.** Mutable refs update every frame for the WebGL loop; React
state changes only when the act changes. Per-frame DOM writes are imperative, so a scroll through
all seventeen acts costs a handful of React renders.

## Rendering

- **Environment lighting is procedural.** Metals have no diffuse response — they are nothing but
  reflected environment — so a flat ambient would make everything look like grey plastic. A small
  emissive studio room is rendered through `PMREMGenerator` to produce the environment map. No
  HDRI is downloaded. The room is dark grey rather than black, and has horizon panels, because a
  rough metal at close range samples a narrow cone of the environment.
- **All textures are generated at runtime** into canvases: brushed-metal roughness, weld seams,
  machined surfaces, multi-scale noise. The repository ships no image files.
- **Order is scene → bloom → ACES → vignette.** The canvas renders with tone mapping disabled into
  a half-float buffer so the plasma can push values above 1.0 and bloom as genuine HDR highlights
  before ACES compresses the range.
- Instanced meshes for the 440 blanket modules, 54 divertor cassettes and 18 TF coils. One canvas
  for the whole document.

## Verification

This model cannot view images, so the review loop is measurement instead of eyeballing:

- `npm run verify` — geometry, radial-build and timeline assertions. Exit code 1 on failure.
- `npm run probe` — reports which GL backend headless Chrome reaches, and the frame rate.
- `npm run shots` — screenshots every act at a deterministic scroll position, and fails on any
  console error or page exception. `npm run shots:mobile` and `--reduced` run the same pass at
  390×844 and with `prefers-reduced-motion: reduce`.
- `npm run analyze` — decodes each screenshot and reports mean/min/max luminance, the fraction of
  lit and clipped pixels, detail density, and an ASCII luminance map for judging composition.
- `npm run exposure` — renders one act under several pipeline variants to localise exposure
  problems rather than guess at them.
- `node scripts/a11y.mjs` — reads the rendered pixels inside every visible text element and
  reports the WCAG contrast ratio, compositing the declared CSS ink over the measured backdrop.
  Currently: all 12 type-bearing acts pass, 20:1 for display type and 6.2:1 at the dimmest label.

Debug switches, harmless in production: `?fx=0` skips post-processing, `?exposure=N` scales every
light, `?rig=name` forces a lighting rig.

### Measured results

Across 44 screenshots (desktop 1440×900, mobile 390×844, reduced motion), every act lands between
mean luminance 10 and 102 with under 4% of pixels clipped — except the plasma core at close range,
which is meant to clip. Nothing renders black, nothing blows out, and the reduced-motion pass
matches the normal pass to within 2%.

Timeline checks: 17 acts, 3780 viewport heights, camera chain continuous across every boundary,
and no act exceeds the three-ghosted-layer budget.

Frame rate, measured on **AMD Radeon 610M** — a 2-compute-unit, 15 W integrated GPU, which is
roughly one tenth of an M-series Mac — at 1440×900:

| Act | Before optimisation | After |
|---|---|---|
| magnets | 13.6 fps | 34.5 fps |
| overture | 31.3 fps | 39.7 fps |
| ignition (heaviest) | 12.5 fps | 17.6 fps |
| mobile 390×844 | 12.2 fps | 29.2 fps |

GPU resources stay flat at 28 geometries, 29 textures and ~16 compiled programs, so nothing is
being allocated per frame. The largest single win was restructuring the timeline to cap
transparent full-screen layers: ghosted assemblies drop depth writing, so each one re-shades all
the geometry behind it, and going from six to three roughly doubled the frame rate. `npm run
verify` now asserts that budget so it cannot regress silently.

The adaptive tier provably engages — measured steps of dpr 1.00→0.75 and 2.00→1.25 on this
hardware. Real-world frame rates will be much higher than the table above; these are the numbers
from the weakest GPU available here, not a target.

## Accessibility

`prefers-reduced-motion` disables smooth scrolling and drives the camera without damping.
Quality tiers drop device pixel ratio, MSAA and the post chain on weak GPUs. All type meets the
WCAG minimum contrast against the live render behind it. The keyboard scroll scrubber is
off-screen until focused, so it is not an invisible focus trap.

## Notes

Built with Vite, React 19, React Three Fiber, three.js and `postprocessing`. Text is set in Inter
and JetBrains Mono, both self-hosted. No HDRIs, no model files, no image assets: the machine, its
materials and its environment are all generated at runtime.