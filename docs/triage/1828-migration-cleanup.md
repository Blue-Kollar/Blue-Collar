# Triage: database migration cleanup (#1828)

## Checked

- `prisma/migrations` has 26 dated migration folders, plus `add_push_subscriptions` and `migration_lock.toml`.
- Every migration folder checked has a `migration.sql` file.
- `add_push_subscriptions` has no date prefix, unlike the others.

## Why it was not renamed

Prisma records migrations by folder name. Renaming an applied migration makes Prisma treat it as new on the next deploy. That can break deployed databases, so the rename needs a planned migration.

## Not changed

No code change was made.
