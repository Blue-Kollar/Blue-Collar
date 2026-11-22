//! # Payment — Business Logic
//!
//! Validation, state transitions, and RBAC helpers.
//! Storage access goes through `storage.rs`; entrypoints in `lib.rs` are thin
//! wrappers around these functions.
//!
//! ## CEI ordering
//! Every lifecycle function follows Checks → Effects → Interactions:
//! storage is committed before the external token call so a failed transfer
//! rolls back the whole invocation (Soroban atomicity) rather than leaving
//! state inconsistent.

use bluecollar_types::{helpers, split_fee, ContractError};
use soroban_sdk::{symbol_short, token, Address, BytesN, Env, Symbol, Vec};

use crate::storage::{
    self, load_config, load_payment, load_role_members, save_config, save_payment,
    save_role_members, Config, LockedPayment, PaymentStatus, ROLE_ADMIN_ID, ROLE_FEE_MGR_ID,
    ROLE_PAUSER_ID, ROLE_UPGRADER_ID,
};
use crate::storage::{
    ROLE_ADMIN, ROLE_FEE_MGR, ROLE_PAUSER, ROLE_UPGRADER,
};

use bluecollar_types::events::{ContractPaused, ContractUnpaused, RoleGranted, RoleRevoked};

// =============================================================================
// RBAC helpers
// =============================================================================

/// Assert `caller` holds `role` and has signed the transaction.
pub fn require_role(env: &Env, role: &Symbol, caller: &Address) -> Result<(), ContractError> {
    let id = storage::role_to_id(env, role);
    let members = load_role_members(env, id);
    helpers::require_role(caller, &members)
}

/// Assert the contract is not paused.
pub fn require_not_paused(env: &Env) -> Result<(), ContractError> {
    helpers::require_not_paused(storage::is_paused(env))
}

/// Load config or return `NotInitialized`.
pub fn get_config(env: &Env) -> Result<Config, ContractError> {
    load_config(env).ok_or(ContractError::NotInitialized)
}

// =============================================================================
// Initialisation
// =============================================================================

pub fn do_initialize(
    env: &Env,
    admin: &Address,
    fee_bps: u32,
    fee_recipient: Address,
) -> Result<(), ContractError> {
    if storage::is_initialized(env) {
        return Err(ContractError::AlreadyInitialized);
    }
    if fee_bps > storage::MAX_FEE_BPS {
        return Err(ContractError::FeeBpsExceedsMaximum);
    }

    let config = Config {
        fee_bps,
        fee_recipient,
    };
    save_config(env, &config);
    storage::save_admin(env, admin);
    storage::set_schema_version(env, 1u32);

    let role = Symbol::new(env, ROLE_ADMIN);
    let mut members: Vec<Address> = Vec::new(env);
    members.push_back(admin.clone());
    save_role_members(env, ROLE_ADMIN_ID, &members);

    env.events()
        .publish((symbol_short!("Init"), admin.clone()), crate::VERSION);
    Ok(())
}

// =============================================================================
// Role management
// =============================================================================

pub fn do_grant_role(
    env: &Env,
    caller: &Address,
    role: Symbol,
    account: Address,
) -> Result<(), ContractError> {
    require_role(env, &Symbol::new(env, ROLE_ADMIN), caller)?;
    let id = storage::role_to_id(env, &role);
    let mut members = load_role_members(env, id);
    if !members.iter().any(|m| m == account) {
        members.push_back(account.clone());
    }
    save_role_members(env, id, &members);
    RoleGranted { role, admin: account }.publish(env);
    Ok(())
}

pub fn do_revoke_role(
    env: &Env,
    caller: &Address,
    role: Symbol,
    account: Address,
) -> Result<(), ContractError> {
    require_role(env, &Symbol::new(env, ROLE_ADMIN), caller)?;
    let id = storage::role_to_id(env, &role);
    let members = load_role_members(env, id);
    let mut updated: Vec<Address> = Vec::new(env);
    for m in members.iter() {
        if m != account {
            updated.push_back(m);
        }
    }
    save_role_members(env, id, &updated);
    RoleRevoked { role, account }.publish(env);
    Ok(())
}

// =============================================================================
// Admin / Config
// =============================================================================

pub fn do_update_fee(
    env: &Env,
    caller: &Address,
    new_fee_bps: u32,
) -> Result<(), ContractError> {
    require_role(env, &Symbol::new(env, ROLE_FEE_MGR), caller)?;
    if new_fee_bps > storage::MAX_FEE_BPS {
        return Err(ContractError::FeeBpsExceedsMaximum);
    }
    let mut config = get_config(env)?;
    config.fee_bps = new_fee_bps;
    save_config(env, &config);
    env.events()
        .publish((symbol_short!("FeeUpd"), caller.clone()), new_fee_bps);
    Ok(())
}

pub fn do_set_treasury(
    env: &Env,
    caller: &Address,
    new_treasury: Address,
) -> Result<(), ContractError> {
    require_role(env, &Symbol::new(env, ROLE_ADMIN), caller)?;
    let mut config = get_config(env)?;
    config.fee_recipient = new_treasury.clone();
    save_config(env, &config);
    env.events()
        .publish((symbol_short!("TrsSet"), caller.clone()), new_treasury);
    Ok(())
}

pub fn do_pause(env: &Env, caller: &Address) -> Result<(), ContractError> {
    require_role(env, &Symbol::new(env, ROLE_PAUSER), caller)?;
    storage::set_paused(env, true);
    ContractPaused { admin: caller.clone() }.publish(env);
    Ok(())
}

pub fn do_unpause(env: &Env, caller: &Address) -> Result<(), ContractError> {
    require_role(env, &Symbol::new(env, ROLE_PAUSER), caller)?;
    storage::set_paused(env, false);
    ContractUnpaused { admin: caller.clone() }.publish(env);
    Ok(())
}

// =============================================================================
// Payment lifecycle
// =============================================================================

pub fn do_pay(
    env: &Env,
    from: &Address,
    to: Address,
    token_addr: Address,
    amount: i128,
) -> Result<(), ContractError> {
    // --- Checks ---
    require_not_paused(env)?;
    from.require_auth();
    if amount <= 0 {
        return Err(ContractError::AmountMustBePositive);
    }
    let config = get_config(env)?;

    // --- Effects ---
    let (fee, net) = split_fee(amount, config.fee_bps);

    // --- Interactions ---
    let token = token::Client::new(env, &token_addr);
    token.transfer(from, &to, &net);
    if fee > 0 {
        token.transfer(from, &config.fee_recipient, &fee);
    }
    env.events()
        .publish((symbol_short!("Pay"), from.clone(), to), (token_addr, amount, fee));
    Ok(())
}

pub fn do_lock_payment(
    env: &Env,
    from: &Address,
    to: Address,
    token_addr: Address,
    id: Symbol,
    amount: i128,
    expiry: u64,
) -> Result<(), ContractError> {
    // --- Checks ---
    require_not_paused(env)?;
    from.require_auth();
    if amount <= 0 {
        return Err(ContractError::AmountMustBePositive);
    }
    if expiry <= env.ledger().timestamp() {
        return Err(ContractError::ExpiryMustBeInFuture);
    }
    if load_payment(env, &id).is_some() {
        return Err(ContractError::AlreadyExists);
    }

    // --- Effects ---
    let record = LockedPayment {
        id: id.clone(),
        client: from.clone(),
        worker: to.clone(),
        token: token_addr.clone(),
        amount,
        expiry,
        status: PaymentStatus::Locked,
    };
    save_payment(env, &record);

    // --- Interactions ---
    let token = token::Client::new(env, &token_addr);
    token.transfer(from, &env.current_contract_address(), &amount);
    env.events()
        .publish((symbol_short!("Locked"), id), (from.clone(), to, amount));
    Ok(())
}

pub fn do_release_payment(
    env: &Env,
    caller: &Address,
    id: Symbol,
) -> Result<(), ContractError> {
    // --- Checks ---
    require_not_paused(env)?;
    caller.require_auth();

    let mut record = load_payment(env, &id).ok_or(ContractError::PaymentNotFound)?;
    let is_client = record.client == *caller;
    let is_admin = load_role_members(env, ROLE_ADMIN_ID)
        .iter()
        .any(|m| m == *caller);
    if !is_client && !is_admin {
        return Err(ContractError::NotAuthorized);
    }
    if record.status != PaymentStatus::Locked {
        return Err(ContractError::PaymentNotLocked);
    }

    // --- Effects ---
    record.status = PaymentStatus::Released;
    save_payment(env, &record);

    // --- Interactions ---
    let token = token::Client::new(env, &record.token);
    token.transfer(&env.current_contract_address(), &record.worker, &record.amount);
    env.events().publish(
        (symbol_short!("Released"), id),
        (caller.clone(), record.worker, record.amount),
    );
    Ok(())
}

pub fn do_refund_payment(
    env: &Env,
    caller: &Address,
    id: Symbol,
) -> Result<(), ContractError> {
    // --- Checks ---
    require_not_paused(env)?;
    caller.require_auth();

    let mut record = load_payment(env, &id).ok_or(ContractError::PaymentNotFound)?;
    if record.status != PaymentStatus::Locked {
        return Err(ContractError::PaymentNotLocked);
    }
    let is_admin = load_role_members(env, ROLE_ADMIN_ID)
        .iter()
        .any(|m| m == *caller);
    let is_expired_client = record.client == *caller && env.ledger().timestamp() >= record.expiry;
    if !is_admin && !is_expired_client {
        return Err(ContractError::NotAuthorized);
    }

    // --- Effects ---
    record.status = PaymentStatus::Refunded;
    save_payment(env, &record);

    // --- Interactions ---
    let token = token::Client::new(env, &record.token);
    token.transfer(&env.current_contract_address(), &record.client, &record.amount);
    env.events().publish(
        (symbol_short!("Refunded"), id),
        (caller.clone(), record.client, record.amount),
    );
    Ok(())
}

/// Release multiple locked payments in one transaction (batch optimization, issue #1839).
///
/// Skips payments that are not in `Locked` state or where `caller` has no authority.
/// Returns the ids of payments that were successfully released.
/// Capped at 20 payments per call to bound gas cost.
pub fn do_batch_release_payment(
    env: &Env,
    caller: &Address,
    ids: Vec<Symbol>,
) -> Result<Vec<Symbol>, ContractError> {
    // --- Checks ---
    require_not_paused(env)?;
    caller.require_auth();
    if ids.len() > 20 {
        return Err(ContractError::BatchTooLarge);
    }

    let is_admin = load_role_members(env, ROLE_ADMIN_ID)
        .iter()
        .any(|m| m == *caller);

    let mut released: Vec<Symbol> = Vec::new(env);
    for id in ids.iter() {
        if let Some(mut record) = load_payment(env, &id) {
            if record.status != PaymentStatus::Locked {
                continue;
            }
            let is_client = record.client == *caller;
            if !is_client && !is_admin {
                continue;
            }
            record.status = PaymentStatus::Released;
            save_payment(env, &record);

            let token = token::Client::new(env, &record.token);
            token.transfer(&env.current_contract_address(), &record.worker, &record.amount);
            env.events().publish(
                (symbol_short!("Released"), id.clone()),
                (caller.clone(), record.worker, record.amount),
            );
            released.push_back(id);
        }
    }
    Ok(released)
}

// =============================================================================
// Upgrade
// =============================================================================

pub fn do_upgrade(
    env: &Env,
    caller: &Address,
    new_wasm_hash: BytesN<32>,
) -> Result<(), ContractError> {
    require_role(env, &Symbol::new(env, ROLE_UPGRADER), caller)?;
    env.deployer().update_current_contract_wasm(new_wasm_hash);
    Ok(())
}
