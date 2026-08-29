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
        'contracts',
        'deps',
        'ci',
        'docs',
        'sdk',
        'types',
        'monitoring',
        'mobile',
      ],
    ],
    'subject-case': [2, 'never', ['sentence-case', 'start-case', 'pascal-case', 'upper-case']],
    'header-max-length': [2, 'always', 100],
  },
};