# Your First Contribution

A step-by-step walkthrough for new contributors to get the BlueCollar monorepo running locally and make their first contribution.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Local Development Setup](#local-development-setup)
  - [API (packages/api)](#api-packagesapi)
  - [App (packages/app)](#app-packagesapp)
  - [Contracts (packages/contracts)](#contracts-packagescontracts)
- [Your First Contribution Walkthrough](#your-first-contribution-walkthrough)
- [Common Troubleshooting](#common-troubleshooting)
- [Good First Issues](#good-first-issues)

---

## Prerequisites

Install these tools before you start:

| Tool | Version | Install |
|---|---|---|
| Node.js | >= 20 | [nodejs.org](https://nodejs.org) |
| pnpm | >= 9 | `npm i -g pnpm` |
| PostgreSQL | >= 14 | [postgresql.org](https://www.postgresql.org/download/) or Docker |
| Git | any | [git-scm.com](https://git-scm.com) |
| Rust | stable | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| Docker (optional) | any | [docker.com](https://www.docker.com/get-started/) |

Verify your setup:

```bash
node --version    # v20.x.x or higher
pnpm --version    # 9.x.x or higher
psql --version    # psql (PostgreSQL) 14.x or higher
git --version     # git version 2.x.x
rustc --version   # rustc 1.x.x (stable)
```

---

## Local Development Setup

### 1. Fork and clone

Fork the repository on GitHub, then clone your fork:

```bash
git clone https://github.com/<your-username>/Blue-Collar.git
cd Blue-Collar
```

Add the upstream remote so you can pull future changes:

```bash
git remote add upstream https://github.com/abore9769/Blue-Collar.git
```

### 2. Install dependencies

From the repo root, install all workspace dependencies at once:

```bash
pnpm install
```

This installs dependencies for all three packages (`api`, `app`, `contracts`) in one step.

---

### API (`packages/api`)

The backend REST API — Node.js, Express, TypeScript, Prisma, PostgreSQL.

#### Step 1 — Set up environment variables

```bash
cp packages/api/.env.example packages/api/.env
```

Open `packages/api/.env` and fill in the required values:

| Variable | Required | Example |
|---|---|---|
| `DATABASE_URL` | Yes | `postgresql://user:pass@localhost:5432/bluecollar` |
| `TEST_DATABASE_URL` | Yes (for tests) | `postgresql://user:pass@localhost:5432/bluecollar_test` |
| `JWT_SECRET` | Yes | `openssl rand -hex 32` output |
| `PORT` | No | `3000` |
| `NODE_ENV` | No | `development` |
| `APP_URL` | No | `http://localhost:3001` |
| `ALLOWED_ORIGINS` | No | `http://localhost:3001` |
| `GOOGLE_CLIENT_ID` | No | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | No | From Google Cloud Console |
| `MAIL_HOST` | No | `smtp.example.com` |
| `MAIL_PORT` | No | `587` |
| `MAIL_USER` | No | `no-reply@example.com` |
| `MAIL_PASS` | No | Your SMTP password |
| `VAPID_PUBLIC_KEY` | No | Generate with `npx web-push generate-vapid-keys` |
| `VAPID_PRIVATE_KEY` | No | Generate with `npx web-push generate-vapid-keys` |

For local development, only `DATABASE_URL`, `JWT_SECRET`, and `PORT` are strictly required. Google OAuth and email features will be unavailable without their respective variables.

#### Step 2 — Create the database

```bash
createdb bluecollar
createdb bluecollar_test   # for running tests
```

Or with Docker (no local PostgreSQL needed):

```bash
pnpm docker:up   # starts PostgreSQL + API + Adminer at localhost:8080
```

#### Step 3 — Run migrations

```bash
cd packages/api
pnpm migrate
```

This runs `prisma migrate dev` and applies all schema migrations.

#### Step 4 — Seed the database

```bash
pnpm seed
```

Populates the database with default job categories.

#### Step 5 — Start the dev server

```bash
pnpm dev
```

The API is now available at `http://localhost:3000/api`.

Verify it's running:

```bash
curl http://localhost:3000/health
# {"status":"ok","service":"bluecollar-api"}
```

#### Optional — Create an admin user

```bash
pnpm admin:create --email admin@example.com --password secret123 --firstName Jane --lastName Doe
```

#### Useful API scripts

| Script | Description |
|---|---|
| `pnpm dev` | Start dev server with hot reload |
| `pnpm build` | Compile TypeScript to `dist/` |
| `pnpm test` | Run tests with Vitest (watch mode) |
| `pnpm test -- --run` | Run tests once (no watch) |
| `pnpm test:coverage` | Run tests with coverage report |
| `pnpm migrate` | Run Prisma migrations |
| `pnpm seed` | Seed default categories |
| `pnpm admin:create` | Create an admin user via CLI |
| `pnpm db:reset` | Reset the database (dev only) |
| `pnpm lint` | Run ESLint |
| `pnpm format` | Format with Prettier |

---

### App (`packages/app`)

The Next.js 14 frontend — React, Tailwind CSS, next-intl, Stellar SDK.

#### Step 1 — Set up environment variables

```bash
cp packages/app/.env.example packages/app/.env
```

Open `packages/app/.env` and fill in:

| Variable | Required | Example |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Yes | `http://localhost:3000/api` |
| `NEXT_PUBLIC_STELLAR_NETWORK` | No | `TESTNET` |
| `NEXT_PUBLIC_MARKET_CONTRACT_ID` | No | Deployed contract ID |
| `NEXT_PUBLIC_REGISTRY_CONTRACT_ID` | No | Deployed contract ID |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | No | Must match API's `VAPID_PUBLIC_KEY` |

For local development, only `NEXT_PUBLIC_API_URL` is required.

#### Step 2 — Start the dev server

```bash
cd packages/app
pnpm dev
```

The app is available at `http://localhost:3001`.

#### Useful App scripts

| Script | Description |
|---|---|
| `pnpm dev` | Start Next.js dev server |
| `pnpm build` | Production build |
| `pnpm test` | Run component tests with Vitest |
| `pnpm lint` | Run ESLint |
| `pnpm type-check` | TypeScript type check (no emit) |

---

### Contracts (`packages/contracts`)

Stellar Soroban smart contracts written in Rust.

#### Step 1 — Install Rust toolchain

```bash
rustup target add wasm32v1-none
cargo install --locked stellar-cli --features opt
```

Verify:

```bash
rustc --version
stellar --version
```

#### Step 2 — Build contracts

```bash
cd packages/contracts
make build
# or: cargo build --release --target wasm32v1-none
```

Output WASMs:
- `target/wasm32v1-none/release/bluecollar_registry.wasm`
- `target/wasm32v1-none/release/bluecollar_market.wasm`

#### Step 3 — Run contract tests

```bash
make test
# or: cargo test
```

Run a single contract's tests:

```bash
cargo test -p bluecollar-registry
cargo test -p bluecollar-market
```

#### Useful contract scripts

| Command | Description |
|---|---|
| `make build` | Build all contracts to WASM |
| `make test` | Run all contract tests |
| `make clippy` | Lint with Clippy (zero warnings) |
| `make fmt` | Format with `cargo fmt` |

---

## Your First Contribution Walkthrough

Here's the full flow from picking an issue to opening a PR.

### Step 1 — Pick an issue

Browse [good first issues](https://github.com/abore9769/Blue-Collar/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) on GitHub. Leave a comment saying you'd like to work on it so maintainers can assign it to you.

### Step 2 — Sync with upstream

Before starting, make sure your `main` is up to date:

```bash
git checkout main
git fetch upstream
git merge upstream/main
```

### Step 3 — Create a feature branch

Follow the branch naming convention `<type>/<short-description>`:

```bash
git checkout -b fix/worker-toggle-auth
# or
git checkout -b feat/add-worker-search
# or
git checkout -b docs/update-api-readme
```

### Step 4 — Make your changes

Write your code. Keep commits small and focused. Follow the [Conventional Commits](https://www.conventionalcommits.org/) format:

```bash
git commit -m "fix(api): return 403 instead of 401 on missing role"
git commit -m "feat(app): add search bar to workers page"
git commit -m "docs(api): document rate limiting headers"
```

### Step 5 — Run checks locally

Before pushing, make sure everything passes:

```bash
# API
cd packages/api
pnpm test -- --run
pnpm build

# App
cd packages/app
pnpm lint
pnpm type-check

# Contracts (if you changed Rust code)
cd packages/contracts
make clippy
make test
```

### Step 6 — Push and open a PR

```bash
git push origin fix/worker-toggle-auth
```

Then open a pull request on GitHub against the `main` branch. A PR template will pre-fill — it includes a checklist covering the type of change you made. Use the appropriate issue template when opening issues:

| Issue Type | Template |
|---|---|
| Bug Report | `.github/ISSUE_TEMPLATE/bug_report.yml` |
| Feature Request | `.github/ISSUE_TEMPLATE/feature_request.yml` |
| Documentation | `.github/ISSUE_TEMPLATE/documentation.yml` |

PR template (`.github/pull_request_template.md`):

```
## Summary

Brief description of what this PR does and why.

## Related Issue

Closes #

## Type of Change

- [ ] feat — New feature
- [ ] fix — Bug fix
- [ ] docs — Documentation
...

## Checklist

- [ ] Linter passes (`pnpm lint`)
- [ ] Tests pass (`pnpm test -- --run`)
- [ ] PR title follows Conventional Commits
...
```

---

## Common Troubleshooting

### PostgreSQL connection error (`P1001: Can't reach database server`)

- Ensure PostgreSQL is running: `pg_isready` or `sudo service postgresql start`
- Double-check `DATABASE_URL` in `packages/api/.env` — username, password, host, port, and database name must all match
- Make sure the database exists: `createdb bluecollar`

### `prisma migrate dev` fails with "database does not exist"

```bash
createdb bluecollar
```

### Missing environment variable errors on startup

- Confirm `packages/api/.env` exists: `ls packages/api/.env`
- Ensure you copied from the example: `cp packages/api/.env.example packages/api/.env`
- Check that `JWT_SECRET`, `DATABASE_URL`, and `PORT` are set and non-empty

### `pnpm: command not found`

```bash
npm i -g pnpm
```

### Port 3000 already in use

```bash
# Find and kill the process
lsof -ti:3000 | xargs kill
# Or use a different port
PORT=3001 pnpm dev
```

### `cargo: command not found`

Install Rust:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
```

### `wasm32v1-none` target missing

```bash
rustup target add wasm32v1-none
```

### `stellar: command not found`

```bash
cargo install --locked stellar-cli --features opt
```

### Next.js build fails with type errors

```bash
cd packages/app
pnpm type-check   # see all type errors
```

Fix the reported errors before pushing — CI will fail on type errors.

### Tests fail with "Cannot find module"

Make sure you ran `pnpm install` from the repo root, not from inside a package directory:

```bash
cd Blue-Collar   # repo root
pnpm install
```

---

## Good First Issues

Look for issues tagged [`good first issue`](https://github.com/abore9769/Blue-Collar/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) on GitHub. These are scoped to be approachable for new contributors and have enough context to get started without deep knowledge of the codebase.

If you're unsure where to start, these areas are always good for contributions:

- **Documentation** — improving READMEs, adding code comments, fixing typos
- **Tests** — adding test coverage for untested services or controllers
- **Validation** — strengthening input validation rules
- **UI components** — building or improving frontend components in `packages/app/src/components/`

Feel free to open a GitHub Discussion if you have questions before diving in.
