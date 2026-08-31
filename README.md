# BlueCollar

> Find Skilled Workers Near You

**[English](./README.md) | [Português](./README.pt.md)**

[![CI](https://github.com/Fidelis900/Blue-Collar/actions/workflows/ci.yml/badge.svg)](https://github.com/Fidelis900/Blue-Collar/actions/workflows/ci.yml)
[![API Tests](https://github.com/Fidelis900/Blue-Collar/actions/workflows/api-tests.yml/badge.svg)](https://github.com/Fidelis900/Blue-Collar/actions/workflows/api-tests.yml)
[![Node Version](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)
[![pnpm Version](https://img.shields.io/badge/pnpm-%3E%3D9-orange)](https://pnpm.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./packages/api/LICENSE)

BlueCollar is a **decentralised protocol built on [Stellar](https://stellar.org)** that connects local skilled workers (plumbers, electricians, carpenters, welders, and more) with users through community-curated listings. The platform creates a trustless ecosystem where workers can be discovered, verified, and compensated securely — without relying on centralised intermediaries.

Many skilled workers lack a platform to help them get noticed. Meanwhile, countless people need quality recommendations for reliable tradespeople. BlueCollar is the bridge connecting both worlds.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Monorepo Structure](#monorepo-structure)
- [Architecture Decision Records](docs/adr/0001-monorepo-package-boundaries.md)
- [Packages](#packages)
  - [API](#api-packagesapi)
  - [Contracts](#contracts-packagescontracts)
  - [App](#app-packagesapp)
- [API Reference](#api-reference)
- [Smart Contracts](#smart-contracts)
- [Getting Started](#getting-started)
- [Local Developer Setup Guide](docs/architecture/setup.md)
- [Environment Variables](#environment-variables)
- [Production Deployment](#production-deployment)
- [Status Page](#status-page)
- [Roadmap](#roadmap)
- [Community](#community)
- [Contributing](#contributing)
- [License](#license)
- [Monorepo Package Boundaries (ADR)](docs/adr/0001-monorepo-package-boundaries.md)
- [Quick Start Guide](packages/api/QUICK_START_GUIDE.md)
- [API Reference](packages/api/API_REFERENCE.md)
- [API cURL Examples](packages/api/CURL_EXAMPLES.md)
- [Security Policy](packages/api/SECURITY.md)
- [Environment Variables](docs/ENVIRONMENT_VARIABLES.md)
- [User Guide](docs/USER_GUIDE.md)
- [Contract Reference](docs/CONTRACTS.md)
- [Contract Integration Guide](docs/CONTRACT_INTEGRATION.md)
- [Contributing Guide](CONTRIBUTING.md)
- [Error Handling & Logging Conventions](docs/ERROR_HANDLING_AND_LOGGING.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Frontend Contributing Guide](packages/app/CONTRIBUTING.md)
- [i18n & Translation Guide](docs/i18n-translations.md)
- [Stellar Wallet Integration Guide](docs/stellar-wallet-integration.md)
- [Mainnet Launch Checklist](docs/MAINNET_LAUNCH_CHECKLIST.md)

---

## Overview

| Feature                | Description                                                                       |
| ---------------------- | --------------------------------------------------------------------------------- |
| Decentralised listings | Worker profiles are anchored on-chain via Stellar Soroban smart contracts         |
| Community curation     | Curators (verified community members) create and manage worker listings           |
| Trustless payments     | Tips and payments flow directly between users and workers via the Market contract |
| Google OAuth           | Users can sign in with Google in addition to email/password                       |
| Role-based access      | Three roles: `user`, `curator`, `admin`                                           |
| Media uploads          | Profile images handled with method-spoofed PUT requests (multipart/form-data)     |

---

## Architecture

![BlueCollar Architecture](docs/architecture/system-overview.svg)

```
User / Browser
      │
      ├────────────────────────────────────────────────────┐
      ▼                                                     ▼
 [Next.js App]  ──────────────────────────────┐   [Stellar Network]
      │                                        │         │
      ▼                                        ▼         ▼
 [BlueCollar API]  (Node.js / Express / TS)    │  [Soroban Smart Contracts]
      │                                        │   ├── Registry
      ▼                                        │   ├── Market (Escrow)
 [PostgreSQL via Prisma]                       │   ├── Dispute
                                               │   ├── FeeDistribution
                                               │   └── InsurancePool
                                               ▼
                                      [Freighter Wallet]
                                        (signing path)
```

- The **API** handles authentication, category management, and worker CRUD. It stores data in PostgreSQL via Prisma ORM.
- **Registry Contract** (Rust/Soroban) — anchors worker registrations, reputation, staking, and category verification on-chain.
- **Market Contract** (Rust/Soroban) — handles tips, escrow payments, multi-sig escrows, and arbitration.
- **Dispute Contract** (Rust/Soroban) — file disputes, submit evidence, and resolve through arbitration.
- **FeeDistribution Contract** (Rust/Soroban) — collects and distributes protocol fees to configured recipients.
- **InsurancePool Contract** (Rust/Soroban) — manages contribution pool, claims filing, and payout.
- The **App** is a Next.js frontend that consumes the API and interacts with Stellar wallets (Freighter) for on-chain signing.

For detailed contract signatures, storage maps, and events, see [docs/CONTRACTS.md](./docs/CONTRACTS.md).

Diagram maintenance note: update `docs/architecture/system-overview.svg` whenever major architectural relationships, contracts, or data flows change. The SVG is the canonical source; it can be edited in any SVG editor or imported into diagrams.net.

---

## Monorepo Structure

```
bluecollar/
├── packages/
│   ├── api/                  # Node.js/Express backend API (TypeScript)
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   ├── src/
│   │   │   ├── controllers/  # Route handlers
│   │   │   ├── middleware/   # Auth, validation
│   │   │   ├── routes/       # Express routers
│   │   │   ├── services/     # Business logic
│   │   │   ├── models/       # Type definitions
│   │   │   ├── mailer/       # Email templates & transport
│   │   │   ├── database/     # Seed scripts
│   │   │   ├── utils/        # Helpers
│   │   │   ├── db.ts         # Prisma client singleton
│   │   │   └── index.ts      # App entry point
│   │   ├── .env.example
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── contracts/            # Stellar Soroban smart contracts (Rust)
│   │   ├── contracts/
│   │   │   ├── registry/     # Worker registry contract
│   │   │   │   └── src/lib.rs
│   │   │   └── market/       # Tip/payment contract
│   │   │       └── src/lib.rs
│   │   └── Cargo.toml
│   │
│   ├── app/                  # Next.js frontend
│   │   ├── src/
│   │   └── package.json
│   │
│   └── mobile/               # React Native mobile app (Expo)
│       ├── src/
│       │   ├── auth/         # SecureStorage & BiometricAuth
│       │   ├── screens/      # App screens
│       │   └── context/      # React context providers
│       ├── docs/
│       └── package.json
│
├── package.json              # Root workspace config
├── pnpm-workspace.yaml
└── README.md
```

For the rationale behind this split — what each package is for, which packages are
allowed to depend on which, and a dependency graph — see
[docs/adr/0001-monorepo-package-boundaries.md](docs/adr/0001-monorepo-package-boundaries.md).

---

## Packages

### API (`packages/api`)

The backend REST API built with **Node.js**, **Express**, and **TypeScript**. Uses **Prisma** as the ORM against a PostgreSQL database.

**Key modules:**

| Module                      | Purpose                                       |
| --------------------------- | --------------------------------------------- |
| `controllers/auth.ts`       | Login, register, logout, password reset       |
| `controllers/workers.ts`    | CRUD for worker listings                      |
| `controllers/categories.ts` | Category listing and lookup                   |
| `middleware/auth.ts`        | JWT authentication + role-based authorization |
| `prisma/schema.prisma`      | Database schema (User, Worker, Category)      |

**Tech stack:** Express · TypeScript · Prisma · PostgreSQL · Argon2 · JWT · Passport (Google OAuth) · Nodemailer · Vitest

---

### Contracts (`packages/contracts`)

Stellar **Soroban** smart contracts written in **Rust**.

Five contracts are deployed across the protocol:

| Contract | Location | Purpose |
|---|---|---|
| **Registry** | `contracts/registry/` | Worker registration, reputation, staking, categories, badges |
| **Market** | `contracts/market/` | Tips, escrow, multi-sig payments, arbitration |
| **Dispute** | `contracts/dispute/` | Dispute filing, evidence, arbitrator resolution |
| **FeeDistribution** | `contracts/fee_distribution/` | Fee collection, multi-recipient splits |
| **InsurancePool** | `contracts/insurance_pool/` | Contribution pool, claims management |

All contracts are compiled to WASM and deployed to the Stellar network (testnet / mainnet).

For complete function signatures, storage maps, event catalogues, and authorization rules, see [docs/CONTRACTS.md](./docs/CONTRACTS.md).

---

### App (`packages/app`)

Next.js 14 frontend. Connects to the BlueCollar API and integrates with Stellar wallets (Freighter) for on-chain interactions.

---

### Mobile (`packages/mobile`)

React Native mobile app built with **Expo**. Features secure authentication with hardware-backed token storage and biometric unlock.

**Key modules:**

| Module | Purpose |
|--------|---------|
| `auth/SecureStorage.ts` | Hardware-backed token storage (Keychain/Keystore) |
| `auth/BiometricAuth.ts` | Biometric authentication (Face ID, Touch ID, Fingerprint) |
| `context/AuthContext.tsx` | Authentication state management |
| `screens/BiometricSettingsScreen.tsx` | Biometric unlock settings |
| `screens/AppLockScreen.tsx` | Biometric unlock prompt |

**Tech stack:** React Native · Expo · expo-secure-store · expo-local-authentication

**Documentation:** See [packages/mobile/docs/AUTHENTICATION.md](./packages/mobile/docs/AUTHENTICATION.md)

---

## API Reference

Base URL: `http://localhost:3000/api`

### Auth

| Method   | Endpoint                | Description                  |
| -------- | ----------------------- | ---------------------------- |
| `POST`   | `/auth/login`           | Login with email + password  |
| `POST`   | `/auth/register`        | Create a new account         |
| `PUT`    | `/auth/verify-account`  | Verify email address         |
| `DELETE` | `/auth/logout`          | Logout (requires auth)       |
| `POST`   | `/auth/forgot-password` | Request password reset email |
| `PUT`    | `/auth/reset-password`  | Reset password with token    |
| `GET`    | `/auth/google`          | Initiate Google OAuth        |
| `GET`    | `/auth/google/callback` | Google OAuth callback        |

**Login response example:**

```json
{
  "data": {
    "id": "clxyz...",
    "email": "user@example.com",
    "firstName": "Jane",
    "lastName": "Doe",
    "role": "user",
    "verified": true
  },
  "status": "success",
  "message": "Login successful",
  "code": 202,
  "token": "<jwt>"
}
```

### Categories

| Method | Endpoint          | Description           |
| ------ | ----------------- | --------------------- |
| `GET`  | `/categories`     | List all categories   |
| `GET`  | `/categories/:id` | Get a single category |

### Workers (Curator)

| Method   | Endpoint                              | Description                            | Auth    |
| -------- | ------------------------------------- | -------------------------------------- | ------- |
| `GET`    | `/workers`                            | List active workers (paginated)        | Public  |
| `GET`    | `/workers/:id`                        | Get a single worker                    | Public  |
| `POST`   | `/workers`                            | Create a worker listing                | Curator |
| `POST`   | `/workers/:id` + `X-HTTP-Method: PUT` | Update a worker (supports file upload) | Curator |
| `DELETE` | `/workers/:id`                        | Delete a worker                        | Curator |
| `PATCH`  | `/workers/:id/toggle`                 | Toggle active status                   | Curator |

> **Method spoofing for file uploads:** HTML forms and `multipart/form-data` requests only support `GET`/`POST`. To update a worker with a file upload, send a `POST` request with the header `X-HTTP-Method: PUT`. The API uses the [`method-override`](https://www.npmjs.com/package/method-override) middleware to rewrite the request method to `PUT` before it reaches the route handler, so the update route behaves identically to a standard `PUT`.
>
> ```
> POST /api/workers/:id
> Content-Type: multipart/form-data
> X-HTTP-Method: PUT
> ```
>
> See [API_REFERENCE.md](packages/api/API_REFERENCE.md#the-x-http-method-override-pattern) for a detailed explanation of the method-override pattern, including client implementation examples.

### Admin

Admin endpoints mirror the Curator endpoints but are scoped to the `admin` role and include bulk operations.

---

## Smart Contracts

For the full contract reference including signatures, storage maps, events, and authorization rules, see [docs/CONTRACTS.md](./docs/CONTRACTS.md). The summary below covers build, deploy, and common operations.

### Prerequisites

- [Rust](https://rustup.rs/) with `wasm32v1-none` target
- [Stellar CLI](https://developers.stellar.org/docs/tools/developer-tools/cli/stellar-cli)

```bash
rustup target add wasm32v1-none
cargo install --locked stellar-cli
```

### Build

```bash
cd packages/contracts
cargo build --release --target wasm32v1-none
```

### Deploy to Testnet

```bash
stellar contract deploy \
  --wasm target/wasm32v1-none/release/bluecollar_registry.wasm \
  --source <your-secret-key> \
  --network testnet
```

### Upgrading a Contract

To upgrade a deployed contract without redeploying (preserving its contract ID and storage):

1. Build the new WASM and install it on-chain to get its hash:

```bash
stellar contract install \
  --wasm target/wasm32v1-none/release/bluecollar_registry.wasm \
  --source <your-secret-key> \
  --network testnet
# outputs: <new_wasm_hash>
```

2. Invoke the `upgrade` function with the admin address:

```bash
stellar contract invoke \
  --id <contract-id> \
  --source <admin-secret-key> \
  --network testnet \
  -- upgrade \
  --admin <admin-address> \
  --new_wasm_hash <new_wasm_hash>
```

The same steps apply to the Market contract. The `admin` argument must match the signing key (`--source`), as `require_auth()` is enforced on-chain.

### Storage TTL Strategy

Soroban persistent storage entries have a TTL (time-to-live) measured in ledgers. Without extension, entries can expire and be pruned from the ledger.

| Constant        | Value           | Approximate duration   |
| --------------- | --------------- | ---------------------- |
| `TTL_EXTEND_TO` | 535,000 ledgers | ~1 year (at 5s/ledger) |
| `TTL_THRESHOLD` | 267,500 ledgers | ~6 months              |

**How it works:**

- Every write to persistent storage (`register`, `toggle`) automatically calls `extend_ttl` on the affected key.
- `extend_ttl(key, threshold, extend_to)` only extends if the current TTL is below `threshold`, avoiding unnecessary fees.
- A public `extend_worker_ttl(id)` function is available so anyone (users, bots, the app) can refresh a worker entry's TTL without needing special permissions.

```bash
# Extend a worker's TTL via CLI
stellar contract invoke \
  --id <contract-id> \
  --source <any-account> \
  --network testnet \
  -- extend_worker_ttl \
  --id <worker-id>
```

---

## Docker

The quickest way to run the API and database locally is with Docker Compose.

```bash
# Copy and fill in the API env file first
cp packages/api/.env.example packages/api/.env

# Start API + PostgreSQL + Adminer
pnpm docker:up

# Stop and remove containers
pnpm docker:down
```

| Service         | URL                   |
| --------------- | --------------------- |
| API             | http://localhost:3000 |
| Adminer (DB UI) | http://localhost:8080 |
| PostgreSQL      | localhost:5432        |

> The API container runs `prisma migrate deploy` automatically on startup.

---

## Getting Started

> This section is a quick-start for `api` + `app` only. For the authoritative guide covering
> every package — `api`, `app`, `contracts`, `sdk`, `mobile`, `monitoring`, `types` —
> plus environment variables, database, and local Soroban/Stellar network setup, see the
> **[Local Developer Setup Guide](docs/architecture/setup.md)**.

### Prerequisites

- Node.js >= 20
- pnpm >= 9
- PostgreSQL
- Rust (for contracts)

### Install

```bash
git clone https://github.com/Fidelis900/Blue-Collar.git
cd Blue-Collar
pnpm install
```

### Run the API

```bash
cp packages/api/.env.example packages/api/.env
# fill in DATABASE_URL and JWT_SECRET

cd packages/api
pnpm migrate       # run prisma migrations
pnpm seed          # seed categories
pnpm dev           # start dev server on :3000
```

### Run the App

```bash
cd packages/app
pnpm dev           # start Next.js on :3001
```

---

## Environment Variables

All variables for the API live in `packages/api/.env` (copy from `.env.example`):

| Variable               | Description                            |
| ---------------------- | -------------------------------------- |
| `DATABASE_URL`         | PostgreSQL connection string           |
| `JWT_SECRET`           | Secret key for signing JWTs            |
| `PORT`                 | API port (default: 3000)               |
| `GOOGLE_CLIENT_ID`     | Google OAuth client ID                 |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret             |
| `MAIL_HOST`            | SMTP host                              |
| `MAIL_PORT`            | SMTP port                              |
| `MAIL_USER`            | SMTP username                          |
| `MAIL_PASS`            | SMTP password                          |
| `APP_URL`              | Public URL of the app (used in emails) |

---

## Production Deployment

Use the production runbook in [docs/PRODUCTION_DEPLOYMENT.md](./docs/PRODUCTION_DEPLOYMENT.md) for:

- API/app/database environment setup
- Docker production examples
- SSL/TLS reverse-proxy setup
- Monitoring and logging recommendations
- Backup and disaster recovery procedures

---

## Roadmap

| Status         | Feature                                             |
| -------------- | --------------------------------------------------- |
| ✅ Done        | Worker CRUD with curator-gated listings             |
| ✅ Done        | JWT auth + email verification + password reset      |
| ✅ Done        | Google OAuth 2.0                                    |
| ✅ Done        | Registry & Market Soroban contracts (testnet)       |
| ✅ Done        | Escrow payments with time-locked cancellation       |
| ✅ Done        | Role-based access (user / curator / admin)          |
| ✅ Done        | Profile image uploads (Multer + Sharp)              |
| 🔄 In progress | Next.js frontend (worker discovery, wallet connect) |
| 🔄 In progress | Freighter wallet integration                        |
| 📋 Planned     | Mainnet deployment                                  |
| 📋 Planned     | Worker reviews & ratings                            |
| 📋 Planned     | Push notifications                                  |
| 📋 Planned     | Mobile app (React Native)                           |

---

## Status Page

Check service health and uptime status at [status.bluecollar.app](https://status.bluecollar.app)

We monitor critical endpoints every 60 seconds:
- API health check (`/health`)
- API readiness check (`/ready`)
- Frontend application

## Community

Join the conversation and stay up to date:

- **Telegram:** [t.me/bluecollar](https://t.me/bluecollar)
- **GitHub Discussions:** [github.com/Fidelis900/Blue-Collar/discussions](https://github.com/Fidelis900/Blue-Collar/discussions)
- **Issues:** [github.com/Fidelis900/Blue-Collar/issues](https://github.com/Fidelis900/Blue-Collar/issues)

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full guide, including commit message conventions and PR process.

1. Check the open issues for something to work on
2. Fork the repo and create a feature branch
3. Make your changes and open a pull request using the [PR template](.github/pull_request_template.md)

All PRs require passing CI checks.

### Contribution Areas

| Area | Guide |
|---|---|
| Code (API, App, Contracts) | [CONTRIBUTING.md](./CONTRIBUTING.md) |
| First contribution walkthrough | [docs/CONTRIBUTING_GUIDE.md](./docs/CONTRIBUTING_GUIDE.md) |
| Translations & localization | [docs/i18n-translations.md](./docs/i18n-translations.md) |
| Stellar wallet integration | [docs/stellar-wallet-integration.md](./docs/stellar-wallet-integration.md) |

---

## License

MIT © BlueCollar Contributors
