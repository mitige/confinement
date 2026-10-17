import * as THREE from 'three'

/**
 * Text rendered into a canvas and used as a billboard sprite.
 *
 * Used for the sparse technical annotations the piece needs in 3D — the 1.8 m
 * dimension on the human figure, and the axis callouts during the magnets act.
 * A sprite always faces the camera and attenuates with distance, so an annotation
 * stays legible without ever being drawn on top of the machine.
 *
 * Deliberately not the DOM: these labels must be occluded by the machine when the
 * camera moves behind it, which CSS overlays cannot do.
 */
export function makeLabelSprite(
  text,
  {
    worldHeight = 0.5,
    fontSize = 64,
    weight = 500,
    color = '#ffffff',
    opacity = 0.7,
    family = 'Inter Variable, Inter, Helvetica Neue, sans-serif',
    tracking = 0,
  } = {},
) {
  const dpr = 2
  const font = `${weight} ${fontSize}px ${family}`
  const padding = fontSize * 0.35

  const canvas = document.createElement('canvas')
  let ctx = canvas.getContext('2d')
  ctx.font = font
  if (tracking && 'letterSpacing' in ctx) ctx.letterSpacing = `${tracking}px`

  const width = ctx.measureText(text).width
  const height = fontSize * 1.5

  canvas.width = Math.ceil((width + padding * 2) * dpr)
  canvas.height = Math.ceil(height * dpr)

  // Resizing resets the context, so the font and spacing must be reapplied.
  ctx = canvas.getContext('2d')
  ctx.scale(dpr, dpr)
  ctx.font = font
  if (tracking && 'letterSpacing' in ctx) ctx.letterSpacing = `${tracking}px`
  ctx.textBaseline = 'middle'
  ctx.fillStyle = color
  ctx.globalAlpha = opacity
  ctx.fillText(text, padding, height / 2)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearFilter
  texture.needsUpdate = true

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    opacity: 1,
  })

  const sprite = new THREE.Sprite(material)
  const aspect = canvas.width / canvas.height
  sprite.scale.set(worldHeight * aspect, worldHeight, 1)
  sprite.renderOrder = 20
  return sprite
}

/**
 * An engineering dimension line: a thin span with tick marks at both ends,
 * describing a measured distance between two points.
 */
export function makeDimensionLine(from, to, { tick = 0.18 } = {}) {
  const a = new THREE.Vector3(...from)
  const b = new THREE.Vector3(...to)
  const axis = new THREE.Vector3().subVectors(b, a).normalize()
  // Any direction perpendicular to the span will do for the end ticks.
  const perp = new THREE.Vector3(0, 1, 0)
  if (Math.abs(axis.dot(perp)) > 0.95) perp.set(1, 0, 0)
  perp.crossVectors(axis, perp).normalize().multiplyScalar(tick)

  const points = [
    b.clone().sub(perp),
    b.clone().add(perp),
    b,
    a,
    a.clone().sub(perp),
    a.clone().add(perp),
  ]

  const geometry = new THREE.BufferGeometry().setFromPoints(points)
  const material = new THREE.LineBasicMaterial({
    color: new THREE.Color('#ffffff'),
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
    toneMapped: false,
  })

  return new THREE.Line(geometry, material)
}