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

'use strict';

const {
  tsRules,
  baseRules,
  productionOnlyRules,
  filenameRules,
  deprecationRules,
  importRules,
} = require('../../eslint-base-rules.js');

/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: ['next/core-web-vitals', 'next/typescript'],
  plugins: ['unicorn', 'i18next'],
  parserOptions: {
    // Required by @typescript-eslint/no-deprecated (#1688).
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  rules: {
    // ── Shared baseline ────────────────────────────────────────────────────
    ...tsRules,
    ...baseRules,
    ...productionOnlyRules,
    // Disallow all console usage (#1798). The logger module is the single
    // sanctioned place for console output; see the override below.
    'no-console': 'error',
    ...filenameRules,
    ...importRules,

    // ── Deprecation detection (#1688) ──────────────────────────────────────
    ...deprecationRules,

    // ── Type safety (#1795) ────────────────────────────────────────────────
    // Disallow explicit `any` in app components; use the types package
    // instead of ad-hoc `any` annotations.
    '@typescript-eslint/no-explicit-any': 'error',

    // ── App-specific rules ─────────────────────────────────────────────────
    'jsx-a11y/control-has-associated-label': 'warn',
  },
};
