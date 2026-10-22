/**
 * Shared ESLint rule set — single source of truth for all packages.
 *
 * Each package's ESLint config imports this module and spreads the rules so
 * that every package enforces the same baseline, with only intentional
 * per-package overrides on top.
 *
 * Two ESLint generations coexist in this monorepo:
 *   • ESLint 9 flat config  (packages/api, sdk, types) — imports as plain object
 *   • ESLint 8 legacy       (packages/app, mobile)
 *     — consumed via .eslintrc.js `rules:` spread
 *
 * When the whole monorepo is migrated to ESLint 9 flat config this file can
 * be converted to a proper shared flat-config preset.
 */

/**
 * Documented per-package exceptions to the shared baseline. Anything not
 * listed here must match the baseline exactly.
 *
 *   packages/app     no-console allows warn/error (client-side code)
 *   packages/mobile  no-console is 'warn' (React Native debugging)
 *   packages/api     no-console off for seed, command, script, monitoring and test files
 *   packages/sdk     no-console off and no-explicit-any 'warn' in src/__tests__
 *   packages/types   no-console off and no-explicit-any 'warn' in test files
 *   packages/*       no-deprecated requires type info; see per-package configs
 */

'use strict'

/**
 * TypeScript-specific rules applied to all *.ts / *.tsx source files.
 * These are the rules that were duplicated across packages before #1289.
 */
const tsRules = {
  '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
  '@typescript-eslint/no-explicit-any': 'error',
  '@typescript-eslint/explicit-function-return-type': 'off',
}

/**
 * General rules that apply to every JS/TS file.
 */
const baseRules = {
  'no-debugger': 'error',
}

/**
 * Rules that apply to production code but NOT to scripts / seed files / tests.
 */
const productionOnlyRules = {
  'no-console': 'error',
}

/**
 * File naming convention rules enforcing kebab-case (#1691).
 */
const filenameRules = {
  'unicorn/filename-case': [
    'error',
    {
      case: 'kebabCase',
      ignore: [
        '^[A-Z][a-zA-Z0-9]*\\.tsx$',
        '^use[A-Z][a-zA-Z0-9]*\\.(ts|tsx)$',
        '^(page|layout|error|loading|not-found|robots|sitemap|middleware)\\.(ts|tsx)$',
        '\\.(test|spec)\\.(ts|tsx)$',
        '\\.stories\\.tsx$',
        '\\.d\\.ts$',
        '^index\\.(ts|tsx)$',
        '^[a-z]+\\.(ts|tsx)$',
      ],
    },
  ],
}

/**
 * Deprecation detection (#1688).
 *
 * Flags usage of anything marked with a JSDoc `@deprecated` tag —
 * TypeScript/Stellar SDK APIs, React ecosystem APIs, or our own code.
 *
 * Uses the built-in `@typescript-eslint/no-deprecated` rule (replaces the
 * now-superseded `eslint-plugin-deprecation` [citation:1][citation:4]).
 *
 * Requires type information: `parserOptions.project` (or `projectService`)
 * must be configured in every package that spreads these rules.
 *
 * Auto-disable for a specific line (with justification):
 *   // eslint-disable-next-line @typescript-eslint/no-deprecated -- <reason>
 *
 * See CONTRIBUTING.md § Deprecation Exceptions.
 */
const deprecationRules = {
  '@typescript-eslint/no-deprecated': 'error',
}

module.exports = {
  tsRules,
  baseRules,
  productionOnlyRules,
  filenameRules,
  deprecationRules,
}
