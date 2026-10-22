/**
 * ESLint 8 legacy config for packages/app (Next.js).
 *
 * Shared baseline rules come from /eslint-base-rules.js (#1289).
 * Deprecation detection (#1688) comes from the same file.
 * This file only contains app-specific overrides on top of the shared set.
 *
 * NOTE: When this package is upgraded to ESLint 9 flat config, convert to
 * eslint.config.js and extend the shared preset directly.
 */

'use strict'

const {
  tsRules,
  baseRules,
  productionOnlyRules,
  filenameRules,
  deprecationRules,
} = require('../../eslint-base-rules.js')

/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: ['next/core-web-vitals', 'next/typescript'],
  plugins: ['unicorn'],
  parserOptions: {
    // Required by @typescript-eslint/no-deprecated (#1688).
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  rules: {
    // ── Shared baseline ────────────────────────────────────────────────────
    ...tsRules,
    ...baseRules,
    // Allow console.warn / console.error in the app layer (same relaxation
    // as before; strict no-console would be too noisy for client-side code).
    ...productionOnlyRules,
    'no-console': ['error', { allow: ['warn', 'error'] }],
    ...filenameRules,

    // ── Deprecation detection (#1688) ──────────────────────────────────────
    ...deprecationRules,

    // ── App-specific rules ─────────────────────────────────────────────────
    'jsx-a11y/control-has-associated-label': 'warn',
  },
}
