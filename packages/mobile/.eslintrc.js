/**
 * ESLint 8 legacy config for packages/mobile (React Native / Expo).
 *
 * Shared baseline rules come from /eslint-base-rules.js (#1289).
 * This file only contains mobile-specific overrides on top of the shared set.
 */

'use strict'

const { tsRules, baseRules, productionOnlyRules } = require('../../eslint-base-rules.js')

/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  env: {
    browser: true,
    es2022: true,
  },
  rules: {
    // ── Shared baseline ────────────────────────────────────────────────────
    ...tsRules,
    ...baseRules,
    ...productionOnlyRules,
    // React Native uses console for debugging; relax for dev ergonomics.
    'no-console': ['warn', { allow: ['warn', 'error'] }],
  },
  overrides: [
    {
      // Test files — allow console freely and relax no-explicit-any.
      files: ['**/__tests__/**/*.{ts,tsx}', '**/*.test.{ts,tsx}', 'jest.setup.ts', 'e2e/**/*.{ts,tsx}'],
      rules: {
        'no-console': 'off',
        '@typescript-eslint/no-explicit-any': 'warn',
      },
    },
  ],
  ignorePatterns: ['node_modules/', 'dist/', 'build/', '.expo/'],
}
