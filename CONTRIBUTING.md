# Contributing to BlueCollar

Thanks for your interest in contributing! This guide covers everything you need to get started.

---

## Table of Contents

- [Getting Started](#getting-started)
- [Commit Message Convention](#commit-message-convention)
- [Pre-commit Hooks](#pre-commit-hooks)
- [Branch Naming](#branch-naming)
- [Issue & PR Templates](#issue--pr-templates)
- [Pull Request Process](#pull-request-process)
- [Code Style](#code-style)
- [Error Handling & Logging](#error-handling--logging)
- [Running Tests](#running-tests)
- [End-to-End (E2E) Tests](#end-to-end-e2e-tests)
- [Coverage](#coverage)
- [Translations](#translations)

---

## Getting Started

1. Fork the repository and clone your fork:
   ```bash
   git clone https://github.com/<your-username>/Blue-Collar.git
   cd Blue-Collar
   pnpm install
   ```

2. The `pnpm install` step automatically installs [Husky](https://typicode.github.io/husky/)
   git hooks via the `prepare` script in `package.json`.

3. Configure your environment:
   ```bash
   cp .env.example .env
   # Fill in .env — see docs/ENVIRONMENT_VARIABLES.md
   ```

4. Start the dev server:
   ```bash
   pnpm dev
   ```

---

## Commit Message Convention

This project follows [Conventional Commits v1.0.0](https://www.conventionalcommits.org/).

### Format

```
<type>(<scope>): <subject>

<body>
```

### Types

| Type       | When to use                            |
| ---------- | -------------------------------------- |
| `feat`     | New feature                            |
| `fix`      | Bug fix                                |
| `docs`     | Documentation only                      |
| `style`    | Formatting, whitespace                 |
| `refactor` | Code restructuring, no behavior change |
| `test`     | Adding or updating tests               |
| `chore`    | Maintenance, dependency bumps          |
| `ci`       | CI/CD configuration                    |
| `perf`     | Performance improvement                |
| `i18n`     | Internationalisation changes           |

### Scopes

Scopes map to the monorepo packages:

| Scope       | Area                                    |
| ----------- | --------------------------------------- |
| `api`       | API server (`packages/api`)             |
| `app`       | Next.js app (`packages/app`)            |
| `contracts` | Soroban smart contracts                 |
| `sdk`       | SDK (`packages/sdk`)                    |
| `types`     | Shared types (`packages/types`)         |
| `mobile`    | Mobile app (`packages/mobile`)          |
| `monitoring`| Monitoring (`packages/monitoring`)       |
| `shared`    | Cross-package changes                   |
| `repo`      | Repository-level changes               |
| `deps`      | Dependency updates                      |
| `docs`      | Documentation                           |
| `ci`        | CI/CD                                   |
| `release`   | Release management                      |

### Rules

- **Subject**: imperative mood, lowercase, max 100 characters.
- **Scope**: required (enforced by `commitlint` — `scope-empty: never`).
- **Breaking changes**: add `!` after the type/scope and `BREAKING CHANGE:` in the footer.

### Examples

```
feat(api): add job search endpoint with filters
fix(app): resolve wallet disconnect crash on Safari
refactor(shared): centralize magic numbers in constants module
chore(deps): bump stellar-sdk from 14.5.0 to 14.6.0
```

---

## Pre-commit Hooks

The repository uses [Husky](https://typicode.github.io/husky/) to run local
quality gates before every commit. Hooks are installed automatically when you
run `pnpm install` (via the `prepare` script).

### What the hooks do

| Hook | File | What it runs |
|------|------|-------------|
| `pre-commit` | `.husky/pre-commit` | `pnpm format:check`, `pnpm lint-staged`, `pnpm type-check`, and `cargo fmt --check` for staged Rust files |
| `commit-msg` | `.husky/commit-msg` | `commitlint` — validates the commit message against the Conventional Commits rules in `commitlint.config.js` |

### lint-staged

[lint-staged](https://github.com/lint-staged/lint-staged) runs linters and
formatters only on files you've staged, not the entire repo. The configuration
lives in the `lint-staged` key of the root `package.json`:

| File pattern | Commands |
|---|---|
| `packages/api/src/**/*.ts` | `eslint --fix --max-warnings=0`, `prettier --write` |
| `packages/app/src/**/*.{ts,tsx}` | `prettier --write` |
| `packages/sdk/src/**/*.ts` | `eslint --fix --max-warnings=0`, `prettier --write` |
| `packages/types/src/**/*.ts` | `eslint --fix --max-warnings=0`, `prettier --write` |
| `packages/monitoring/src/**/*.ts` | `prettier --write` |
| `packages/contracts/**/*.rs` | `rustfmt --edition 2021` |
| `**/*.{js,json,md}` | `prettier --write` |

### Bypassing hooks

To skip hooks for a specific commit (e.g., WIP), use `--no-verify`:

```bash
git commit --no-verify -m "WIP: temporary change"
```

> **Warning**: `--no-verify` bypasses all pre-commit checks. CI will still
> enforce lint, type-check, and format on every push. Use sparingly.

### Reinstalling hooks

If hooks are missing (e.g., after a fresh clone without `pnpm install`), run:

```bash
pnpm run prepare
```

Or install Husky manually:

```bash
npx husky
```

---

## Branch Naming

Use descriptive branch names with these prefixes:

| Prefix      | Purpose                             |
| ----------- | ----------------------------------- |
| `feat/`     | New features                        |
| `fix/`      | Bug fixes                           |
| `docs/`     | Documentation updates               |
| `style/`    | Formatting / whitespace only        |
| `refactor/` | Refactoring without behavior change |
| `test/`     | Adding or updating tests            |
| `chore/`    | Maintenance, dependency updates     |
| `ci/`       | CI/CD changes                       |
| `contract/` | Soroban smart contract changes      |

Include the issue number when relevant: `feat/issue-42-add-kes-corridor`.

---

## Issue & PR Templates

- Use the templates in `.github/ISSUE_TEMPLATE/` when opening issues.
- Use the PR template at `.github/pull_request_template.md` when opening PRs.
- Fill in every section; do not delete sections you leave blank.

---

## Pull Request Process

1. Make sure your branch is up to date with `main`.
2. Run the full check suite:
   ```bash
   pnpm lint && pnpm format:check && pnpm type-check && pnpm test
   ```
3. If you changed UI flows, run E2E tests: `pnpm test:e2e`
4. Open a PR targeting `main`, fill in the PR template, and reference the issue.
5. At least one maintainer approval is required to merge.
6. PRs are merged via squash and merge.

---

## Code Style

- **TypeScript**: use explicit types, avoid `any`, prefer `unknown` when the type is genuinely unknown.
- **Prettier**: single quotes, 100-char line limit, trailing commas in multi-line structures.
- **ESLint**: project-specific rules in `eslint-base-rules.js` and per-package configs.
- **Rust**: `cargo fmt --workspace` with `contracts/rustfmt.toml` settings (100-char width, 4-space indent).

---

## Error Handling & Logging

- Use the structured logger (see `docs/ERROR_HANDLING_AND_LOGGING.md`).
- Never use `console.log` in application source (enforced by lint).
- Wrap async route handlers in `catchAsync`.
- Return errors in the standard `{ status, code, message }` envelope.

---

## Running Tests

```bash
pnpm test                    # all unit tests
pnpm test:integration:db     # DB integration tests (requires docker compose)
pnpm test:load:jobs          # load tests
```

---

## End-to-End (E2E) Tests

```bash
pnpm test:e2e               # Playwright E2E suite
```

---

## Coverage

- Test coverage must stay at or above **85%** for modified modules.
- Run coverage with: `pnpm --filter @bluecollar/api test:coverage`

---

## Translations

See `docs/i18n-translations.md` for the translation workflow.
