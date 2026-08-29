# Local Setup Guide

A single place to get every package in this monorepo — `api`, `app`, `contracts`,
`sdk`, `mobile`, `monitoring`, `types` — running on your machine.

If you only need the API running, [packages/api/QUICK_START_GUIDE.md](../packages/api/QUICK_START_GUIDE.md)
covers that faster and in more depth — this guide's API section is a shorter pointer to
it, focused on how the API fits together with everything else.

## Table of Contents

- [Prerequisites](#prerequisites)
- [1. Clone & install](#1-clone--install)
- [2. Database & cache (Postgres, Redis)](#2-database--cache-postgres-redis)
- [3. Stellar/Soroban network](#3-stellarsoroban-network)
- [4. Deploy the contracts](#4-deploy-the-contracts)
- [5. Per-package setup](#5-per-package-setup)
- [6. Wiring it together](#6-wiring-it-together)
- [Docker Compose (alternative)](#docker-compose-alternative)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

| Tool | Version | Needed for |
|---|---|---|
| [Node.js](https://nodejs.org) | >= 20 | api, app, mobile, monitoring, sdk, types |
| [pnpm](https://pnpm.io) | >= 9 | all TypeScript packages (workspace-managed) |
| [PostgreSQL](https://www.postgresql.org/download/) | 16.x | api |
| [Redis](https://redis.io/docs/getting-started/) | 7.x | api (optional — API degrades gracefully without it) |
| [Rust](https://www.rust-lang.org/tools/install) + `wasm32v1-none` target | stable | contracts |
| [Stellar CLI](https://developers.stellar.org/docs/tools/cli/install-cli) | latest | contracts, and deploying/funding accounts for api/app/mobile/monitoring to talk to |
| [Docker](https://docs.docker.com/get-docker/) | any recent | optional — Docker Compose path, and/or a local Soroban network |

Install the Rust/Stellar toolchain:

```bash
rustup target add wasm32v1-none
cargo install --locked stellar-cli
```

## 1. Clone & install

```bash
git clone https://github.com/Blue-Kollar/Blue-Collar.git
cd Blue-Collar
pnpm install
```

This installs dependencies for every package in `pnpm-workspace.yaml` (`api`, `app`,
`mobile`, `monitoring`, `sdk`, `types`) in one pass — `contracts` is a separate Cargo
workspace and isn't touched by `pnpm install` (see step 4).

## 2. Database & cache (Postgres, Redis)

Only `api` needs these. Either run them natively or via the root
[docker-compose.yml](../docker-compose.yml):

```bash
# Docker (recommended — matches CI)
docker compose up -d db redis

# or natively
createdb bluecollar
createdb bluecollar_test   # used by `pnpm test` in packages/api
```

Default local connection strings (already the defaults in
`packages/api/.env.example`):

```
DATABASE_URL="postgresql://user:password@localhost:5432/bluecollar"
TEST_DATABASE_URL="postgresql://user:password@localhost:5432/bluecollar_test"
REDIS_URL="redis://localhost:6379"
```

If you used `docker compose up -d db`, the actual user/password are `bluecollar`/
`bluecollar` (see `docker-compose.yml`) — adjust `DATABASE_URL` accordingly, or set
`POSTGRES_PASSWORD` to match what your `.env` expects.

## 3. Stellar/Soroban network

Everything in this repo (`api`'s wallet endpoints, `app`, `mobile`, `monitoring`, and
`contracts` deploys) talks to a Stellar network over Horizon (classic operations) and
Soroban RPC (contract calls). You have two options — pick one before deploying
contracts in step 4.

### Option A — Testnet (recommended default)

No local infrastructure to run; this is what every `.env.example` in this repo defaults
to. Slower feedback loop (real network latency, occasional Friendbot rate limits) but
zero setup.

```bash
# Generate and fund a deployer identity (one-time)
stellar keys generate --global deployer
stellar keys fund deployer --network testnet
```

`stellar keys fund` calls Friendbot to send the account testnet XLM. Re-run
`stellar keys fund deployer --network testnet` any time you need more.

### Option B — Local standalone network

Fully offline, deterministic, and fast — no Friendbot rate limits, no dependency on
testnet uptime. Costs you a `docker` container and one extra CLI network alias.

```bash
# Start a local Stellar + Soroban RPC network (Horizon on :8000, RPC on :8000/soroban/rpc)
stellar container start local

# Register it as a named network for the CLI
stellar network add local \
  --rpc-url http://localhost:8000/soroban/rpc \
  --network-passphrase "Standalone Network ; February 2017" \
  --horizon-url http://localhost:8000

# Generate and fund a deployer identity against it
stellar keys generate --global deployer
stellar keys fund deployer --network local
```

The `packages/contracts` `Makefile`/`scripts/deploy-*.sh` wrappers only accept
`--network testnet|mainnet` (see [packages/contracts/README.md](../packages/contracts/README.md#deploy)),
so against a local network deploy contracts manually instead of via `make
deploy-testnet` — see step 4.

Stop the local network with `stellar container stop local` when you're done; data
doesn't persist across restarts unless you configure a volume.

## 4. Deploy the contracts

```bash
cd packages/contracts
make build   # compiles registry + market to WASM (target/wasm32v1-none/release/)
```

**Testnet:**

```bash
make deploy-testnet \
  SOURCE=deployer \
  ADMIN=<your-stellar-address> \
  FEE_RECIPIENT=<treasury-address> \
  FEE_BPS=100
```

Writes both contract IDs to `packages/contracts/deployments.json`.

**Local standalone network:** the `make deploy-*` targets don't support a `local`
network value, so invoke the underlying scripts' `stellar contract deploy` step
manually against your `local` network alias — see
`packages/contracts/scripts/deploy-registry.sh` and `deploy-market.sh` for the exact
`stellar contract deploy`/`invoke -- initialize` sequence to adapt (swap
`--network testnet` for `--network local` throughout).

Either way, `dispute`, `fee_distribution`, and `insurance_pool` aren't wired into the
`make deploy-*` targets yet — deploy them individually with
`stellar contract deploy --wasm target/wasm32v1-none/release/<crate>.wasm
--source deployer --network <testnet|local>` followed by `-- initialize --admin
<address>` (adjust per contract's `initialize` signature — see
[docs/CONTRACTS.md](./CONTRACTS.md)).

You'll need the resulting contract IDs in step 6.

## 5. Per-package setup

### api (`packages/api`)

```bash
cp packages/api/.env.example packages/api/.env
# fill in DATABASE_URL, JWT_SECRET, and the other required vars — see
# docs/ENVIRONMENT_VARIABLES.md, or packages/api/QUICK_START_GUIDE.md for a
# walkthrough of exactly which values are required for a fully working local run.

cd packages/api
pnpm prisma:generate
pnpm migrate
pnpm seed        # default categories
pnpm dev         # http://localhost:3000
```

### app (`packages/app`)

```bash
cp packages/app/.env.example packages/app/.env
# NEXT_PUBLIC_API_URL should point at the api instance from above

cd packages/app
pnpm dev         # http://localhost:3001
```

### sdk (`packages/sdk`)

No dev server — it's a library consumed by other packages. No env vars or setup beyond
`pnpm install` (already done in step 1).

```bash
pnpm --filter @bluecollar/sdk test   # run its unit tests
```

### mobile (`packages/mobile`)

```bash
cd packages/mobile
# optional — defaults to http://localhost:3000/api if unset
echo 'EXPO_PUBLIC_API_URL=http://localhost:3000/api' > .env

pnpm start       # Expo dev server — press i/a/w for iOS/Android/web, or scan the QR code
```

See [packages/mobile/README.md](../packages/mobile/README.md) for iOS/Android
simulator specifics.

### monitoring (`packages/monitoring`)

```bash
cp packages/monitoring/.env.example packages/monitoring/.env
# fill in REGISTRY_CONTRACT_ID / MARKET_CONTRACT_ID from step 4

cd packages/monitoring
pnpm dev
```

### types (`packages/types`)

No dev server, no env vars — pure type definitions consumed by `api`/`app` at compile
time via `workspace:*`. Nothing to run; `pnpm --filter @bluecollar/types type-check`
validates it in isolation.

## 6. Wiring it together

Once contracts are deployed (step 4) and `api`/`app` are running (step 5), point each
consumer at the deployed contract IDs so the whole stack talks to the same network:

| File | Variables |
|---|---|
| `packages/api/.env` | `REGISTRY_CONTRACT_ID`, `MARKET_CONTRACT_ID`, `HORIZON_URL` |
| `packages/app/.env` | `NEXT_PUBLIC_REGISTRY_CONTRACT_ID`, `NEXT_PUBLIC_MARKET_CONTRACT_ID`, `NEXT_PUBLIC_STELLAR_NETWORK` |
| `packages/monitoring/.env` | `REGISTRY_CONTRACT_ID`, `MARKET_CONTRACT_ID`, `STELLAR_RPC_URL` |

If you're on the local standalone network from step 3, `HORIZON_URL`/
`NEXT_PUBLIC_STELLAR_HORIZON_URL`/`STELLAR_RPC_URL` also need to point at
`http://localhost:8000` (and its `/soroban/rpc` path for RPC) instead of the testnet
defaults baked into each `.env.example`.

Full variable reference (types, defaults, which are required): see
[docs/ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md).

## Docker Compose (alternative)

For `api` + `app` + Postgres + Redis + observability stack (OpenTelemetry Collector,
Loki, Promtail) in one command, without installing Node/pnpm locally at all:

```bash
cp packages/api/.env.example packages/api/.env   # filled in as above
docker compose up -d
```

See [docker-compose.yml](../docker-compose.yml) for the full service list and exposed
ports. This path still requires contracts to be deployed separately (step 4) — Docker
Compose doesn't build or deploy Rust/Soroban contracts.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `api` fails to start with a message naming a missing env var | A required variable in `packages/api/.env` is unset — the config module validates eagerly at startup. See [docs/ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md) for what's required. |
| `stellar keys fund` hangs or errors | Friendbot (testnet) is rate-limited or briefly down; retry, or switch to the local standalone network (step 3, Option B). |
| `app`/`mobile` can reach the API but on-chain actions (tips, registration) fail | Contract IDs in `.env` don't match a contract actually deployed on the network you configured — re-check step 6 against step 4's deploy output. |
| `pnpm install` fails on `contracts`-adjacent scripts | `contracts` is a Cargo workspace, not part of the pnpm workspace — make sure you're not trying to `pnpm install` from inside `packages/contracts`. |
