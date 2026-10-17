# CONFINEMENT

Portfolio for **Evan** — [`github.com/mitige`](https://github.com/mitige).

**Live: <https://mitige.github.io/confinement/>**

A scroll-driven descent into a real-scale ITER tokamak, built entirely in code, alternating
cinematic 3D acts with sober monochrome 2D text plates.

```bash
npm install
npm run dev        # http://127.0.0.1:5273
npm run build      # static bundle in dist/
npm run verify     # assert the machine's geometry and radial build
```

## Deployment

Published to GitHub Pages by `.github/workflows/deploy.yml`, on every push to `main`. The
workflow runs `npm run verify` **before** it builds, so a change that breaks the machine's radial
build, the camera chain or the layered-transparency budget fails the deploy rather than shipping.

The build sets `base: './'` in `vite.config.js` so the same bundle works at a domain root and at
the sub-path a project Pages site is served from — with the default absolute base the page loads
and then 404s every asset.

### A custom subdomain

`confinement.<your-domain>` is supported and takes two steps, one of which is DNS and therefore
has to happen on a domain you own:

1. In this repository, add a file named `CNAME` at the root containing just the hostname, for
   example `confinement.example.com`, and push. (Or set it under *Settings → Pages → Custom
   domain*, which creates the file for you.)
2. At your DNS provider, add a `CNAME` record for the `confinement` subdomain pointing at
   `mitige.github.io`.

Then enable *Enforce HTTPS* in the Pages settings; the certificate is issued automatically. Do
**not** add the `CNAME` file before the DNS record exists — Pages would start redirecting the
working `github.io` address to a hostname that does not resolve yet.

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

- `npm run verify` — geometry, radial-build, cryostat-stack and timeline assertions. Exit code 1
  on failure. The cryostat check exists because its failure mode is invisible in code review: if
  the top cap shares the trunk's radius while their height ranges overlap, the two side walls sit
  on the same surface and the depth buffer flickers between them — the top of the machine appears
  to punch in and out of its own wall. The rule asserted is general: no two coaxial cylinders may
  share a radius while overlapping in height.
- `npm run probe` — reports which GL backend headless Chrome reaches, and the frame rate.
- `npm run perf` — frame rate, settled device pixel ratio and GPU resource counts per resolution.
- `node scripts/click-audit.mjs` — for each act, asks the document what is actually under five
  points in the viewport. Every 2D section fills the screen and its links set `pointer-events:
  auto`, which an ancestor cannot override, so an invisible section would otherwise swallow every
  click. This is what catches that.
- `npm run shots` — screenshots every act at a deterministic scroll position, and fails on any
  console error or page exception. `npm run shots:mobile` and `--reduced` run the same pass at
  390×844 and with `prefers-reduced-motion: reduce`. Point it at the deployed site with
  `PREVIEW_URL=https://mitige.github.io/confinement/ npm run shots`, which is how the live build
  is verified rather than assumed.
- `npm run analyze` — decodes each screenshot and reports mean/min/max luminance, the fraction of
  lit and clipped pixels, detail density, and an ASCII luminance map for judging composition.
- `npm run exposure` — renders one act under several pipeline variants to localise exposure
  problems rather than guess at them.
- `node scripts/a11y.mjs` — reads the rendered pixels inside every visible text element and
  reports the WCAG contrast ratio, compositing the declared CSS ink over the measured backdrop.
  Currently: all 12 type-bearing acts pass, 20:1 for display type and 6.2:1 at the dimmest label.

Debug switches, harmless in production: `?fx=0` skips post-processing, `?exposure=N` scales every
light, `?rig=name` forces a lighting rig, and

```
?cam=0,37,25&target=0,28.4,0&fov=33
```

holds a fixed camera, for looking at one piece of the machine instead of hunting for a scroll
position that happens to frame it. `node scripts/inspect.mjs "<that url>" name` shoots it and
reports luminance, detail and an ASCII map — which is how the cryostat's top cap was confirmed
fixed rather than assumed.

### Measured results

Across 44 screenshots (desktop 1440×900, mobile 390×844, reduced motion), every act lands between
mean luminance 10 and 102 with under 4% of pixels clipped — except the plasma core at close range,
which is meant to clip. Nothing renders black, nothing blows out, and the reduced-motion pass
matches the normal pass to within 2%.

Timeline checks: 17 acts, 3780 viewport heights, camera chain continuous across every boundary,
and no act exceeds the three-ghosted-layer budget.

## Performance

### Default: maximum quality

The deployed site runs at **full resolution and the top feature tier by default** —
native device pixel ratio up to 2, bloom, vignette, MSAA. Nothing changes resolution while you
scroll. This is a deliberate trade against smoothness: a portfolio that looks soft by default is a
worse failure than one that occasionally drops a frame.

If it does not hold up on a given machine, the adaptation is one query parameter away:

| | |
|---|---|
| `?adaptive=1` | let the render resolution fall, targeting 50–58 fps |
| `?quality=medium` | cap the feature tier: no MSAA, cheaper bloom |
| `?res=0.7` | pin an exact render scale |

### The adaptive path

When switched on, the frame rate adapts. Resolution is spent first, because the cost of this scene is dominated by
fragment work — full-screen ghosted layers plus the additive plasma shader — and because losing
sharpness is far less noticeable than losing the glow. Only when resolution has bottomed out does
the governor shed bloom, vignette and MSAA. Because the lever is the canvas, the typography is
never softened: it is DOM, and stays sharp at any render scale.

Measured on **AMD Radeon 610M** — a 2-compute-unit, 15 W integrated GPU, roughly a tenth of an
M-series Mac — in the heaviest act at 1440×900. This is a weak enough GPU that the adaptive path
is worth having there; anything with a real graphics chip will sit at maximum:

| | fps | render resolution |
|---|---|---|
| original | 12–17 | 1440×900 |
| after cutting ghosted layers and the hall wall | 21–25 | 1440×900 |
| **with adaptive resolution** | **45–54** | 720×450 |

The spread is real measurement noise: this machine was under a load average of 13 from unrelated
compilation during the runs. Treat the ratio as the result, not the digits.

Changes that produced it, in order of what they were worth:

1. **Adaptive render resolution.** Walks between 0.5 and 1.0 in steps of 0.1, targeting 50–58 fps,
   with an extra allowance for text acts where the canvas runs at 10% opacity. Roughly 2×.
2. **A budget on ghosted layers.** A transparent assembly with depth writing off re-shades every
   pixel it covers, including all the geometry behind it. Going from six to three roughly doubled
   the frame rate in the magnets act, and `npm run verify` now asserts the budget so it cannot
   regress silently.
3. **Removing the hall wall.** A 180 m double-sided concrete cylinder that cost a full-screen
   shaded pass to render a surface that is nearly black anyway.
4. **Turbulence from a texture instead of the shader.** Two lookups in a seamless tileable noise
   replace about eighty arithmetic operations, in the most expensive fragment shader in the piece.
5. **Two plasma shells instead of three**, and front faces only. The middle shell was nested
   between the other two and contributed little while costing a third of the fill.
6. **Dropping texture work that showed nothing** — bump maps scaled at 0.01 on the largest
   surfaces, and a roughness map across the entire floor.

GPU resources stay flat at 26 geometries and ~26 textures, so nothing is allocated per frame.
`npm run perf` reports the frame rate, the device pixel ratio the governor settled on, and those
resource counts; `?res=1` pins the render scale, which is how the governor is A/B tested.

## Accessibility

`prefers-reduced-motion` disables smooth scrolling and drives the camera without damping.
Quality tiers drop device pixel ratio, MSAA and the post chain on weak GPUs. All type meets the
WCAG minimum contrast against the live render behind it. The keyboard scroll scrubber is
off-screen until focused, so it is not an invisible focus trap.

## Notes

Built with Vite, React 19, React Three Fiber, three.js and `postprocessing`. Text is set in Inter
and JetBrains Mono, both self-hosted. No HDRIs, no model files, no image assets: the machine, its
materials and its environment are all generated at runtime.