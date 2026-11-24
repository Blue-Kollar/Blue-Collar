# Secret Scanning

Gitleaks runs locally and in CI using the repository config
[`.gitleaks.toml`](../.gitleaks.toml). The config is validated against
Gitleaks **8.30.1**, which is the version pinned in CI. A custom config
replaces the built-in rule set, so all enabled detectors are declared in that
file.

## Local scan commands

Always pass `--redact` so matching values are never printed, and keep any
report file outside the repository (or delete it after review).

```bash
gitleaks version

# Working tree (ignores git history)
gitleaks detect --source . --config .gitleaks.toml --no-git --redact \
  --report-format json --report-path /tmp/gitleaks-wt.json

# Full git history, including all refs
gitleaks detect --source . --config .gitleaks.toml --redact \
  --log-opts="--all" --report-format json --report-path /tmp/gitleaks-history.json

# Only the commits in a pull request
gitleaks detect --source . --config .gitleaks.toml --redact \
  --log-opts="origin/main..HEAD"
```

Exit code `1` means findings were detected. Inspect reports with a tool that
selects only `RuleID`, `File`, and `StartLine`/`Commit` fields; never print the
`Secret` field.

## On a finding

1. Treat it as real until proven otherwise. Do not copy the value into an
   issue, PR, chat, or commit message.
2. Note the rule ID, file, and line/commit from the redacted output.
3. **Fixture or vendored dependency:** add a narrow, documented entry to an
   allowlist in `.gitleaks.toml` (prefer an exact regex or a tightly scoped
   test path), then re-run both scans. Do not allowlist a broad source tree.
4. **Likely real credential:** stop and escalate to the secret owner. Do not
   edit or delete the value locally; removal from the working tree does not
   remove it from history.

## Rotation (owner action)

Rotation is performed only by the owner of the affected secret / Ops using the
canonical procedures in [SECRETS_MANAGEMENT.md](./SECRETS_MANAGEMENT.md#12-rotation-procedures-operationalised--798):

1. Revoke or rotate the credential at the provider first.
2. Update the authoritative store (Vault, GitHub Actions secrets, etc.) and
   roll the dependent workloads.
3. For `JWT_SECRET`, allow one token TTL for old tokens to expire; for database
   credentials, use the documented dual-write window.
4. Purge the value from Git history (`git filter-repo` or BFG), force-push the
   cleaned history, and ask collaborators to re-clone.
5. Re-run the full history scan above to confirm zero findings, then file a
   post-mortem referencing the leak.

## CI

- `.github/workflows/secret-scan.yml`: blocking Gitleaks gate on every push and
  PR, using the local config (PR delta on PRs, all refs on push), plus
  TruffleHog verified-only scanning.
- `.github/workflows/security-scan.yml`: full-history Gitleaks scan for
  security-review-triggering changes.
