# Contributing to BlueCollar

Thanks for your interest in contributing! This guide covers everything you need to get started.

---

## Table of Contents

- [Getting Started](#getting-started)
- [Commit Message Convention](#commit-message-convention)
- [Branch Naming](#branch-naming)
- [Issue & PR Templates](#issue--pr-templates)
- [Pull Request Process](#pull-request-process)
- [Code Style](#code-style)
- [Running Tests](#running-tests)
- [Translations](#translations)

---

## Getting Started

1. Fork the repository and clone your fork:
   ```bash
   git clone https://github.com/<your-username>/Blue-Collar.git
   cd Blue-Collar
   pnpm install
   ```

2. Create a feature branch (see [Branch Naming](#branch-naming)).

3. Make your changes, commit using the [convention below](#commit-message-convention), and open a PR.

---

## Commit Message Convention

This project uses **Conventional Commits** to power automated changelog generation via [release-please](https://github.com/googleapis/release-please).

### Format

```
<type>(<scope>): <short description>

[optional body]

[optional footer(s)]
```

### Types

| Type       | When to use                                              |
| ---------- | -------------------------------------------------------- |
| `feat`     | A new feature                                            |
| `fix`      | A bug fix                                                |
| `docs`     | Documentation changes only                               |
| `i18n`     | Translations and localization                            |
| `refactor` | Code change that neither fixes a bug nor adds a feature  |
| `test`     | Adding or updating tests                                 |
| `chore`    | Build process, dependency updates, tooling               |
| `ci`       | CI/CD configuration changes                              |
| `perf`     | Performance improvements                                 |

### Scopes (optional but encouraged)

`api`, `app`, `contracts`, `deps`, `ci`, `docs`

### Examples

```
feat(api): add Google OAuth 2.0 login
fix(api): return 409 on duplicate email registration
docs(contracts): add full interface documentation
chore(deps): bump prisma to 7.2.0
test(api): add edge cases for worker toggle endpoint
refactor(api): extract payment logic into service layer
ci: add release-please workflow
```

### Breaking Changes

Append `!` after the type/scope, or add `BREAKING CHANGE:` in the footer:

```
feat(api)!: rename /workers/mine to /workers/curator

BREAKING CHANGE: clients must update the endpoint path.
```

---

## Release Notes

This repository uses `release-please` to generate `CHANGELOG.md` from Conventional Commits.
Do not edit `CHANGELOG.md` manually; use the commit convention above and let the release workflow update the changelog on merge.

## Branch Naming

```
<type>/<short-description>
```

Examples:
- `feat/google-oauth`
- `fix/worker-toggle-auth`
- `docs/contracts-readme`
- `chore/bump-prisma`

---

## Issue & PR Templates

This repository provides structured templates for issues and pull requests:

| Template | File | When to Use |
|---|---|---|
| Bug Report | `.github/ISSUE_TEMPLATE/bug_report.yml` | Reporting a bug |
| Feature Request | `.github/ISSUE_TEMPLATE/feature_request.yml` | Suggesting a new feature |
| Documentation | `.github/ISSUE_TEMPLATE/documentation.yml` | Documentation issues or improvements |
| Pull Request | `.github/pull_request_template.md` | Opening a new PR |

Fill in all relevant sections. The templates include checklists specific to the type of change so reviewers can verify compliance quickly.

## Pull Request Process

1. Ensure all CI checks pass (`pnpm test`, `pnpm build`, `cargo clippy`).
2. Write a clear PR title following the commit convention (release-please uses it).
3. Reference the related issue: `Closes #123`.
4. Request a review from a maintainer.
5. Squash-merge is preferred to keep history clean.

---

## Code Style

### API (TypeScript)

- 2-space indent, double quotes
- Run `pnpm build` to catch type errors before pushing
- Run `pnpm test` to ensure no regressions

### Contracts (Rust)

- Run `make fmt` before committing
- Run `make clippy` — zero warnings policy

### App (Next.js)

See [packages/app/CONTRIBUTING.md](./packages/app/CONTRIBUTING.md) for frontend-specific conventions.

---

## Database Migrations

### Migration Safety Process

When modifying the database schema:

1. **Make schema changes** in `packages/api/prisma/schema.prisma`
2. **Create a migration**: `npx prisma migrate dev --name <descriptive-name>`
3. **For destructive migrations** (DROP COLUMN, DROP TABLE, ALTER COLUMN):
   - Add the `migration:destructive` label to your PR
   - Request explicit review from a maintainer
   - Include justification in the PR description
4. **CI will verify** that destructive migrations are properly labeled

### Destructive Operations Require Manual Approval

The CI pipeline will flag any migration containing:
- `DROP COLUMN`
- `DROP TABLE`
- `ALTER COLUMN`

These changes require the `migration:destructive` label and manual approval before merging.

---

## Running Tests

```bash
# API tests
cd packages/api
pnpm test

# Contract tests
cd packages/contracts
cargo test

# App
cd packages/app
pnpm test
```

---

## Translations

See [docs/i18n-translations.md](./docs/i18n-translations.md) for contributing translations to the app UI and README files. This includes:

- Adding a new language to the Next.js frontend (message JSON files)
- Translating README files to new languages
- Keeping translations in sync with the English source
- Validating translation completeness

Translation PRs should use the `i18n:` commit type and reference the language being added.

---

## Dead-file detection

Entire files can outlive their usefulness (old prototypes, superseded
scripts) with zero incoming imports anywhere in the monorepo. We use
[knip](https://knip.dev/) to detect them.

### Running the check

From the repo root:

```bash
npm run check:dead-files
npm run check:dead-files
npm run check:dead-files:fix
grep -rn "path/to/file" --include="*.ts" --include="*.tsx" --include="*.js" .
