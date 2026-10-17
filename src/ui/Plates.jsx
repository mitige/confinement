import { useMemo, useRef } from 'react'
import { useDirector, useScrollFrame } from '../scroll/ScrollDirector.jsx'
import { TIMELINE } from '../data/acts.js'
import { PLATES } from '../data/plates.js'
import { applyVisibility } from '../lib/dom.js'
import { clamp, easeOutCubic, window01 } from '../lib/math.js'

/**
 * The four monochrome plates.
 *
 * These are the 2D half of the alternation: full-bleed typography on black while
 * the machine recedes to a twelfth of its brightness behind. Every element is
 * animated by writing to the DOM from the scroll loop rather than through React
 * state, so a plate costs nothing per frame.
 *
 * Nothing sits above the copy. There was a roman numeral and a hairline rule
 * there; both were decoration standing in front of the words, and removing them
 * leaves the plate with only what it has to say.
 *
 * Reveals are staggered inside each plate, and elements never fade themselves out —
 * the plate's own master fade handles the exit, which avoids the compounding
 * opacity dip that double-fading produces.
 */

/** Master window for a plate's overall presence within its act. */
const inWindow = (local) => window01(local, 0.05, 0.2, 0.76, 0.92)

/** Staggered ramp for a child element; rises and then holds at 1. */
const childRamp = (local, index, { start = 0.09, step = 0.035, duration = 0.16 } = {}) =>
  easeOutCubic(clamp((local - (start + index * step)) / duration))

export function Plates() {
  const { activeIndex } = useDirector()
  const roots = useRef({})
  const children = useRef({})

  // Only the four plate acts, paired with their copy.
  const plates = useMemo(
    () =>
      TIMELINE.map((act, index) => ({ act, index })).filter(
        ({ act }) => act.kind === 'plate' && PLATES[act.id],
      ),
    [],
  )

  useScrollFrame((s) => {
    for (const { act, index } of plates) {
      const local = s.actIndex === index ? s.local : s.actIndex > index ? 1 : 0

      const root = roots.current[act.id]
      if (root) {
        const o = inWindow(local)
        applyVisibility(root, o)
        root.style.transform = `translateY(${(1 - o) * 18}px)`
      }

      const items = children.current[act.id]
      if (items) {
        items.forEach((element, i) => {
          if (!element) return
          const o = childRamp(local, i)
          element.style.opacity = o
          element.style.transform = `translateY(${(1 - o) * 14}px)`
        })
      }
    }
  })

  const register = (actId, slot) => (element) => {
    if (!children.current[actId]) children.current[actId] = []
    children.current[actId][slot] = element
  }

  return (
    <>
      {plates.map(({ act }) => {
        const plate = PLATES[act.id]
        const isCentre = plate.layout === 'centre'
        // Slots are allocated in render order so the stagger follows the eye.
        let slot = 0

        return (
          <section
            key={act.id}
            ref={(element) => {
              roots.current[act.id] = element
            }}
            className={`plate plate--${isCentre ? 'centre' : 'left'}`}
            aria-hidden={activeIndex !== TIMELINE.indexOf(act)}
          >
            {plate.display && (
              <h2 className="plate__display" ref={register(act.id, slot++)}>
                {plate.display}
              </h2>
            )}

            {plate.stats && (
              <div className="stats">
                {plate.stats.map((stat) => (
                  <div className="stat" key={stat.label} ref={register(act.id, slot++)}>
                    <div className="stat__value">
                      {stat.value}
                      {stat.unit && <span className="stat__unit">{stat.unit}</span>}
                    </div>
                    <div className="stat__label">{stat.label}</div>
                  </div>
                ))}
              </div>
            )}

            <p className="plate__lead" ref={register(act.id, slot++)}>
              {plate.lead}
            </p>
          </section>
        )
      })}
    </>
  )
}