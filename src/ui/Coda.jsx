import { useMemo, useRef } from 'react'
import { useDirectorStore, useScrollFrame } from '../scroll/ScrollDirector.jsx'
import { TIMELINE } from '../data/acts.js'
import { CODA } from '../data/plates.js'
import { clamp, easeOutCubic } from '../lib/math.js'

/**
 * The coda.
 *
 * The camera is pulling back to the whole machine and the canvas has returned to
 * full brightness, so this fades in late in the act and simply stays. Typography
 * only, centred, with the machine behind it — no call to action, no form.
 */
export function Coda() {
  const store = useDirectorStore()
  const root = useRef(null)
  const children = useRef([])

  const actIndex = useMemo(() => TIMELINE.findIndex((act) => act.kind === 'coda'), [])

  useScrollFrame((s) => {
    const local = s.actIndex === actIndex ? s.local : s.actIndex > actIndex ? 1 : 0

    if (root.current) {
      root.current.style.opacity = clamp((local - 0.34) / 0.3)
    }

    children.current.forEach((element, i) => {
      if (!element) return
      const o = easeOutCubic(clamp((local - (0.44 + i * 0.05)) / 0.24))
      element.style.opacity = o
      element.style.transform = `translateY(${(1 - o) * 12}px)`
    })
  })

  return (
    <section className="coda" ref={root}>
      <a
        className="coda__display"
        href={CODA.href}
        target="_blank"
        rel="noreferrer noopener"
        ref={(element) => {
          children.current[0] = element
        }}
      >
        {CODA.display}
      </a>

      <div
        className="coda__rule"
        ref={(element) => {
          children.current[1] = element
        }}
      />

      <div className="coda__lines">
        {CODA.lines.map((line, i) => (
          <span
            key={line}
            ref={(element) => {
              children.current[2 + i] = element
            }}
          >
            {line}
          </span>
        ))}
      </div>
    </section>
  )
}