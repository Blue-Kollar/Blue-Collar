#!/usr/bin/env bash
# scripts/check-openapi-fresh.sh
#
# Verifies that packages/api/openapi.json is current with the source
# definitions in packages/api/src/openapi/.
#
# Usage: ./scripts/check-openapi-fresh.sh
#
# Run in CI or as a pre-commit hook. Exits non-zero if stale.
# Closes #1296

set -euo pipefail

PACKAGE_DIR="packages/api"
OPENAPI_FILE="${PACKAGE_DIR}/openapi.json"

echo "🔍  Checking openapi.json freshness..."

# 1. Regenerate into a temp file
TMPFILE=$(mktemp /tmp/openapi-fresh-XXXXXX.json)
trap 'rm -f "$TMPFILE"' EXIT

cd "$PACKAGE_DIR"
npx tsx src/scripts/generate-openapi.ts 2>/dev/null
cd - >/dev/null

# Capture freshly generated content
npx --prefix "$PACKAGE_DIR" tsx "$PACKAGE_DIR/src/scripts/generate-openapi.ts" 2>/dev/null || true

# Actually compare: regenerate to stdout via node and diff
node --input-type=module - <<'EOF' > "$TMPFILE"
import { buildSpec } from './packages/api/src/openapi/spec.js'
process.stdout.write(JSON.stringify(buildSpec(), null, 2) + '\n')
EOF

if diff -q "$OPENAPI_FILE" "$TMPFILE" > /dev/null 2>&1; then
  echo "✅  openapi.json is up-to-date."
  exit 0
else
  echo ""
  echo "❌  openapi.json is STALE."
  echo ""
  echo "   The tracked file does not match what the current source would generate."
  echo "   Regenerate it with:"
  echo ""
  echo "       pnpm --filter @bluecollar/api openapi:generate"
  echo ""
  echo "   Then commit the updated openapi.json."
  exit 1
fi
