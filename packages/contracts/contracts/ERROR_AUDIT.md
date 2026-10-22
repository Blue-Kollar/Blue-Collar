# Error enum audit (Issue #1354)

## Method

Searched every crate under `packages/contracts/contracts` for
`#[contracterror]` / `enum ... Error` definitions:

```
grep -rn "enum.*Error\|#\[contracterror\]" packages/contracts/contracts --include="*.rs"
```

## Finding

Every contract crate (`registry`, `job_registry`, `escrow`, `payment`,
`market`, `reputation`, `dispute`, `insurance_pool`, `fee_distribution`)
already imports and returns `bluecollar_types::ContractError` exclusively.
There are **no** per-contract error enums left to consolidate — the shared
module described in the issue (`contracts/shared/src/error.rs`) already
exists in this codebase as `packages/contracts/contracts/types/src/errors.rs`
(the `types` crate is the workspace's shared crate, published as
`bluecollar_types` and depended on by every other contract crate).

## What this PR does

Since the consolidation itself was already complete, this change focuses on
the remaining risk called out in the issue — "overlapping variants... risking
drift" — which still exists *inside* the shared enum itself:

- `NotAuthorized` / `Unauthorized` / `UnauthorizedCaller` all mean "caller not
  permitted."
- `AmountMustBePositive` / `AmountMustBePositiveAlt` are duplicates.

These were **not** removed or renumbered: `#[contracterror]` discriminants
are part of the on-chain ABI and the client SDK's generated bindings, so
deleting a variant that any deployed contract or SDK caller matches on would
be a breaking change outside the scope of a same-day refactor. Instead,
`errors.rs` now documents which variant is canonical and instructs future
contract authors not to add further synonyms — the "genuinely shared
variants" consolidation this issue asks for going forward.

## Follow-up (not done here)

A breaking-change migration (major SDK version bump) could drop
`Unauthorized`, `UnauthorizedCaller`, and `AmountMustBePositiveAlt` entirely
once all client integrations are confirmed to use the canonical variants.
That should be its own tracked issue, since it requires coordinating a
client SDK release.

## Test coverage

No error-path tests were removed or altered; existing coverage in each
contract's `test.rs` (e.g. `test_release_requires_authorization`-style tests)
continues to assert against `ContractError` as before — no call sites
changed since no variants were renumbered or removed.
