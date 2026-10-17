import { useRef } from 'react'
import { useDirector, useDirectorStore, useScrollFrame } from '../scroll/ScrollDirector.jsx'
import { HERO } from '../data/plates.js'
import { TOTAL_VH } from '../data/acts.js'

/**
 * The fixed chrome.
 *
 * Three elements, and nothing else: who this is, where in the piece you are, and
 * how far through. Deliberately no navigation, no menu, no scroll-to-top — the
 * only instrument is the scroll position, and a navigation bar would compete with
 * the machine for attention.
 *
 * The act label and counter re-render only when the act changes; the progress bar
 * is written from the scroll loop.
 */
export function Hud() {
  const { activeIndex, timeline } = useDirector()
  const store = useDirectorStore()
  const fill = useRef(null)

  useScrollFrame((s) => {
    if (fill.current) {
      fill.current.style.transform = `scaleX(${s.progress})`
    }
  })

  const act = timeline[activeIndex]
  const numeral = String(activeIndex + 1).padStart(2, '0')
  const total = String(timeline.length).padStart(2, '0')

  return (
    <>
      <div className="identity">
        <span className="identity__name">{HERO.name}</span>
        <a
          className="identity__handle"
          href={`https://github.com/${HERO.handle}`}
          target="_blank"
          rel="noreferrer noopener"
        >
          github.com/{HERO.handle}
        </a>
      </div>

      <div className="act-meter" aria-live="polite">
        <span className="act-meter__label">{act.label}</span>
        <span className="act-meter__count">
          {numeral} / {total}
        </span>
      </div>

      <div className="progress" aria-hidden="true">
        <div className="progress__fill" ref={fill} />
      </div>

      {/* A machine-readable summary for assistive technology. */}
      <span className="sr-only">
        A scroll-driven portfolio. {timeline.length} acts over {TOTAL_VH} viewport
        heights. Current act: {act.label}.
      </span>

      {/* Progress is also exposed as a real range control for keyboard users. */}
      <input
        className="sr-only"
        type="range"
        min="0"
        max="1000"
        defaultValue={Math.round(store.progress * 1000)}
        aria-label="Scroll position through the piece"
        onChange={(event) => {
          const max = document.documentElement.scrollHeight - window.innerHeight
          window.scrollTo({ top: (Number(event.target.value) / 1000) * max })
        }}
      />
    </>
  )
}