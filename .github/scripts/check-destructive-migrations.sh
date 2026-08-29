#!/usr/bin/env bash
# check-destructive-migrations.sh — #835
#
# Fails CI if any NEW migration SQL (added in this PR relative to main)
# contains destructive patterns that would break a zero-downtime deploy.
#
# Operators must follow the Expand/Contract pattern documented in
# docs/DATABASE_MIGRATIONS.md before merging any migration with these patterns.
#
# Usage (called by .github/workflows/db-migrations.yml):
#   bash .github/scripts/check-destructive-migrations.sh

set -euo pipefail

BASE_BRANCH="${BASE_BRANCH:-origin/main}"

# Collect only new/modified migration SQL files in this PR
CHANGED=$(git diff --name-only "${BASE_BRANCH}...HEAD" -- 'packages/api/prisma/migrations/**/*.sql' 2>/dev/null || true)

if [[ -z "$CHANGED" ]]; then
  echo "✅ No new migration files detected — nothing to check."
  exit 0
fi

echo "Checking migration files for destructive patterns:"
echo "$CHANGED" | sed 's/^/  /'
echo ""

# Patterns that indicate a potentially destructive or lock-inducing operation.
# Each entry is a tuple: "PATTERN|HUMAN_READABLE_LABEL"
DESTRUCTIVE_PATTERNS=(
  "DROP[[:space:]]+TABLE|DROP TABLE (without prior soft-delete / archival)"
  "DROP[[:space:]]+COLUMN|DROP COLUMN (follow the Contract step of Expand/Contract)"
  "RENAME[[:space:]]+COLUMN|RENAME COLUMN (use a two-migration rename instead)"
  "RENAME[[:space:]]+TO|RENAME TABLE (breaks existing queries)"
  "ALTER[[:space:]]+COLUMN[^;]+NOT[[:space:]]+NULL[^;]*;|ALTER COLUMN … NOT NULL (may need backfill; verify column is fully populated)"
  "ADD[[:space:]]+COLUMN[^;]+NOT[[:space:]]+NULL[^;]+WITHOUT[[:space:]]+DEFAULT|ADD COLUMN NOT NULL without DEFAULT (table rewrite)"
  "CREATE[[:space:]]+INDEX[^C][^O][^N]|CREATE INDEX without CONCURRENTLY (on large tables this takes a table lock)"
)

FOUND=0

for file in $CHANGED; do
  if [[ ! -f "$file" ]]; then continue; fi

  for entry in "${DESTRUCTIVE_PATTERNS[@]}"; do
    PATTERN="${entry%%|*}"
    LABEL="${entry##*|}"

    if grep -qiE "$PATTERN" "$file"; then
      echo "⚠️  Destructive pattern in $(basename "$(dirname "$file")")/migration.sql"
      echo "   Pattern : $LABEL"
      echo "   File    : $file"
      echo "   Action  : Follow the Expand/Contract pattern in docs/DATABASE_MIGRATIONS.md"
      echo "             Open a separate PR for the Contract (drop) step after the Expand"
      echo "             is already deployed and all pods have rolled over."
      echo ""
      FOUND=1
    fi
  done
done

if [[ $FOUND -ne 0 ]]; then
  echo "❌ One or more destructive migration patterns detected."
  echo "   Review docs/DATABASE_MIGRATIONS.md before proceeding."
  exit 1
fi

echo "✅ No destructive migration patterns found."
