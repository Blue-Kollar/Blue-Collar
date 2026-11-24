#!/usr/bin/env bash
# deploy-payment.sh — Build and deploy the BlueCollar Payment contract.
#
# Usage:
#   ./scripts/deploy-payment.sh --network testnet|mainnet \
#                                --source <key-or-alias> \
#                                --admin <address> \
#                                --fee-bps <0-10000> \
#                                --fee-recipient <address>
#
# Arguments:
#   --network        Target Stellar network: "testnet" or "mainnet".
#   --source         Stellar CLI identity (alias preferred over raw key).
#   --admin          Admin address for the initialized contract.
#   --fee-bps        Protocol fee in basis points, 0-10000 (default: 0).
#   --fee-recipient  Address that receives protocol fees (required).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTRACTS_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
DEPLOYMENTS_FILE="${CONTRACTS_DIR}/deployments.json"
WASM_PATH="${CONTRACTS_DIR}/target/wasm32v1-none/release/bluecollar_payment.wasm"

NETWORK=""
SOURCE=""
ADMIN=""
FEE_BPS="0"
FEE_RECIPIENT=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --network)       NETWORK="$2";       shift 2 ;;
    --source)        SOURCE="$2";        shift 2 ;;
    --admin)         ADMIN="$2";         shift 2 ;;
    --fee-bps)       FEE_BPS="$2";       shift 2 ;;
    --fee-recipient) FEE_RECIPIENT="$2"; shift 2 ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "$NETWORK" || -z "$SOURCE" || -z "$ADMIN" || -z "$FEE_RECIPIENT" ]]; then
  echo "Usage: $0 --network testnet|mainnet --source <key> --admin <addr> \
--fee-bps <n> --fee-recipient <addr>" >&2
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
echo "==> Building payment contract..."
(cd "${CONTRACTS_DIR}" && cargo build --release --target wasm32v1-none \
  --package bluecollar-payment 2>&1)

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
echo "==> Initializing payment contract..."
stellar contract invoke \
  --id "${CONTRACT_ID}" \
  --source "${SOURCE}" \
  --network "${NETWORK}" \
  -- initialize \
  --admin "${ADMIN}" \
  --fee_bps "${FEE_BPS}" \
  --fee_recipient "${FEE_RECIPIENT}"

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
  echo "WARNING: on-chain admin does not match --admin. Check deployment." >&2
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

CONFIG=$(stellar contract invoke \
  --id "${CONTRACT_ID}" \
  --source "${SOURCE}" \
  --network "${NETWORK}" \
  -- get_config_view 2>&1 || echo "VERIFY_FAILED")

echo "==> Contract config: ${CONFIG}"

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

data.setdefault("${NETWORK}", {})["payment"] = {
    "contract_id": "${CONTRACT_ID}",
    "admin": "${ADMIN}",
    "fee_bps": ${FEE_BPS},
    "fee_recipient": "${FEE_RECIPIENT}",
    "deployed_at": "${TIMESTAMP}"
}

with open(path, "w") as f:
    json.dump(data, f, indent=2)
    f.write("\n")

print(f"Saved to {path}")
EOF

echo "==> Done. Payment contract deployed at ${CONTRACT_ID}"
