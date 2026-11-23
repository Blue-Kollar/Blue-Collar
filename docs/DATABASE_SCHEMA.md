# Database Schema

This document is derived from `packages/api/prisma/schema.prisma` and reflects the current Prisma data model. The ER diagram can be regenerated with `prisma-erd-generator`.

Comprehensive documentation of the BlueCollar Prisma schema, including model descriptions, relationships, indexes, migration strategy, and data retention policies.

---

## Table of Contents

- [ER Diagram](#er-diagram)
- [Models](#models)
  - [User](#user)
  - [Worker](#worker)
  - [Category](#category)
  - [Location](#location)
  - [Bookmark](#bookmark)
  - [Review](#review)
  - [Availability](#availability)
  - [ContactRequest](#contactrequest)
  - [PushSubscription](#pushsubscription)
- [Enums](#enums)
- [Indexes](#indexes)
- [Relationships Summary](#relationships-summary)
- [Migration Strategy](#migration-strategy)
- [Data Retention Policies](#data-retention-policies)

---

## ER Diagram

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│   Location   │         │     User     │         │   Category   │
│──────────────│         │──────────────│         │──────────────│
│ id (PK)      │◄────────│ locationId   │         │ id (PK)      │
│ city         │  0..1   │ id (PK)      │         │ name (UQ)    │
│ state        │         │ email (UQ)   │         │ description  │
│ country      │         │ password     │         │ icon         │
│ lat          │         │ googleId(UQ) │         │ createdAt    │
│ lng          │         │ firstName    │         │ updatedAt    │
└──────────────┘         │ lastName     │         └──────┬───────┘
       ▲                 │ role         │                │
       │                 │ walletAddress│                │ 1
       │                 │ avatar       │                │
       │                 │ bio          │                ▼
       │                 │ phone        │         ┌──────────────┐
       │                 │ verified     │         │    Worker    │
       │                 │ createdAt    │         │──────────────│
       │                 │ updatedAt    │◄────────│ curatorId    │
       │                 └──────┬───────┘  1..*   │ id (PK)      │
       │                        │                 │ name         │
       │                        │ 1               │ bio          │
       │                        │                 │ avatar       │
       └────────────────────────┼─────────────────│ locationId   │
                                │                 │ categoryId   │
                    ┌───────────┼──────────┐      │ walletAddress│
                    │           │          │      │ isActive     │
                    ▼           ▼          ▼      │ isVerified   │
             ┌──────────┐ ┌──────────┐ ┌──────┐  │ stellarId    │
             │ Bookmark │ │  Review  │ │Push  │  │ createdAt    │
             │──────────│ │──────────│ │Sub   │  │ updatedAt    │
             │ id (PK)  │ │ id (PK)  │ │──────│  └──────┬───────┘
             │ userId   │ │ workerId │ │id(PK)│         │
             │ workerId │ │ authorId │ │userId│         │ 1
             │ createdAt│ │ rating   │ │endpt │         │
             │ UQ(u,w)  │ │ comment  │ │auth  │    ┌────┴──────────────┐
             └──────────┘ │ createdAt│ │p256dh│    │                   │
                          │ UQ(a,w)  │ │UQ(u,e│    ▼                   ▼
                          └──────────┘ └──────┘ ┌──────────┐  ┌───────────────┐
                                                 │Availabil.│  │ContactRequest │
                                                 │──────────│  │───────────────│
                                                 │ id (PK)  │  │ id (PK)       │
                                                 │ workerId │  │ workerId      │
                                                 │ dayOfWeek│  │ fromUserId    │
                                                 │ startTime│  │ message       │
                                                 │ endTime  │  │ status        │
                                                 │UQ(w,day) │  │ createdAt     │
                                                 └──────────┘  │ updatedAt     │
                                                               └───────────────┘
```

---

## Models

### User

Represents a registered platform user. Users can have one of three roles: `user`, `curator`, or `admin`.

| Column                    | Type        | Constraints      | Description                                |
| ------------------------- | ----------- | ---------------- | ------------------------------------------ |
| `id`                      | `String`    | PK, CUID         | Auto-generated unique identifier           |
| `email`                   | `String`    | Unique           | User's email address                       |
| `password`                | `String?`   | Nullable         | Argon2id hash; null for OAuth-only users   |
| `googleId`                | `String?`   | Unique, Nullable | Google OAuth subject identifier            |
| `firstName`               | `String`    | Required         | Given name                                 |
| `lastName`                | `String`    | Required         | Family name                                |
| `role`                    | `Role`      | Default: `user`  | Access level (`user`, `curator`, `admin`)  |
| `walletAddress`           | `String?`   | Nullable         | Stellar public key                         |
| `avatar`                  | `String?`   | Nullable         | Path to uploaded profile image             |
| `bio`                     | `String?`   | Nullable         | Short biography                            |
| `phone`                   | `String?`   | Nullable         | Contact phone number                       |
| `verified`                | `Boolean`   | Default: `false` | Whether email has been verified            |
| `verificationToken`       | `String?`   | Nullable         | SHA-256 hash of the email verification JWT |
| `verificationTokenExpiry` | `DateTime?` | Nullable         | Expiry of the verification token (24h)     |
| `resetToken`              | `String?`   | Unique, Nullable | SHA-256 hash of the password reset token   |
| `resetTokenExpiry`        | `DateTime?` | Nullable         | Expiry of the reset token (1h)             |
| `locationId`              | `String?`   | FK → Location    | Optional location reference                |
| `createdAt`               | `DateTime`  | Default: now     | Record creation timestamp                  |
| `updatedAt`               | `DateTime`  | Auto-updated     | Last modification timestamp                |

**Relations:** has many `Worker` (as curator), `Bookmark`, `Review`, `ContactRequest`, `PushSubscription`; belongs to one optional `Location`.

---

### Worker

Represents a skilled worker listing created by a curator. Workers can optionally be anchored on-chain via the Stellar Registry contract.

| Column              | Type       | Constraints      | Description                               |
| ------------------- | ---------- | ---------------- | ----------------------------------------- |
| `id`                | `String`   | PK, CUID         | Auto-generated unique identifier          |
| `name`              | `String`   | Required         | Worker's display name                     |
| `bio`               | `String?`  | Nullable         | Short biography                           |
| `avatar`            | `String?`  | Nullable         | Path to uploaded profile image            |
| `phone`             | `String?`  | Nullable         | Contact phone number                      |
| `email`             | `String?`  | Nullable         | Contact email address                     |
| `walletAddress`     | `String?`  | Nullable         | Stellar public key for receiving payments |
| `isActive`          | `Boolean`  | Default: `true`  | Whether the listing is publicly visible   |
| `isVerified`        | `Boolean`  | Default: `false` | Whether the worker has been verified      |
| `stellarContractId` | `String?`  | Nullable         | On-chain Registry contract worker ID      |
| `categoryId`        | `String`   | FK → Category    | The worker's job category                 |
| `curatorId`         | `String`   | FK → User        | The curator who created this listing      |
| `locationId`        | `String?`  | FK → Location    | Optional location reference               |
| `createdAt`         | `DateTime` | Default: now     | Record creation timestamp                 |
| `updatedAt`         | `DateTime` | Auto-updated     | Last modification timestamp               |

**Relations:** belongs to `Category`, `User` (curator), optional `Location`; has many `Bookmark`, `Review`, `Availability`, `ContactRequest`.

---

### Category

Represents a job category (e.g. Plumbing, Electrical, Carpentry).

| Column        | Type       | Constraints  | Description                      |
| ------------- | ---------- | ------------ | -------------------------------- |
| `id`          | `String`   | PK, CUID     | Auto-generated unique identifier |
| `name`        | `String`   | Unique       | Category name                    |
| `description` | `String?`  | Nullable     | Optional description             |
| `icon`        | `String?`  | Nullable     | Emoji or icon identifier         |
| `createdAt`   | `DateTime` | Default: now | Record creation timestamp        |
| `updatedAt`   | `DateTime` | Auto-updated | Last modification timestamp      |

**Relations:** has many `Worker`.

---

### Location

Represents a geographic location shared by users and workers.

| Column    | Type      | Constraints | Description                      |
| --------- | --------- | ----------- | -------------------------------- |
| `id`      | `String`  | PK, CUID    | Auto-generated unique identifier |
| `city`    | `String`  | Required    | City name                        |
| `state`   | `String?` | Nullable    | State or province                |
| `country` | `String`  | Required    | Country name or ISO code         |
| `lat`     | `Float?`  | Nullable    | Latitude coordinate              |
| `lng`     | `Float?`  | Nullable    | Longitude coordinate             |

**Relations:** has many `User`, has many `Worker`.

---

### Bookmark

A user's saved worker listing. Each user can bookmark a given worker at most once.

| Column      | Type       | Constraints  | Description                      |
| ----------- | ---------- | ------------ | -------------------------------- |
| `id`        | `String`   | PK, CUID     | Auto-generated unique identifier |
| `userId`    | `String`   | FK → User    | The user who bookmarked          |
| `workerId`  | `String`   | FK → Worker  | The bookmarked worker            |
| `createdAt` | `DateTime` | Default: now | When the bookmark was created    |

**Unique constraint:** `(userId, workerId)` — a user cannot bookmark the same worker twice.

**Cascade:** deleting a `User` or `Worker` cascades to delete their bookmarks.

---

### Review

A rating and optional comment left by a user for a worker. Each user can review a given worker at most once.

| Column      | Type       | Constraints  | Description                               |
| ----------- | ---------- | ------------ | ----------------------------------------- |
| `id`        | `String`   | PK, CUID     | Auto-generated unique identifier          |
| `rating`    | `Int`      | Required     | Numeric rating (application enforces 1–5) |
| `comment`   | `String?`  | Nullable     | Optional review text                      |
| `workerId`  | `String`   | FK → Worker  | The reviewed worker                       |
| `authorId`  | `String`   | FK → User    | The user who wrote the review             |
| `createdAt` | `DateTime` | Default: now | When the review was created               |

**Unique constraint:** `(authorId, workerId)` — one review per user per worker.

**Cascade:** deleting a `User` or `Worker` cascades to delete their reviews.

---

### Availability

A worker's availability schedule. Each worker can have at most one availability entry per day of the week.

| Column      | Type       | Constraints  | Description                         |
| ----------- | ---------- | ------------ | ----------------------------------- |
| `id`        | `String`   | PK, CUID     | Auto-generated unique identifier    |
| `workerId`  | `String`   | FK → Worker  | The worker this schedule belongs to |
| `dayOfWeek` | `Int`      | Required     | Day index: 0 = Sunday, 6 = Saturday |
| `startTime` | `String`   | Required     | Start time in `HH:mm` format (24h)  |
| `endTime`   | `String`   | Required     | End time in `HH:mm` format (24h)    |
| `createdAt` | `DateTime` | Default: now | Record creation timestamp           |
| `updatedAt` | `DateTime` | Auto-updated | Last modification timestamp         |

**Unique constraint:** `(workerId, dayOfWeek)` — one schedule entry per day per worker.

**Cascade:** deleting a `Worker` cascades to delete their availability entries.

---

### ContactRequest

A request from a user to contact a worker. The curator can accept or decline.

| Column       | Type       | Constraints        | Description                          |
| ------------ | ---------- | ------------------ | ------------------------------------ |
| `id`         | `String`   | PK, CUID           | Auto-generated unique identifier     |
| `workerId`   | `String`   | FK → Worker        | The worker being contacted           |
| `fromUserId` | `String`   | FK → User          | The user making the request          |
| `message`    | `String`   | Required           | The contact message                  |
| `status`     | `String`   | Default: `pending` | `pending`, `accepted`, or `declined` |
| `createdAt`  | `DateTime` | Default: now       | Record creation timestamp            |
| `updatedAt`  | `DateTime` | Auto-updated       | Last modification timestamp          |

**Cascade:** deleting a `User` or `Worker` cascades to delete their contact requests.

---

### PushSubscription

Stores Web Push API subscription data for a user, enabling push notifications.

| Column      | Type       | Constraints  | Description                       |
| ----------- | ---------- | ------------ | --------------------------------- |
| `id`        | `String`   | PK, CUID     | Auto-generated unique identifier  |
| `userId`    | `String`   | FK → User    | The subscribed user               |
| `endpoint`  | `String`   | Required     | Push service endpoint URL         |
| `auth`      | `String`   | Required     | Auth secret for the subscription  |
| `p256dh`    | `String`   | Required     | Public key for message encryption |
| `createdAt` | `DateTime` | Default: now | When the subscription was created |

**Unique constraint:** `(userId, endpoint)` — one subscription per endpoint per user (supports multiple devices).

**Cascade:** deleting a `User` cascades to delete their push subscriptions.

---

## Enums

### Role

Controls access level throughout the API.

| Value     | Description                                                                        |
| --------- | ---------------------------------------------------------------------------------- |
| `user`    | Standard user — can browse workers, leave reviews, bookmark, send contact requests |
| `curator` | Can create and manage worker listings, view contact requests                       |
| `admin`   | Full access — all curator permissions plus user management and platform stats      |

---

## Indexes

Prisma automatically creates indexes for:

- All `@id` fields (primary key index)
- All `@unique` fields (unique index)
- All foreign key fields used in `@relation` (implicit index in PostgreSQL)

### Explicit unique indexes

| Model              | Columns                 | Purpose                                |
| ------------------ | ----------------------- | -------------------------------------- |
| `User`             | `email`                 | Prevent duplicate accounts             |
| `User`             | `googleId`              | Ensure one account per Google identity |
| `User`             | `resetToken`            | Fast lookup during password reset      |
| `Category`         | `name`                  | Prevent duplicate category names       |
| `Bookmark`         | `(userId, workerId)`    | Prevent duplicate bookmarks            |
| `Review`           | `(authorId, workerId)`  | One review per user per worker         |
| `Availability`     | `(workerId, dayOfWeek)` | One schedule entry per day per worker  |
| `PushSubscription` | `(userId, endpoint)`    | One subscription per device per user   |

### Query performance notes

- Worker listing queries filter on `isActive = true` and optionally `categoryId`. Adding a composite index on `(isActive, categoryId)` would improve performance at scale.
- Contact request queries filter on `workerId` and `status`. An index on `(workerId, status)` would help at scale.
- These indexes are not yet in the schema and can be added as the dataset grows.

---

## Relationships Summary

```
User ──────────────────────────────────────────────────────────────────────────
  │  has many Workers (as curator)
  │  has many Bookmarks
  │  has many Reviews (as author)
  │  has many ContactRequests (as fromUser)
  │  has many PushSubscriptions
  └─ belongs to optional Location

Worker ─────────────────────────────────────────────────────────────────────────
  │  belongs to Category
  │  belongs to User (curator)
  │  belongs to optional Location
  │  has many Bookmarks
  │  has many Reviews
  │  has many Availability entries
  └─ has many ContactRequests

Category ───────────────────────────────────────────────────────────────────────
  └─ has many Workers

Location ───────────────────────────────────────────────────────────────────────
  │  has many Users
  └─ has many Workers
```

---

## Migration Strategy

### Running migrations

Migrations live in `packages/api/prisma/migrations/`. Each migration is a timestamped directory containing a `migration.sql` file.

```bash
# Development — creates a new migration and applies it
cd packages/api
pnpm migrate          # runs: prisma migrate dev

# Production — applies pending migrations without creating new ones
npx prisma migrate deploy
```

The Docker Compose setup runs `prisma migrate deploy` automatically on API container startup.

### Creating a new migration

1. Edit `packages/api/prisma/schema.prisma` with your changes.
2. Run `pnpm migrate` and provide a descriptive name when prompted:
   ```
   Enter a name for the new migration: add_worker_rating_cache
   ```
3. Prisma generates the SQL diff and applies it to your local database.
4. Commit both the updated `schema.prisma` and the new migration directory.

### Migration naming convention

Use snake_case and describe what the migration does:

```
20260324_add_location_model
20260330_add_availability_contact_request_stellar
add_push_subscriptions
```

### Rollback strategy

Prisma does not support automatic rollbacks. To undo a migration in development:

```bash
npx prisma migrate reset   # drops and recreates the database, re-runs all migrations
```

For production rollbacks, write a new migration that reverses the change (e.g. `DROP COLUMN`, `DROP TABLE`). Never manually edit applied migration files.

### Schema drift

If the database schema drifts from the Prisma schema (e.g. manual SQL changes), run:

```bash
npx prisma migrate diff \
  --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma
```

---

## Data Retention Policies

### Active data

All records are retained indefinitely unless explicitly deleted by a user action or cascade rule.

### Cascade deletes

The following records are automatically deleted when their parent is deleted:

| Deleted record | Cascades to                                                |
| -------------- | ---------------------------------------------------------- |
| `User`         | `Bookmark`, `Review`, `ContactRequest`, `PushSubscription` |
| `Worker`       | `Bookmark`, `Review`, `Availability`, `ContactRequest`     |

`User` deletion does **not** cascade to `Worker` records — workers created by a deleted curator remain in the database. This is intentional to preserve listing history. Orphaned workers should be reassigned or archived via an admin action.

### Token expiry

Verification and reset tokens have database-level expiry timestamps:

| Token               | Expiry                     |
| ------------------- | -------------------------- |
| `verificationToken` | 24 hours from registration |
| `resetToken`        | 1 hour from request        |

Expired tokens are not automatically deleted from the database — they remain as null-equivalent entries until the user re-requests. A periodic cleanup job (not yet implemented) could prune rows where `verificationTokenExpiry < NOW()` and `verified = false`.

### Push subscriptions

Push subscriptions are deleted when the user explicitly unsubscribes (`DELETE /api/users/me/push-subscription`). Stale subscriptions (where the push service has invalidated the endpoint) are not automatically pruned — the push service will return a `410 Gone` response, which the application should handle by deleting the subscription.

### On-chain data

Worker records anchored on the Stellar Registry contract have a storage TTL of approximately 1 year (535,000 ledgers). TTL is extended automatically on every write. Anyone can call `extend_worker_ttl` to refresh a specific entry. See the [contracts README](../packages/contracts/README.md) for details.
