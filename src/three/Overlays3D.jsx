import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useDirectorStore } from '../scroll/ScrollDirector.jsx'
import { TIMELINE } from '../data/acts.js'
import { MIDPLANE } from '../data/iter.js'
import { damp } from '../lib/math.js'

/**
 * Thin white technical diagrams, one per project.
 *
 * The reactor stays the same object throughout the piece; what changes for each
 * project is the shot, the lighting, and one of these wireframe structures. They
 * are drawn as engineering line work — no fills, no colour — so a project reads as
 * an instrument measuring the machine rather than as a sticker placed on top of it.
 *
 * All six are built once and cross-faded, so switching projects costs nothing.
 */

const TAU = Math.PI * 2

/** Accumulates line segments into a flat position buffer. */
class SegmentBuilder {
  constructor() {
    this.points = []
  }

  line(ax, ay, az, bx, by, bz) {
    this.points.push(ax, ay, az, bx, by, bz)
  }

  /** A three-axis tick, used to mark a node without drawing a heavy glyph. */
  cross(x, y, z, size) {
    this.line(x - size, y, z, x + size, y, z)
    this.line(x, y - size, z, x, y + size, z)
    this.line(x, y, z - size, x, y, z + size)
  }

  /** A closed rectangular loop on a horizontal plane. */
  ring(y, radius, corners = 24) {
    for (let i = 0; i < corners; i += 1) {
      const a = (i / corners) * TAU
      const b = ((i + 1) / corners) * TAU
      this.line(
        Math.cos(a) * radius, y, Math.sin(a) * radius,
        Math.cos(b) * radius, y, Math.sin(b) * radius,
      )
    }
  }

  build() {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(this.points), 3),
    )
    return geometry
  }
}

/* ------------------------------------------------------------- generators */

/** humanity — a distributed network with no centre. */
function network() {
  const b = new SegmentBuilder()
  const count = 34
  const nodes = []
  // Fibonacci sphere: even coverage without clumping at the poles.
  for (let i = 0; i < count; i += 1) {
    const y = 1 - (i / (count - 1)) * 2
    const r = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = i * 2.39996
    const radius = 8.5 + (i % 5) * 0.85
    nodes.push(
      new THREE.Vector3(Math.cos(theta) * r * radius, y * radius * 1.15, Math.sin(theta) * r * radius),
    )
  }
  for (const n of nodes) b.cross(n.x, n.y, n.z, 0.26)
  // Connect each node to its two nearest neighbours: a graph, not a mesh.
  nodes.forEach((n, i) => {
    const sorted = nodes
      .map((m, j) => ({ j, d: n.distanceTo(m) }))
      .filter((m) => m.j !== i)
      .sort((p, q) => p.d - q.d)
      .slice(0, 2)
    for (const { j } of sorted) {
      if (j < i) continue
      const m = nodes[j]
      b.line(n.x, n.y, n.z, m.x, m.y, m.z)
    }
  })
  return b.build()
}

/** judas — a bounded arena with a centre line. */
function arena() {
  const b = new SegmentBuilder()
  const w = 8.5
  const h = 5.5
  const corners = [
    [-w, -h, -w], [w, -h, -w], [w, -h, w], [-w, -h, w],
    [-w, h, -w], [w, h, -w], [w, h, w], [-w, h, w],
  ]
  const edges = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ]
  for (const [i, j] of edges) {
    b.line(...corners[i], ...corners[j])
  }
  // Corner leaders, extending outward from the cage.
  for (const c of corners) {
    const scale = 1.28
    b.line(...c, c[0] * scale, c[1], c[2] * scale)
  }
  b.line(-w, 0, 0, w, 0, 0)
  b.line(0, 0, -w, 0, 0, w)
  b.line(0, -h, 0, 0, h, 0)
  return b.build()
}

/** all-seeing-eye — stacked verification passes over one subject. */
function grid() {
  const b = new SegmentBuilder()
  const passes = 7
  for (let i = 0; i < passes; i += 1) {
    const t = i / (passes - 1)
    const y = -5.4 + t * 10.8
    const radius = 11.2 - t * 3.4
    b.ring(y, radius, 26)
    // Radial ticks break each ring into readable segments.
    for (let k = 0; k < 12; k += 1) {
      const a = (k / 12) * TAU
      const inner = radius - 0.7
      b.line(Math.cos(a) * inner, y, Math.sin(a) * inner, Math.cos(a) * radius, y, Math.sin(a) * radius)
    }
  }
  // Six vertical struts tie the stack together, so it reads as one instrument.
  for (let k = 0; k < 6; k += 1) {
    const a = (k / 6) * TAU
    const x = Math.cos(a)
    const z = Math.sin(a)
    b.line(x * 11.2, -5.4, z * 11.2, x * 7.8, 5.4, z * 7.8)
  }
  return b.build()
}

/** c-man — a descending pipeline of stages. */
function cascade() {
  const b = new SegmentBuilder()
  const stages = 7
  for (let i = 0; i < stages; i += 1) {
    const t = i / (stages - 1)
    const x = -9 + t * 18
    const y = 6.5 - t * 12.5
    const s = 2.6 - t * 0.8
    b.line(x - s, y - s, -s, x + s, y - s, -s)
    b.line(x + s, y - s, -s, x + s, y + s, -s)
    b.line(x + s, y + s, -s, x - s, y + s, -s)
    b.line(x - s, y + s, -s, x - s, y - s, -s)
    if (i < stages - 1) {
      const t2 = (i + 1) / (stages - 1)
      const x2 = -9 + t2 * 18
      const y2 = 6.5 - t2 * 12.5
      b.line(x + s, y, 0, x2 - (2.6 - t2 * 0.8), y2, 0)
    }
  }
  return b.build()
}

/** prometheus — a policy trajectory against its reward axis. */
function trajectory() {
  const b = new SegmentBuilder()
  const span = 11
  const samples = 48
  let prev = null
  for (let i = 0; i <= samples; i += 1) {
    const x = -span + (i / samples) * span * 2
    const y = 4.2 - (x * x) / 32
    if (prev) b.line(prev.x, prev.y, 0, x, y, 0)
    prev = { x, y }
  }
  // A second, higher trajectory: transfer learning reaching further.
  prev = null
  for (let i = 0; i <= samples; i += 1) {
    const x = -span * 0.82 + (i / samples) * span * 1.64
    const y = 7.6 - (x * x) / 22
    if (prev) b.line(prev.x, prev.y, 2.2, x, y, 2.2)
    prev = { x, y }
  }
  b.line(-span, -2.6, 0, span, -2.6, 0)
  for (let i = 0; i <= 10; i += 1) {
    const x = -span + (i / 10) * span * 2
    b.line(x, -2.6, 0, x, -2.95, 0)
  }
  return b.build()
}

/** nana — a spatiotemporal lattice of remembered states. */
function lattice() {
  const b = new SegmentBuilder()
  const nx = 4
  const ny = 3
  const nz = 4
  const stepX = 6.0
  const stepY = 4.6
  const stepZ = 6.0
  const s = 0.62
  for (let i = 0; i < nx; i += 1) {
    for (let j = 0; j < ny; j += 1) {
      for (let k = 0; k < nz; k += 1) {
        const x = (i - (nx - 1) / 2) * stepX
        const y = (j - (ny - 1) / 2) * stepY
        const z = (k - (nz - 1) / 2) * stepZ
        b.line(x - s, y - s, z - s, x + s, y - s, z - s)
        b.line(x + s, y - s, z - s, x + s, y + s, z - s)
        b.line(x + s, y + s, z - s, x - s, y + s, z - s)
        b.line(x - s, y + s, z - s, x - s, y - s, z - s)
        b.line(x - s, y - s, z + s, x + s, y - s, z + s)
        b.line(x + s, y - s, z + s, x + s, y + s, z + s)
        b.line(x + s, y + s, z + s, x - s, y + s, z + s)
        b.line(x - s, y + s, z + s, x - s, y - s, z + s)
        b.line(x - s, y - s, z - s, x - s, y - s, z + s)
        b.line(x + s, y - s, z - s, x + s, y - s, z + s)
        b.line(x + s, y + s, z - s, x + s, y + s, z + s)
        b.line(x - s, y + s, z - s, x - s, y + s, z + s)
      }
    }
  }
  return b.build()
}

const BUILDERS = { network, arena, grid, cascade, trajectory, lattice }

/** Peak opacity. Subtle by design: this is line work under heavy bloom. */
const PEAK_OPACITY = 0.16

export function Overlays3D() {
  const store = useDirectorStore()
  const group = useRef(null)
  const opacity = useRef({})

  const schemas = useMemo(() => Object.keys(BUILDERS), [])
  const geometries = useMemo(
    () => Object.fromEntries(schemas.map((name) => [name, BUILDERS[name]()])),
    [schemas],
  )
  const materials = useMemo(
    () =>
      Object.fromEntries(
        schemas.map((name) => [
          name,
          new THREE.LineBasicMaterial({
            color: new THREE.Color('#ffffff'),
            transparent: true,
            opacity: 0,
            depthWrite: false,
            toneMapped: false,
          }),
        ]),
      ),
    [schemas],
  )

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    const act = TIMELINE[store.actIndex]
    const active = act.kind === 'project' ? act.slug : null

    for (const name of schemas) {
      const target = name === active ? PEAK_OPACITY : 0
      const current = opacity.current[name] ?? 0
      const next = damp(current, target, 2.1, dt)
      opacity.current[name] = next
      materials[name].opacity = next
      const mesh = group.current?.getObjectByName(name)
      if (mesh) mesh.visible = next > 0.004
    }

    if (group.current) {
      group.current.rotation.y += dt * 0.028
    }
  })

  return (
    <group ref={group} position={[0, MIDPLANE, 0]} renderOrder={8}>
      {schemas.map((name) => (
        <lineSegments
          key={name}
          name={name}
          geometry={geometries[name]}
          material={materials[name]}
          visible={false}
          frustumCulled={false}
        />
      ))}
    </group>
  )
}