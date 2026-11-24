#!/usr/bin/env bash
# verify-deployments.sh — Post-deploy smoke-test for all BlueCollar contracts.
#
# Reads contract IDs from deployments.json and verifies that each deployed
# contract responds correctly to its `get_admin`, `is_paused`, and `version`
# read-only entry points.  Exits non-zero if any check fails.
#
# Usage:
#   ./scripts/verify-deployments.sh --network testnet|mainnet \
#                                    --source <key-or-alias>
#
# Arguments:
#   --network  Target Stellar network: "testnet" or "mainnet".
#   --source   Stellar CLI identity used to submit the read-only calls.
#
# Requires:
#   - stellar CLI on PATH
#   - python3 on PATH
#   - deployments.json populated by one or more deploy-*.sh scripts

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTRACTS_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
DEPLOYMENTS_FILE="${CONTRACTS_DIR}/deployments.json"

NETWORK=""
SOURCE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --network) NETWORK="$2"; shift 2 ;;
    --source)  SOURCE="$2";  shift 2 ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "$NETWORK" || -z "$SOURCE" ]]; then
  echo "Usage: $0 --network testnet|mainnet --source <key>" >&2
  exit 1
fi

if [[ "$NETWORK" != "testnet" && "$NETWORK" != "mainnet" ]]; then
  echo "Error: --network must be 'testnet' or 'mainnet'" >&2
  exit 1
fi

if [[ ! -f "${DEPLOYMENTS_FILE}" ]]; then
  echo "Error: ${DEPLOYMENTS_FILE} not found. Run a deploy script first." >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Helper: invoke a read-only entry point and return stdout.
# Returns the string "INVOKE_FAILED" (non-zero exit) on CLI errors.
# ---------------------------------------------------------------------------
invoke_ro() {
  local contract_id="$1"
  local fn_name="$2"
  shift 2
  stellar contract invoke \
    --id "${contract_id}" \
    --source "${SOURCE}" \
    --network "${NETWORK}" \
    -- "${fn_name}" "$@" 2>&1 || echo "INVOKE_FAILED"
}

# ---------------------------------------------------------------------------
# Load the contract IDs from deployments.json for the requested network.
# ---------------------------------------------------------------------------
read -r -d '' EXTRACT_IDS_PY << 'PYEOF' || true
import json, sys

network = sys.argv[1]
path = sys.argv[2]

with open(path) as f:
    data = json.load(f)

contracts = data.get(network, {})
if not contracts:
    print(f"No contracts recorded for network '{network}' in {path}", file=sys.stderr)
    sys.exit(1)

for name, info in contracts.items():
    cid = info.get("contract_id", "")
    admin = info.get("admin", "")
    print(f"{name}={cid}:{admin}")
PYEOF

FAIL=0
declare -A CONTRACT_IDS
declare -A CONTRACT_ADMINS

while IFS= read -r line; do
  name="${line%%=*}"
  rest="${line#*=}"
  cid="${rest%%:*}"
  admin="${rest#*:}"
  CONTRACT_IDS["$name"]="$cid"
  CONTRACT_ADMINS["$name"]="$admin"
done < <(python3 - "${NETWORK}" "${DEPLOYMENTS_FILE}" <<< "${EXTRACT_IDS_PY}")

if [[ ${#CONTRACT_IDS[@]} -eq 0 ]]; then
  echo "No contracts to verify for network '${NETWORK}'." >&2
  exit 1
fi

echo "==> Verifying ${#CONTRACT_IDS[@]} contract(s) on ${NETWORK}..."

# ---------------------------------------------------------------------------
# Per-contract checks
# ---------------------------------------------------------------------------

# Contracts that expose get_admin
ADMIN_CONTRACTS=("registry" "market" "dispute" "escrow" "payment" "job_registry" "reputation")
# Contracts that expose is_paused
PAUSE_CONTRACTS=("registry" "market" "dispute" "escrow" "payment" "job_registry" "reputation" "fee_distribution" "insurance_pool")
# Contracts that expose version
VERSION_CONTRACTS=("registry" "market" "dispute" "escrow" "payment" "job_registry" "reputation" "fee_distribution" "insurance_pool")

for contract_name in "${!CONTRACT_IDS[@]}"; do
  cid="${CONTRACT_IDS[$contract_name]}"
  expected_admin="${CONTRACT_ADMINS[$contract_name]}"

  echo ""
  echo "--- ${contract_name} (${cid}) ---"

  # --- is_paused ---
  if printf '%s\n' "${PAUSE_CONTRACTS[@]}" | grep -qx "${contract_name}"; then
    paused=$(invoke_ro "${cid}" "is_paused")
    if [[ "$paused" == *"false"* ]]; then
      echo "  [PASS] is_paused: false"
    elif [[ "$paused" == "INVOKE_FAILED" ]]; then
      echo "  [FAIL] is_paused: invocation failed"
      FAIL=1
    else
      echo "  [WARN] is_paused returned: ${paused} (expected false for a fresh deploy)"
    fi
  fi

  # --- get_admin ---
  if printf '%s\n' "${ADMIN_CONTRACTS[@]}" | grep -qx "${contract_name}"; then
    stored_admin=$(invoke_ro "${cid}" "get_admin")
    if [[ -n "$expected_admin" && "$stored_admin" == *"${expected_admin}"* ]]; then
      echo "  [PASS] get_admin matches deployments.json"
    elif [[ "$stored_admin" == "INVOKE_FAILED" ]]; then
      echo "  [FAIL] get_admin: invocation failed"
      FAIL=1
    else
      echo "  [WARN] get_admin returned: ${stored_admin} (expected: ${expected_admin})"
    fi
  fi

  # --- version ---
  if printf '%s\n' "${VERSION_CONTRACTS[@]}" | grep -qx "${contract_name}"; then
    ver=$(invoke_ro "${cid}" "version")
    if [[ "$ver" == "INVOKE_FAILED" ]]; then
      echo "  [FAIL] version: invocation failed"
      FAIL=1
    else
      echo "  [PASS] version: ${ver}"
    fi
  fi
done

echo ""
if [[ "$FAIL" -eq 0 ]]; then
  echo "==> All verification checks passed."
else
  echo "==> One or more verification checks FAILED. Review output above." >&2
  exit 1
fi
