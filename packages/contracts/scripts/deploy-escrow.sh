#!/usr/bin/env bash
# deploy-escrow.sh — Build and deploy the BlueCollar Escrow contract.
#
# Usage:
#   ./scripts/deploy-escrow.sh --network testnet|mainnet \
#                               --source <key-or-alias> \
#                               --admin <address>
#
# Arguments:
#   --network  Target Stellar network: "testnet" or "mainnet".
#   --source   Stellar CLI identity (alias or raw secret key).
#   --admin    Admin address initialized into the escrow contract.
#
# Outputs the deployed contract ID and appends a record to deployments.json.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTRACTS_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
DEPLOYMENTS_FILE="${CONTRACTS_DIR}/deployments.json"
WASM_PATH="${CONTRACTS_DIR}/target/wasm32v1-none/release/bluecollar_escrow.wasm"

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
echo "==> Building escrow contract..."
(cd "${CONTRACTS_DIR}" && cargo build --release --target wasm32v1-none \
  --package bluecollar-escrow 2>&1)

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
echo "==> Initializing escrow contract..."
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

STORED_ADMIN=$(stellar contract invoke \
  --id "${CONTRACT_ID}" \
  --source "${SOURCE}" \
  --network "${NETWORK}" \
  -- get_admin 2>&1 || echo "VERIFY_FAILED")

if [[ "$STORED_ADMIN" == *"${ADMIN}"* ]]; then
  echo "==> Verification passed: admin confirmed on-chain."
else
  echo "WARNING: on-chain admin ('${STORED_ADMIN}') does not match --admin. Check deployment." >&2
fi

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

data.setdefault("${NETWORK}", {})["escrow"] = {
    "contract_id": "${CONTRACT_ID}",
    "admin": "${ADMIN}",
    "deployed_at": "${TIMESTAMP}"
}

with open(path, "w") as f:
    json.dump(data, f, indent=2)
    f.write("\n")

print(f"Saved to {path}")
EOF

echo "==> Done. Escrow contract deployed at ${CONTRACT_ID}"
