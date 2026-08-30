//! # BlueCollar Access Control
//!
//! Shared role-based access control (RBAC) library used by all BlueCollar
//! Soroban contracts.
//!
//! ## Design
//!
//! Roles are stored in **persistent** contract storage under a compact `u64`
//! key to minimise storage reads.  Each role maps to a `Vec<Address>` of
//! members.  The `u64` key for well-known roles is stable and defined by the
//! constants in this crate.
//!
//! Contracts that use this module must include a `DataKey::RoleMembers(u64)`
//! variant in their own `DataKey` enum, matching the storage layout used here,
//! OR call the helper functions provided (which use the same key format).
//!
//! ## Usage
//!
//! ```rust,ignore
//! use bluecollar_access_control as ac;
//!
//! // In an entrypoint:
//! ac::require_role(&env, &Symbol::new(&env, "admin"), &caller)?;
//! ac::require_not_paused(&env)?;
//!
//! // Grant a role:
//! ac::grant_role(&env, &Symbol::new(&env, "curator_mgr"), &new_curator_mgr);
//!
//! // Check a role:
//! let is_admin = ac::has_role(&env, &Symbol::new(&env, "admin"), &caller);
//! ```

#![no_std]

use bluecollar_types::{helpers, ContractError};
use soroban_sdk::{contracttype, Address, Env, Symbol, Vec};

// =============================================================================
// Well-known role IDs
// =============================================================================

/// Full admin â€” can grant/revoke any role and call all privileged functions.
pub const ROLE_ADMIN_ID: u64 = 0;
/// May pause and unpause the contract.
pub const ROLE_PAUSER_ID: u64 = 1;
/// General manager slot (e.g. `curator_mgr`, `fee_mgr`).
pub const ROLE_MANAGER_ID: u64 = 2;
/// May update reputation scores (registry-specific).
pub const ROLE_REP_MGR_ID: u64 = 3;
/// May upgrade the contract WASM.
pub const ROLE_UPGRADER_ID: u64 = 4;

// Well-known role string constants.
pub const ROLE_ADMIN: &str = "admin";
pub const ROLE_PAUSER: &str = "pauser";
pub const ROLE_CURATOR_MGR: &str = "curator_mgr";
pub const ROLE_FEE_MGR: &str = "fee_mgr";
pub const ROLE_REP_MGR: &str = "rep_mgr";
pub const ROLE_UPGRADER: &str = "upgrader";

// =============================================================================
// Storage key
// =============================================================================

/// The storage key used for role member lists.
///
/// Both the Registry and Market contracts use `DataKey::RoleMembers(u64)` with
/// the same layout.  This type mirrors that variant so this library can read
/// and write the same storage entries.
#[contracttype]
pub enum AccessControlKey {
    /// Persistent storage â€” `Vec<Address>` of members for a given role id.
    RoleMembers(u64),
    /// Instance storage â€” paused flag.
    Paused,
}

// =============================================================================
// Role ID mapping
// =============================================================================

/// Convert a role `Symbol` to its compact `u64` storage ID.
///
/// Unknown roles map to `u64::MAX` so they get their own distinct bucket
/// without colliding with the well-known IDs above.
pub fn role_to_id(env: &Env, role: &Symbol) -> u64 {
    if *role == Symbol::new(env, ROLE_ADMIN) {
        ROLE_ADMIN_ID
    } else if *role == Symbol::new(env, ROLE_PAUSER) {
        ROLE_PAUSER_ID
    } else if *role == Symbol::new(env, ROLE_CURATOR_MGR) {
        ROLE_MANAGER_ID
    } else if *role == Symbol::new(env, ROLE_FEE_MGR) {
        ROLE_MANAGER_ID
    } else if *role == Symbol::new(env, ROLE_REP_MGR) {
        ROLE_REP_MGR_ID
    } else if *role == Symbol::new(env, ROLE_UPGRADER) {
        ROLE_UPGRADER_ID
    } else {
        u64::MAX
    }
}

// =============================================================================
// Storage accessors
// =============================================================================

/// Return the member list for `role_id`, or an empty vec.
pub fn get_role_members(env: &Env, role_id: u64) -> Vec<Address> {
    env.storage()
        .persistent()
        .get(&AccessControlKey::RoleMembers(role_id))
        .unwrap_or(Vec::new(env))
}

/// Persist an updated member list for `role_id`.
pub fn set_role_members(env: &Env, role_id: u64, members: &Vec<Address>) {
    env.storage()
        .persistent()
        .set(&AccessControlKey::RoleMembers(role_id), members);
}

// =============================================================================
// Access-control helpers
// =============================================================================

/// Assert that `caller` holds `role` and has authorised this call.
///
/// Returns `Err(ContractError::MissingRole)` if the caller is not a member.
pub fn require_role(env: &Env, role: &Symbol, caller: &Address) -> Result<(), ContractError> {
    let members = get_role_members(env, role_to_id(env, role));
    helpers::require_role(caller, &members)
}

/// Assert that the contract is not paused.
///
/// Returns `Err(ContractError::ContractIsPaused)` if `Paused` is `true` in
/// instance storage.
pub fn require_not_paused(env: &Env) -> Result<(), ContractError> {
    let paused: bool = env
        .storage()
        .instance()
        .get(&AccessControlKey::Paused)
        .unwrap_or(false);
    helpers::require_not_paused(paused)
}

/// Grant `role` to `account`.  Idempotent â€” adding an existing member is a no-op.
pub fn grant_role(env: &Env, role: &Symbol, account: &Address) {
    let role_id = role_to_id(env, role);
    let mut members = get_role_members(env, role_id);
    if members.iter().all(|m| m != *account) {
        members.push_back(account.clone());
        set_role_members(env, role_id, &members);
    }
}

/// Revoke `role` from `account`.
///
/// Returns `Err(ContractError::AccountDoesNotHoldRole)` if the account is not
/// currently a member.
pub fn revoke_role(
    env: &Env,
    role: &Symbol,
    account: &Address,
) -> Result<(), ContractError> {
    let role_id = role_to_id(env, role);
    let members = get_role_members(env, role_id);
    let mut updated: Vec<Address> = Vec::new(env);
    let mut found = false;
    for m in members.iter() {
        if m == *account {
            found = true;
        } else {
            updated.push_back(m);
        }
    }
    if !found {
        return Err(ContractError::AccountDoesNotHoldRole);
    }
    set_role_members(env, role_id, &updated);
    Ok(())
}

/// Returns `true` if `account` holds `role`.
pub fn has_role(env: &Env, role: &Symbol, account: &Address) -> bool {
    get_role_members(env, role_to_id(env, role))
        .iter()
        .any(|m| m == *account)
}

/// Set the paused flag.
pub fn set_paused(env: &Env, paused: bool) {
    env.storage()
        .instance()
        .set(&AccessControlKey::Paused, &paused);
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    extern crate std;
    use super::*;
    use soroban_sdk::{testutils::Address as _, Address, Env, Symbol};

    fn make_env() -> Env {
        let env = Env::default();
        env.mock_all_auths();
        env
    }

    #[test]
    fn test_grant_and_has_role() {
        let env = make_env();
        let admin = Address::generate(&env);
        let role = Symbol::new(&env, ROLE_ADMIN);

        assert!(!has_role(&env, &role, &admin));
        grant_role(&env, &role, &admin);
        assert!(has_role(&env, &role, &admin));
    }

    #[test]
    fn test_grant_role_idempotent() {
        let env = make_env();
        let admin = Address::generate(&env);
        let role = Symbol::new(&env, ROLE_ADMIN);

        grant_role(&env, &role, &admin);
        grant_role(&env, &role, &admin); // should not add a second entry

        let members = get_role_members(&env, role_to_id(&env, &role));
        assert_eq!(members.len(), 1);
    }

    #[test]
    fn test_revoke_role_succeeds() {
        let env = make_env();
        let admin = Address::generate(&env);
        let role = Symbol::new(&env, ROLE_ADMIN);

        grant_role(&env, &role, &admin);
        assert!(has_role(&env, &role, &admin));

        revoke_role(&env, &role, &admin).expect("revoke should succeed");
        assert!(!has_role(&env, &role, &admin));
    }

    #[test]
    fn test_revoke_role_not_member_returns_error() {
        let env = make_env();
        let stranger = Address::generate(&env);
        let role = Symbol::new(&env, ROLE_ADMIN);

        let result = revoke_role(&env, &role, &stranger);
        assert_eq!(result, Err(ContractError::AccountDoesNotHoldRole));
    }

    #[test]
    fn test_require_role_success() {
        let env = make_env();
        let admin = Address::generate(&env);
        let role = Symbol::new(&env, ROLE_ADMIN);

        grant_role(&env, &role, &admin);
        assert!(require_role(&env, &role, &admin).is_ok());
    }

    #[test]
    fn test_require_role_failure() {
        let env = make_env();
        let stranger = Address::generate(&env);
        let role = Symbol::new(&env, ROLE_ADMIN);

        let result = require_role(&env, &role, &stranger);
        assert_eq!(result, Err(ContractError::MissingRole));
    }

    #[test]
    fn test_require_not_paused_when_not_paused() {
        let env = make_env();
        assert!(require_not_paused(&env).is_ok());
    }

    #[test]
    fn test_require_not_paused_when_paused() {
        let env = make_env();
        set_paused(&env, true);
        let result = require_not_paused(&env);
        assert_eq!(result, Err(ContractError::ContractIsPaused));
    }

    #[test]
    fn test_unpause_allows_calls() {
        let env = make_env();
        set_paused(&env, true);
        assert!(require_not_paused(&env).is_err());
        set_paused(&env, false);
        assert!(require_not_paused(&env).is_ok());
    }

    #[test]
    fn test_multiple_roles_independent() {
        let env = make_env();
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);

        let admin_role = Symbol::new(&env, ROLE_ADMIN);
        let pauser_role = Symbol::new(&env, ROLE_PAUSER);

        grant_role(&env, &admin_role, &alice);
        grant_role(&env, &pauser_role, &bob);

        assert!(has_role(&env, &admin_role, &alice));
        assert!(!has_role(&env, &admin_role, &bob));
        assert!(has_role(&env, &pauser_role, &bob));
        assert!(!has_role(&env, &pauser_role, &alice));
    }

    #[test]
    fn test_multiple_members_per_role() {
        let env = make_env();
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);
        let role = Symbol::new(&env, ROLE_CURATOR_MGR);

        grant_role(&env, &role, &alice);
        grant_role(&env, &role, &bob);

        assert!(has_role(&env, &role, &alice));
        assert!(has_role(&env, &role, &bob));

        revoke_role(&env, &role, &alice).unwrap();
        assert!(!has_role(&env, &role, &alice));
        assert!(has_role(&env, &role, &bob));
    }

    #[test]
    fn test_role_to_id_unknown_role() {
        let env = make_env();
        let unknown = Symbol::new(&env, "completely_unknown_xyz");
        assert_eq!(role_to_id(&env, &unknown), u64::MAX);
    }

    #[test]
    fn test_role_to_id_known_roles() {
        let env = make_env();
        assert_eq!(role_to_id(&env, &Symbol::new(&env, ROLE_ADMIN)), ROLE_ADMIN_ID);
        assert_eq!(role_to_id(&env, &Symbol::new(&env, ROLE_PAUSER)), ROLE_PAUSER_ID);
        assert_eq!(role_to_id(&env, &Symbol::new(&env, ROLE_REP_MGR)), ROLE_REP_MGR_ID);
        assert_eq!(role_to_id(&env, &Symbol::new(&env, ROLE_UPGRADER)), ROLE_UPGRADER_ID);
    }
}
