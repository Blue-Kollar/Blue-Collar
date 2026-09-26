#!/usr/bin/env bash
# Profile the storage read/write footprint of the key `job_registry` and
# `market` entrypoints (issue #1433).
#
# Prints one `[BENCH]` line per entrypoint with the CPU instruction cost and
# memory byte cost of that call, measured after `budget().reset_unlimited()`.
# Run it before and after a storage change and diff the output to quantify the
# resource delta.
#
# Usage (from packages/contracts):
#   ./scripts/profile-storage.sh
#
# Or directly:
#   cargo test -p bluecollar-job-registry benchmarks -- --nocapture
#   cargo test -p bluecollar-market benchmarks -- --nocapture

set -euo pipefail

cd "$(dirname "$0")/.."

echo "== job_registry =="
cargo test -p bluecollar-job-registry benchmarks -- --nocapture --test-threads=1

echo
echo "== market =="
cargo test -p bluecollar-market benchmarks -- --nocapture --test-threads=1
