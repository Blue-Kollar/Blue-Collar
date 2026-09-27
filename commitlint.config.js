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
    'scope-enum': [
      2,
      'always',
      [
        'app',
        'backend',
        'contracts',
        'docs',
        'frontend',
        'indexer',
        'mobile',
        'shared',
        'sdk',
        'types',
        'ci',
        'deps',
        'release',
        'repo',
      ],
    ],
    'scope-empty': [1, 'never'],
  },
};
