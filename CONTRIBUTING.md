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

For full environment setup — including pnpm workspace installation, docker-compose services, and environment variables — see the single authoritative onboarding guide: **[docs/setup.md](docs/setup.md)**.

In short:

1. Fork the repository and clone your fork.
2. Install dependencies with `pnpm install` from the repo root.
3. Configure environment variables and start local services as described in [docs/setup.md](docs/setup.md).

Once your environment is ready, come back here for contribution conventions below.

---

## Commit Message Convention

This project follows [Conventional Commits v1.0.0](https://www.conventionalcommits.org/).

### Format

```
<type>(<scope>): <short summary>
```

**Types:** `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `style`, `ci`, `perf`
**Scopes:** `api`, `app`, `sdk`, `types`, `mobile`, `contracts`, `monitoring`, `scripts`

---

## Code Style

### TypeScript — `interface` vs `type` (#1895)

Use **`interface`** for all object shapes. Use **`type`** only for unions, intersections, mapped types, conditional types, and `Partial<X>` / `Pick<X, K>` aliases.

```ts
// ✅ Correct — object shape uses interface
interface WorkerProfile {
  id: string;
  name: string;
  categoryId: string;
}

// ❌ Wrong — object shape should not use type alias
type WorkerProfile = {
  id: string;
  name: string;
};

// ✅ Correct — union type uses type
type JobStatus = 'open' | 'closed' | 'filled';

// ✅ Correct — mapped/partial alias uses type
type PartialWorker = Partial<WorkerProfile>;
```

This rule is enforced by `@typescript-eslint/consistent-type-definitions: ['error', 'interface']` in all packages.

### Import ordering (#1893)

Imports must follow this group order, enforced by `import-x/order`:

1. Node built-ins (`node:fs`, `node:path`, …)
2. External packages (`express`, `zod`, …)
3. Workspace packages (`@bluecollar/*`)
4. Internal path aliases (`@/lib/…`)
5. Relative imports (`./foo`, `../bar`)

---

## Environment Variables (#1896)

Each package owns its own `.env.example`. The root `.env.example` documents cross-cutting variables.

- **Never read `process.env` directly** in `packages/api` production code — import `config` from `src/config/config.ts` instead.
- When adding a new env var to `packages/api`, add it to both `src/config/config.ts` (`envSchema` + `Config` type) **and** `packages/api/.env.example`.
- Seed-only variables (`SEED_ADMIN_EMAIL`, etc.) are exempt — they are read directly by `src/database/seed.ts` and do not belong in `envSchema`.

---

## Pre-commit Hooks

Husky pre-commit hooks run `lint-staged` automatically. Ensure `pnpm install` has been run so hooks are registered.

---

## Running Tests

```bash
# All packages
pnpm test

# Single package
pnpm --filter @bluecollar/api test
pnpm --filter @bluecollar/app test
```

---

## Coverage

Coverage threshold is **85%** lines/functions/branches for `packages/api` and `packages/app`. PRs must not reduce coverage for modified modules.
