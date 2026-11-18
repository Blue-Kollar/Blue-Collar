# Local Developer Setup Guide

> **This is the single authoritative onboarding guide** for the BlueCollar monorepo. It supersedes any overlapping setup instructions in `README.md` and `CONTRIBUTING.md`; those files link here instead of duplicating steps. If you find a discrepancy, this document wins — please open a PR to fix it.

It covers backend (`packages/api`), web frontend (`packages/app`), smart contracts (`packages/contracts`), mobile application (`packages/mobile`), monitoring (`packages/monitoring`), SDK (`packages/sdk`), and shared types (`packages/types`).

**Contents**

1. [Prerequisites](#1-prerequisites)
2. [Clean Checkout & Repository Installation](#2-clean-checkout--repository-installation)
3. [Environment Variables Configuration](#3-environment-variables-configuration)
4. [Database & Cache Setup (PostgreSQL + Redis)](#4-database--cache-setup-postgresql--redis)
5. [Stellar & Soroban Local Network Setup](#5-stellar--soroban-local-network-setup)
6. [Running the Applications](#6-running-the-applications)
7. [Full Docker Compose Environment (All-in-One)](#7-full-docker-compose-environment-all-in-one)
8. [Verification on a Clean Machine](#8-verification-on-a-clean-machine)
9. [Troubleshooting](#9-troubleshooting)
10. [Related References](#10-related-references)

---

## 1. Prerequisites

Ensure your development environment meets the following requirements:

| Tool | Version | Required By | Installation / Verification |
|---|---|---|---|
| **Node.js** | `>= 20.x` | `api`, `app`, `mobile`, `monitoring`, `sdk`, `types` | `node -v` |
| **pnpm** | `>= 9.x` | Monorepo package manager | `corepack enable && corepack prepare pnpm@latest --activate` |
| **Rust** | `>= 1.74.0` (stable) | `contracts` (Soroban) | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| **wasm32v1-none** | bundled | Soroban contract compilation | `rustup target add wasm32v1-none` |
| **Stellar CLI** | `>= 21.x` | Smart contract build, deploy, invoke | `cargo install --locked stellar-cli` |
| **Docker & Docker Compose** | Latest | Database, Redis, Soroban Quickstart | `docker compose version` |
| **PostgreSQL** (if native) | `16.x` | `api` persistence | `psql --version` |
| **Redis** (if native) | `7.x` | `api` caching & rate limiting | `redis-cli --version` |

---

## 2. Clean Checkout & Repository Installation

BlueCollar is a **pnpm workspace** (`pnpm-workspace.yaml` lists `packages/*`). Always install from the repository root — never run `npm install` or `yarn` inside a package.

```bash
# Clone the repository
git clone https://github.com/Blue-Kollar/Blue-Collar.git
cd Blue-Collar

# Enable the pinned package manager (see "packageManager" in package.json)
corepack enable

# Install all workspace dependencies (root and every packages/* workspace)
pnpm install
```

Useful workspace commands:

```bash
pnpm -r build          # build every workspace package
pnpm --filter @bluecollar/api <script>   # run a script in one package
pnpm -w <script>       # run a root-level script
```

> **Note**: `packages/contracts` is an independent Rust/Cargo workspace. Its dependencies are managed by Cargo, not `pnpm` (see [Section 5](#5-stellar--soroban-local-network-setup)).

---

## 3. Environment Variables Configuration

Each package reads its own `.env` file. Copy the examples first:

```bash
# API environment
cp packages/api/.env.example packages/api/.env

# App (Next.js) environment
cp packages/app/.env.example packages/app/.env

# Monitoring environment
cp packages/monitoring/.env.example packages/monitoring/.env
```

> `.env` files are git-ignored. Never commit real secrets — use placeholder values locally.

### 3.1 `packages/api/.env`

The API validates its configuration at boot in `packages/api/src/config/config.ts`. The variables below are the ones that file reads; values marked **required** must be present or the process exits with a validation error.

```dotenv
# --- Core ---
NODE_ENV="development"                 # development | test | production
PORT=3000
APP_URL="http://localhost:3001"        # public URL of the web app (CORS + links)
ALLOWED_ORIGINS="http://localhost:3001"

# --- Database (required) ---
DATABASE_URL="postgresql://bluecollar:bluecollar@localhost:5432/bluecollar"
TEST_DATABASE_URL="postgresql://bluecollar:bluecollar@localhost:5432/bluecollar_test"

# --- Cache / rate limiting (required) ---
REDIS_URL="redis://localhost:6379"

# --- Auth (required) ---
JWT_SECRET="local-dev-jwt-secret-minimum-32-chars-long"
JWT_EXPIRES_IN="7d"
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# --- Mail (required for email flows) ---
MAIL_HOST="smtp.mailtrap.io"
MAIL_PORT=2525
MAIL_USER=""
MAIL_PASSWORD=""
MAIL_FROM="no-reply@bluecollar.local"

# --- Stellar / Soroban ---
STELLAR_NETWORK="testnet"              # testnet | mainnet | local
STELLAR_RPC_URL="https://soroban-testnet.stellar.org"
REGISTRY_CONTRACT_ID=""                # filled in after Section 5.3
MARKET_CONTRACT_ID=""                  # filled in after Section 5.3
```

> **Tip**: `JWT_SECRET` must be at least 32 characters. Generate one with `openssl rand -hex 32`.

### 3.2 `packages/app/.env`

```dotenv
NEXT_PUBLIC_API_URL="http://localhost:3000/api"
NEXT_PUBLIC_STELLAR_NETWORK="TESTNET"
NEXT_PUBLIC_REGISTRY_CONTRACT_ID=""    # from Section 5.3
NEXT_PUBLIC_MARKET_CONTRACT_ID=""      # from Section 5.3
```

### 3.3 `packages/monitoring/.env`

```dotenv
STELLAR_RPC_URL="https://soroban-testnet.stellar.org"
REGISTRY_CONTRACT_ID=""                # from Section 5.3
MARKET_CONTRACT_ID=""                  # from Section 5.3
```

---

## 4. Database & Cache Setup (PostgreSQL + Redis)

### Option A: Using Docker Compose (Recommended)

The root `docker-compose.yml` defines the local backing services. Start only the database and cache for day-to-day development:

```bash
# Start DB and Redis services in the background
docker compose up -d db redis

# Verify containers are running and healthy
docker compose ps
```

Services defined in `docker-compose.yml`:

| Service | Container port | Host port | Purpose |
|---|---|---|---|
| `db` | `5432` | `5432` | PostgreSQL 16 (user/password/db: `bluecollar`) |
| `redis` | `6379` | `6379` | Redis 7 (cache + rate limiting) |
| `adminer` | `8080` | `8080` | Web DB browser at `http://localhost:8080` |
| `api` | `3000` | `3000` | Backend API (full-stack profile only) |
| `app` | `3001` | `3001` | Next.js web frontend (full-stack profile only) |

Stop services with `docker compose down` (add `-v` to also drop the database volume).

### Option B: Native Services

If running native PostgreSQL and Redis:

```bash
createdb bluecollar
createdb bluecollar_test
# Ensure Redis server is active on port 6379
```

### Run Database Migrations and Seed Data

```bash
# Apply Prisma migrations to the database
pnpm --filter @bluecollar/api migrate

# Seed initial categories and reference data
pnpm --filter @bluecollar/api seed
```

---

## 5. Stellar & Soroban Local Network Setup

BlueCollar contracts can run against **Testnet** (easiest) or a **Local Standalone Soroban Network** (fastest feedback loop).

### 5.1 Setting Up Stellar CLI Network Config

```bash
# Configure Testnet
stellar network add \
  --global testnet \
  --rpc-url https://soroban-testnet.stellar.org \
  --network-passphrase "Test SDF Network ; September 2015"

# Configure Local Standalone (if running local docker container)
stellar network add \
  --global local \
  --rpc-url http://localhost:8000/soroban/rpc \
  --network-passphrase "Standalone Network ; February 2017"
```

### 5.2 Generate and Fund Deployer Identity

```bash
# Generate local identity
stellar keys generate --global deployer

# Fund deployer identity on Testnet via Friendbot
stellar keys fund deployer --network testnet
```

### 5.3 Build & Deploy Smart Contracts

```bash
cd packages/contracts

# Build release WASM for all contracts
make build

# Deploy Registry Contract
REGISTRY_CONTRACT_ID=$(stellar contract deploy \
  --wasm target/wasm32v1-none/release/bluecollar_registry.wasm \
  --source deployer \
  --network testnet)

# Deploy Market Contract
MARKET_CONTRACT_ID=$(stellar contract deploy \
  --wasm target/wasm32v1-none/release/bluecollar_market.wasm \
  --source deployer \
  --network testnet)

echo "Registry Contract ID: $REGISTRY_CONTRACT_ID"
echo "Market Contract ID: $MARKET_CONTRACT_ID"
```

### 5.4 Wire Contract IDs to Frontend & API

Export the deployed contract IDs into `packages/app/.env` and `packages/monitoring/.env`:

- Set `NEXT_PUBLIC_REGISTRY_CONTRACT_ID=$REGISTRY_CONTRACT_ID`
- Set `NEXT_PUBLIC_MARKET_CONTRACT_ID=$MARKET_CONTRACT_ID`
- Set `REGISTRY_CONTRACT_ID=$REGISTRY_CONTRACT_ID` in `packages/monitoring/.env`
- Set `MARKET_CONTRACT_ID=$MARKET_CONTRACT_ID` in `packages/monitoring/.env`

---

## 6. Running the Applications

### 6.1 Run All Services Concurrently
From the repository root:

```bash
pnpm dev
```

### 6.2 Run Packages Individually

- **API (`packages/api`)**:
  ```bash
  pnpm --filter @bluecollar/api dev
  # API runs on http://localhost:3000
  # Swagger Docs at http://localhost:3000/api/v1/docs
  ```

- **Web Frontend (`packages/app`)**:
  ```bash
  pnpm --filter @bluecollar/app dev
  # Web App runs on http://localhost:3001
  ```

- **Mobile App (`packages/mobile`)**:
  ```bash
  pnpm --filter @bluecollar/mobile start
  # Expo DevTools and Metro bundler
  ```

- **Contract Monitor (`packages/monitoring`)**:
  ```bash
  pnpm --filter @bluecollar/monitoring dev
  ```

---

## 7. Full Docker Compose Environment (All-in-One)

To run the entire platform (API, Web App, Database, Redis, Adminer) in containers:

```bash
# Build and start all services
docker compose up --build -d

# Check service logs
docker compose logs -f api
```

| Service | Port / URL |
|---|---|
| **Web Frontend** | `http://localhost:3001` |
| **API Server** | `http://localhost:3000` |
| **Swagger UI** | `http://localhost:3000/api/v1/docs` |
| **PostgreSQL** | `localhost:5432` |
| **Redis** | `localhost:6379` |
| **Adminer (DB UI)** | `http://localhost:8080` |

---

## 8. Verification on a Clean Machine

Before opening your first PR, confirm your environment is correct by running the setup verification script from the repository root:

```bash
./scripts/verify-setup.sh
```

The script checks tool versions, workspace installation, Docker service health, required environment variables, and (when the API is running) endpoint reachability. It exits non-zero on the first failure.

**Expected output on a correctly configured machine:**

```
[ok]   node v20.x (>= 20)
[ok]   pnpm 9.x (>= 9)
[ok]   rustc 1.7x.x (>= 1.74)
[ok]   stellar-cli 21.x
[ok]   pnpm workspace installed (node_modules present)
[ok]   docker compose service db is healthy
[ok]   docker compose service redis is healthy
[ok]   packages/api/.env present with required keys
[ok]   packages/app/.env present
[ok]   packages/monitoring/.env present
[ok]   API health endpoint responded 200
Setup verification passed.
```

If any line is prefixed with `[fail]`, fix the reported item and re-run the script.

### Manual Verification Checklist
1. `node -v` returns `>= 20.x` and `pnpm -v` returns `>= 9.x`.
2. `docker compose ps` shows `db` and `redis` in healthy status.
3. `curl http://localhost:3000/api/vitals` returns `{ "status": "ok" }`.
4. `curl http://localhost:3000/api/v1/docs` loads the OpenAPI Swagger UI.
5. Opening `http://localhost:3001` loads the BlueCollar marketplace landing page.

---

## 9. Troubleshooting

### Common Issues

| Issue | Resolution |
|---|---|
| `PrismaClientInitializationError: Can't reach database server` | Ensure Docker DB is running (`docker compose up -d db`) and `DATABASE_URL` in `packages/api/.env` matches port 5432. |
| `Friendbot rate limit exceeded` on Testnet | Wait 60 seconds or use an alternative funded test account. |
| `stellar-cli: command not found` | Run `cargo install --locked stellar-cli` and ensure `~/.cargo/bin` is in `$PATH`. |
| Port conflicts on 3000 or 5432 | Check for local PostgreSQL or processes running on ports 3000/5432 (`lsof -i :3000`, `lsof -i :5432`). |
| `ERR_PNPM_UNSUPPORTED_ENGINE` | Your Node version is too old; install Node `>= 20` and re-run `pnpm install`. |
| API exits with a config validation error | A required key is missing from `packages/api/.env`; compare against [Section 3.1](#31-packagesapienv). |

---

## 10. Related References

- [Monorepo Package Boundaries (ADR 0001)](../adr/0001-monorepo-package-boundaries.md)
- [Public API Reference](./api-reference.md)
- [Smart Contracts Guide](../CONTRACTS.md)
- [Soroban Contract Upgrade Guide](../contract-upgrade-guide.md)
- [Contributing Guide](../../CONTRIBUTING.md)
- [Repository README](../../README.md)
