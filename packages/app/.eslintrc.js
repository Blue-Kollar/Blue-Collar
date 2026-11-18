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

    // ── Deprecation detection (#1688) ──────────────────────────────────────
    ...deprecationRules,

    // ── i18n literal detection (#1797) ─────────────────────────────────────
    // Flag hardcoded UI strings so they get moved to locale files.
    'i18next/no-literal-string': [
      'error',
      {
        mode: 'jsx-text-only',
        'should-validate-template': true,
        message:
          'Hardcoded string detected. Move it to a locale file and use t() (#1797).',
        // Non-UI attributes that legitimately hold literals.
        'jsx-attributes': {
          include: [],
          exclude: [
            'className',
            'style',
            'id',
            'name',
            'type',
            'role',
            'key',
            'href',
            'src',
            'alt',
            'target',
            'rel',
            'htmlFor',
            'data-testid',
            'data-test-id',
            'data-cy',
            'aria-describedby',
            'aria-labelledby',
            'aria-controls',
            'aria-hidden',
            'autoComplete',
            'inputMode',
            'method',
            'action',
            'placeholder',
          ],
        },
        // Ignore numbers, punctuation-only strings, and single symbols.
        words: {
          exclude: ['^\\d+$', '^[\\s\\p{P}\\p{S}]+$'],
        },
      },
    ],

    // ── App-specific rules ─────────────────────────────────────────────────
    'jsx-a11y/control-has-associated-label': 'warn',
  },
  overrides: [
    {
      // Logger is the only module allowed to touch the console (#1798).
      files: ['src/lib/logger.ts'],
      rules: {
        'no-console': 'off',
      },
    },
    {
      // Tests and stories legitimately contain literals and debug output.
      files: [
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.spec.ts',
        '**/*.spec.tsx',
        '**/__tests__/**',
        '**/*.stories.ts',
        '**/*.stories.tsx',
      ],
      rules: {
        'i18next/no-literal-string': 'off',
        'no-console': 'off',
      },
    },
  ],
}