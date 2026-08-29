//! # BlueCollar Escrow Contract
//!
//! Refactored from a monolithic `lib.rs` into three focused modules (issue #1020):
//!
//! | Module    | Responsibility |
//! |-----------|----------------|
//! | `storage` | Persistent/instance storage reads, writes, types, TTL helpers |
//! | `logic`   | CEI-ordered state transitions, RBAC guards, role constants |
//! | `lib`     | Public contract entry-points — thin delegation layer only |
//!
//! The public interface is **unchanged** from the pre-refactor version:
//! `create_escrow`, `release_escrow`, `cancel_escrow`, `dispute_escrow`,
//! `resolve_dispute`, `get_escrow`, `list_escrows`,
//! `initialize`, `grant_role`, `revoke_role`, `has_role`,
//! `pause`, `unpause`, `is_paused`, `get_admin`, `upgrade`.

#![no_std]

use bluecollar_types::ContractError;
use soroban_sdk::{contract, contractimpl, symbol_short, Address, BytesN, Env, Symbol, Vec};

mod logic;
mod storage;

pub use storage::EscrowState;

#[cfg(test)]
mod test;

use logic::{
    do_cancel, do_create, do_dispute, do_initialize, do_release, do_resolve, require_role,
    role_to_id, ROLE_ADMIN, ROLE_PAUSER, ROLE_UPGRADER,
};
use storage::{
    is_paused, load_admin, load_escrow, load_escrow_list, load_role_members, save_role_members,
    set_paused, EscrowRecord,
};

pub const VERSION: u32 = 1;

#[contract]
pub struct EscrowContract;

#[contractimpl]
impl EscrowContract {
    // -------------------------------------------------------------------------
    // Initialise
    // -------------------------------------------------------------------------

    /// Initialise the contract with an admin address.
    pub fn initialize(env: Env, admin: Address) -> Result<(), ContractError> {
        do_initialize(&env, &admin)
    }

    // -------------------------------------------------------------------------
    // Role management
    // -------------------------------------------------------------------------

    /// Grant a role to an address. Caller must hold `ROLE_ADMIN`.
    pub fn grant_role(
        env: Env,
        caller: Address,
        role: Symbol,
        account: Address,
    ) -> Result<(), ContractError> {
        require_role(&env, &Symbol::new(&env, ROLE_ADMIN), &caller)?;
        let id = role_to_id(&env, &role);
        let mut members = load_role_members(&env, id);
        if !members.iter().any(|m| m == account) {
            members.push_back(account.clone());
        }
        save_role_members(&env, id, &members);
        env.events()
            .publish((symbol_short!("RlGrnt"), role), account);
        Ok(())
    }

    /// Revoke a role from an address. Caller must hold `ROLE_ADMIN`.
    pub fn revoke_role(
        env: Env,
        caller: Address,
        role: Symbol,
        account: Address,
    ) -> Result<(), ContractError> {
        require_role(&env, &Symbol::new(&env, ROLE_ADMIN), &caller)?;
        let id = role_to_id(&env, &role);
        let members = load_role_members(&env, id);
        let mut updated: Vec<Address> = Vec::new(&env);
        for m in members.iter() {
            if m != account {
                updated.push_back(m);
            }
        }
        save_role_members(&env, id, &updated);
        env.events()
            .publish((symbol_short!("RlRevk"), role), account);
        Ok(())
    }

    /// Return `true` if `account` holds `role`.
    pub fn has_role(env: Env, role: Symbol, account: Address) -> Result<bool, ContractError> {
        let id = role_to_id(&env, &role);
        Ok(load_role_members(&env, id).iter().any(|m| m == account))
    }

    // -------------------------------------------------------------------------
    // Pause / Unpause
    // -------------------------------------------------------------------------

    /// Pause the contract. Caller must hold `ROLE_PAUSER`.
    pub fn pause(env: Env, caller: Address) -> Result<(), ContractError> {
        require_role(&env, &Symbol::new(&env, ROLE_PAUSER), &caller)?;
        set_paused(&env, true);
        env.events().publish((symbol_short!("Paused"), caller), ());
        Ok(())
    }

    /// Unpause the contract. Caller must hold `ROLE_PAUSER`.
    pub fn unpause(env: Env, caller: Address) -> Result<(), ContractError> {
        require_role(&env, &Symbol::new(&env, ROLE_PAUSER), &caller)?;
        set_paused(&env, false);
        env.events()
            .publish((symbol_short!("Unpaused"), caller), ());
        Ok(())
    }

    /// Return `true` if the contract is paused.
    pub fn is_paused(env: Env) -> Result<bool, ContractError> {
        Ok(is_paused(&env))
    }

    /// Return the admin address.
    pub fn get_admin(env: Env) -> Result<Address, ContractError> {
        load_admin(&env).ok_or(ContractError::NotInitialized)
    }

    // -------------------------------------------------------------------------
    // Escrow lifecycle
    // -------------------------------------------------------------------------

    /// Create a new escrow and lock `amount` tokens from `depositor`.
    pub fn create_escrow(
        env: Env,
        depositor: Address,
        beneficiary: Address,
        token: Address,
        id: Symbol,
        amount: i128,
        expiry: u64,
    ) -> Result<(), ContractError> {
        do_create(&env, &depositor, beneficiary, token, id, amount, expiry)
    }

    /// Release escrow funds to the beneficiary. Depositor or admin only.
    pub fn release_escrow(env: Env, caller: Address, id: Symbol) -> Result<(), ContractError> {
        do_release(&env, &caller, id)
    }

    /// Cancel escrow and refund depositor. Admin any time; depositor after expiry.
    pub fn cancel_escrow(env: Env, caller: Address, id: Symbol) -> Result<(), ContractError> {
        do_cancel(&env, &caller, id)
    }

    /// File a dispute on an active escrow. Either party may call.
    pub fn dispute_escrow(env: Env, caller: Address, id: Symbol) -> Result<(), ContractError> {
        do_dispute(&env, &caller, id)
    }

    /// Resolve a disputed escrow. Caller must hold `ROLE_ARBITRATOR`.
    pub fn resolve_dispute(
        env: Env,
        caller: Address,
        id: Symbol,
        release_to_beneficiary: bool,
    ) -> Result<(), ContractError> {
        do_resolve(&env, &caller, id, release_to_beneficiary)
    }

    // -------------------------------------------------------------------------
    // Queries
    // -------------------------------------------------------------------------

    /// Get a single escrow record.
    pub fn get_escrow(env: Env, id: Symbol) -> Result<EscrowRecord, ContractError> {
        load_escrow(&env, &id).ok_or(ContractError::EscrowNotFound)
    }

    /// Return all escrow ids in creation order.
    pub fn list_escrows(env: Env) -> Result<Vec<Symbol>, ContractError> {
        Ok(load_escrow_list(&env))
    }

    /// Extend the TTL of an escrow entry (permissionless).
    pub fn extend_escrow_ttl(env: Env, id: Symbol) -> Result<(), ContractError> {
        storage::extend_escrow_ttl(&env, &id);
        Ok(())
    }

    // -------------------------------------------------------------------------
    // Versioning
    // -------------------------------------------------------------------------

    /// Return the event schema version.
    pub fn version(_env: Env) -> Result<u32, ContractError> {
        Ok(VERSION)
    }

    // -------------------------------------------------------------------------
    // Upgrade
    // -------------------------------------------------------------------------

    /// Upgrade the contract WASM. Caller must hold `ROLE_UPGRADER`.
    pub fn upgrade(
        env: Env,
        caller: Address,
        new_wasm_hash: BytesN<32>,
    ) -> Result<(), ContractError> {
        require_role(&env, &Symbol::new(&env, ROLE_UPGRADER), &caller)?;
        env.deployer().update_current_contract_wasm(new_wasm_hash);
        Ok(())
    }
}
