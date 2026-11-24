#!/usr/bin/env bash
# deploy-insurance-pool.sh — Build and deploy the BlueCollar Insurance Pool contract.
#
# Usage:
#   ./scripts/deploy-insurance-pool.sh --network testnet|mainnet \
#                                       --source <key-or-alias> \
#                                       --admin <address> \
#                                       --token <token-address> \
#                                       --premium-bps <0-10000>
#
# Arguments:
#   --network      Target Stellar network: "testnet" or "mainnet".
#   --source       Stellar CLI identity (alias or raw secret key).
#   --admin        Admin address initialized into the insurance pool contract.
#   --token        Token address used as the pool's default contribution token.
#   --premium-bps  Initial premium in basis points, 0-10000 (default: 500).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTRACTS_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
DEPLOYMENTS_FILE="${CONTRACTS_DIR}/deployments.json"
WASM_PATH="${CONTRACTS_DIR}/target/wasm32v1-none/release/bluecollar_insurance_pool.wasm"

NETWORK=""
SOURCE=""
ADMIN=""
TOKEN=""
PREMIUM_BPS="500"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --network)     NETWORK="$2";     shift 2 ;;
    --source)      SOURCE="$2";      shift 2 ;;
    --admin)       ADMIN="$2";       shift 2 ;;
    --token)       TOKEN="$2";       shift 2 ;;
    --premium-bps) PREMIUM_BPS="$2"; shift 2 ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "$NETWORK" || -z "$SOURCE" || -z "$ADMIN" || -z "$TOKEN" ]]; then
  echo "Usage: $0 --network testnet|mainnet --source <key> --admin <addr> \
--token <addr> [--premium-bps <n>]" >&2
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
echo "==> Building insurance-pool contract..."
(cd "${CONTRACTS_DIR}" && cargo build --release --target wasm32v1-none \
  --package bluecollar-insurance-pool 2>&1)

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
echo "==> Initializing insurance-pool contract..."
stellar contract invoke \
  --id "${CONTRACT_ID}" \
  --source "${SOURCE}" \
  --network "${NETWORK}" \
  -- initialize \
  --admin "${ADMIN}" \
  --token "${TOKEN}" \
  --premium_bps "${PREMIUM_BPS}"

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

POOL_STATS=$(stellar contract invoke \
  --id "${CONTRACT_ID}" \
  --source "${SOURCE}" \
  --network "${NETWORK}" \
  -- get_pool_stats \
  --token "${TOKEN}" 2>&1 || echo "VERIFY_FAILED")

echo "==> Initial pool stats: ${POOL_STATS}"

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

data.setdefault("${NETWORK}", {})["insurance_pool"] = {
    "contract_id": "${CONTRACT_ID}",
    "admin": "${ADMIN}",
    "token": "${TOKEN}",
    "premium_bps": ${PREMIUM_BPS},
    "deployed_at": "${TIMESTAMP}"
}

with open(path, "w") as f:
    json.dump(data, f, indent=2)
    f.write("\n")

print(f"Saved to {path}")
EOF

echo "==> Done. Insurance Pool contract deployed at ${CONTRACT_ID}"
