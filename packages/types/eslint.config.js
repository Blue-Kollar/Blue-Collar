// Flat config (ESLint 9+) for @bluecollar/types.
// Shared baseline rules come from /eslint-base-rules.js (#1289).
import js from '@eslint/js'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import unicornPlugin from 'eslint-plugin-unicorn'
import importXPlugin from 'eslint-plugin-import-x'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { tsRules, baseRules, productionOnlyRules, filenameRules, importRules, typeDefinitionRules } = require('../../eslint-base-rules.js')

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
      // Import ordering and cycle detection (#1893)
      'import-x/no-cycle': importRules['import/no-cycle'],
      'import-x/order': importRules['import/order'],
      // Consistent type definitions (#1895)
      ...typeDefinitionRules,
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
