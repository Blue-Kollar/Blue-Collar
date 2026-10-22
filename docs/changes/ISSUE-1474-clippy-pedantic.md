# Issue #1474 — Cargo clippy pedantic lints across all contract crates

## Summary

Enabled `clippy::pedantic` warnings across the entire `packages/contracts`
workspace and ensured every contract crate opts in via `[lints] workspace = true`.

---

## What was audited

`packages/contracts` is a Cargo workspace with 13 member crates:

| Crate | Location |
|---|---|
| `bluecollar-types` | `contracts/types` |
| `bluecollar-registry` | `contracts/registry` |
| `bluecollar-market` | `contracts/market` |
| `bluecollar-dispute` | `contracts/dispute` |
| `bluecollar_fee_distribution` | `contracts/fee_distribution` |
| `bluecollar_insurance_pool` | `contracts/insurance_pool` |
| `bluecollar-fuzz` | `contracts/fuzz` |
| `bluecollar-integration` | `contracts/integration` |
| `bluecollar-reputation` | `contracts/reputation` |
| `bluecollar-job-registry` | `contracts/job_registry` |
| `bluecollar-payment` | `contracts/payment` |
| `bluecollar-escrow` | `contracts/escrow` |
| `bluecollar-access-control` | `contracts/access_control` |

---

## Changes made

### `packages/contracts/Cargo.toml` — workspace lint policy

The `[workspace.lints.clippy]` section was already present (added as part of
issue #1254). It sets `pedantic = "warn"` and suppresses four lint categories
that conflict with Soroban contract patterns:

```toml
[workspace.lints.clippy]
pedantic = "warn"

# Soroban entry-point functions receive `Env` by value (SDK requirement).
needless_pass_by_value = "allow"
# Contract query functions are called by the host; `#[must_use]` is irrelevant.
must_use_candidate = "allow"
# SDK-generated discriminant casts are safe and intentional.
cast_possible_truncation = "allow"
cast_sign_loss = "allow"
# Documenting every `Err` variant is aspirational but not enforced in MVP.
missing_errors_doc = "allow"
# Module-level doc missing on private helper modules is acceptable.
module_name_repetitions = "allow"
```

### Crate-level opt-in — `[lints] workspace = true`

Three crates were missing the opt-in stanza and have been updated:

| File | Change |
|---|---|
| `contracts/access_control/Cargo.toml` | Added `[lints]\nworkspace = true` |
| `contracts/fuzz/Cargo.toml` | Added `[lints]\nworkspace = true` |
| `contracts/integration/Cargo.toml` | Added `[lints]\nworkspace = true` |

All 13 workspace members now include:

```toml
[lints]
workspace = true
```

---

## Rationale for lint exceptions

| Lint suppressed | Reason |
|---|---|
| `needless_pass_by_value` | Soroban's SDK requires contract functions to take `Env` by value — the SDK provides a `Clone`-able handle wrapper but the API signature is non-negotiable. |
| `must_use_candidate` | Contract entry points are invoked by the Soroban host; the return value is serialized on-chain. `#[must_use]` is meaningful only in library contexts. |
| `cast_possible_truncation` / `cast_sign_loss` | The SDK's storage discriminant casts (`as u32`) are safe by construction — the enum values are defined to fit. Changing these casts would require unsafe SDK internals. |
| `missing_errors_doc` | Every public error variant is documented via `ContractError` attributes. Full prose `# Errors` sections in every docstring are aspirational at MVP stage. |
| `module_name_repetitions` | Several modules intentionally use the crate name prefix (e.g. `bluecollar_registry::registry_storage`) to remain unambiguous when imported from integration tests. |

---

## CI

The contract CI workflow (`.github/workflows/contract.yml`) runs:

```sh
cargo clippy --workspace --all-targets -- -D warnings
```

With the workspace lint policy set to `pedantic = "warn"` and exceptions set
to `"allow"`, this command surfaces any new pedantic warnings as warnings
rather than errors. Crate authors are expected to fix or explicitly `#[allow]`
any new warnings before merging.

---

## How to run locally

```bash
cd packages/contracts
cargo clippy --workspace --all-targets -- -W clippy::pedantic
```

To promote all warnings to errors (for pre-merge verification):

```bash
cargo clippy --workspace --all-targets -- -D warnings
```
