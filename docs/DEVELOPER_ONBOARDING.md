# Developer Onboarding Guide

> Get the full BlueCollar stack running locally.
> **Measured setup time**: ~40 min fresh machine (mostly waiting for `stellar-cli` to compile).

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Clone & Install](#clone--install)
- [Environment Setup](#environment-setup)
- [Running the Stack](#running-the-stack)
  - [Option A — Docker (recommended)](#option-a--docker-recommended)
  - [Option B — Manual](#option-b--manual)
- [Contracts (Rust / Soroban)](#contracts-rust--soroban)
- [Verify Your Setup](#verify-your-setup)
- [Troubleshooting](#troubleshooting)
- [Your First Contribution](#your-first-contribution)

---

## Prerequisites

Install the following tools before you begin. Exact minimum versions are listed — newer patch releases are fine.

| Tool | Min version | Install |
|------|-------------|---------|
| Node.js | 20 | [nodejs.org](https://nodejs.org) or `nvm install 20` |
| pnpm | 9 | `npm install -g pnpm@9` |
| Docker + Compose | 24 / 2.24 | [docs.docker.com](https://docs.docker.com/get-docker/) |
| Rust + Cargo | 1.79 | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| Stellar CLI | 21 | `cargo install --locked stellar-cli` (takes 15–30 min) |
| WASM target | — | `rustup target add wasm32v1-none` |

Verify your setup:

```bash
node -v          # v20.x.x
pnpm -v          # 9.x.x
docker -v        # Docker version 24.x.x
cargo -V         # cargo 1.79.x
stellar -V       # stellar 21.x.x
rustc -v         # rustc 1.79.x
```

---

## Clone & Install

```bash
git clone https://github.com/Fidelis900/Blue-Collar.git
cd Blue-Collar
pnpm install
```

`pnpm install` installs dependencies for all workspace packages (`api`, `app`, `contracts`) in one shot.

---

## Environment Setup

### API environment

```bash
cp packages/api/.env.example packages/api/.env
```

Open `packages/api/.env` and set the following values:

| Variable | What to set locally |
|----------|---------------------|
| `DATABASE_URL` | `postgresql://bluecollar:bluecollar@localhost:5432/bluecollar` |
| `TEST_DATABASE_URL` | `postgresql://bluecollar:bluecollar@localhost:5432/bluecollar_test` |
| `JWT_SECRET` | Any long random string — `openssl rand -hex 32` |
| `APP_URL` | `http://localhost:3001` |
| `ALLOWED_ORIGINS` | `http://localhost:3001` |
| `REDIS_URL` | `redis://localhost:6379` |
| `GOOGLE_CLIENT_ID` | `placeholder` (must be non-empty) |
| `GOOGLE_CLIENT_SECRET` | `placeholder` |
| `MAIL_HOST` | `localhost` |
| `MAIL_USER` | `dev@localhost` |
| `MAIL_PASS` | `dev` |

The config module marks Google OAuth and SMTP vars as **required** at startup. Set them to the placeholder values above for local development — features that depend on real credentials (OAuth login, email) will gracefully no-op.

Stellar contract IDs, VAPID keys, and similar optional vars can be left blank.

### App environment

The Next.js frontend also needs its env file:

```bash
cp packages/app/.env.example packages/app/.env.local
```

No changes are needed for local development — the defaults point to `http://localhost:3000/api` on testnet.

---

## Running the Stack

### Option A — Docker (recommended)

Docker Compose starts PostgreSQL, Redis, the API, Adminer (DB UI), Loki, Promtail, and an OpenTelemetry Collector with a single command.

Make sure `packages/api/.env` exists before starting (see [Environment Setup](#environment-setup)).

```bash
# Start all services in the background
pnpm docker:up

# Run database migrations
cd packages/api && pnpm migrate && cd ../..

# Seed the database with demo-ready data (categories, curators, workers)
cd packages/api && pnpm seed && cd ../..

# Stop and remove containers (data volumes are preserved)
pnpm docker:down
```

| Service | URL |
|---------|-----|
| API | http://localhost:3000 |
| Adminer (DB UI) | http://localhost:8080 |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |
| Loki | http://localhost:3100 |

Then start the Next.js frontend in a separate terminal:

```bash
cd packages/app
pnpm dev   # http://localhost:3001
```

> **Note**: The Docker Compose file starts the API inside a container using `NODE_ENV=production`. In that mode the API does **not** use `tsx` hot-reload — it runs compiled JS from `dist/`. For active development, use [Option B](#option-b--manual) instead.

### Option B — Manual

Use this if you prefer to run services outside Docker or already have PostgreSQL and Redis running.

**1. Start PostgreSQL and Redis**

Make sure both are running and accessible at the URLs in your `.env`.
If you use Docker only for data services:

```bash
docker compose up -d db redis
```

**2. Generate the Prisma client and run migrations**

```bash
cd packages/api
pnpm prisma:generate   # generates Prisma client from schema
pnpm migrate           # runs prisma migrate dev
pnpm seed              # seeds categories + admin + curators + 20 workers
```

See [Seeding the database](#seeding-the-database) for all available seed commands.

**3. Start the API**

```bash
pnpm dev               # starts API with hot-reload on :3000
```

**4. Start the frontend**

```bash
cd packages/app
pnpm dev               # starts Next.js with hot-reload on :3001
```

**5. Run both together from the root (optional)**

```bash
pnpm dev               # starts API + app concurrently via root package.json
```

---

## Contracts (Rust / Soroban)

You only need this section if you are working on the smart contracts.

**Build all contracts:**

```bash
cd packages/contracts
cargo build --release --target wasm32v1-none
```

This produces WASM binaries for all workspace members:

| Contract | WASM output |
|---|---|
| Registry | `target/wasm32v1-none/release/bluecollar_registry.wasm` |
| Market | `target/wasm32v1-none/release/bluecollar_market.wasm` |
| Dispute | `target/wasm32v1-none/release/bluecollar_dispute.wasm` |
| Fuzz (lib-only) | — |

> `fee_distribution` and `insurance_pool` contracts exist but are not yet in the workspace. Build them individually from their directories.

**Run contract tests:**

```bash
# All workspace contract tests
cargo test --workspace

# Single contract
cargo test -p bluecollar-registry
```

**Lint (zero-warnings policy):**

```bash
cargo clippy --workspace -- -D warnings
```

**Deploy to Stellar testnet:**

```bash
stellar contract deploy \
  --wasm target/wasm32v1-none/release/bluecollar_registry.wasm \
  --source <your-secret-key> \
  --network testnet
```

After deploying, copy the contract ID into `REGISTRY_CONTRACT_ID` or `MARKET_CONTRACT_ID` in `packages/api/.env` and `NEXT_PUBLIC_REGISTRY_CONTRACT_ID` / `NEXT_PUBLIC_MARKET_CONTRACT_ID` in `packages/app/.env.local`.

---

## Verify Your Setup

### Smoke script

Run the smoke test script from the repo root:

```bash
scripts/verify-setup.sh
```

This checks:

- Required tools are installed (`node`, `pnpm`, `docker`, `cargo`)
- API responds on `http://localhost:3000/health`
- Database is reachable via `http://localhost:3000/ready`
- API returns categories on `http://localhost:3000/api/categories`
- App dev server responds on `http://localhost:3001`

### Manual checklist

If the smoke script isn't available on your platform, run through these manually:

```bash
# 1. API health check
curl http://localhost:3000/health
# Expected: {"status":"ok"}

# 2. Full readiness check (DB + Redis)
curl http://localhost:3000/ready
# Expected: {"status":"ok","service":"bluecollar-api","checks":{...}}

# 3. List categories (public endpoint)
curl http://localhost:3000/api/categories
# Expected: JSON array of categories

# 4. API unit tests
cd packages/api && pnpm test

# 5. App unit tests
cd packages/app && pnpm test

# 6. Contract tests
cd packages/contracts && cargo test --workspace
```

If all six pass, your environment is ready.

---

## Troubleshooting

### Port already in use

```
Error: listen EADDRINUSE :::3000
```

Find and kill the process using the port:

```bash
lsof -ti :3000 | xargs kill -9   # API
lsof -ti :3001 | xargs kill -9   # App
lsof -ti :5432 | xargs kill -9   # PostgreSQL
```

Or change the port in `packages/api/.env` (`PORT=3001`) and update `APP_URL` / `ALLOWED_ORIGINS` accordingly.

### Config validation errors at startup

If the API crashes immediately with a message like:

```
Config error: required env var "GOOGLE_CLIENT_ID" is missing or empty
```

Make sure `packages/api/.env` has **all** of the following set to at least a placeholder value:

```bash
GOOGLE_CLIENT_ID=placeholder
GOOGLE_CLIENT_SECRET=placeholder
MAIL_HOST=localhost
MAIL_USER=dev@localhost
MAIL_PASS=dev
APP_URL=http://localhost:3001
DATABASE_URL=postgresql://bluecollar:bluecollar@localhost:5432/bluecollar
JWT_SECRET=<your-random-secret>
```

### Prisma migration errors

**`P1001` — Can't reach database server**

The database isn't running or `DATABASE_URL` is wrong. If using Docker, make sure the containers are up:

```bash
pnpm docker:up
docker ps   # confirm db container is healthy
```

**`P3006` — Migration failed to apply**

A previous migration left the database in a dirty state. Reset it (destroys all local data):

```bash
cd packages/api
pnpm exec prisma migrate reset
pnpm seed
```

**Schema out of sync after pulling new code**

```bash
cd packages/api
pnpm migrate   # applies any new migrations
```

**`database "bluecollar_test" does not exist`**

Create the test database manually:

```bash
createdb bluecollar_test
# Or via Docker:
docker exec -ti blue-collar-db-1 createdb -U bluecollar bluecollar_test
```

### `pnpm install` fails with peer dependency errors

Make sure you are on pnpm 9:

```bash
pnpm -v
npm install -g pnpm@9
```

Then delete the lockfile and reinstall:

```bash
rm pnpm-lock.yaml
pnpm install
```

### WASM target not found

```
error[E0463]: can't find crate for `core`
  |
  = note: the `wasm32v1-none` target may not be installed
```

Install the WASM target:

```bash
rustup target add wasm32v1-none
```

### `cargo build --target wasm32v1-none` fails on Windows

On Windows, the WASM target requires the `wasm32v1-none` toolchain. Ensure you installed it:

```bash
rustup target add wasm32v1-none
```

If you see linker errors (`LNK`), install [LLVM](https://releases.llvm.org/) or use [WSL](https://learn.microsoft.com/en-us/windows/wsl/) to build contracts.

### Freighter wallet not connecting

Freighter is a browser extension for Stellar wallet interactions. To set it up for local development:

1. Install the [Freighter extension](https://www.freighter.app/) in Chrome or Firefox.
2. Create or import a wallet.
3. Switch the network to **Testnet**: click the network selector in the top-right of the extension and choose "Testnet".
4. Fund your testnet account using [Stellar Friendbot](https://friendbot.stellar.org/?addr=<your-public-key>).
5. Reload the app — Freighter should now connect when prompted.

If the app shows "Freighter not detected", make sure the extension is enabled for `localhost` in your browser's extension settings.

### `stellar` CLI not found after install

The Stellar CLI binary is installed into Cargo's bin directory. Make sure it is on your `PATH`:

```bash
export PATH="$HOME/.cargo/bin:$PATH"
# Add this line to your ~/.bashrc or ~/.zshrc to make it permanent
```

### Docker containers keep restarting

Check the logs for the failing service:

```bash
docker compose logs api
docker compose logs db
docker compose logs redis
```

Common causes:

- `packages/api/.env` is missing or has an invalid `DATABASE_URL`.
- Port 5432 or 6379 is already occupied by a local process (see port conflict section above).
- The API's `.env` has a `PORT` that doesn't match the Docker Compose port mapping.

### Redis not available (non-fatal)

The API degrades gracefully if Redis is unreachable — caching is disabled and per-user rate limiting falls back to IP-based. You'll see a warning log:

```
Redis error — caching disabled
```

This is fine for local development.

---

## Your First Contribution

### 1. Find an issue

Browse [open issues](https://github.com/Fidelis900/Blue-Collar/issues) and look for ones labelled `good first issue` or `help wanted`. Leave a comment to claim it before starting.

### 2. Fork and branch

```bash
# Fork on GitHub, then clone your fork
git clone https://github.com/<your-username>/Blue-Collar.git
cd Blue-Collar
pnpm install

# Create a branch following the naming convention: <type>/<short-description>
git checkout -b feat/my-feature
```

Branch types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`.

### 3. Make your changes

- Follow the code style for the package you are editing (TypeScript for `api`/`app`, Rust for `contracts`).
- Run `pnpm build` (or `cargo build`) to catch type/compile errors before committing.
- Add or update tests for any logic you change.

### 4. Commit using Conventional Commits

```
<type>(<scope>): <short description>
```

Examples:

```bash
git commit -m "feat(api): add worker search by category"
git commit -m "fix(app): correct pagination offset on worker list"
git commit -m "docs: add Freighter setup to onboarding guide"
```

Scopes: `api`, `app`, `contracts`, `docs`, `ci`, `deps`.

### 5. Run CI checks locally

```bash
pnpm test    # all package tests
pnpm build   # TypeScript compile check
pnpm lint    # ESLint

# Contracts
cd packages/contracts
cargo test --workspace
cargo clippy --workspace -- -D warnings
```

All checks must pass before opening a PR.

### 6. Open a pull request

```bash
git push -u origin feat/my-feature
```

Then open a PR on GitHub:

- **Title**: follow the commit convention (`feat(api): add worker search by category`).
- **Description**: summarise what changed, how you tested it, and reference the issue (`Closes #42`).
- Request a review from a maintainer.

PRs are squash-merged. The CI pipeline runs tests, build, and lint automatically — all checks must be green before merge.

---

For questions, join the [Telegram community](https://t.me/bluecollar) or open a [GitHub Discussion](https://github.com/Fidelis900/Blue-Collar/discussions).


---

## Seeding the database

### What gets seeded

Running `pnpm seed` creates:

| Entity | Count | Details |
|--------|-------|---------|
| Categories | 10 | Plumber, Electrician, Carpenter, Welder, Mason, Painter, Roofer, HVAC, Landscaper, General Contractor |
| Admin user | 1 | `admin@bluecollar.dev` |
| Curator users | 3 | `curator1–3@bluecollar.dev` |
| Workers | 20 | 2 per category, assigned round-robin to curators |

### Available commands

```bash
cd packages/api

# Basic seed — idempotent, safe to re-run
pnpm seed

# Full seed including sample reviews
pnpm seed:reviews

# Wipe everything and re-seed (dev only — not allowed in production)
pnpm seed:reset

# Staging seed — realistic fake data using faker.js (~15 workers, 30+ reviews)
NODE_ENV=staging pnpm seed:staging
```

### Default credentials (development only)

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@bluecollar.dev` | `Admin1234!` |
| Curator | `curator1@bluecollar.dev` | `Curator1234!` |
| Curator | `curator2@bluecollar.dev` | `Curator1234!` |
| Curator | `curator3@bluecollar.dev` | `Curator1234!` |

> **Production note:** dev passwords are only used when `NODE_ENV !== 'production'`.  
> In production or CI, set `SEED_ADMIN_PASSWORD`, `SEED_CURATOR1_PASSWORD`, etc. via environment variables — the script will throw if they are missing.

### Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `SEED_ADMIN_EMAIL` | `admin@bluecollar.dev` | Admin account email |
| `SEED_ADMIN_PASSWORD` | `Admin1234!` (dev only) | Admin password |
| `SEED_CURATOR1_EMAIL` | `curator1@bluecollar.dev` | Curator 1 email |
| `SEED_CURATOR1_PASSWORD` | `Curator1234!` (dev only) | Curator 1 password |
| `SEED_CURATOR2_EMAIL` | `curator2@bluecollar.dev` | Curator 2 email |
| `SEED_CURATOR2_PASSWORD` | `Curator1234!` (dev only) | Curator 2 password |
| `SEED_CURATOR3_EMAIL` | `curator3@bluecollar.dev` | Curator 3 email |
| `SEED_CURATOR3_PASSWORD` | `Curator1234!` (dev only) | Curator 3 password |

### Idempotency

The seed is safe to run multiple times:

- Categories are inserted with `skipDuplicates: true`.
- Users are upserted by email — re-running leaves passwords unchanged.
- Workers are skipped if a row with the same `email` already exists.
- Reviews are skipped if an identical `(workerId, authorId)` pair exists.
