# BlueCollar

> Find Skilled Workers Near You

BlueCollar is a **decentralised protocol built on [Stellar](https://stellar.org)** that connects local skilled workers (plumbers, electricians, carpenters, welders, and more) with users through community-curated listings. The platform creates a trustless ecosystem where workers can be discovered, verified, and compensated securely — without relying on centralised intermediaries.

Many skilled workers lack a platform to help them get noticed. Meanwhile, countless people need quality recommendations for reliable tradespeople. BlueCollar is the bridge connecting both worlds.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Monorepo Structure](#monorepo-structure)
- [Packages](#packages)
  - [API](#api-packagesapi)
  - [Contracts](#contracts-packagescontracts)
  - [App](#app-packagesapp)
- [API Reference](#api-reference)
- [Smart Contracts](#smart-contracts)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Contributing](#contributing)
- [License](#license)
- [Quick Start Guide](packages/api/QUICK_START_GUIDE.md)
- [API Documentation](packages/api/DOCUMENTATION.json)

---

## Overview

| Feature | Description |
|---|---|
| Decentralised listings | Worker profiles are anchored on-chain via Stellar Soroban smart contracts |
| Community curation | Curators (verified community members) create and manage worker listings |
| Trustless payments | Tips and payments flow directly between users and workers via the Market contract |
| Google OAuth | Users can sign in with Google in addition to email/password |
| Role-based access | Three roles: `user`, `curator`, `admin` |
| Media uploads | Profile images handled with method-spoofed PUT requests (multipart/form-data) |

---

## Architecture

```
User / Browser
      │
      ▼
 [Next.js App]  ──────────────────────────────────────────────────────────┐
      │                                                                    │
      ▼                                                                    ▼
 [BlueCollar API]  (Node.js / Express / TypeScript)          [Stellar Network]
      │                                                                    │
      ▼                                                                    ▼
 [PostgreSQL via Prisma]                              [Soroban Smart Contracts]
                                                       ├── Registry Contract
                                                       └── Market Contract
```

- The **API** handles authentication, category management, and worker CRUD. It stores data in PostgreSQL via Prisma ORM.
- The **Registry Contract** (Rust/Soroban) anchors worker registrations on the Stellar blockchain, providing immutable proof of listing.
- The **Market Contract** (Rust/Soroban) handles on-chain tip/payment transfers between users and workers using Stellar tokens (XLM or custom assets).
- The **App** is a Next.js frontend that consumes the API and interacts with Stellar wallets (Freighter, etc.).

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
│   └── app/                  # Next.js frontend
│       ├── src/
│       └── package.json
│
├── package.json              # Root workspace config
├── pnpm-workspace.yaml
└── README.md
```

---

## Packages

### API (`packages/api`)

The backend REST API built with **Node.js**, **Express**, and **TypeScript**. Uses **Prisma** as the ORM against a PostgreSQL database.

**Key modules:**

| Module | Purpose |
|---|---|
| `controllers/auth.ts` | Login, register, logout, password reset |
| `controllers/workers.ts` | CRUD for worker listings |
| `controllers/categories.ts` | Category listing and lookup |
| `middleware/auth.ts` | JWT authentication + role-based authorization |
| `prisma/schema.prisma` | Database schema (User, Worker, Category) |

**Tech stack:** Express · TypeScript · Prisma · PostgreSQL · Argon2 · JWT · Passport (Google OAuth) · Nodemailer · Vitest

---

### Contracts (`packages/contracts`)

Stellar **Soroban** smart contracts written in **Rust**.

#### Registry Contract

Manages on-chain worker registrations. Workers are stored in persistent contract storage keyed by a unique `Symbol` id.

```
register(id, owner, name, category)  → stores Worker on-chain
get_worker(id)                        → returns Worker struct
toggle(id, caller)                    → flips is_active (owner only)
list_workers()                        → returns all worker ids
```

#### Market Contract

Handles direct token transfers (tips/payments) between users and workers.

```
tip(from, to, token_addr, amount)  → transfers Stellar tokens from user to worker
```

Both contracts are compiled to WASM and deployed to the Stellar network (testnet / mainnet).

---

### App (`packages/app`)

Next.js 14 frontend. Connects to the BlueCollar API and integrates with Stellar wallets (Freighter) for on-chain interactions.

---

## API Reference

Base URL: `http://localhost:3000/api`

### Auth

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/auth/login` | Login with email + password |
| `POST` | `/auth/register` | Create a new account |
| `PUT` | `/auth/verify-account` | Verify email address |
| `DELETE` | `/auth/logout` | Logout (requires auth) |
| `POST` | `/auth/forgot-password` | Request password reset email |
| `PUT` | `/auth/reset-password` | Reset password with token |
| `GET` | `/auth/google` | Initiate Google OAuth |
| `GET` | `/auth/google/callback` | Google OAuth callback |

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

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/categories` | List all categories |
| `GET` | `/categories/:id` | Get a single category |

### Workers (Curator)

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/workers` | List active workers (paginated) | Public |
| `GET` | `/workers/:id` | Get a single worker | Public |
| `POST` | `/workers` | Create a worker listing | Curator |
| `POST` | `/workers/:id` + `X-HTTP-Method: PUT` | Update a worker (supports file upload) | Curator |
| `DELETE` | `/workers/:id` | Delete a worker | Curator |
| `PATCH` | `/workers/:id/toggle` | Toggle active status | Curator |

> **Note on file uploads:** Use `POST` with the `X-HTTP-Method: PUT` header to update resources that include file uploads (e.g. profile images). Standard `PUT` does not support `multipart/form-data`.

### Admin

Admin endpoints mirror the Curator endpoints but are scoped to the `admin` role and include bulk operations.

---

## Smart Contracts

### Prerequisites

- [Rust](https://rustup.rs/) with `wasm32-unknown-unknown` target
- [Stellar CLI](https://developers.stellar.org/docs/tools/developer-tools/cli/stellar-cli)

```bash
rustup target add wasm32-unknown-unknown
cargo install --locked stellar-cli
```

### Build

```bash
cd packages/contracts
cargo build --release --target wasm32-unknown-unknown
```

### Deploy to Testnet

```bash
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/bluecollar_registry.wasm \
  --source <your-secret-key> \
  --network testnet
```

---

## Getting Started

### Prerequisites

- Node.js >= 20
- pnpm >= 9
- PostgreSQL
- Rust (for contracts)

### Install

```bash
git clone https://github.com/your-org/bluecollar.git
cd bluecollar
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

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret key for signing JWTs |
| `PORT` | API port (default: 3000) |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `MAIL_HOST` | SMTP host |
| `MAIL_PORT` | SMTP port |
| `MAIL_USER` | SMTP username |
| `MAIL_PASS` | SMTP password |
| `APP_URL` | Public URL of the app (used in emails) |

---

## Contributing

1. Check the open issues for something to work on
2. Fork the repo and create a feature branch
3. Make your changes and open a pull request

Please follow the existing code style. All PRs require passing CI checks.

---

## License

MIT © BlueCollar Contributors
