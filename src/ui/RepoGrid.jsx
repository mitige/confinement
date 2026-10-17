import { useMemo, useRef } from 'react'
import { useDirectorStore, useScrollFrame } from '../scroll/ScrollDirector.jsx'
import { TIMELINE } from '../data/acts.js'
import {
  REPOS,
  TOTALS,
  PROFILE,
  SNAPSHOT_DATE,
  FLAGSHIP_SLUGS,
} from '../data/repos.js'
import { clamp, easeOutCubic, window01 } from '../lib/math.js'

/**
 * Every public repository, as a typographic grid.
 *
 * This is the honest counterweight to the six flagship acts: the whole body of
 * work on one screen, including the repositories with no stars. Presenting the
 * full list rather than a highlight reel is what makes the nine stars on
 * `humanity` mean something.
 *
 * Rows are ordered by stars and then by recency, and the six flagship projects are
 * set in a heavier weight so the grid reads as a hierarchy rather than a list.
 */

const ORDERED = [...REPOS].sort((a, b) => {
  if (b.stars !== a.stars) return b.stars - a.stars
  return b.pushed.localeCompare(a.pushed)
})

export function RepoGrid() {
  const store = useDirectorStore()
  const root = useRef(null)
  const children = useRef([])

  const actIndex = useMemo(
    () => TIMELINE.findIndex((act) => act.kind === 'grid'),
    [],
  )

  useScrollFrame((s) => {
    const local = s.actIndex === actIndex ? s.local : s.actIndex > actIndex ? 1 : 0

    if (root.current) {
      const o = window01(local, 0.03, 0.16, 0.86, 0.97)
      root.current.style.opacity = o
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
        <h2 className="repos__title">All repositories</h2>
        <div className="repos__summary">
          {TOTALS.repos} public · {TOTALS.stars} stars · {TOTALS.forks} forks ·{' '}
          {TOTALS.languages} languages · {PROFILE.location} · snapshot {SNAPSHOT_DATE}
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
            <span className="repo__index">{String(i + 1).padStart(2, '0')}</span>

            <span className="repo__main">
              <span className="repo__name">{repo.name}</span>
              <span className="repo__blurb">{repo.blurb}</span>
            </span>

            <span className="repo__stats">
              <span>{repo.language}</span>
              <span className="repo__stars">★ {repo.stars}</span>
              <span>⑂ {repo.forks}</span>
            </span>
          </a>
        ))}
      </div>
    </section>
  )
}