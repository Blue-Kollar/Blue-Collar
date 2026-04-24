# BlueCollar API

REST API for the BlueCollar platform — connecting skilled workers with users via a decentralised Stellar-backed protocol.

- [Quick Start Guide](./QUICK_START_GUIDE.md)
- [Full API Documentation](./DOCUMENTATION.json)
- [cURL Examples](./CURL_EXAMPLES.md)
- [Security Policy](./SECURITY.md)

---

## Tech Stack

| Layer        | Technology                                 |
| ------------ | ------------------------------------------ |
| Runtime      | Node.js >= 20                              |
| Framework    | Express 4                                  |
| Language     | TypeScript 5                               |
| ORM          | Prisma 7 (PostgreSQL)                      |
| Auth         | JWT · Argon2 · Passport (Google OAuth 2.0) |
| File uploads | Multer · Sharp (image processing)          |
| Email        | Nodemailer (SMTP)                          |
| Testing      | Vitest · Supertest                         |
| Logging      | Pino                                       |

---

## Project Structure

```
packages/api/
├── prisma/
│   ├── schema.prisma          # Database schema (User, Worker, Category, Location)
│   └── migrations/
├── src/
│   ├── config/                # CORS, env validation, logger, Passport, rate limiter
│   ├── controllers/           # Route handlers (auth, workers, categories, admin)
│   ├── database/              # Seed script
│   ├── interfaces/            # TypeScript interfaces
│   ├── mailer/                # Email templates & Nodemailer transport
│   ├── middleware/            # auth, validate, upload, errorHandler
│   ├── models/                # Shared type definitions
│   ├── resources/             # Response serialisers
│   ├── routes/                # Express routers
│   ├── services/              # Business logic (auth, worker, category, payment)
│   ├── utils/                 # catchAsync, AppError, paginate, imageProcessor
│   ├── app.ts                 # Express app setup
│   ├── db.ts                  # Prisma client singleton
│   └── index.ts               # Server entry point
├── .env.example
├── package.json
└── tsconfig.json
```

---

## Development Setup

```bash
# 1. Install dependencies (from repo root)
pnpm install

# 2. Copy and fill in environment variables
cp packages/api/.env.example packages/api/.env

# 3. Run database migrations
cd packages/api
pnpm migrate

# 4. Seed categories
pnpm seed

# 5. Start dev server (http://localhost:3000)
pnpm dev
```

See [QUICK_START_GUIDE.md](./QUICK_START_GUIDE.md) for detailed troubleshooting.

### Useful Scripts

| Script               | Description                    |
| -------------------- | ------------------------------ |
| `pnpm dev`           | Start dev server with `tsx`    |
| `pnpm build`         | Compile TypeScript to `dist/`  |
| `pnpm test`          | Run tests with Vitest          |
| `pnpm test:coverage` | Run tests with coverage report |
| `pnpm migrate`       | Run Prisma migrations          |
| `pnpm seed`          | Seed default categories        |
| `pnpm admin:create`  | Create an admin user via CLI   |
| `pnpm db:reset`      | Reset the database (dev only)  |

---

## Environment Variables

| Variable               | Required | Description                                       |
| ---------------------- | -------- | ------------------------------------------------- |
| `DATABASE_URL`         | ✅       | PostgreSQL connection string                      |
| `TEST_DATABASE_URL`    | ✅       | Separate DB for tests                             |
| `JWT_SECRET`           | ✅       | Secret for signing JWTs                           |
| `PORT`                 | —        | Server port (default: `3000`)                     |
| `APP_URL`              | —        | Frontend base URL (OAuth redirects, emails, CORS) |
| `ALLOWED_ORIGINS`      | —        | Comma-separated CORS origins                      |
| `GOOGLE_CLIENT_ID`     | —        | Google OAuth 2.0 client ID                        |
| `GOOGLE_CLIENT_SECRET` | —        | Google OAuth 2.0 client secret                    |
| `MAIL_HOST`            | —        | SMTP host                                         |
| `MAIL_PORT`            | —        | SMTP port (typically `587`)                       |
| `MAIL_USER`            | —        | SMTP username                                     |
| `MAIL_PASS`            | —        | SMTP password                                     |

---

## API Reference

Base URL: `http://localhost:3000/api`

All authenticated endpoints require the header:

```
Authorization: Bearer <jwt>
```

Standard success envelope:

```json
{
  "status": "success",
  "message": "...",
  "code": 200,
  "data": { ... }
}
```

---

### Auth

#### `POST /auth/register`

Create a new user account. Sends a verification email.

**Body:**

```json
{
  "firstName": "Jane",
  "lastName": "Doe",
  "email": "jane@example.com",
  "password": "secret123"
}
```

**Response `201`:**

```json
{
  "status": "success",
  "message": "Registration successful. Please verify your email.",
  "code": 201,
  "data": { "id": "clxyz...", "email": "jane@example.com", "role": "user" }
}
```

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Jane","lastName":"Doe","email":"jane@example.com","password":"secret123"}'
```

---

#### `POST /auth/login`

Login with email and password.

**Body:**

```json
{ "email": "jane@example.com", "password": "secret123" }
```

**Response `202`:**

```json
{
  "status": "success",
  "message": "Login successful",
  "code": 202,
  "data": { "id": "clxyz...", "email": "jane@example.com", "role": "user", "verified": true },
  "token": "<jwt>"
}
```

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"jane@example.com","password":"secret123"}'
```

---

#### `DELETE /auth/logout`

Stateless logout — client should discard the JWT. Requires auth.

```bash
curl -X DELETE http://localhost:3000/api/auth/logout \
  -H "Authorization: Bearer <jwt>"
```

---

#### `GET /auth/me`

Returns the currently authenticated user's profile. Requires auth.

```bash
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer <jwt>"
```

---

#### `PUT /auth/verify-account`

Verify email address using the token sent in the verification email.

**Body:**

```json
{ "token": "<verification-token>" }
```

```bash
curl -X PUT http://localhost:3000/api/auth/verify-account \
  -H "Content-Type: application/json" \
  -d '{"token":"<verification-token>"}'
```

---

#### `POST /auth/forgot-password`

Request a password reset email. Always returns `200` to prevent email enumeration.

**Body:**

```json
{ "email": "jane@example.com" }
```

```bash
curl -X POST http://localhost:3000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"jane@example.com"}'
```

---

#### `PUT /auth/reset-password`

Reset password using the token from the reset email.

**Body:**

```json
{ "token": "<reset-token>", "password": "newpassword123" }
```

```bash
curl -X PUT http://localhost:3000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{"token":"<reset-token>","password":"newpassword123"}'
```

---

#### `GET /auth/google`

Initiates the Google OAuth 2.0 flow. Redirects to Google's consent screen.

#### `GET /auth/google/callback`

Google redirects here after the user grants access. Issues a JWT and redirects to the frontend.

---

### Categories

#### `GET /categories`

List all categories.

**Response `200`:**

```json
{
  "status": "success",
  "data": [{ "id": "clxyz...", "name": "Plumbing", "description": "...", "icon": "🔧" }]
}
```

```bash
curl http://localhost:3000/api/categories
```

---

#### `GET /categories/:id`

Get a single category by ID.

```bash
curl http://localhost:3000/api/categories/clxyz123
```

---

### Workers

#### `GET /workers`

List active workers (paginated). Public.

**Query params:** `page` (default: 1), `limit` (default: 10), `category`

```bash
curl "http://localhost:3000/api/workers?page=1&limit=10"
curl "http://localhost:3000/api/workers?category=clxyz123"
```

---

#### `GET /workers/:id`

Get a single worker by ID. Public.

```bash
curl http://localhost:3000/api/workers/clxyz123
```

---

#### `GET /workers/mine`

List workers created by the authenticated curator. Requires `curator` or `admin` role.

```bash
curl http://localhost:3000/api/workers/mine \
  -H "Authorization: Bearer <jwt>"
```

---

#### `POST /workers`

Create a worker listing. Requires `curator` role.

**Body (`application/json`):**

```json
{
  "name": "John Smith",
  "bio": "10 years experience",
  "phone": "+447911123456",
  "email": "john@example.com",
  "walletAddress": "GXXXXXXX...",
  "categoryId": "clxyz123"
}
```

```bash
curl -X POST http://localhost:3000/api/workers \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"name":"John Smith","categoryId":"clxyz123"}'
```

---

#### `PUT /workers/:id`

Update a worker listing. Requires `curator` role.

For updates **with a file upload** (profile image), use method spoofing:

```bash
# JSON update
curl -X PUT http://localhost:3000/api/workers/clxyz123 \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"name":"John Smith Updated"}'

# With file upload (method spoofing via POST)
curl -X POST http://localhost:3000/api/workers/clxyz123 \
  -H "Authorization: Bearer <jwt>" \
  -H "X-HTTP-Method: PUT" \
  -F "name=John Smith Updated" \
  -F "avatar=@/path/to/image.jpg"
```

> HTML forms only support GET/POST. Send a `POST` with `X-HTTP-Method: PUT` to upload a file alongside an update. The `method-override` middleware rewrites the method before it reaches the route handler.

---

#### `DELETE /workers/:id`

Delete a worker listing. Requires `curator` role.

```bash
curl -X DELETE http://localhost:3000/api/workers/clxyz123 \
  -H "Authorization: Bearer <jwt>"
```

---

#### `PATCH /workers/:id/toggle`

Toggle a worker's active status. Requires `curator` role.

```bash
curl -X PATCH http://localhost:3000/api/workers/clxyz123/toggle \
  -H "Authorization: Bearer <jwt>"
```

---

### Admin

All admin endpoints require the `admin` role.

#### `GET /admin/workers`

List all workers (including inactive).

```bash
curl http://localhost:3000/api/admin/workers \
  -H "Authorization: Bearer <admin-jwt>"
```

#### `GET /admin/users`

List all users.

```bash
curl http://localhost:3000/api/admin/users \
  -H "Authorization: Bearer <admin-jwt>"
```

---

## Error Codes

| HTTP Status | Meaning                                     |
| ----------- | ------------------------------------------- |
| `400`       | Validation error — check the `errors` field |
| `401`       | Unauthenticated — missing or invalid JWT    |
| `403`       | Forbidden — insufficient role               |
| `404`       | Resource not found                          |
| `409`       | Conflict — e.g. email already registered    |
| `429`       | Rate limit exceeded                         |
| `500`       | Internal server error                       |

Error response shape:

```json
{
  "status": "error",
  "message": "Validation failed",
  "code": 400,
  "errors": { "email": ["The email field is required."] }
}
```

---

## CI

![API Tests](https://github.com/Fidelis900/Blue-Collar/actions/workflows/api-tests.yml/badge.svg)
![CI](https://github.com/Fidelis900/Blue-Collar/actions/workflows/ci.yml/badge.svg)
