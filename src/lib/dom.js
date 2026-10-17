/**
 * Overlay section visibility.
 *
 * Every 2D section is absolutely positioned to fill the viewport, and the links
 * inside them set `pointer-events: auto` so they can be clicked. That combination
 * is a trap: `pointer-events: none` on an ancestor does not disable a descendant
 * that re-enables it, so an overlay at zero opacity still swallows every click
 * across the screen.
 *
 * `visibility: hidden` removes the section and all of its descendants from hit
 * testing and from painting, regardless of pointer-events.
 */

/** Sections at or below this opacity are treated as gone. */
const GONE = 0.01

export function applyVisibility(element, opacity) {
  if (!element) return
  element.style.opacity = opacity

  const next = opacity > GONE ? 'visible' : 'hidden'
  // Only touch the DOM when it actually changes: this runs every frame.
  if (element.style.visibility !== next) element.style.visibility = next
}