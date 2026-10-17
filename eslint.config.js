import globals from 'globals'

/**
 * Lint configuration.
 *
 * Deliberately narrow. This is not a style checker — it exists to catch the class
 * of mistake that a bundler accepts happily and that only fails at runtime in the
 * browser, which is how a blank page reached the live site once: a `const` read
 * before its own declaration, inside a component, throwing on the first render.
 *
 * So: correctness rules only, no formatting opinions.
 */
export default [
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser },
    },
    linterOptions: { reportUnusedDisableDirectives: true },
    rules: {
      /*
       * The rule that would have caught the blank page. Function declarations are
       * exempt because hoisting makes them genuinely safe, and component order
       * would otherwise be dictated by the linter.
       */
      'no-use-before-define': ['error', { functions: false, classes: false, variables: true }],

      // Real bugs.
      'no-undef': 'error',
      'no-unreachable': 'error',
      'no-dupe-keys': 'error',
      'no-dupe-args': 'error',
      'no-dupe-class-members': 'error',
      'no-cond-assign': ['error', 'except-parens'],
      'no-self-assign': 'error',
      'no-unsafe-negation': 'error',
      'no-unsafe-optional-chaining': 'error',
      'require-atomic-updates': 'error',
      'no-await-in-loop': 'off',
      'no-constant-binary-expression': 'error',
      'valid-typeof': 'error',
      'use-isnan': 'error',
      'no-func-assign': 'error',
      'no-import-assign': 'error',
      'no-loss-of-precision': 'error',

      // Unused code is a fact worth surfacing, not a failure.
      'no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // Build and verification scripts run in Node.
    files: ['scripts/**/*.mjs', 'vite.config.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      'no-use-before-define': ['error', { functions: false, variables: true }],
      'no-undef': 'error',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
]