#!/usr/bin/env bash
# =============================================================================
# generate-bindings.sh — BlueCollar SDK binding regeneration script
# =============================================================================
#
# PURPOSE
# ───────
# Regenerates the TypeScript binding files in packages/sdk/src/generated/
# by invoking `stellar contract bindings typescript` for each deployed
# BlueCollar contract.
#
# REQUIREMENTS
# ────────────
# 1. Stellar CLI installed: https://developers.stellar.org/docs/tools/stellar-cli
#    Install: cargo install stellar-cli --locked
# 2. Contract IDs — either:
#    a. Set the env variables listed below, OR
#    b. Pass them as positional arguments (see USAGE).
# 3. Network access to the Soroban RPC endpoint.
#
# DRIFT DETECTION (CI)
# ────────────────────
# In CI the script is used to detect binding drift:
#
#   1. Run this script into a temp directory.
#   2. Diff the output against packages/sdk/src/generated/.
#   3. Fail if there are any differences.
#
# Example CI step (GitHub Actions):
#
#   - name: Check binding drift
#     run: |
#       TEMP=$(mktemp -d)
#       bash packages/sdk/scripts/generate-bindings.sh "$TEMP"
#       diff -r "$TEMP" packages/sdk/src/generated/
#
# Without a live RPC node the compile-time structural checks in
# packages/sdk/src/__tests__/bindings-drift.test.ts serve as the
# primary drift guard.
#
# USAGE
# ─────
#   # Use env variables:
#   export REGISTRY_CONTRACT_ID="C..."
#   export MARKET_CONTRACT_ID="C..."
#   export DISPUTE_CONTRACT_ID="C..."
#   export ESCROW_CONTRACT_ID="C..."
#   export PAYMENT_CONTRACT_ID="C..."
#   export JOB_REGISTRY_CONTRACT_ID="C..."
#   export SOROBAN_RPC_URL="https://soroban-testnet.stellar.org"
#   export STELLAR_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
#   bash packages/sdk/scripts/generate-bindings.sh
#
#   # Override the output directory (useful in CI drift-check mode):
#   bash packages/sdk/scripts/generate-bindings.sh /tmp/bindings-check
#
# =============================================================================

set -euo pipefail

# ─── Configuration ────────────────────────────────────────────────────────────

# Root of the monorepo (two levels up from this script's directory).
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../" && pwd)"

# Default output directory: the canonical generated/ folder.
OUTPUT_DIR="${1:-"${REPO_ROOT}/packages/sdk/src/generated"}"

# Soroban RPC endpoint. Defaults to public testnet.
RPC_URL="${SOROBAN_RPC_URL:-"https://soroban-testnet.stellar.org"}"

# Network passphrase. Defaults to testnet.
NETWORK_PASSPHRASE="${STELLAR_NETWORK_PASSPHRASE:-"Test SDF Network ; September 2015"}"

# Contract IDs — must be set via environment (or deployment config).
REGISTRY_CONTRACT_ID="${REGISTRY_CONTRACT_ID:-""}"
MARKET_CONTRACT_ID="${MARKET_CONTRACT_ID:-""}"
DISPUTE_CONTRACT_ID="${DISPUTE_CONTRACT_ID:-""}"
ESCROW_CONTRACT_ID="${ESCROW_CONTRACT_ID:-""}"
PAYMENT_CONTRACT_ID="${PAYMENT_CONTRACT_ID:-""}"
JOB_REGISTRY_CONTRACT_ID="${JOB_REGISTRY_CONTRACT_ID:-""}"

# ─── Helpers ──────────────────────────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No colour

log()  { echo -e "${GREEN}[generate-bindings]${NC} $*"; }
warn() { echo -e "${YELLOW}[generate-bindings WARN]${NC} $*" >&2; }
die()  { echo -e "${RED}[generate-bindings ERROR]${NC} $*" >&2; exit 1; }

check_stellar_cli() {
  if ! command -v stellar &>/dev/null; then
    die "stellar CLI not found. Install with: cargo install stellar-cli --locked"
  fi
  log "stellar CLI version: $(stellar --version)"
}

require_contract_id() {
  local name="$1"
  local id="$2"
  if [[ -z "$id" ]]; then
    die "Contract ID for ${name} is not set. Export the matching env variable (e.g. export ${name}_CONTRACT_ID='C...')."
  fi
}

# Generate bindings for a single contract.
#
# Arguments:
#   $1 — Contract name (used as the output sub-directory and TypeScript module name)
#   $2 — Contract ID on the network
#   $3 — Output directory for this contract's bindings
generate_bindings_for() {
  local contract_name="$1"
  local contract_id="$2"
  local out_dir="$3"

  log "Generating bindings for ${contract_name} (${contract_id}) …"

  mkdir -p "${out_dir}"

  # `stellar contract bindings typescript` generates a fully-typed TypeScript
  # client package by introspecting the on-chain contract's metadata (compiled
  # into the WASM by Soroban's `contractimpl` macro).
  #
  # Flags:
  #   --contract-id      On-chain contract address.
  #   --rpc-url          Soroban RPC endpoint to query.
  #   --network-passphrase  Identifies the network (prevents cross-network confusion).
  #   --output-dir       Where to write the generated files.
  stellar contract bindings typescript \
    --contract-id    "${contract_id}" \
    --rpc-url        "${RPC_URL}" \
    --network-passphrase "${NETWORK_PASSPHRASE}" \
    --output-dir     "${out_dir}"

  log "  ✓ ${contract_name} bindings written to ${out_dir}"
}

# ─── Main ─────────────────────────────────────────────────────────────────────

main() {
  log "Starting BlueCollar SDK binding regeneration"
  log "Output directory: ${OUTPUT_DIR}"
  log "RPC URL:          ${RPC_URL}"
  echo ""

  # Validate prerequisites.
  check_stellar_cli

  # Validate that all contract IDs are present before we start any network calls.
  require_contract_id "REGISTRY"      "${REGISTRY_CONTRACT_ID}"
  require_contract_id "MARKET"        "${MARKET_CONTRACT_ID}"
  require_contract_id "DISPUTE"       "${DISPUTE_CONTRACT_ID}"
  require_contract_id "ESCROW"        "${ESCROW_CONTRACT_ID}"
  require_contract_id "PAYMENT"       "${PAYMENT_CONTRACT_ID}"
  require_contract_id "JOB_REGISTRY"  "${JOB_REGISTRY_CONTRACT_ID}"

  mkdir -p "${OUTPUT_DIR}"

  # ── Registry ─────────────────────────────────────────────────────────────
  generate_bindings_for \
    "registry" \
    "${REGISTRY_CONTRACT_ID}" \
    "${OUTPUT_DIR}/registry"

  # ── Market ───────────────────────────────────────────────────────────────
  generate_bindings_for \
    "market" \
    "${MARKET_CONTRACT_ID}" \
    "${OUTPUT_DIR}/market"

  # ── Dispute ──────────────────────────────────────────────────────────────
  generate_bindings_for \
    "dispute" \
    "${DISPUTE_CONTRACT_ID}" \
    "${OUTPUT_DIR}/dispute"

  # ── Escrow ───────────────────────────────────────────────────────────────
  generate_bindings_for \
    "escrow" \
    "${ESCROW_CONTRACT_ID}" \
    "${OUTPUT_DIR}/escrow"

  # ── Payment ──────────────────────────────────────────────────────────────
  generate_bindings_for \
    "payment" \
    "${PAYMENT_CONTRACT_ID}" \
    "${OUTPUT_DIR}/payment"

  # ── JobRegistry ──────────────────────────────────────────────────────────
  generate_bindings_for \
    "job_registry" \
    "${JOB_REGISTRY_CONTRACT_ID}" \
    "${OUTPUT_DIR}/job_registry"

  echo ""
  log "All bindings regenerated successfully."
  log ""
  log "Next steps:"
  log "  1. Review the diff:  git diff packages/sdk/src/generated/"
  log "  2. Update the drift test if any method signatures changed:"
  log "       packages/sdk/src/__tests__/bindings-drift.test.ts"
  log "  3. Run the test suite:  pnpm --filter @bluecollar/sdk test"
  log "  4. Commit both the generated files and any test updates."
}

main "$@"
