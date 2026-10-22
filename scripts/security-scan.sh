#!/usr/bin/env bash
# Local security scan: secrets with gitleaks, and dependency advisories with pnpm audit.
# Usage: scripts/security-scan.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

command -v gitleaks >/dev/null 2>&1 \
  || { echo "gitleaks is not installed: https://github.com/gitleaks/gitleaks" >&2; exit 1; }
command -v pnpm >/dev/null 2>&1 \
  || { echo "pnpm is not installed: https://pnpm.io/installation" >&2; exit 1; }

echo "== gitleaks (secrets, config: .gitleaks.toml) =="
gitleaks detect --source . --config .gitleaks.toml --redact

echo "== pnpm audit (dependency advisories, production dependencies) =="
pnpm audit --prod
