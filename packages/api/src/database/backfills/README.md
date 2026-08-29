# Backfill scripts

One-off data-migration scripts that run **after** an Expand migration has been
deployed but **before** the Contract migration that makes the old column
non-nullable or removes it.

## Naming convention

```
YYYYMMDD_backfill_<descriptive_name>.ts
```

## Running a backfill

```bash
cd packages/api
npx tsx src/database/backfills/YYYYMMDD_backfill_<name>.ts
```

All scripts are idempotent — they only update rows that have not been
backfilled yet, so re-running is safe.

See [docs/DATABASE_MIGRATIONS.md](../../../../../docs/DATABASE_MIGRATIONS.md#backfill-job-template)
for the full backfill template.
