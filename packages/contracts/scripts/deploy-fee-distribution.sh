#!/usr/bin/env bash
# deploy-fee-distribution.sh — Build and deploy the BlueCollar Fee Distribution contract.
#
# Usage:
#   ./scripts/deploy-fee-distribution.sh --network testnet|mainnet \
#                                         --source <key-or-alias> \
#                                         --admin <address>
#
# Arguments:
#   --network  Target Stellar network: "testnet" or "mainnet".
#   --source   Stellar CLI identity (alias or raw secret key).
#   --admin    Admin address initialized into the fee distribution contract.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTRACTS_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
DEPLOYMENTS_FILE="${CONTRACTS_DIR}/deployments.json"
WASM_PATH="${CONTRACTS_DIR}/target/wasm32v1-none/release/bluecollar_fee_distribution.wasm"

NETWORK=""
SOURCE=""
ADMIN=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --network) NETWORK="$2"; shift 2 ;;
    --source)  SOURCE="$2";  shift 2 ;;
    --admin)   ADMIN="$2";   shift 2 ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "$NETWORK" || -z "$SOURCE" || -z "$ADMIN" ]]; then
  echo "Usage: $0 --network testnet|mainnet --source <key> --admin <address>" >&2
  exit 1
fi

if [[ -z "${SOURCE// }" ]]; then
  echo "Error: --source must not be empty" >&2
  exit 1
fi

if [[ "$NETWORK" != "testnet" && "$NETWORK" != "mainnet" ]]; then
  echo "Error: --network must be 'testnet' or 'mainnet'" >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------
echo "==> Building fee-distribution contract..."
(cd "${CONTRACTS_DIR}" && cargo build --release --target wasm32v1-none \
  --package bluecollar-fee-distribution 2>&1)

# ---------------------------------------------------------------------------
# Deploy
# ---------------------------------------------------------------------------
echo "==> Deploying to ${NETWORK}..."
CONTRACT_ID=$(stellar contract deploy \
  --wasm "${WASM_PATH}" \
  --source "${SOURCE}" \
  --network "${NETWORK}")

echo "==> Contract ID: ${CONTRACT_ID}"

# ---------------------------------------------------------------------------
# Initialize
# ---------------------------------------------------------------------------
echo "==> Initializing fee-distribution contract..."
stellar contract invoke \
  --id "${CONTRACT_ID}" \
  --source "${SOURCE}" \
  --network "${NETWORK}" \
  -- initialize \
  --admin "${ADMIN}"

# ---------------------------------------------------------------------------
# Post-deploy verification
# ---------------------------------------------------------------------------
echo "==> Verifying deployment..."

PAUSED=$(stellar contract invoke \
  --id "${CONTRACT_ID}" \
  --source "${SOURCE}" \
  --network "${NETWORK}" \
  -- is_paused 2>&1 || echo "VERIFY_FAILED")

if [[ "$PAUSED" == *"false"* ]]; then
  echo "==> Verification passed: contract is not paused."
else
  echo "WARNING: unexpected paused state: ${PAUSED}" >&2
fi

RECIPIENTS=$(stellar contract invoke \
  --id "${CONTRACT_ID}" \
  --source "${SOURCE}" \
  --network "${NETWORK}" \
  -- get_fee_recipients 2>&1 || echo "VERIFY_FAILED")

echo "==> Initial fee recipients: ${RECIPIENTS}"

VERSION=$(stellar contract invoke \
  --id "${CONTRACT_ID}" \
  --source "${SOURCE}" \
  --network "${NETWORK}" \
  -- version 2>&1 || echo "VERIFY_FAILED")

echo "==> Contract version: ${VERSION}"

# ---------------------------------------------------------------------------
# Record deployment
# ---------------------------------------------------------------------------
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

if [[ ! -f "${DEPLOYMENTS_FILE}" ]]; then
  echo '{}' > "${DEPLOYMENTS_FILE}"
fi

python3 - <<EOF
import json

path = "${DEPLOYMENTS_FILE}"
with open(path) as f:
    data = json.load(f)

data.setdefault("${NETWORK}", {})["fee_distribution"] = {
    "contract_id": "${CONTRACT_ID}",
    "admin": "${ADMIN}",
    "deployed_at": "${TIMESTAMP}"
}

with open(path, "w") as f:
    json.dump(data, f, indent=2)
    f.write("\n")

print(f"Saved to {path}")
EOF

echo "==> Done. Fee Distribution contract deployed at ${CONTRACT_ID}"
