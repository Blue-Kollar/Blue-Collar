// Flat config (ESLint 9+) for @bluecollar/sdk.
// Shared baseline rules come from /eslint-base-rules.js (#1289).
import js from '@eslint/js'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import globals from 'globals'
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
      // SDK targets Node 18+ (fetch built-in) and modern browsers.
      globals: {
        ...globals.node,
        fetch: 'readonly',
        URLSearchParams: 'readonly',
      },
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
    // Tests may use console freely and reference Node/Jest globals.
    files: ['src/__tests__/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
        global: 'readonly',
        vi: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
]
