import { useMemo, useRef } from 'react'
import { useDirector, useScrollFrame } from '../scroll/ScrollDirector.jsx'
import { TIMELINE } from '../data/acts.js'
import { PROJECT_BY_SLUG } from '../data/projects.js'
import { applyVisibility } from '../lib/dom.js'
import { clamp, easeOutCubic, window01 } from '../lib/math.js'

/**
 * The six flagship projects.
 *
 * Each is a text beat laid over the machine at full render brightness: a
 * directional scrim on the left guarantees contrast, and the 3D stays untouched on
 * the right. That is deliberate — dimming the canvas to make room for type would
 * waste the shot the camera just made.
 *
 * The block is name, one paragraph, and a line of facts. The index numeral, the
 * category label and the repository size and push date were all removed: the
 * project's own diagram is already drawn in 3D by Overlays3D, keyed off the act
 * slug, so text and geometry cannot disagree about which project is on screen —
 * and everything else was information the reader did not need in order to
 * understand the work.
 *
 * Every element is animated by writing to the DOM from the scroll loop, so a
 * project act costs zero React renders.
 */

export function ProjectAct() {
  const { activeIndex } = useDirector()
  const roots = useRef({})
  const children = useRef({})

  const projects = useMemo(
    () =>
      TIMELINE.map((act, index) => ({ act, index }))
        .filter(({ act }) => act.kind === 'project')
        .map(({ act, index }) => ({ act, index, project: PROJECT_BY_SLUG[act.slug] }))
        .filter(({ project }) => Boolean(project)),
    [],
  )

  useScrollFrame((s) => {
    for (const { act, index } of projects) {
      const local = s.actIndex === index ? s.local : s.actIndex > index ? 1 : 0

      const root = roots.current[act.id]
      if (root) {
        const o = window01(local, 0.04, 0.18, 0.8, 0.94)
        applyVisibility(root, o)
        root.style.transform = `translateY(${(1 - o) * 20}px)`
      }

      const items = children.current[act.id]
      if (items) {
        items.forEach((element, i) => {
          if (!element) return
          const o = easeOutCubic(clamp((local - (0.07 + i * 0.03)) / 0.16))
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
      {projects.map(({ act, index, project }) => (
        <section
          key={act.id}
          ref={(element) => {
            roots.current[act.id] = element
          }}
          className="project"
          aria-hidden={activeIndex !== index}
        >
          <div className="project__scrim" />

          <div className="project__content">
            <h2 className="project__name" ref={register(act.id, 0)}>
              {project.name}
            </h2>

            <p className="project__body" ref={register(act.id, 1)}>
              {project.body}
            </p>

            <div className="project__metrics" ref={register(act.id, 2)}>
              <span className="project__metric--accent">{project.language}</span>
              <span>★ {project.stars}</span>
              <span>⑂ {project.forks}</span>
            </div>

            <a
              className="project__link"
              href={`https://github.com/mitige/${project.slug}`}
              target="_blank"
              rel="noreferrer noopener"
              ref={register(act.id, 3)}
            >
              github.com/mitige/{project.slug}
              <span aria-hidden="true">↗</span>
            </a>
          </div>
        </section>
      ))}
    </>
  )
}