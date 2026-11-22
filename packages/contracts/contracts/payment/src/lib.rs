//! # BlueCollar Payment Contract
//!
//! Handles direct payments and milestone-based locked payments between clients
//! and workers on the Stellar/Soroban network.
//!
//! ## Module layout
//! - **`storage`** — persisted types, `DataKey`, role constants, and storage accessors.
//! - **`logic`**   — business-logic helpers (RBAC guards, state transitions, batch ops).
//! - **`lib`**     (this file) — thin public entry-point: the `#[contract]` struct
//!                  and its `#[contractimpl]` block, delegating to `storage` and `logic`.
//!
//! ## Functions
//! - `pay` — direct single-shot payment with optional protocol fee.
//! - `lock_payment` — lock funds for a job milestone; released on completion.
//! - `release_payment` / `batch_release_payment` — release locked funds to the worker.
//! - `refund_payment` — refund locked funds to the client (admin only, or expired).
//! - Admin management: `initialize`, `update_fee`, `set_treasury`, `pause`, `unpause`.
//!
//! ## Access Control
//! - `ROLE_ADMIN`: full admin; grant/revoke roles, upgrade.
//! - `ROLE_FEE_MGR`: update protocol fee.
//! - `ROLE_PAUSER`: pause/unpause.
//!
//! ## Security (CEI ordering)
//! Every state-mutating function in `logic.rs` follows Checks → Effects → Interactions.

#![no_std]
// Lint policy: clippy::pedantic enabled at workspace level (issue #1254).
// Blanket Soroban exceptions (needless_pass_by_value, must_use_candidate, etc.)
// are configured in the workspace Cargo.toml; per-function overrides go here.

mod logic;
mod storage;

use bluecollar_types::ContractError;
use soroban_sdk::{contract, contractimpl, Address, BytesN, Env, Symbol, Vec};

pub use storage::{Config, DataKey, LockedPayment, PaymentStatus};
pub use storage::{ROLE_ADMIN, ROLE_FEE_MGR, ROLE_PAUSER, ROLE_UPGRADER};

pub const VERSION: u32 = 1;

#[contract]
pub struct PaymentContract;

#[contractimpl]
impl PaymentContract {
    // -------------------------------------------------------------------------
    // Initialise
    // -------------------------------------------------------------------------

    /// Initialise the contract.
    pub fn initialize(
        env: Env,
        admin: Address,
        fee_bps: u32,
        fee_recipient: Address,
    ) -> Result<(), ContractError> {
        logic::do_initialize(&env, &admin, fee_bps, fee_recipient)
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
        logic::do_grant_role(&env, &caller, role, account)
    }

    /// Revoke a role from an address. Caller must hold `ROLE_ADMIN`.
    pub fn revoke_role(
        env: Env,
        caller: Address,
        role: Symbol,
        account: Address,
    ) -> Result<(), ContractError> {
        logic::do_revoke_role(&env, &caller, role, account)
    }

    /// Return `true` if `account` holds `role`.
    pub fn has_role(env: Env, role: Symbol, account: Address) -> Result<bool, ContractError> {
        let id = storage::role_to_id(&env, &role);
        Ok(storage::load_role_members(&env, id)
            .iter()
            .any(|m| m == account))
    }

    // -------------------------------------------------------------------------
    // Admin / Config
    // -------------------------------------------------------------------------

    /// Update the protocol fee. Caller must hold `ROLE_FEE_MGR`.
    pub fn update_fee(env: Env, caller: Address, new_fee_bps: u32) -> Result<(), ContractError> {
        logic::do_update_fee(&env, &caller, new_fee_bps)
    }

    /// Update the treasury (fee recipient). Caller must hold `ROLE_ADMIN`.
    pub fn set_treasury(
        env: Env,
        caller: Address,
        new_treasury: Address,
    ) -> Result<(), ContractError> {
        logic::do_set_treasury(&env, &caller, new_treasury)
    }

    /// Pause the contract. Caller must hold `ROLE_PAUSER`.
    pub fn pause(env: Env, caller: Address) -> Result<(), ContractError> {
        logic::do_pause(&env, &caller)
    }

    /// Unpause the contract. Caller must hold `ROLE_PAUSER`.
    pub fn unpause(env: Env, caller: Address) -> Result<(), ContractError> {
        logic::do_unpause(&env, &caller)
    }

    /// Returns `true` if the contract is currently paused.
    pub fn is_paused(env: Env) -> Result<bool, ContractError> {
        Ok(storage::is_paused(&env))
    }

    /// Return the admin address.
    pub fn get_admin(env: Env) -> Result<Address, ContractError> {
        storage::load_admin(&env).ok_or(ContractError::NotInitialized)
    }

    /// Return the current protocol configuration (fee_bps and fee_recipient).
    pub fn get_config_view(env: Env) -> Result<Config, ContractError> {
        logic::get_config(&env)
    }

    // -------------------------------------------------------------------------
    // Versioning
    // -------------------------------------------------------------------------

    /// Return the event schema version.
    pub fn version(_env: Env) -> Result<u32, ContractError> {
        Ok(VERSION)
    }

    // -------------------------------------------------------------------------
    // Direct payment
    // -------------------------------------------------------------------------

    /// Send a direct payment to a worker, deducting the protocol fee.
    pub fn pay(
        env: Env,
        from: Address,
        to: Address,
        token_addr: Address,
        amount: i128,
    ) -> Result<(), ContractError> {
        logic::do_pay(&env, &from, to, token_addr, amount)
    }

    // -------------------------------------------------------------------------
    // Locked payments (milestone-based)
    // -------------------------------------------------------------------------

    /// Lock funds for a job milestone.
    pub fn lock_payment(
        env: Env,
        from: Address,
        to: Address,
        token_addr: Address,
        id: Symbol,
        amount: i128,
        expiry: u64,
    ) -> Result<(), ContractError> {
        logic::do_lock_payment(&env, &from, to, token_addr, id, amount, expiry)
    }

    /// Release a locked payment to the worker. Client or admin may call.
    pub fn release_payment(env: Env, caller: Address, id: Symbol) -> Result<(), ContractError> {
        logic::do_release_payment(&env, &caller, id)
    }

    /// Release multiple locked payments in one transaction.
    ///
    /// Skips payments that are not `Locked` or where `caller` has no authority.
    /// Returns the ids of payments successfully released. Capped at 20 per call.
    pub fn batch_release_payment(
        env: Env,
        caller: Address,
        ids: Vec<Symbol>,
    ) -> Result<Vec<Symbol>, ContractError> {
        logic::do_batch_release_payment(&env, &caller, ids)
    }

    /// Refund a locked payment to the client.
    pub fn refund_payment(env: Env, caller: Address, id: Symbol) -> Result<(), ContractError> {
        logic::do_refund_payment(&env, &caller, id)
    }

    /// Get a locked payment record by id.
    pub fn get_payment(env: Env, id: Symbol) -> Result<LockedPayment, ContractError> {
        storage::load_payment(&env, &id).ok_or(ContractError::PaymentNotFound)
    }

    /// Extend the TTL of a payment entry (permissionless).
    pub fn extend_payment_ttl_pub(env: Env, id: Symbol) -> Result<(), ContractError> {
        storage::save_payment(
            &env,
            &storage::load_payment(&env, &id).ok_or(ContractError::PaymentNotFound)?,
        );
        Ok(())
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
        logic::do_upgrade(&env, &caller, new_wasm_hash)
    }
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod test;
