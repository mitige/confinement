import * as THREE from 'three'

/**
 * Geometry kernel for the machine.
 *
 * The tokamak's coils are closed D-shaped loops swept with a rectangular
 * winding-pack profile. Three's ExtrudeGeometry is not usable here: with an
 * `extrudePath` it relies on Frenet frames, which flip and roll unpredictably
 * around a closed planar loop, producing a twisted tube and a seam gap.
 *
 * So the sweep is built by hand. The path is planar, which makes the frame
 * trivial and exact: the in-plane normal is a fixed 90° rotation of the tangent,
 * and the binormal is the constant out-of-plane axis. No frame flipping is
 * possible.
 */

const TAU = Math.PI * 2

/* ------------------------------------------------------------------ profiles */

/**
 * A rounded rectangle, centred on the origin, wound counter-clockwise.
 * `w` runs along the profile's in-plane axis, `h` along the out-of-plane axis.
 */
export function roundedRectProfile(w, h, r = 0.2, cornerSegments = 4) {
  const hw = w / 2
  const hh = h / 2
  const rad = Math.min(r, hw * 0.98, hh * 0.98)
  const points = []

  // Corner centres, counter-clockwise from the +x/+y corner.
  const corners = [
    { cx: hw - rad, cy: hh - rad, start: 0 },
    { cx: -(hw - rad), cy: hh - rad, start: Math.PI / 2 },
    { cx: -(hw - rad), cy: -(hh - rad), start: Math.PI },
    { cx: hw - rad, cy: -(hh - rad), start: (3 * Math.PI) / 2 },
  ]

  for (const c of corners) {
    for (let i = 0; i <= cornerSegments; i += 1) {
      const a = c.start + (i / cornerSegments) * (Math.PI / 2)
      points.push(new THREE.Vector2(c.cx + Math.cos(a) * rad, c.cy + Math.sin(a) * rad))
    }
  }

  // The corner sweep already includes each flat's endpoints, so drop the
  // duplicated vertices where one corner's last point equals the next's first.
  return dedupeRing(points)
}

/** Remove consecutive duplicates from a closed ring. */
function dedupeRing(points, epsilon = 1e-6) {
  const out = []
  for (const p of points) {
    const last = out[out.length - 1]
    if (!last || last.distanceTo(p) > epsilon) out.push(p)
  }
  while (out.length > 2 && out[0].distanceTo(out[out.length - 1]) <= epsilon) out.pop()
  return out
}

/* --------------------------------------------------------------- D-shape path */

/**
 * The D-shaped centreline of a toroidal field coil, in the (radius, height)
 * plane.
 *
 * The outboard boundary is an elliptic arc; the inboard boundary is the straight
 * leg that closes the loop. When `innerRadius === arcCentre` the leg is tangent to
 * the arc — the classic Princeton D — so the swept case is smooth across the join
 * with no crease for the light to catch.
 *
 * Returned in (x = radius, y = height), wound so that the in-plane normal points
 * outboard.
 */
export function dShapeCenterline({
  innerRadius,
  arcCentre,
  semiR,
  semiZ,
  arcSamples = 190,
  legSamples = 7,
} = {}) {
  // Where the ellipse crosses the inboard radius.
  const thetaEnd = Math.acos(
    Math.max(-1, Math.min(1, (innerRadius - arcCentre) / semiR)),
  )
  const zJunction = semiZ * Math.sin(thetaEnd)

  const arc = []
  for (let i = 0; i <= arcSamples; i += 1) {
    const theta = thetaEnd - (i / arcSamples) * 2 * thetaEnd
    arc.push(
      new THREE.Vector2(arcCentre + semiR * Math.cos(theta), semiZ * Math.sin(theta)),
    )
  }

  /*
   * Straight inboard leg, bottom to top.
   *
   * The arc already contains both junctions at (innerRadius, ±zJunction), so the
   * leg contributes strictly interior points only. Including the endpoints here
   * would duplicate them, and offsetting them inward would make the ring reverse
   * direction at the junction and fold the swept surface back on itself.
   *
   * When innerRadius === arcCentre the leg meets the arc tangentially, so the
   * centreline is smooth across the join and needs no fillet.
   */
  const leg = []
  for (let i = 1; i <= legSamples; i += 1) {
    const t = i / (legSamples + 1)
    leg.push(new THREE.Vector2(innerRadius, -zJunction + t * 2 * zJunction))
  }

  // Order: down the outboard arc, then up the inboard leg. Closed by wrapping.
  const ring = [...arc, ...leg]

  // A tangential join needs no rounding; a non-tangential one gets corner-cut so
  // the winding pack does not crease.
  const isTangent = Math.abs(innerRadius - arcCentre) < 1e-9
  if (isTangent) return ring

  return cornerCutClosed(ring, [0, arc.length - 1], 0.5)
}

/**
 * Chaikin-style corner cutting at the given closed-ring indices. Replaces each
 * corner with three points that round the join without ever folding the ring.
 */
function cornerCutClosed(ring, indices, k) {
  const marked = new Set(indices)
  const out = []
  const n = ring.length

  for (let i = 0; i < n; i += 1) {
    const p = ring[i]
    if (!marked.has(i)) {
      out.push(p)
      continue
    }
    const prev = ring[(i - 1 + n) % n]
    const next = ring[(i + 1) % n]
    const a = prev.clone().lerp(p, k)
    const b = next.clone().lerp(p, k)
    const mid = a.clone().multiplyScalar(0.25).addScaledVector(p, 0.5).addScaledVector(b, 0.25)
    out.push(a, mid, b)
  }

  return dedupeRing(out)
}

/* -------------------------------------------------------------------- sweep */

/**
 * Sweep a closed profile along a closed planar centreline.
 *
 * The centreline must lie in the z = 0 plane. The profile's x axis maps to the
 * in-plane normal (outward, for the D-shape above) and its y axis maps to +z.
 *
 * Returns a BufferGeometry with positions, uvs and normals.
 */
export function sweepClosed(centerline, profile, { uvRepeat = 6 } = {}) {
  const n = centerline.length
  const m = profile.length

  const positions = new Float32Array(n * m * 3)
  const uvs = new Float32Array(n * m * 2)

  // Cumulative arc length, so UVs stay proportional on long straights.
  const arcLength = [0]
  for (let i = 1; i <= n; i += 1) {
    const a = centerline[i - 1]
    const b = centerline[i % n]
    arcLength.push(arcLength[i - 1] + a.distanceTo(b))
  }
  const totalLength = arcLength[n] || 1

  const tangent = new THREE.Vector2()
  const normal = new THREE.Vector2()

  for (let i = 0; i < n; i += 1) {
    const prev = centerline[(i - 1 + n) % n]
    const next = centerline[(i + 1) % n]
    // Central difference: stable on a densely sampled loop, and symmetric so the
    // straight leg keeps an exactly constant frame.
    tangent.set(next.x - prev.x, next.y - prev.y)
    if (tangent.lengthSq() < 1e-12) tangent.set(1, 0)
    tangent.normalize()
    // 90° rotation in-plane. With the D-shape wound as above this points outward.
    normal.set(-tangent.y, tangent.x)

    const origin = centerline[i]
    const v = (arcLength[i] / totalLength) * uvRepeat

    for (let j = 0; j < m; j += 1) {
      const p = profile[j]
      const o = (i * m + j) * 3
      positions[o] = origin.x + normal.x * p.x
      positions[o + 1] = origin.y + normal.y * p.x
      positions[o + 2] = p.y

      const t = (i * m + j) * 2
      uvs[t] = j / m
      uvs[t + 1] = v
    }
  }

  const quads = n * m
  const indices = new Uint32Array(quads * 6)
  let w = 0
  for (let i = 0; i < n; i += 1) {
    const i2 = (i + 1) % n
    for (let j = 0; j < m; j += 1) {
      const j2 = (j + 1) % m
      const a = i * m + j
      const b = i * m + j2
      const c = i2 * m + j2
      const d = i2 * m + j
      indices[w] = a
      indices[w + 1] = b
      indices[w + 2] = c
      indices[w + 3] = a
      indices[w + 4] = c
      indices[w + 5] = d
      w += 6
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  geometry.setIndex(new THREE.BufferAttribute(indices, 1))
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  geometry.userData.sweepClosed = { n, m, totalLength }
  return geometry
}

/* -------------------------------------------------- surfaces of revolution */

/**
 * A closed D-shaped outline in (radius, height), used as a lathe profile for the
 * plasma's last closed flux surface and for the vessel's cross-section.
 *
 * Uses the standard Miller parametrisation, so the plasma's triangularity and
 * elongation are the real ITER values rather than a stretched torus.
 */
export function fluxSurfaceOutline({
  R0,
  a,
  kappa = 1,
  delta = 0,
  samples = 220,
  /** >0 shrinks the outline inward, used to give a vessel wall thickness. */
  inset = 0,
  /**
   * Repeat the first point at the end. Required when the outline is fed to a
   * lathe: without it the surface of revolution leaves a slit along the poloidal
   * seam, which reads as a bright crack down the vessel.
   */
  close = false,
} = {}) {
  const points = []
  for (let i = 0; i < samples; i += 1) {
    const theta = (i / samples) * TAU
    const r = R0 + (a - inset) * Math.cos(theta + delta * Math.sin(theta))
    const z = kappa * (a - inset) * Math.sin(theta)
    points.push(new THREE.Vector2(r, z))
  }
  if (close) points.push(points[0].clone())
  return points
}

/** A closed circular centreline in the (radius, height) plane. */
export function circleCenterline(radius, samples = 180) {
  const points = []
  for (let i = 0; i < samples; i += 1) {
    const theta = (i / samples) * TAU
    points.push(new THREE.Vector2(radius * Math.cos(theta), radius * Math.sin(theta)))
  }
  return points
}

/**
 * Build a closed surface of revolution from an open outline by revolving it
 * about the vertical axis. `closedProfile` selects whether the outline itself is
 * a closed loop (a hollow shell) or a single contour (a solid of revolution).
 */
export function revolve(
  outline,
  { segments = 160, closedProfile = false, uvRepeat = 8 } = {},
) {
  const geometry = new THREE.LatheGeometry(outline, segments, 0, TAU)
  !closedProfile
  // LatheGeometry already produces the correct topology for both cases; we only
  // need to scale the UVs so procedural maps tile at a useful density.
  const uv = geometry.attributes.uv
  for (let i = 0; i < uv.count; i += 1) {
    uv.setX(i, uv.getX(i) * uvRepeat)
  }
  uv.needsUpdate = true
  geometry.computeVertexNormals()
  return geometry
}

/**
 * Signed volume of a closed mesh, by the divergence theorem. Used by the test
 * suite to prove the sweep's winding order faces outward: a negative volume means
 * every normal points the wrong way.
 */
export function signedVolume(geometry) {
  const pos = geometry.attributes.position
  const index = geometry.index
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  const cross = new THREE.Vector3()
  let volume = 0

  const count = index ? index.count : pos.count
  for (let i = 0; i < count; i += 3) {
    const i0 = index ? index.getX(i) : i
    const i1 = index ? index.getX(i + 1) : i + 1
    const i2 = index ? index.getX(i + 2) : i + 2
    a.fromBufferAttribute(pos, i0)
    b.fromBufferAttribute(pos, i1)
    c.fromBufferAttribute(pos, i2)
    cross.crossVectors(b, c)
    volume += a.dot(cross)
  }

  return volume / 6
}