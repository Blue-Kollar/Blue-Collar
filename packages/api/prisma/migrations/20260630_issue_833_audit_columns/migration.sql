-- #833: Add audit columns (createdBy, updatedBy) to Worker
-- Expand step: add nullable columns first so existing rows are unaffected.
-- Application layer populates them on all new writes going forward.
-- A separate backfill job can populate them for existing rows if required.

ALTER TABLE "Worker"
  ADD COLUMN IF NOT EXISTS "createdById" TEXT,
  ADD COLUMN IF NOT EXISTS "updatedById" TEXT;

-- Foreign-key constraints are intentionally deferred to a future migration
-- once the backfill is complete (expand/contract pattern — see docs/DATABASE_MIGRATIONS.md).

-- Index updatedById for admin "who last touched this?" queries
CREATE INDEX IF NOT EXISTS "Worker_createdById_idx" ON "Worker"("createdById");
CREATE INDEX IF NOT EXISTS "Worker_updatedById_idx" ON "Worker"("updatedById");
