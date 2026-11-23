# BlueCollar API — Quick Start Guide

Get the API running locally in under 5 minutes (assuming prerequisites are installed).

---

## Prerequisites

- **Node.js** >= 20
- **pnpm** >= 9 (`npm i -g pnpm@9`)
- **PostgreSQL** running locally (or a connection string to a remote instance)
- **Redis** running locally (API degrades gracefully if absent)

---

## 1. Clone & Install

```bash
git clone https://github.com/Fidelis900/Blue-Collar.git
cd Blue-Collar
pnpm install
```

---

## 2. Set Up Environment Variables

```bash
cp packages/api/.env.example packages/api/.env
```

Open `packages/api/.env` and fill in the required values:

| Variable               | Example                                                 | Required?               |
| ---------------------- | ------------------------------------------------------- | ----------------------- |
| `DATABASE_URL`         | `postgresql://user:pass@localhost:5432/bluecollar`      | Yes                     |
| `TEST_DATABASE_URL`    | `postgresql://user:pass@localhost:5432/bluecollar_test` | For tests               |
| `JWT_SECRET`           | `openssl rand -hex 32` output                           | Yes                     |
| `APP_URL`              | `http://localhost:3001`                                 | Yes                     |
| `ALLOWED_ORIGINS`      | `http://localhost:3001`                                 | Yes                     |
| `GOOGLE_CLIENT_ID`     | `placeholder`                                           | Yes (must be non-empty) |
| `GOOGLE_CLIENT_SECRET` | `placeholder`                                           | Yes (must be non-empty) |
| `MAIL_HOST`            | `localhost`                                             | Yes (must be non-empty) |
| `MAIL_USER`            | `dev@localhost`                                         | Yes (must be non-empty) |
| `MAIL_PASS`            | `dev`                                                   | Yes (must be non-empty) |

The config module validates these at startup. Set Google OAuth and SMTP vars to placeholder values for local development — features that depend on real credentials will gracefully no-op.

All other variables (`REDIS_URL`, `PORT`, Stellar contract IDs, VAPID keys) are optional and fall back to sensible defaults.

Create the databases (if they don't exist yet):

```bash
createdb bluecollar
createdb bluecollar_test
```

---

## 3. Generate Prisma Client & Run Migrations

```bash
cd packages/api
pnpm prisma:generate
pnpm migrate
```

This generates the Prisma client from the schema and applies all pending migrations.

---

## 4. Seed the Database

```bash
pnpm seed
```

Populates the database with default categories.

---

## 5. Start the Dev Server

```bash
pnpm dev
```

The API will be available at `http://localhost:3000`.

---

## 6. Verify It Works

```bash
# Health check
curl http://localhost:3000/health

# Readiness check (DB + Redis)
curl http://localhost:3000/ready

# List categories
curl http://localhost:3000/api/categories
```

---

## Create an Admin User (Optional)

```bash
pnpm admin:create --email admin@example.com --password secret123 --firstName Jane --lastName Doe
```

---

## Troubleshooting

**PostgreSQL connection error (`P1001: Can't reach database server`)**

- Ensure PostgreSQL is running: `pg_isready` or `sudo service postgresql start`
- Double-check `DATABASE_URL` in your `.env` — username, password, host, port, and database name must all be correct
- Make sure the database exists: `createdb bluecollar`

**`prisma migrate dev` fails with "database does not exist"**

- Create the database first: `createdb bluecollar`

**Config validation errors on startup**

- Ensure **all** required vars in the table above are set — the config module will crash on missing `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `MAIL_HOST`, `MAIL_USER`, `MAIL_PASS`, `APP_URL`, `DATABASE_URL`, or `JWT_SECRET`

**`pnpm: command not found`**

- Install pnpm globally: `npm i -g pnpm@9`

**Port 3000 already in use**

- Set a different port in `.env`: `PORT=3001`
- Or kill the process using the port: `lsof -ti:3000 | xargs kill`

**Redis not available (non-fatal)**

- The API logs a warning and disables caching / per-user rate limiting. Everything else works.

---

## CI Status

![API Tests](https://github.com/Fidelis900/Blue-Collar/actions/workflows/api-tests.yml/badge.svg)
