/**
 * The six flagship projects.
 *
 * Every metric here was verified against the GitHub API on 2026-10-16 and must
 * stay in sync with data/repos.js. Copy is deliberately sober: it states what
 * the software does and stops.
 *
 * Only name, body, language, stars and forks reach the screen. The index numeral
 * and the category label that used to be rendered alongside them were removed —
 * the project's technical diagram is drawn in 3D and already identifies it.
 */

export const PROJECTS = [
  {
    slug: 'humanity',
    index: '01',
    name: 'humanity',
    language: 'Python',
    stars: 9,
    forks: 1,
    sizeKb: 12047,
    pushed: '2026-08-13',
    /** Two or three lines at most. The typography carries the rest. */
    body: 'Global workspace, attention schema, higher-order thought, active inference and integrated information, run as code, not described as prose. No language model anywhere in the loop. It models, it measures, and it never claims to be conscious.',
    /** Rendered as a thin technical diagram over the machine. */
    schema: 'network',
    topics: ['active-inference', 'agent-based-model', 'cognitive-architecture', 'consciousness'],
  },
  {
    slug: 'judas',
    index: '02',
    name: 'judas',
    language: 'Python',
    stars: 2,
    forks: 0,
    sizeKb: 18135,
    pushed: '2026-07-03',
    body: 'A CUDA simulator of Minecraft 1.8.9 boxing, trained by PPO self-play until the policy stops losing. Electron control surface, a 3D arena viewer, and a Forge bridge that runs the trained agent live inside the game.',
    schema: 'arena',
    topics: ['reinforcement-learning', 'ppo', 'self-play', 'cuda'],
  },
  {
    slug: 'all-seeing-eye',
    index: '03',
    name: 'all-seeing-eye',
    language: 'Rust',
    stars: 2,
    forks: 0,
    sizeKb: 406,
    pushed: '2026-10-07',
    body: 'A 1:1 reconstruction of the Epitech moulinette for the Bachelor programme and its new C pool. Prelim, build, epiclang and banana norm, symbol checks, unit and functional tests, verdict, sixteen batteries, one live terminal UI.',
    schema: 'grid',
    topics: ['epitech', 'moulinette', 'tui', 'rust'],
  },
  {
    slug: 'c-man',
    index: '04',
    name: 'c-man',
    language: 'Rust',
    stars: 1,
    forks: 0,
    sizeKb: 485,
    pushed: '2026-10-02',
    body: 'An entire piscine inside the shell. One hundred and four fiches, forty-two exercises whose code is genuinely compiled and tested, the Epitech Norm checker, spaced-repetition flashcards and an editor. Twelve hours a day in a terminal, so it lives in the terminal.',
    schema: 'cascade',
    topics: ['epitech', 'tui', 'rust', 'education'],
  },
  {
    slug: 'prometheus',
    index: '05',
    name: 'prometheus',
    language: 'C++',
    stars: 0,
    forks: 1,
    sizeKb: 2514,
    pushed: '2026-06-27',
    body: 'A Rocket League training workspace: continuous-action PPO with attention, a CUDA physics layer, transfer learning between tasks, an ImGui control panel, and an RLBot runtime that puts the agent on the pitch.',
    schema: 'trajectory',
    topics: ['reinforcement-learning', 'ppo', 'rlbot', 'cuda'],
  },
  {
    slug: 'nana',
    index: '06',
    name: 'nana',
    language: 'Rust',
    stars: 0,
    forks: 0,
    sizeKb: 3755,
    pushed: '2026-10-15',
    body: 'A Rust agent harness resting on a persistent spatiotemporal world model, with three sages whose only job is keeping memory honest. Paired with an adaptive, language-agnostic editor, so you can watch the agent navigate, reason and write code live.',
    schema: 'lattice',
    topics: ['cli', 'editor', 'ratatui', 'rust'],
  },
]

/** Lookup by slug, built once. */
export const PROJECT_BY_SLUG = Object.fromEntries(PROJECTS.map((p) => [p.slug, p]))