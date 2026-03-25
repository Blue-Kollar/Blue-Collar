# BlueCollar API — Quick Start Guide

Get the API running locally in under 5 minutes.

---

## Prerequisites

- **Node.js** >= 20
- **pnpm** >= 9 (`npm i -g pnpm`)
- **PostgreSQL** running locally (or a connection string to a remote instance)

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

| Variable | Example |
|---|---|
| `DATABASE_URL` | `postgresql://user:pass@localhost:5432/bluecollar` |
| `JWT_SECRET` | any long random string |
| `PORT` | `3000` |

All other variables (Google OAuth, SMTP) are optional for local development.

---

## 3. Run Migrations

```bash
cd packages/api
pnpm migrate
```

This runs `prisma migrate dev` and applies all schema migrations to your database.

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

The API will be available at `http://localhost:3000/api`.

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
- Create the database first: `createdb bluecollar` (or the name in your `DATABASE_URL`)

**Missing environment variable errors on startup**
- Confirm `packages/api/.env` exists and is not empty
- Ensure you copied from `.env.example`: `cp .env.example .env`

**`pnpm: command not found`**
- Install pnpm globally: `npm i -g pnpm`

**Port 3000 already in use**
- Set a different port in `.env`: `PORT=3001`
- Or kill the process using the port: `lsof -ti:3000 | xargs kill`
