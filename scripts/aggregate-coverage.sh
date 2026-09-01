#!/usr/bin/env bash
# =============================================================================
# scripts/aggregate-coverage.sh — BlueCollar monorepo (#1283)
#
# Aggregates Istanbul/V8 JSON coverage from api, app, and sdk packages plus
# the lcov report from the mobile package into a single merged report under
# coverage/aggregate/.
#
# Prerequisites (install once):
#   pnpm add -Dw nyc
#   # nyc ships istanbul-lib-coverage + istanbul-lib-report internally
#
# Usage:
#   # Run all package test suites then aggregate
#   bash scripts/aggregate-coverage.sh
#
#   # Skip re-running tests (use existing coverage/ dirs)
#   bash scripts/aggregate-coverage.sh --no-run
#
#   # CI — same as default; artifact is uploaded from coverage/aggregate/
#   bash scripts/aggregate-coverage.sh
#
# Output:
#   coverage/aggregate/
#     index.html          — browsable HTML summary
#     lcov.info           — merged LCOV for CI/Codecov/SonarCloud upload
#     coverage-summary.json — machine-readable per-package summary
#     text-summary.txt    — plain-text table (printed to stdout)
# =============================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AGGREGATE_DIR="$REPO_ROOT/coverage/aggregate"
TMP_DIR="$REPO_ROOT/coverage/.tmp-merge"

# Colour helpers
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()    { echo -e "${GREEN}[coverage]${NC} $*"; }
warn()    { echo -e "${YELLOW}[coverage]${NC} $*"; }
fatal()   { echo -e "${RED}[coverage] ERROR:${NC} $*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# Parse flags
# ---------------------------------------------------------------------------
RUN_TESTS=true
for arg in "$@"; do
  case $arg in
    --no-run) RUN_TESTS=false ;;
    *) fatal "Unknown argument: $arg" ;;
  esac
done

# ---------------------------------------------------------------------------
# Step 1 — Run each package's test:coverage command
# ---------------------------------------------------------------------------
if [ "$RUN_TESTS" = true ]; then
  info "Running test coverage for all packages..."

  info "  → packages/api"
  pnpm --filter @bluecollar/api test:coverage || warn "api coverage run exited non-zero (thresholds may not be met yet)"

  info "  → packages/app"
  pnpm --filter @bluecollar/app test:coverage || warn "app coverage run exited non-zero (thresholds may not be met yet)"

  info "  → packages/sdk"
  pnpm --filter @bluecollar/sdk test:coverage || warn "sdk coverage run exited non-zero (thresholds may not be met yet)"

  info "  → packages/mobile"
  pnpm --filter @bluecollar/mobile test:coverage || warn "mobile coverage run exited non-zero (thresholds may not be met yet)"
else
  info "Skipping test runs (--no-run). Using existing coverage/ directories."
fi

# ---------------------------------------------------------------------------
# Step 2 — Validate source files exist
# ---------------------------------------------------------------------------
API_JSON="$REPO_ROOT/packages/api/coverage/coverage-final.json"
APP_JSON="$REPO_ROOT/packages/app/coverage/coverage-final.json"
SDK_JSON="$REPO_ROOT/packages/sdk/coverage/coverage-final.json"
MOBILE_LCOV="$REPO_ROOT/packages/mobile/coverage/lcov.info"

missing=0
for f in "$API_JSON" "$APP_JSON" "$SDK_JSON"; do
  if [ ! -f "$f" ]; then
    warn "Missing: $f"
    missing=$((missing + 1))
  fi
done

if [ $missing -gt 0 ]; then
  fatal "$missing coverage-final.json file(s) missing. Run tests first (or without --no-run)."
fi

# ---------------------------------------------------------------------------
# Step 3 — Merge Istanbul JSON files (api + app + sdk)
# ---------------------------------------------------------------------------
info "Merging Istanbul JSON coverage reports..."

mkdir -p "$TMP_DIR" "$AGGREGATE_DIR"

# Copy individual reports into the temp merge dir under unique sub-paths so
# nyc can discover them without key collisions between packages.
cp "$API_JSON" "$TMP_DIR/api-coverage-final.json"
cp "$APP_JSON" "$TMP_DIR/app-coverage-final.json"
cp "$SDK_JSON" "$TMP_DIR/sdk-coverage-final.json"

# Use nyc merge to produce a single coverage-final.json
# nyc is expected as a devDependency at the workspace root
NYX_BIN="$REPO_ROOT/node_modules/.bin/nyc"
if [ ! -f "$NYX_BIN" ]; then
  fatal "nyc not found at $NYX_BIN. Run: pnpm add -Dw nyc"
fi

"$NYX_BIN" merge "$TMP_DIR" "$AGGREGATE_DIR/coverage-final.json"
info "Merged JSON written to coverage/aggregate/coverage-final.json"

# ---------------------------------------------------------------------------
# Step 4 — Generate reports from the merged JSON
# ---------------------------------------------------------------------------
info "Generating HTML, LCOV, text, and JSON summary reports..."

"$NYX_BIN" report \
  --reporter=html \
  --reporter=lcovonly \
  --reporter=text-summary \
  --reporter=json-summary \
  --temp-dir="$AGGREGATE_DIR" \
  --report-dir="$AGGREGATE_DIR"

# text-summary goes to stdout — also tee to a file
"$NYX_BIN" report \
  --reporter=text \
  --temp-dir="$AGGREGATE_DIR" \
  --report-dir="$AGGREGATE_DIR" \
  | tee "$AGGREGATE_DIR/text-summary.txt"

# ---------------------------------------------------------------------------
# Step 5 — Append mobile lcov if available
# ---------------------------------------------------------------------------
if [ -f "$MOBILE_LCOV" ]; then
  info "Appending mobile lcov.info to aggregate lcov..."
  cat "$MOBILE_LCOV" >> "$AGGREGATE_DIR/lcov.info"
else
  warn "Mobile lcov.info not found at $MOBILE_LCOV — mobile coverage excluded from LCOV merge."
  warn "Run: pnpm --filter @bluecollar/mobile test:coverage"
fi

# ---------------------------------------------------------------------------
# Cleanup
# ---------------------------------------------------------------------------
rm -rf "$TMP_DIR"

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------
info "Aggregate report ready at: coverage/aggregate/"
info "  HTML:         coverage/aggregate/index.html"
info "  LCOV:         coverage/aggregate/lcov.info"
info "  JSON summary: coverage/aggregate/coverage-summary.json"
info "  Text summary: coverage/aggregate/text-summary.txt"
