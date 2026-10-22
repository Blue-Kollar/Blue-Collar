/**
 * Commitlint configuration for the Blue-Collar monorepo.
 *
 * Scopes mirror the top-level packages so release-please can categorize
 * changelog entries accurately. Update this list whenever a new package
 * is added under `packages/` or as a top-level workspace.
 */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'i18n',
        'refactor',
        'test',
        'chore',
        'ci',
        'perf',
      ],
    ],
    'scope-enum': [
      2,
      'always',
      [
        'api',
        'app',
        'backend',
        'ci',
        'contracts',
        'deps',
        'docs',
        'frontend',
        'indexer',
        'mobile',
        'monitoring',
        'release',
        'repo',
        'sdk',
        'shared',
        'types',
      ],
    ],
    'scope-empty': [1, 'never'],
    'subject-case': [2, 'never', ['sentence-case', 'start-case', 'pascal-case', 'upper-case']],
    'header-max-length': [2, 'always', 100],
  },
};