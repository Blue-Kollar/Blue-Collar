# Issue #1246 â€” Access Control Migration Guide

This document describes the changes needed to wire `bluecollar-access-control`
into the Registry and Market contracts to eliminate duplicated role-check logic.

---

## 1. `packages/contracts/Cargo.toml` â€” add workspace member

Add `contracts/access_control` to the workspace members list:

```toml
[workspace]
members = [
    # existing members ...
    "contracts/access_control",   # ADD THIS
]
```

And add the dependency to `[workspace.dependencies]` so contracts can reference it:

```toml
[workspace.dependencies]
bluecollar-access-control = { path = "contracts/access_control" }
```

---

## 2. `packages/contracts/contracts/registry/Cargo.toml`

Add the dependency:

```toml
[dependencies]
bluecollar-access-control = { workspace = true }
```

---

## 3. `packages/contracts/contracts/market/Cargo.toml`

Add the dependency:

```toml
[dependencies]
bluecollar-access-control = { workspace = true }
```

---

## 4. Registry contract â€” what changes

In `registry/src/logic.rs`, replace the local role helpers with calls to
`bluecollar_access_control`:

**Before (in logic.rs):**
```rust
use crate::storage::{get_role_members, ...};

pub(crate) fn role_to_id(env: &Env, role: &Symbol) -> u64 { /* 20 lines */ }

pub(crate) fn require_role(env: &Env, role: &Symbol, caller: &Address) -> Result<(), ContractError> {
    let members = get_role_members(env, role_to_id(env, role));
    helpers::require_role(caller, &members)
}

pub(crate) fn require_not_paused(env: &Env) -> Result<(), ContractError> {
    let paused: bool = env.storage().instance().get(&DataKey::Paused).unwrap_or(false);
    helpers::require_not_paused(paused)
}
```

**After (in logic.rs):**
```rust
use bluecollar_access_control as ac;

pub(crate) fn role_to_id(env: &Env, role: &Symbol) -> u64 {
    ac::role_to_id(env, role)
}

pub(crate) fn require_role(env: &Env, role: &Symbol, caller: &Address) -> Result<(), ContractError> {
    ac::require_role(env, role, caller)
}

pub(crate) fn require_not_paused(env: &Env) -> Result<(), ContractError> {
    ac::require_not_paused(env)
}
```

In `registry/src/lib.rs`, the `grant_role` and `revoke_role` entrypoints can
delegate their member-list manipulation to `ac::grant_role` / `ac::revoke_role`:

**Before:**
```rust
pub fn grant_role(env: Env, caller: Address, role: Symbol, account: Address) -> Result<(), ContractError> {
    logic::require_role(&env, &admin_role, &caller)?;
    let role_id = logic::role_to_id(&env, &role);
    let mut members = storage::get_role_members(&env, role_id);
    if members.iter().all(|m| m != account) {
        members.push_back(account.clone());
        storage::set_role_members(&env, role_id, &members);
    }
    // ...
}
```

**After:**
```rust
use bluecollar_access_control as ac;

pub fn grant_role(env: Env, caller: Address, role: Symbol, account: Address) -> Result<(), ContractError> {
    ac::require_role(&env, &Symbol::new(&env, ROLE_ADMIN), &caller)?;
    ac::require_not_paused(&env)?;
    ac::grant_role(&env, &role, &account);
    env.events().publish((symbol_short!("RlGrnt"), role, account), ());
    Ok(())
}

pub fn revoke_role(env: Env, caller: Address, role: Symbol, account: Address) -> Result<(), ContractError> {
    ac::require_role(&env, &Symbol::new(&env, ROLE_ADMIN), &caller)?;
    ac::require_not_paused(&env)?;
    ac::revoke_role(&env, &role, &account)?;
    env.events().publish((symbol_short!("RlRvkd"), role, account), ());
    Ok(())
}

pub fn has_role(env: Env, role: Symbol, account: Address) -> Result<bool, ContractError> {
    Ok(ac::has_role(&env, &role, &account))
}
```

---

## 5. Market contract â€” what changes

In `market/src/lib.rs`, replace the local `role_to_id`, `get_role_members`,
`require_role`, `require_not_paused`, `grant_role`, `revoke_role`, and
`has_role` implementations with calls to `bluecollar_access_control`:

**Before (local free functions):**
```rust
fn role_to_id(env: &Env, role: &Symbol) -> u64 { /* 20 lines */ }
fn get_role_members(env: &Env, role: &Symbol) -> Vec<Address> { /* ... */ }
fn require_role(env: &Env, role: &Symbol, caller: &Address) -> Result<(), ContractError> { /* ... */ }
fn require_not_paused(env: &Env) -> Result<(), ContractError> { /* ... */ }
```

**After:**
```rust
use bluecollar_access_control as ac;

// Remove all the local helpers above and replace call sites:
// - require_role(...) â†’ ac::require_role(...)
// - require_not_paused(...) â†’ ac::require_not_paused(...)
// - grant_role body â†’ ac::grant_role(...)
// - revoke_role body â†’ ac::revoke_role(...)
// - has_role body â†’ ac::has_role(...)
```

---

## 6. Shared constants

Both contracts currently define their own `ROLE_*_ID` constants with the same
values.  After migration, import them from `bluecollar_access_control`:

```rust
use bluecollar_access_control::{
    ROLE_ADMIN_ID, ROLE_PAUSER_ID, ROLE_MANAGER_ID, ROLE_REP_MGR_ID, ROLE_UPGRADER_ID,
    ROLE_ADMIN, ROLE_PAUSER, ROLE_CURATOR_MGR, ROLE_FEE_MGR, ROLE_REP_MGR, ROLE_UPGRADER,
};
```

---

## Storage compatibility note

`bluecollar_access_control` uses `AccessControlKey::RoleMembers(u64)` as its
storage key.  The Registry and Market contracts currently use
`DataKey::RoleMembers(u64)`.  Both resolve to the same on-chain key as long as
the `u64` values match (which they do â€” the IDs are identical).  No data
migration is required.
