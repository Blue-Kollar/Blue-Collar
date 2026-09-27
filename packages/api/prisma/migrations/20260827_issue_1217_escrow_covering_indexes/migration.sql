-- Migration: Add covering indexes on EscrowRecord for N+1 query prevention
-- Issue #1217: Optimize transaction listing endpoint
--
-- The listEscrows query filters by (payerId OR payeeId) combined with status.
-- Adding composite indexes eliminates full-table scans on large datasets.

CREATE INDEX CONCURRENTLY IF NOT EXISTS "EscrowRecord_payerId_status_idx"
    ON "EscrowRecord" ("payerId", "status");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "EscrowRecord_payeeId_status_idx"
    ON "EscrowRecord" ("payeeId", "status");
