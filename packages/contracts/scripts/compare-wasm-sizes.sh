#!/usr/bin/env bash
# Compare the release WASM bytecode size of every deployable BlueCollar
# contract (issue #1847). Builds with the optimised release profile
# (opt-level = "z", strip = "symbols", panic = "abort", codegen-units = 1)
# and prints one line per contract plus the total.
#
# To check a size regression, capture a baseline before a change and diff it
# against the output after the change:
#
#   ./scripts/compare-wasm-sizes.sh > before.txt
#   # ... change contract code ...
#   ./scripts/compare-wasm-sizes.sh > after.txt
#   diff before.txt after.txt
#
# Usage (from packages/contracts):
#   ./scripts/compare-wasm-sizes.sh

set -euo pipefail

cd "$(dirname "$0")/.."

# Match the CI release build: every contract crate except the test-only fuzz
# and integration crates, which are not deployed as WASM.
cargo build --release --target wasm32v1-none --workspace \
  --exclude bluecollar-fuzz --exclude bluecollar-integration

WASM_DIR="target/wasm32v1-none/release"

echo "== contract WASM sizes (release, opt-level z) =="
total=0
for wasm in "$WASM_DIR"/*.wasm; do
  name=$(basename "$wasm" .wasm)
  size=$(wc -c < "$wasm" | tr -d ' ')
  printf '%-40s %10s bytes\n' "$name" "$size"
  total=$((total + size))
done
echo
printf '%-40s %10s bytes\n' "TOTAL" "$total"
