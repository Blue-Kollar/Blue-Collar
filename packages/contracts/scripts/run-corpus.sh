#!/usr/bin/env bash
# run-corpus.sh — Run all libFuzzer targets with a bounded iteration count
# suitable for CI usage.
#
# Each target receives:
#   -runs=1000   — 1 000 input iterations per target (fast, deterministic CI gate)
#   -max_len=1024 — input length cap consistent with the per-target Makefile rules
#   -timeout=10  — per-input wall-clock timeout in seconds
#
# Usage:
#   ./scripts/run-corpus.sh
#
# Requirements:
#   - Rust nightly toolchain (cargo +nightly)
#   - cargo-fuzz  (cargo install --locked cargo-fuzz)
#   - The bluecollar-fuzz crate is built with the `fuzzing` feature enabled by
#     cargo-fuzz automatically.
#
# Exit behaviour:
#   The script exits with a non-zero code on the first target that fails so CI
#   fails fast.  Set FAIL_FAST=0 to run all targets regardless of failures.

set -euo pipefail

FAIL_FAST="${FAIL_FAST:-1}"
RUNS="${RUNS:-1000}"
MAX_LEN="${MAX_LEN:-1024}"
TIMEOUT="${TIMEOUT:-10}"

FUZZ_TARGETS=(
  fuzz_register
  fuzz_tip
  fuzz_migrate
  fuzz_dispute
  fuzz_escrow_ops
)

# Locate the fuzz crate root (the directory that contains its Cargo.toml).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTRACTS_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
FUZZ_DIR="${CONTRACTS_DIR}/contracts/fuzz"

if [[ ! -f "${FUZZ_DIR}/Cargo.toml" ]]; then
  echo "ERROR: Cannot find fuzz crate at ${FUZZ_DIR}" >&2
  exit 1
fi

# Install cargo-fuzz if not already present.
if ! command -v cargo-fuzz &>/dev/null; then
  echo "Installing cargo-fuzz…"
  cargo install --locked cargo-fuzz
fi

FAILURES=()

for target in "${FUZZ_TARGETS[@]}"; do
  echo ""
  echo "========================================================================"
  echo "  Running fuzz target: ${target}  (runs=${RUNS})"
  echo "========================================================================"

  set +e
  (
    cd "${FUZZ_DIR}"
    cargo +nightly fuzz run "${target}" \
      -- \
      -runs="${RUNS}" \
      -max_len="${MAX_LEN}" \
      -timeout="${TIMEOUT}"
  )
  exit_code=$?
  set -e

  if [[ ${exit_code} -ne 0 ]]; then
    FAILURES+=("${target}")
    echo "FAIL: ${target} exited with code ${exit_code}" >&2
    if [[ "${FAIL_FAST}" -eq 1 ]]; then
      exit "${exit_code}"
    fi
  else
    echo "PASS: ${target}"
  fi
done

echo ""
if [[ ${#FAILURES[@]} -eq 0 ]]; then
  echo "All fuzz corpus runs passed."
  exit 0
else
  echo "Failed targets: ${FAILURES[*]}" >&2
  exit 1
fi
