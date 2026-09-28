// Flat config (ESLint 9+). Migrated from .eslintrc.json — see git history for the
// legacy config this replaces. Keep behavior equivalent when touching this file.
//
// Shared rules are sourced from /eslint-base-rules.js (#1289) so that all
// packages enforce the same baseline. Add only api-specific overrides here.
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
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
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
    // Relax no-console for scripts, seed files, and tests — api-specific override.
    files: [
      'src/database/seed*.ts',
      'src/commands/*.ts',
      'src/scripts/*.ts',
      'src/monitoring/*.ts',
      'src/__tests__/**/*.ts',
    ],
    rules: {
      'no-console': 'off',
    },
  },
]
