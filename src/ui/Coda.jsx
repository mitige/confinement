import { useMemo, useRef } from 'react'
import { useScrollFrame } from '../scroll/ScrollDirector.jsx'
import { TIMELINE } from '../data/acts.js'
import { CODA } from '../data/plates.js'
import { applyVisibility } from '../lib/dom.js'
import { clamp, easeOutCubic } from '../lib/math.js'

/**
 * The coda.
 *
 * The camera is pulling back to the whole machine and the canvas has returned to
 * full brightness, so this fades in late in the act and simply stays. A single
 * line, centred: the repository. Everything that used to sit under it — a rule and
 * two lines of credits — has been removed, because the address is the whole
 * message and the machine behind it is doing the talking.
 */
export function Coda() {
  const root = useRef(null)
  const display = useRef(null)

  const actIndex = useMemo(() => TIMELINE.findIndex((act) => act.kind === 'coda'), [])

  useScrollFrame((s) => {
    const local = s.actIndex === actIndex ? s.local : s.actIndex > actIndex ? 1 : 0

    if (root.current) {
      applyVisibility(root.current, clamp((local - 0.34) / 0.3))
    }

    if (display.current) {
      const o = easeOutCubic(clamp((local - 0.44) / 0.24))
      display.current.style.opacity = o
      display.current.style.transform = `translateY(${(1 - o) * 12}px)`
    }
  })

  return (
    <section className="coda" ref={root}>
      <a
        className="coda__display"
        href={CODA.href}
        target="_blank"
        rel="noreferrer noopener"
        ref={display}
      >
        {CODA.display}
      </a>
    </section>
  )
}