/**
 * Full repository snapshot, pulled from the GitHub API on 2026-10-16.
 *
 * Hard-coded on purpose: the site must render identically offline and cannot
 * depend on an unauthenticated API rate limit of 60 requests/hour. A live
 * refresh may upgrade the star/fork counts at runtime, but every field below is
 * the verified baseline.
 */

export const GITHUB_USER = 'mitige'
export const SNAPSHOT_DATE = '2026-10-16'

export const PROFILE = {
  login: 'mitige',
  name: 'evan',
  location: 'France',
  publicRepos: 15,
  followers: 3,
  joined: '2026-01-17',
}

/** Flagship repos, in narrative order. `slug` matches data/projects.js. */
export const FLAGSHIP_SLUGS = [
  'humanity',
  'judas',
  'all-seeing-eye',
  'c-man',
  'prometheus',
  'nana',
]

/**
 * Every public repository. `blurb` is a one-line factual descriptor derived from
 * the repository description, kept short so the grid stays typographic.
 */
export const REPOS = [
  {
    name: 'humanity',
    language: 'Python',
    stars: 9,
    forks: 1,
    sizeKb: 12047,
    pushed: '2026-08-13',
    topics: ['active-inference', 'agent-based-model', 'cognitive-architecture', 'consciousness'],
    blurb:
      'The major scientific theories of consciousness, implemented as running code. No LLM in the loop.',
  },
  {
    name: 'judas',
    language: 'Python',
    stars: 2,
    forks: 0,
    sizeKb: 18135,
    pushed: '2026-07-03',
    topics: ['reinforcement-learning', 'ppo', 'self-play', 'cuda'],
    blurb:
      'Windows-first RL framework for Minecraft 1.8.9 boxing: CUDA simulator, PPO self-play, live Forge bridge.',
  },
  {
    name: 'all-seeing-eye',
    language: 'Rust',
    stars: 2,
    forks: 0,
    sizeKb: 406,
    pushed: '2026-10-07',
    topics: ['epitech', 'moulinette', 'tui', 'rust'],
    blurb:
      'A 1:1 local reconstruction of the Epitech moulinette: prelim, build, norm, symbols, tests, verdict.',
  },
  {
    name: 'c-man',
    language: 'Rust',
    stars: 1,
    forks: 0,
    sizeKb: 485,
    pushed: '2026-10-02',
    topics: ['tui', 'rust', 'education'],
    blurb:
      'The Epitech pool in a terminal: 104 fiches, 42 tested exercises, Norm checker, built-in editor.',
  },
  {
    name: 'prometheus',
    language: 'C++',
    stars: 0,
    forks: 1,
    sizeKb: 2514,
    pushed: '2026-06-27',
    topics: ['reinforcement-learning', 'ppo', 'rlbot', 'cuda'],
    blurb:
      'Rocket League RL workspace: continuous-action PPO with attention, CUDA physics, RLBot runtime.',
  },
  {
    name: 'nana',
    language: 'Rust',
    stars: 0,
    forks: 0,
    sizeKb: 3755,
    pushed: '2026-10-15',
    topics: ['cli', 'editor', 'ratatui', 'rust', 'tui'],
    blurb:
      'A Rust AI harness on a persistent spatiotemporal world model, with an adaptive terminal editor.',
  },
  {
    name: 'rust-man',
    language: 'Rust',
    stars: 0,
    forks: 0,
    sizeKb: 319,
    pushed: '2026-10-06',
    topics: ['tui', 'rust', 'education'],
    blurb: '67 fiches, 54 quizzes and 20 verified exercises for learning Rust in the terminal.',
  },
  {
    name: 'ts-man',
    language: 'TypeScript',
    stars: 0,
    forks: 0,
    sizeKb: 16,
    pushed: '2026-10-12',
    topics: ['tui', 'typescript', 'education'],
    blurb: 'The TypeScript member of the terminal documentation family.',
  },
  {
    name: 'c-nano',
    language: 'Rust',
    stars: 0,
    forks: 0,
    sizeKb: 255,
    pushed: '2026-10-07',
    topics: ['rust'],
    blurb: 'A minimal text editor, written in Rust.',
  },
  {
    name: 'rust-nano',
    language: 'Rust',
    stars: 0,
    forks: 0,
    sizeKb: 255,
    pushed: '2026-10-07',
    topics: ['rust'],
    blurb: 'A minimal text editor, written in Rust.',
  },
  {
    name: 'seuil',
    language: 'JavaScript',
    stars: 0,
    forks: 0,
    sizeKb: 1973,
    pushed: '2026-06-30',
    topics: ['end-to-end-encryption', 'harm-reduction', 'privacy', 'pwa', 'zero-knowledge'],
    blurb:
      'Private harm-reduction PWA: encrypted session tracking, interaction checker, effect curves.',
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
    blurb: 'A liquid-glass now-playing visualizer for Deezer on Windows, with synced lyrics.',
  },
  {
    name: 'oganesson-box',
    language: 'JavaScript',
    stars: 0,
    forks: 0,
    sizeKb: 9372,
    pushed: '2026-07-10',
    topics: ['three.js', 'visualization', 'physics'],
    blurb: 'Scientific Electron and Three.js visualizer for Og-294 atoms.',
  },
  {
    name: 'solar-system',
    language: 'JavaScript',
    stars: 0,
    forks: 0,
    sizeKb: 33962,
    pushed: '2026-07-02',
    topics: ['electron', 'three.js', 'visualization'],
    blurb: 'A cinematic desktop visualization of the Solar System, built with Electron and Three.js.',
  },
  {
    name: 'discord-file-downloader',
    language: 'JavaScript',
    stars: 0,
    forks: 0,
    sizeKb: 34,
    pushed: '2026-06-28',
    topics: ['tooling'],
    blurb: 'A local web app for scanning and downloading Discord channel attachments.',
  },
]

/** Aggregate counts, derived so they can never drift from the table above. */
export const TOTALS = {
  repos: REPOS.length,
  stars: REPOS.reduce((sum, r) => sum + r.stars, 0),
  forks: REPOS.reduce((sum, r) => sum + r.forks, 0),
  languages: new Set(REPOS.map((r) => r.language)).size,
}