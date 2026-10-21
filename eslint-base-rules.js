/**
 * Shared ESLint rule set — single source of truth for all packages.
 *
 * Each package's ESLint config imports this module and spreads the rules so
 * that every package enforces the same baseline, with only intentional
 * per-package overrides on top.
 *
 * Two ESLint generations coexist in this monorepo:
 *   • ESLint 9 flat config  (packages/api)  — imports this as a plain object
 *   • ESLint 8 legacy       (packages/app, packages/mobile)
 *     — consumed via .eslintrc.js `rules:` spread
 *
 * When the whole monorepo is migrated to ESLint 9 flat config this file can
 * be converted to a proper shared flat-config preset.
 */

/**
 * Documented per-package exceptions to the shared baseline. Anything not
 * listed here must match the baseline exactly.
 *
 *   packages/app     no-console allows warn/error (client-side code)
 *   packages/mobile  no-console is 'warn' (React Native debugging)
 *   packages/api     no-console off for seed, command, script, monitoring and test files
 *   packages/sdk     no-console off and no-explicit-any 'warn' in src/__tests__
 *   packages/types   no-console off and no-explicit-any 'warn' in test files
 */

'use strict'

/**
 * TypeScript-specific rules applied to all *.ts / *.tsx source files.
 * These are the rules that were duplicated across packages before #1289.
 */
const tsRules = {
  '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
  '@typescript-eslint/no-explicit-any': 'error',
  '@typescript-eslint/explicit-function-return-type': 'off',
}

/**
 * General rules that apply to every JS/TS file.
 */
const baseRules = {
  'no-debugger': 'error',
}

/**
 * Rules that apply to production code but NOT to scripts / seed files / tests.
 * Each package can opt individual globs back out of this rule when needed.
 */
const productionOnlyRules = {
  'no-console': 'error',
}

/**
 * File naming convention rules enforcing kebab-case.
 * See CONTRIBUTING.md for detailed file naming guidelines.
 * 
 * Configuration for unicorn/filename-case rule (#1691):
 * - Enforces kebab-case for all TypeScript/JavaScript files by default
 * - Allows PascalCase for React component files (.tsx)
 * - Allows camelCase for React hooks (use* prefix)
 * - Ignores Next.js special files (page, layout, error, etc.)
 * - Ignores test files, storybook files, and type definition files
 */
const filenameRules = {
  'unicorn/filename-case': [
    'error',
    {
      case: 'kebabCase',
      ignore: [
        // React components (PascalCase .tsx files)
        '^[A-Z][a-zA-Z0-9]*\\.tsx$',
        // React hooks (camelCase with 'use' prefix)
        '^use[A-Z][a-zA-Z0-9]*\\.(ts|tsx)$',
        // Next.js special files (always lowercase, no hyphens needed)
        '^(page|layout|error|loading|not-found|robots|sitemap|middleware)\\.(ts|tsx)$',
        // Test files (match source naming)
        '\\.(test|spec)\\.(ts|tsx)$',
        // Storybook files
        '\\.stories\\.tsx$',
        // Type definition files with .d.ts
        '\\.d\\.ts$',
        // Index files
        '^index\\.(ts|tsx)$',
        // Root config files (e.g., i18n.ts)
        '^[a-z]+\\.(ts|tsx)$',
      ],
    },
  ],
}

module.exports = {
  tsRules,
  baseRules,
  productionOnlyRules,
  filenameRules,
}
