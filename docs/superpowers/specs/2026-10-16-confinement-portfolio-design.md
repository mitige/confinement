# CONFINEMENT — Design Spec

Portfolio for **Evan / `github.com/mitige`**. A scroll-driven descent into a real-scale,
parametric ITER tokamak, alternating cinematic 3D acts with sober monochrome 2D text plates.

Date: 2026-10-16
Status: approved
Owner: Evan (`mitige`)

---

## 1. Objective

Impress an Epitech jury with a portfolio that is a piece of engineering rather than a template.
Success criteria:

- A real ITER tokamak, built entirely in code, at **true physical scale**, with believable PBR materials.
- Strict black/white/grey UI. The **only** chroma in the piece is the plasma — diegetic light, never decoration.
- Alternation between full-bleed 3D acts and pure 2D typographic plates, in an Apple-like cinematic register.
- Scroll is the sole instrument of staging: no buttons, no carousels, no cards.
- Accurate, verifiable presentation of real GitHub work.

## 2. Verified source data

Pulled live from the GitHub API on 2026-10-16. `evan`, France, 15 public repos, 3 followers.

| Project | Language | ★ | ⑂ | Size (KB) | Last push |
|---|---|---|---|---|---|
| humanity | Python | 9 | 1 | 12047 | 2026-08-13 |
| judas | Python | 2 | 0 | 18135 | 2026-07-03 |
| all-seeing-eye | Rust | 2 | 0 | 406 | 2026-10-07 |
| c-man | Rust | 1 | 0 | 485 | 2026-10-02 |
| prometheus | C++ | 0 | 1 | 2514 | 2026-06-27 |
| nana | Rust | 0 | 0 | 3755 | 2026-10-15 |
| rust-man | Rust | 0 | 0 | 319 | 2026-10-06 |
| c-nano, rust-nano | Rust | 0 | 0 | 255 | 2026-10-07 |
| ts-man | TypeScript | 0 | 0 | 16 | 2026-10-12 |
| seuil | JavaScript | 0 | 0 | 1973 | 2026-06-30 |
| deezer-glass | TypeScript | 0 | 0 | 994 | 2026-07-05 |
| oganesson-box | JavaScript | 0 | 0 | 9372 | 2026-07-10 |
| solar-system | JavaScript | 0 | 0 | 33962 | 2026-07-02 |
| discord-file-downloader | JavaScript | 0 | 0 | 34 | 2026-06-28 |

Six flagship acts, in this order: **humanity, judas, all-seeing-eye, c-man, prometheus, nana**.
Order is by stars then recency, except `nana` which closes the sequence as the newest work.

Data is hard-coded as a build-time snapshot so the site always renders offline, with an
optional live-stats refresh that upgrades the numbers if the API responds.

## 3. ITER reference dimensions

Parametric geometry derived from public ITER figures. All values in metres.

| Component | Value |
|---|---|
| Plasma major radius R | 6.2 |
| Plasma minor radius a | 2.0 |
| Plasma volume | ~840 m³ |
| Cryostat | 28.6 Ø × 29.3 h |
| Toroidal field coils | 18 × D-shaped, 17 h × 9 w, ~360 t each |
| Poloidal field coils | 6 (PF1 9 m, PF6 10 m Ø) |
| Central solenoid | 6 modules, ~13 h, 4.3 Ø, 1000 t, 13 T |
| Vacuum vessel | 19.4 Ø × 11.4 h, 5000 t |
| Blanket modules | 440 |
| Divertor cassettes | 54, tungsten |
| Total mass | 23 000 t |
| Magnetic field | 11.8 T |
| Plasma current | 15 MA |
| Plasma temperature | 150 000 000 °C |
| Fusion gain | Q = 10 (50 MW in → 500 MW out) |

Human reference figure: **1.8 m**, matte black, used in the Scale act to make the
"real scale" claim legible.

## 4. Structure — 17 acts

| # | Act | Type | Content |
|---|---|---|---|
| 0 | Overture | 3D | Dark hall, cryostat silhouette in the distance, title |
| 1 | Plate I | 2D | "Confinement." — manifesto |
| 2 | Scale | 3D | Cryostat exterior + 1.8 m human silhouette |
| 3 | Plate II | 2D | 30 m · 23 000 t · 11.8 T · 150 M °C |
| 4 | Magnets | 3D | Exploded view: 18 TF coils, 6 PF, central solenoid |
| 5 | Plate III | 2D | The physics, as bare numbers |
| 6 | Vessel | 3D | Inside the vacuum vessel, tungsten divertor |
| 7 | Ignition | 3D | The plasma. Bloom. The shot that must land |
| 8 | Plate IV | 2D | Transition: "Nothing here is theoretical." |
| 9 | humanity | 3D + 2D | Shot 01 |
| 10 | judas | 3D + 2D | Shot 02 |
| 11 | all-seeing-eye | 3D + 2D | Shot 03 |
| 12 | c-man | 3D + 2D | Shot 04 |
| 13 | prometheus | 3D + 2D | Shot 05 |
| 14 | nana | 3D + 2D | Shot 06 |
| 15 | GitHub | 2D | All 15 repos, typographic grid |
| 16 | Coda | 3D | Pull back to the whole machine, fade to black, contact |

## 5. Architecture

```
src/
  main.jsx                  entry, mounts App
  App.jsx                   composes canvas + overlay + loader
  data/
    projects.js             flagship project records
    repos.js                full 15-repo snapshot
    iter.js                 ITER reference dimensions (single source of truth)
    acts.js                 the 17-act timeline: type, scroll length, camera keys, lighting
  scroll/
    useLenis.js             smooth scroll
    ScrollDirector.jsx      global progress -> act progress context
    useActProgress.js       per-act normalized progress hook
  three/
    Scene.jsx               canvas contents, act-driven
    tokamak/
      Cryostat.jsx
      TFCoils.jsx
      PFCoils.jsx
      CentralSolenoid.jsx
      VacuumVessel.jsx
      Blanket.jsx           instanced, 440 modules
      Divertor.jsx          instanced, 54 cassettes
      Plasma.jsx            emissive FBM shader
      HumanScale.jsx        1.8 m reference figure
      Hall.jsx              the enclosing space
    materials/
      pbr.js                Inconel / anodized steel / copper / tungsten / concrete
      StudioEnvironment.jsx  procedural PMREM env, no external HDRI
    CameraRig.jsx           keyframe interpolation + damping
    Lighting.jsx            per-act lighting rigs
    Overlays3D.jsx          thin white wireframe technical diagrams per project
    Effects.jsx             ACES tonemapping, selective bloom, vignette, grain
  ui/
    Loader.jsx              hairline progress
    Plates.jsx              2D text acts
    ProjectAct.jsx          project 3D+2D act
    RepoGrid.jsx
    Coda.jsx
    Hud.jsx                 fixed minimal chrome
    Grain.jsx               unifying film grain
  styles/
    tokens.css              type scale, spacing, color
    global.css
```

### Key boundaries

- `data/acts.js` is the **single source of truth** for the timeline. Camera, lighting, HUD and
  overlay all read from it. Adding or reordering an act is a data edit, not a code edit.
- `data/iter.js` is the **only** place dimensions live. Geometry components consume it; none
  hard-code a radius.
- `ScrollDirector` owns all scroll state. 3D and 2D read from it; neither writes to it.

## 6. Scroll and camera model

Global scroll progress `p ∈ [0,1]` over the summed act lengths. Each act declares a length in
viewport heights: 3D spectacle acts 300–400vh, plates 100–140vh, project acts 260vh.

`CameraRig` holds a keyframe array of `{ p, position, target, fov, roll }`. Between keyframes it
interpolates position with Catmull-Rom for arc continuity and target/fov linearly with
easeInOutCubic, then applies critically-damped smoothing so mouse and scroll never snap.

Canvas opacity is act-driven: 3D acts 1.0, plates 0.12, project text beats 0.3. Plates are never
fully black — the machine keeps drifting behind them so the piece reads as continuous.

## 7. Rendering and materials

- `StudioEnvironment` builds an emissive box of soft panels, renders it through
  `PMREMGenerator`, and supplies `scene.environment`. Metal realism depends on this; no HDRI download.
- Materials: brushed Inconel 316 (cryostat), dark anodized steel with copper windings (coils),
  welded steel (vessel), rough tungsten (divertor), matte concrete (hall). All procedural
  roughness/normal detail — no texture files.
- Plasma is an FBM-noise emissive shader in a torus shell, additive, with a white-hot core
  grading to faint cyan then violet. It is the only coloured element.
- Post: ACES filmic tonemapping, selective bloom on the plasma emissive only, subtle vignette,
  film grain. No chromatic aberration.
- Quality tiers: high (desktop), medium (mobile / low DPR), and a static tier for
  `prefers-reduced-motion` that pins the camera to each act's keyframe.

## 8. Typography and colour

- Inter Variable, self-hosted via `@fontsource-variable/inter`. Weights 200/300/400. Display sizes
  use `clamp()` up to ~13vw, tracking −0.04em, leading 0.95.
- JetBrains Mono Variable for technical labels (`R = 6.2 m`, `★ 9`, act indices).
- Palette: `#000`, `#070707`, `#111`, `#1a1a1a` (surfaces); `#fff`, `#a1a1a1`, `#5a5a5a` (text).
  Exactly one light accent reserved for plasma-derived UI glow — used sparingly, if at all.
- Motion: reveals are opacity + a 12px translate, 900ms, cubic-bezier(0.16,1,0.3,1).
  No bounce, no scale-pop, no gradient text.

## 9. Performance targets

- 60fps at 1440p on a discrete GPU, ≥40fps on integrated.
- Instanced meshes for the 440 blanket modules, 54 divertor cassettes and 18 TF coils.
- DPR clamped: high 2, medium 1.5, low 1.
- Single canvas for the whole document. No per-section canvases.
- Total JS budget target under 1.5 MB gzipped including three.js.

## 10. Verification

The build is not "done" until every act has been screenshotted headlessly at 1440×900 and
reviewed for framing, exposure, legibility and material believability. Acts that read poorly
get their camera keys and lighting adjusted and re-shot.

Also checked: no console errors, build succeeds, `dist/` serves standalone, reduced-motion tier
renders, mobile viewport renders, and the four star/fork counts match the table in §2.

## 11. Out of scope

Backend, CMS, contact form submission, blog, analytics, i18n toggle (English only per approval),
and any external 3D asset download.