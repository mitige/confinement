/**
 * Full repository snapshot, pulled from the GitHub API on 2026-10-16.
 *
 * Hard-coded on purpose: the site must render identically offline and cannot
 * depend on an unauthenticated API rate limit of 60 requests/hour. Every field is
 * the verified baseline.
 *
 * The list on screen shows a name, a language and a star count. The remaining
 * fields are kept because this file is the record of what was verified, not just
 * what is displayed — `pushed` also drives the sort order.
 */

export const GITHUB_USER = 'mitige'
export const SNAPSHOT_DATE = '2026-10-16'

/** Flagship repos. `slug` matches data/projects.js. */
export const FLAGSHIP_SLUGS = [
  'humanity',
  'judas',
  'all-seeing-eye',
  'c-man',
  'prometheus',
  'nana',
]

/** Every public repository. */
export const REPOS = [
  {
    name: 'humanity',
    language: 'Python',
    stars: 9,
    forks: 1,
    sizeKb: 12047,
    pushed: '2026-08-13',
    topics: ['active-inference', 'agent-based-model', 'cognitive-architecture', 'consciousness'],
  },
  {
    name: 'judas',
    language: 'Python',
    stars: 2,
    forks: 0,
    sizeKb: 18135,
    pushed: '2026-07-03',
    topics: ['reinforcement-learning', 'ppo', 'self-play', 'cuda'],
  },
  {
    name: 'all-seeing-eye',
    language: 'Rust',
    stars: 2,
    forks: 0,
    sizeKb: 406,
    pushed: '2026-10-07',
    topics: ['epitech', 'moulinette', 'tui', 'rust'],
  },
  {
    name: 'c-man',
    language: 'Rust',
    stars: 1,
    forks: 0,
    sizeKb: 485,
    pushed: '2026-10-02',
    topics: ['tui', 'rust', 'education'],
  },
  {
    name: 'prometheus',
    language: 'C++',
    stars: 0,
    forks: 1,
    sizeKb: 2514,
    pushed: '2026-06-27',
    topics: ['reinforcement-learning', 'ppo', 'rlbot', 'cuda'],
  },
  {
    name: 'nana',
    language: 'Rust',
    stars: 0,
    forks: 0,
    sizeKb: 3755,
    pushed: '2026-10-15',
    topics: ['cli', 'editor', 'ratatui', 'rust', 'tui'],
  },
  {
    name: 'rust-man',
    language: 'Rust',
    stars: 0,
    forks: 0,
    sizeKb: 319,
    pushed: '2026-10-06',
    topics: ['tui', 'rust', 'education'],
  },
  {
    name: 'ts-man',
    language: 'TypeScript',
    stars: 0,
    forks: 0,
    sizeKb: 16,
    pushed: '2026-10-12',
    topics: ['tui', 'typescript', 'education'],
  },
  {
    name: 'c-nano',
    language: 'Rust',
    stars: 0,
    forks: 0,
    sizeKb: 255,
    pushed: '2026-10-07',
    topics: ['rust'],
  },
  {
    name: 'rust-nano',
    language: 'Rust',
    stars: 0,
    forks: 0,
    sizeKb: 255,
    pushed: '2026-10-07',
    topics: ['rust'],
  },
  {
    name: 'seuil',
    language: 'JavaScript',
    stars: 0,
    forks: 0,
    sizeKb: 1973,
    pushed: '2026-06-30',
    topics: ['end-to-end-encryption', 'harm-reduction', 'privacy', 'pwa', 'zero-knowledge'],
    homepage: 'https://seuil.pro',
  },
  {
    name: 'deezer-glass',
    language: 'TypeScript',
    stars: 0,
    forks: 0,
    sizeKb: 994,
    pushed: '2026-07-05',
    topics: ['electron', 'visualizer'],
  },
  {
    name: 'oganesson-box',
    language: 'JavaScript',
    stars: 0,
    forks: 0,
    sizeKb: 9372,
    pushed: '2026-07-10',
    topics: ['three.js', 'visualization', 'physics'],
  },
  {
    name: 'solar-system',
    language: 'JavaScript',
    stars: 0,
    forks: 0,
    sizeKb: 33962,
    pushed: '2026-07-02',
    topics: ['electron', 'three.js', 'visualization'],
  },
  {
    name: 'discord-file-downloader',
    language: 'JavaScript',
    stars: 0,
    forks: 0,
    sizeKb: 34,
    pushed: '2026-06-28',
    topics: ['tooling'],
  },
]

/** Aggregate counts, derived so they can never drift from the table above. */
export const TOTALS = {
  repos: REPOS.length,
  stars: REPOS.reduce((sum, r) => sum + r.stars, 0),
  forks: REPOS.reduce((sum, r) => sum + r.forks, 0),
  languages: new Set(REPOS.map((r) => r.language)).size,
}