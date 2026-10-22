# Interface Versioning Policy

This document covers how the **public function interface** of each contract is
versioned across releases — distinct from the on-chain **WASM upgrade mechanics**
covered in [UPGRADE_GUIDE.md](./UPGRADE_GUIDE.md). A WASM upgrade replaces the code
behind a fixed contract ID; this document is about what's safe to change in that new
code without breaking existing callers (the SDK, the app, external integrators).

## Why this is separate from the upgrade guide

`UPGRADE_GUIDE.md` and `SECURITY.md`'s migration pattern answer *how* to deploy new
code and migrate on-chain storage (`propose_upgrade`/`upgrade`, `migrate`,
`get_schema_version`). They don't say what changes are *safe* to ship in that new code.
That's the gap this document fills, for anyone reading `docs/CONTRACTS.md` or building
against `packages/sdk`.

## Versioning model

Each contract's interface has an implicit version (there is no on-chain interface
version number distinct from `SchemaVersion` — see below). Changes are classified the
same way as semver, applied to the **function signatures and behavior documented in
[docs/CONTRACTS.md](../../docs/CONTRACTS.md)**, not to the crate version in `Cargo.toml`
(these contracts are not published to crates.io; `Cargo.toml` versions track internal
workspace state, not a public interface contract):

| Change type | Examples | Safe to ship via... |
|---|---|---|
| **Patch** (non-breaking, no signature change) | Bug fixes, gas optimizations, internal refactors, tightening an overly-permissive check | `upgrade()` (or `execute_upgrade()` after timelock), no `migrate()` needed unless storage layout changed |
| **Minor** (additive, backward-compatible) | New public function, new optional parameter *at the end* of an existing function via a new function overload (Soroban has no default params — add a new fn instead of changing an existing signature), new event | `upgrade()`, callers on the old interface are unaffected |
| **Major** (breaking) | Changing an existing function's parameter types/order, removing a function, changing a return type, changing storage key encoding | `upgrade()` **+ `migrate()`** if storage changed; bump `SchemaVersion`; requires coordinated updates to `packages/sdk` and any other caller before/alongside the on-chain upgrade |

A "breaking" change to the interface and a storage-layout change that requires
`migrate()` are related but not the same thing — you can have one without the other.
Always check both independently before an upgrade.

## Rules for contributors

1. **Never change an existing public function's signature or semantics in place.**
   Add a new function instead (e.g. `register_v2`) if you need new behavior, or bump
   `SchemaVersion` and go through the full `propose_upgrade`/`migrate` flow (see
   [UPGRADE_GUIDE.md](./UPGRADE_GUIDE.md)) if you must replace it.
2. **Update `docs/CONTRACTS.md`** — its per-contract Public Functions table is the
   source of truth consumers read. A signature change that isn't reflected there is
   treated as undocumented and should not ship.
3. **Update `packages/sdk`** in the same change (or a coordinated follow-up) whenever a
   function used by `RegistryClient`/`HorizonClient` changes — the SDK wraps these
   contracts directly (see [packages/sdk/README.md](../sdk/README.md)) and has no
   independent versioning of its own to cushion a breaking on-chain change.
4. **Deprecating a function**: mark it in its rustdoc comment (`/// @deprecated — use
   X instead. Will be removed no earlier than <target release/date>.`) and note it in
   `docs/CONTRACTS.md`'s function table before removing it in a later major change.
   There's no on-chain deprecation flag — this is a documentation-level contract with
   consumers, not an enforced one.
5. **Registry and Market's `propose_upgrade`/`execute_upgrade` 48-hour timelock** (see
   `docs/CONTRACTS.md#upgrade-flow`) exists precisely so integrators have a window to
   react to an upcoming major change before it goes live — don't rely on same-day
   upgrades for breaking changes on those two contracts.

## Where this fits with `SchemaVersion`

`SchemaVersion` (Registry + Market, see `docs/CONTRACTS.md#storage-ttl-strategy`) tracks
**on-chain storage layout**, bumped by `migrate()`. It is not a general-purpose API
version — a function signature can change without any storage migration, and storage
can migrate without any function signature changing. Don't conflate the two when
deciding whether a change is safe to ship.
