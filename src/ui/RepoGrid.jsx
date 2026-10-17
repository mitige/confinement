import { useMemo, useRef } from 'react'
import { useDirectorStore, useScrollFrame } from '../scroll/ScrollDirector.jsx'
import { TIMELINE } from '../data/acts.js'
import { REPOS, TOTALS, FLAGSHIP_SLUGS } from '../data/repos.js'
import { applyVisibility } from '../lib/dom.js'
import { clamp, easeOutCubic, window01 } from '../lib/math.js'

/**
 * Every public repository, as a typographic list.
 *
 * This is the honest counterweight to the six flagship acts: the whole body of
 * work on one screen, including the repositories with no stars. Presenting the
 * full list rather than a highlight reel is what makes the nine stars on
 * `humanity` mean something.
 *
 * A row shows a name, a language and a star count, and nothing else. The row
 * numbers, the one-line descriptions, the fork counts and the six-field summary
 * were all removed — on a screen whose only job is to show the breadth of the
 * work, everything past the name competes with the name.
 *
 * Rows are ordered by stars and then by recency, and the six flagship projects are
 * set in a heavier weight so the list reads as a hierarchy rather than an inventory.
 */

const ORDERED = [...REPOS].sort((a, b) => {
  if (b.stars !== a.stars) return b.stars - a.stars
  return b.pushed.localeCompare(a.pushed)
})

export function RepoGrid() {
  const store = useDirectorStore()
  const root = useRef(null)
  const children = useRef([])

  const actIndex = useMemo(() => TIMELINE.findIndex((act) => act.kind === 'grid'), [])

  useScrollFrame((s) => {
    const local = s.actIndex === actIndex ? s.local : s.actIndex > actIndex ? 1 : 0

    if (root.current) {
      const o = window01(local, 0.03, 0.16, 0.86, 0.97)
      applyVisibility(root.current, o)
      root.current.style.transform = `translateY(${(1 - o) * 20}px)`
    }

    children.current.forEach((element, i) => {
      if (!element) return
      // Long lists get a compressed stagger, and it must finish well before the
      // middle of the act: rows caught mid-fade are genuinely low-contrast.
      const o = easeOutCubic(clamp((local - (0.05 + i * 0.009)) / 0.1))
      element.style.opacity = o
      element.style.transform = `translateY(${(1 - o) * 10}px)`
    })
  })

  const flagship = useMemo(() => new Set(FLAGSHIP_SLUGS), [])

  return (
    <section className="repos" ref={root}>
      <header className="repos__head">
        <h2 className="repos__title">all repositories</h2>
        <div className="repos__summary">
          {TOTALS.repos} repositories · {TOTALS.stars} stars
        </div>
      </header>

      <div className="repos__grid">
        {ORDERED.map((repo, i) => (
          <a
            key={repo.name}
            className={`repo${flagship.has(repo.name) ? ' repo--flagship' : ''}`}
            href={`https://github.com/mitige/${repo.name}`}
            target="_blank"
            rel="noreferrer noopener"
            ref={(element) => {
              children.current[i] = element
            }}
          >
            <span className="repo__name">{repo.name}</span>
            <span className="repo__stats">
              <span>{repo.language}</span>
              <span className="repo__stars">★ {repo.stars}</span>
            </span>
          </a>
        ))}
      </div>
    </section>
  )
}