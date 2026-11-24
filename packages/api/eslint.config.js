// Flat config (ESLint 9+). Migrated from .eslintrc.json — see git history for the
// legacy config this replaces. Keep behavior equivalent when touching this file.
//
// Shared rules are sourced from /eslint-base-rules.js (#1289) so that all
// packages enforce the same baseline. Add only api-specific overrides here.
import js from '@eslint/js'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import unicornPlugin from 'eslint-plugin-unicorn'
import importXPlugin from 'eslint-plugin-import-x'
import globals from 'globals'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const {
  tsRules,
  baseRules,
  productionOnlyRules,
  filenameRules,
  deprecationRules,
  importRules,
  typeDefinitionRules,
} = require('../../eslint-base-rules.js')

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
      unicorn: unicornPlugin,
      'import-x': importXPlugin,
    },
    settings: {
      'import-x/resolver': {
        typescript: { project: './tsconfig.json' },
      },
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...tsRules,
      ...baseRules,
      ...productionOnlyRules,
      ...filenameRules,
      ...deprecationRules,
      // Remap import/* rule names to import-x/* for ESLint 9 flat config (#1893)
      'import-x/no-cycle': importRules['import/no-cycle'],
      'import-x/order': importRules['import/order'],
      // Consistent type definitions (#1895)
      ...typeDefinitionRules,
    },
  },
  {
    // Relax no-console for scripts, seed files, and tests — api-specific override.
    files: [
      'src/database/seed*.ts',
      'src/commands/*.ts',
      'src/scripts/*.ts',
      'src/__tests__/**/*.ts',
    ],
    rules: {
      'no-console': 'off',
    },
  },
]
