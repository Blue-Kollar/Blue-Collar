# Database Migrations

BlueCollar uses **Prisma Migrate** for schema migrations against PostgreSQL.

---

## Contents

- [Tooling & workflow](#tooling--workflow)
- [Expand/Contract pattern (zero-downtime)](#expandcontract-pattern-zero-downtime)
  - [Example: renaming a column](#example-renaming-a-column)
  - [Example: adding a NOT NULL column](#example-adding-a-not-null-column)
- [Migration lint checklist](#migration-lint-checklist)
- [Backfill job template](#backfill-job-template)
- [CI pipeline](#ci-pipeline)
- [Rollback procedure](#rollback-procedure)
- [Performance guidelines](#performance-guidelines)

---

## Tooling & workflow

```bash
cd packages/api

# Create a new migration and apply it locally
npx prisma migrate dev --name describe_your_change

# Apply pending migrations to a live database (CI/production)
npx prisma migrate deploy

# Check whether schema.prisma and applied migrations are in sync
npx prisma migrate diff \
  --from-migrations ./prisma/migrations \
  --to-schema-datamodel ./prisma/schema.prisma \
  --exit-code
```

**Hard rules:**

1. **Never edit an applied migration file.** Write a new one instead.
2. **All migrations must be backward compatible** (see Expand/Contract below).
3. **Avoid long-running locks** — use `CREATE INDEX CONCURRENTLY` on large tables.
4. **Every destructive change must have a documented rollback path.**

---

## Expand/Contract pattern (zero-downtime)

A zero-downtime deploy requires that both the *old* and *new* API versions can
run against the database simultaneously during the rolling restart window
(typically 1–5 minutes for a Kubernetes rolling update).

The Expand/Contract pattern achieves this by splitting every structural change
into three deploy phases:

```
Phase 1 — Expand    Add new column / table (nullable or with default).
                    Old code ignores it; new code reads and writes it.

Phase 2 — Migrate   Deploy new API version. Run backfill if needed.
                    Both old and new columns are populated during the window.

Phase 3 — Contract  Once all pods are running the new version, drop the old
                    column / table in a follow-up migration.
```

### Example: renaming a column

Renaming `Worker.phone` → `Worker.phoneNumber`.

**Phase 1 — Expand migration:**

```sql
-- 20260701_rename_phone_expand/migration.sql
ALTER TABLE "Worker" ADD COLUMN IF NOT EXISTS "phoneNumber" TEXT;
```

Deploy API v2 which writes to *both* `phone` and `phoneNumber`, reads from
`phoneNumber` (falling back to `phone` if null).

Run backfill (see [Backfill job template](#backfill-job-template)):

```sql
UPDATE "Worker" SET "phoneNumber" = phone WHERE "phoneNumber" IS NULL;
```

**Phase 3 — Contract migration** (after all pods are on v2):

```sql
-- 20260715_rename_phone_contract/migration.sql
ALTER TABLE "Worker" DROP COLUMN IF EXISTS "phone";
```

---

### Example: adding a NOT NULL column

Adding `Worker.tier TEXT NOT NULL DEFAULT 'standard'`.

**Wrong (blocks table rewrite on large tables):**

```sql
ALTER TABLE "Worker" ADD COLUMN "tier" TEXT NOT NULL DEFAULT 'standard';
```

**Correct — two-step:**

```sql
-- Phase 1: add nullable column (instant metadata change)
ALTER TABLE "Worker" ADD COLUMN IF NOT EXISTS "tier" TEXT;
```

Deploy code that writes `'standard'` for every new row. Run backfill:

```sql
UPDATE "Worker" SET "tier" = 'standard' WHERE "tier" IS NULL;
```

```sql
-- Phase 3: add NOT NULL constraint (safe after backfill, no rewrite needed in PG 12+)
ALTER TABLE "Worker" ALTER COLUMN "tier" SET NOT NULL;
ALTER TABLE "Worker" ALTER COLUMN "tier" SET DEFAULT 'standard';
```

---

## Migration lint checklist

Before opening a PR that changes `prisma/schema.prisma` or adds a migration,
verify every item in this checklist:

| # | Check | Why |
|---|-------|-----|
| 1 | No `DROP COLUMN`, `DROP TABLE`, or `RENAME COLUMN` without an Expand phase already deployed | Breaks the running API |
| 2 | No `NOT NULL` without a `DEFAULT` or a backfill on a non-empty table | Lock / constraint violation |
| 3 | `CREATE INDEX` on tables > 100 k rows uses `CONCURRENTLY` | Avoids table lock |
| 4 | Migration completes in < 30 s on production row counts | Confirmed by load-test or explain |
| 5 | `prisma migrate diff --exit-code` passes locally | Drift between schema and migrations |
| 6 | Migration is additive-only **or** a Contract migration with a corresponding merged Expand PR | Zero-downtime guarantee |
| 7 | No `ALTER TABLE … RENAME` — use the two-migration rename approach above | Breaks old running code |
| 8 | Foreign keys added with `NOT VALID` first, then validated separately | Avoids full-table scan lock |

---

## Backfill job template

For any Expand migration that adds a nullable column, create a one-off backfill
script in `packages/api/src/database/backfills/`.  The template below is safe
for large tables because it processes in batches.

```typescript
// packages/api/src/database/backfills/YYYYMMDD_backfill_<column>.ts
/**
 * Backfill: <description of what is being backfilled>
 *
 * Run once after the Expand migration has been deployed:
 *   npx tsx src/database/backfills/YYYYMMDD_backfill_<column>.ts
 *
 * Idempotent — can be re-run safely.
 */
import { db } from '../db.js'

const BATCH_SIZE = 500

async function backfill() {
  console.log('Starting backfill…')
  let cursor: string | undefined
  let total = 0

  while (true) {
    const rows = await db.worker.findMany({
      where: {
        // Only target rows that still need backfilling
        newColumn: null,
        ...(cursor ? { id: { gt: cursor } } : {}),
      },
      orderBy: { id: 'asc' },
      take: BATCH_SIZE,
      select: { id: true },
    })

    if (rows.length === 0) break

    await db.worker.updateMany({
      where: { id: { in: rows.map(r => r.id) } },
      data: { newColumn: 'defaultValue' },
    })

    cursor = rows[rows.length - 1].id
    total += rows.length
    console.log(`  Processed ${total} rows…`)
  }

  console.log(`✅ Backfill complete — ${total} rows updated.`)
}

backfill()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
```

---

## CI pipeline

The `db-migrations.yml` workflow runs on every PR that touches `prisma/`:

| Step | What it checks |
|------|----------------|
| Apply all migrations | `prisma migrate deploy` from scratch |
| Schema drift | `prisma migrate diff --exit-code` |
| Seed + query | Full seed runs without errors |
| **Destructive migration check** | Scans migration SQL for `DROP`, `RENAME`, `NOT NULL` without defaults — fails the PR with guidance |

### Destructive-migration check

The CI workflow runs a shell script that rejects any migration that contains
destructive operations without a matching Expand phase:

```bash
# .github/scripts/check-destructive-migrations.sh
#!/usr/bin/env bash
# Fail if any NEW migration (compared to main) contains destructive patterns.
set -euo pipefail

CHANGED=$(git diff --name-only origin/main...HEAD -- 'packages/api/prisma/migrations/**/*.sql')

if [[ -z "$CHANGED" ]]; then
  echo "No new migration files — nothing to check."
  exit 0
fi

DESTRUCTIVE_PATTERNS=(
  'DROP TABLE'
  'DROP COLUMN'
  'RENAME COLUMN'
  'RENAME TABLE'
  'ALTER COLUMN.*NOT NULL'
  'ALTER TABLE.*RENAME'
)

FOUND=0
for file in $CHANGED; do
  for pattern in "${DESTRUCTIVE_PATTERNS[@]}"; do
    if grep -qiE "$pattern" "$file"; then
      echo "⚠️  Destructive operation detected in $file: '$pattern'"
      echo "   Follow the Expand/Contract pattern in docs/DATABASE_MIGRATIONS.md"
      FOUND=1
    fi
  done
done

if [[ $FOUND -ne 0 ]]; then
  exit 1
fi

echo "✅ No destructive migration patterns found."
```

The workflow step (`db-migrations.yml`) calls this script after checkout:

```yaml
- name: Check for destructive migrations
  run: bash .github/scripts/check-destructive-migrations.sh
```

---

## Rollback procedure

Prisma does not support automatic down-migrations. Options:

1. **Additive change** (new column/table with default): deploy the previous
   API version — it ignores new columns and continues to work.
2. **Destructive change** (dropped column/table): restore from the pre-deploy
   RDS point-in-time snapshot taken automatically before each production deploy.

```bash
# Restore to a specific timestamp (replace with your target)
bash deploy/scripts/restore-database.sh "2026-06-30T10:30:00Z"
```

---

## Performance guidelines

- Add indexes for all foreign keys and frequently filtered columns.
- For tables > 100 k rows use `CREATE INDEX CONCURRENTLY` in raw SQL.
- Avoid `ALTER TABLE … ADD COLUMN NOT NULL` without a DEFAULT on large tables — use the two-step approach above.
- Run `EXPLAIN (ANALYZE, BUFFERS)` on slow queries before and after the migration in a production-like environment.
- Migrations that touch tables with > 10 M rows must be reviewed by a senior engineer before merging.
