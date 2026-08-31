// Flat config (ESLint 9+). Migrated from .eslintrc.json — see git history for the
// legacy config this replaces. Keep behavior equivalent when touching this file.
import js from '@eslint/js'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import globals from 'globals'

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
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': 'off',
      'no-console': 'error',
      'no-debugger': 'error',
    },
  },
  {
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
