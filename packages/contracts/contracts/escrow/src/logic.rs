//! # Escrow — Business Logic
//!
//! State-machine transitions, access-control guards, and RBAC helpers.
//! All functions follow the Checks → Effects → Interactions (CEI) pattern.
//! Token transfers (Interactions) only happen after storage is updated (Effects).

use bluecollar_types::{helpers, ContractError};
use soroban_sdk::{symbol_short, token, Address, Env, Symbol, Vec};

use crate::storage::{
    self, load_escrow, load_escrow_list, load_role_members, save_escrow, save_escrow_list,
    save_role_members, EscrowRecord, EscrowState,
};

// =============================================================================
// Roles
// =============================================================================

pub const ROLE_ADMIN: &str = "admin";
pub const ROLE_ARBITRATOR: &str = "arbitrator";
pub const ROLE_UPGRADER: &str = "upgrader";
pub const ROLE_PAUSER: &str = "pauser";

pub const ROLE_ADMIN_ID: u64 = 0;
pub const ROLE_ARBITRATOR_ID: u64 = 1;
pub const ROLE_UPGRADER_ID: u64 = 2;
pub const ROLE_PAUSER_ID: u64 = 3;

/// Map a role symbol to its compact storage id.
pub fn role_to_id(env: &Env, role: &Symbol) -> u64 {
    if *role == Symbol::new(env, ROLE_ADMIN) {
        ROLE_ADMIN_ID
    } else if *role == Symbol::new(env, ROLE_ARBITRATOR) {
        ROLE_ARBITRATOR_ID
    } else if *role == Symbol::new(env, ROLE_UPGRADER) {
        ROLE_UPGRADER_ID
    } else if *role == Symbol::new(env, ROLE_PAUSER) {
        ROLE_PAUSER_ID
    } else {
        u64::MAX
    }
}

// =============================================================================
// RBAC helpers
// =============================================================================

/// Assert `caller` holds `role` and has signed the transaction.
pub fn require_role(env: &Env, role: &Symbol, caller: &Address) -> Result<(), ContractError> {
    let id = role_to_id(env, role);
    let members = load_role_members(env, id);
    helpers::require_role(caller, &members)
}

/// Assert the contract is not paused.
pub fn require_not_paused(env: &Env) -> Result<(), ContractError> {
    helpers::require_not_paused(storage::is_paused(env))
}

// =============================================================================
// Initialisation
// =============================================================================

/// Bootstrap the contract storage.
pub fn do_initialize(env: &Env, admin: &Address) -> Result<(), ContractError> {
    if storage::is_initialized(env) {
        return Err(ContractError::AlreadyInitialized);
    }

    storage::set_initialized(env);
    storage::save_admin(env, admin);
    env.storage()
        .persistent()
        .set(&storage::DataKey::SchemaVersion, &1u32);

    let mut members: Vec<Address> = Vec::new(env);
    members.push_back(admin.clone());
    save_role_members(env, ROLE_ADMIN_ID, &members);

    env.events()
        .publish((symbol_short!("Init"), admin.clone()), 1u32);
    Ok(())
}

// =============================================================================
// Escrow lifecycle
// =============================================================================

/// Create a new escrow and lock `amount` tokens.
///
/// The depositor must have approved the contract to spend `amount` tokens.
pub fn do_create(
    env: &Env,
    depositor: &Address,
    beneficiary: Address,
    token_addr: Address,
    id: Symbol,
    amount: i128,
    expiry: u64,
) -> Result<(), ContractError> {
    // --- Checks ---
    require_not_paused(env)?;
    depositor.require_auth();
    if amount <= 0 {
        return Err(ContractError::AmountMustBePositive);
    }
    if expiry <= env.ledger().timestamp() {
        return Err(ContractError::ExpiryMustBeInFuture);
    }
    if load_escrow(env, &id).is_some() {
        return Err(ContractError::EscrowAlreadyExists);
    }

    // --- Effects ---
    let record = EscrowRecord {
        id: id.clone(),
        depositor: depositor.clone(),
        beneficiary: beneficiary.clone(),
        token: token_addr.clone(),
        amount,
        expiry,
        state: EscrowState::Active,
        created_at: env.ledger().sequence(),
        updated_at: env.ledger().sequence(),
    };
    save_escrow(env, &record);

    let mut list = load_escrow_list(env);
    list.push_back(id.clone());
    save_escrow_list(env, &list);

    // --- Interactions ---
    let token = token::Client::new(env, &token_addr);
    token.transfer(depositor, &env.current_contract_address(), &amount);

    env.events().publish(
        (symbol_short!("Created"), id),
        (depositor.clone(), beneficiary, amount),
    );
    Ok(())
}

/// Release escrow funds to the beneficiary.
///
/// Only the depositor or an admin may release.
pub fn do_release(env: &Env, caller: &Address, id: Symbol) -> Result<(), ContractError> {
    // --- Checks ---
    require_not_paused(env)?;
    caller.require_auth();

    let mut record = load_escrow(env, &id).ok_or(ContractError::EscrowNotFound)?;
    if record.state != EscrowState::Active {
        return Err(ContractError::EscrowNotActive);
    }

    let is_depositor = record.depositor == *caller;
    let is_admin = load_role_members(env, ROLE_ADMIN_ID)
        .iter()
        .any(|m| m == *caller);
    if !is_depositor && !is_admin {
        return Err(ContractError::NotAuthorized);
    }

    // --- Effects ---
    record.state = EscrowState::Released;
    record.updated_at = env.ledger().sequence();
    save_escrow(env, &record);

    // --- Interactions ---
    let token = token::Client::new(env, &record.token);
    token.transfer(
        &env.current_contract_address(),
        &record.beneficiary,
        &record.amount,
    );

    env.events().publish(
        (symbol_short!("Released"), id),
        (caller.clone(), record.beneficiary, record.amount),
    );
    Ok(())
}

/// Cancel escrow and refund funds to the depositor.
///
/// Admin may cancel at any time. The depositor may self-cancel after expiry.
pub fn do_cancel(env: &Env, caller: &Address, id: Symbol) -> Result<(), ContractError> {
    // --- Checks ---
    require_not_paused(env)?;
    caller.require_auth();

    let mut record = load_escrow(env, &id).ok_or(ContractError::EscrowNotFound)?;
    if record.state != EscrowState::Active {
        return Err(ContractError::EscrowNotActive);
    }

    let is_admin = load_role_members(env, ROLE_ADMIN_ID)
        .iter()
        .any(|m| m == *caller);
    let is_expired_depositor =
        record.depositor == *caller && env.ledger().timestamp() >= record.expiry;
    if !is_admin && !is_expired_depositor {
        return Err(ContractError::NotAuthorized);
    }

    // --- Effects ---
    record.state = EscrowState::Cancelled;
    record.updated_at = env.ledger().sequence();
    save_escrow(env, &record);

    // --- Interactions ---
    let token = token::Client::new(env, &record.token);
    token.transfer(
        &env.current_contract_address(),
        &record.depositor,
        &record.amount,
    );

    env.events().publish(
        (symbol_short!("Cancelled"), id),
        (caller.clone(), record.depositor, record.amount),
    );
    Ok(())
}

/// File a dispute on an active escrow. Either party may call.
pub fn do_dispute(env: &Env, caller: &Address, id: Symbol) -> Result<(), ContractError> {
    // --- Checks ---
    require_not_paused(env)?;
    caller.require_auth();

    let mut record = load_escrow(env, &id).ok_or(ContractError::EscrowNotFound)?;
    let is_party = record.depositor == *caller || record.beneficiary == *caller;
    if !is_party {
        return Err(ContractError::NotAParty);
    }
    if record.state != EscrowState::Active {
        return Err(ContractError::EscrowNotActive);
    }

    // --- Effects ---
    record.state = EscrowState::Disputed;
    record.updated_at = env.ledger().sequence();
    save_escrow(env, &record);

    // --- Interactions ---
    env.events()
        .publish((symbol_short!("Disputed"), id), caller.clone());
    Ok(())
}

/// Resolve a disputed escrow. Caller must hold `ROLE_ARBITRATOR`.
///
/// If `release_to_beneficiary` is `true`, funds go to the beneficiary;
/// otherwise funds are returned to the depositor.
pub fn do_resolve(
    env: &Env,
    caller: &Address,
    id: Symbol,
    release_to_beneficiary: bool,
) -> Result<(), ContractError> {
    // --- Checks ---
    require_not_paused(env)?;
    require_role(env, &Symbol::new(env, ROLE_ARBITRATOR), caller)?;

    let mut record = load_escrow(env, &id).ok_or(ContractError::EscrowNotFound)?;
    if record.state != EscrowState::Disputed {
        return Err(ContractError::EscrowNotDisputed);
    }

    // --- Effects ---
    let recipient = if release_to_beneficiary {
        record.beneficiary.clone()
    } else {
        record.depositor.clone()
    };
    record.state = if release_to_beneficiary {
        EscrowState::Released
    } else {
        EscrowState::Cancelled
    };
    record.updated_at = env.ledger().sequence();
    save_escrow(env, &record);

    // --- Interactions ---
    let token = token::Client::new(env, &record.token);
    token.transfer(&env.current_contract_address(), &recipient, &record.amount);

    env.events().publish(
        (symbol_short!("Resolved"), id),
        (caller.clone(), recipient, release_to_beneficiary),
    );
    Ok(())
}
