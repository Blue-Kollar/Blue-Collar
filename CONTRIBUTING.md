# Contributing to BlueCollar

Thanks for your interest in contributing! This guide covers everything you need to get started.

---

## Table of Contents

- [Getting Started](#getting-started)
- [Commit Message Convention](#commit-message-convention)
- [Branch Naming](#branch-naming)
- [Pull Request Process](#pull-request-process)
- [Code Style](#code-style)
- [Running Tests](#running-tests)

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
| `docs`     | Documentation changes only                              |
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
