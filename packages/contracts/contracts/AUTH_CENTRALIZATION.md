# Auth-check centralization (Issue #1353)

## Inventory

Authorization patterns found duplicated across contracts under
`packages/contracts/contracts`:

| Pattern | Previous locations |
|---|---|
| "caller holds role X" | `escrow/src/logic.rs` (`require_role`), `job_registry`, `access_control`, `dispute`, `market` — each re-implemented an `members.iter().any(|m| m == caller)` loop after `caller.require_auth()` |
| "caller is admin" | `registry`, `payment`, `insurance_pool` — ad-hoc `caller == admin` checks |
| "caller is one of two parties" (depositor/beneficiary, buyer/seller) | `escrow::do_dispute`, `job_registry` job-completion checks, `dispute` evidence submission |
| "caller is the resource owner OR an admin" | `escrow::do_release`, `escrow::do_cancel`, `job_registry` job cancellation |
| "contract is not paused" | every contract with a `pause`/`unpause` entrypoint |

## What changed

`bluecollar_types::helpers` (`packages/contracts/contracts/types/src/helpers.rs`)
was already the shared crate every contract depends on (via
`use bluecollar_types::{helpers, ContractError};`), and already centralized
`require_role`, `require_admin`, and `require_not_paused`. This effort adds
the two remaining duplicated patterns to that module:

- `helpers::require_party(caller, party_a, party_b)` — caller must be one of
  two addresses. Replaces ad-hoc `caller == a || caller == b` checks.
- `helpers::require_owner_or_role(caller, primary, admins)` — caller must be
  the primary address or a member of an admin/role list. Replaces ad-hoc
  `is_owner || is_admin` checks.

Both call `caller.require_auth()` internally (consistent with the existing
`require_role`/`require_admin` helpers), so a missing signature is rejected
before the ownership/role comparison runs.

## Migrated in this change

- `escrow::do_release` — owner-or-admin check → `require_owner_or_role`
- `escrow::do_cancel` — owner-or-admin family check documented as the next
  candidate (kept local because it also folds in an expiry condition; see
  inline comment)
- `escrow::do_dispute` — two-party check → `require_party`

## Remaining migration (tracked, not yet done in this PR)

`job_registry`, `access_control`, `dispute`, and `market` still contain
locally-duplicated versions of the same "party" and "owner-or-admin"
patterns identified above. They should be migrated to
`helpers::require_party` / `helpers::require_owner_or_role` in a follow-up
PR using the same mechanical substitution applied to `escrow` here — no new
shared helpers should be required. Each entrypoint should keep (or gain) a
`try_*` unauthorized-caller test, following the existing
`test_upgrade_requires_upgrader_role`-style tests already present in
`escrow/src/test.rs`.

## Tests

`packages/contracts/contracts/types/src/helpers.rs` gained unit tests for
both new helpers (`require_party_*`, `require_owner_or_role_*`), covering
the authorized-owner, authorized-admin, and rejected-stranger cases.
