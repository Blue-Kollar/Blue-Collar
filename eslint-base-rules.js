/**
 * Shared ESLint rule set — single source of truth for all packages.
 *
 * Each package's ESLint config imports this module and spreads the rules so
 * that every package enforces the same baseline, with only intentional
 * per-package overrides on top.
 *
 * Two ESLint generations coexist in this monorepo:
 *   • ESLint 9 flat config  (packages/api)  — imports this as a plain object
 *   • ESLint 8 legacy       (packages/app, packages/mobile)
 *     — consumed via .eslintrc.js `rules:` spread
 *
 * When the whole monorepo is migrated to ESLint 9 flat config this file can
 * be converted to a proper shared flat-config preset.
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
 * Each package can opt individual globs back out of this rule when needed.
 */
const productionOnlyRules = {
  'no-console': 'error',
}

module.exports = {
  tsRules,
  baseRules,
  productionOnlyRules,
}
