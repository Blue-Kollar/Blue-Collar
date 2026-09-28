// Flat config (ESLint 9+) for @bluecollar/types.
// Shared baseline rules come from /eslint-base-rules.js (#1289).
import js from '@eslint/js'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { tsRules, baseRules, productionOnlyRules } = require('../../eslint-base-rules.js')

export default [
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  js.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        project: './tsconfig.json',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...tsRules,
      ...baseRules,
      ...productionOnlyRules,
    },
  },
  {
    // Tests may use console freely and reference Node globals.
    files: ['src/**/*.test.ts', 'src/__tests__/**/*.ts'],
    languageOptions: {
      globals: {
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
]
