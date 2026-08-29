//! # BlueCollar Payment Contract
//!
//! Handles direct payments and milestone-based locked payments between clients
//! and workers on the Stellar/Soroban network.
//!
//! ## Functions
//! - `pay` — direct single-shot payment with optional protocol fee.
//! - `lock_payment` — lock funds for a job milestone; released on completion.
//! - `release_payment` — release locked funds to the worker (client or admin).
//! - `refund_payment` — refund locked funds to the client (admin only, or expired).
//! - Admin management: `initialize`, `update_fee`, `set_treasury`, `pause`, `unpause`.
//!
//! ## Access Control
//! - `ROLE_ADMIN`: full admin; grant/revoke roles, upgrade.
//! - `ROLE_FEE_MGR`: update protocol fee.
//! - `ROLE_PAUSER`: pause/unpause.
//!
//! ## Security (CEI ordering)
//! Every state-mutating function follows Checks → Effects → Interactions.
//! No external calls occur before storage is updated.

#![no_std]

use bluecollar_types::{helpers, storage::extend_ttl, ContractError};
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, token, Address, BytesN, Env, Symbol, Vec,
};

/// Maximum protocol fee: 500 bps = 5 %.
pub const MAX_FEE_BPS: u32 = 500;

pub const VERSION: u32 = 1;

/// Approximate TTL extension target (~1 year at 5 s/ledger).
const TTL_EXTEND_TO: u32 = 535_000;
/// Extend TTL only when it drops below this threshold (~6 months).
const TTL_THRESHOLD: u32 = 267_500;

// =============================================================================
// Roles
// =============================================================================

pub const ROLE_ADMIN: &str = "admin";
pub const ROLE_FEE_MGR: &str = "fee_mgr";
pub const ROLE_PAUSER: &str = "pauser";
pub const ROLE_UPGRADER: &str = "upgrader";

const ROLE_ADMIN_ID: u64 = 0;
const ROLE_FEE_MGR_ID: u64 = 1;
const ROLE_PAUSER_ID: u64 = 2;
const ROLE_UPGRADER_ID: u64 = 3;

fn role_to_id(env: &Env, role: &Symbol) -> u64 {
    if *role == Symbol::new(env, ROLE_ADMIN) {
        ROLE_ADMIN_ID
    } else if *role == Symbol::new(env, ROLE_FEE_MGR) {
        ROLE_FEE_MGR_ID
    } else if *role == Symbol::new(env, ROLE_PAUSER) {
        ROLE_PAUSER_ID
    } else if *role == Symbol::new(env, ROLE_UPGRADER) {
        ROLE_UPGRADER_ID
    } else {
        u64::MAX
    }
}

// =============================================================================
// Types
// =============================================================================

/// Protocol configuration stored in instance storage.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct Config {
    /// Protocol fee in basis points (0–500).
    pub fee_bps: u32,
    /// Address that receives collected protocol fees.
    pub fee_recipient: Address,
}

/// Status of a locked payment.
#[contracttype]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PaymentStatus {
    /// Funds locked; awaiting release or refund.
    Locked = 0,
    /// Funds released to the worker.
    Released = 1,
    /// Funds refunded to the client.
    Refunded = 2,
}

/// A locked payment record stored in persistent storage.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct LockedPayment {
    /// Unique identifier (caller-supplied).
    pub id: Symbol,
    /// Client that locked the funds.
    pub client: Address,
    /// Worker that will receive funds on release.
    pub worker: Address,
    /// Token contract address.
    pub token: Address,
    /// Locked amount in smallest token units.
    pub amount: i128,
    /// Unix timestamp after which client may self-refund without admin.
    pub expiry: u64,
    /// Current status.
    pub status: PaymentStatus,
}

/// Storage keys.
#[contracttype]
pub enum DataKey {
    /// Instance — config (fee_bps, fee_recipient).
    Config,
    /// Instance — paused flag.
    Paused,
    /// Persistent — admin address.
    Admin,
    /// Persistent — role member lists.
    RoleMembers(u64),
    /// Persistent — locked payment record.
    Payment(Symbol),
    /// Persistent — schema version.
    SchemaVersion,
}

// =============================================================================
// Contract
// =============================================================================

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
        // --- Checks ---
        if env.storage().instance().has(&DataKey::Config) {
            return Err(ContractError::AlreadyInitialized);
        }
        if fee_bps > MAX_FEE_BPS {
            return Err(ContractError::FeeBpsExceedsMaximum);
        }

        // --- Effects ---
        let config = Config {
            fee_bps,
            fee_recipient,
        };
        env.storage().instance().set(&DataKey::Config, &config);
        env.storage().persistent().set(&DataKey::Admin, &admin);
        env.storage()
            .persistent()
            .set(&DataKey::SchemaVersion, &1u32);

        let role = Symbol::new(&env, ROLE_ADMIN);
        let mut members: Vec<Address> = Vec::new(&env);
        members.push_back(admin.clone());
        env.storage()
            .persistent()
            .set(&DataKey::RoleMembers(role_to_id(&env, &role)), &members);

        // --- Interactions ---
        env.events()
            .publish((symbol_short!("Init"), admin), VERSION);

        Ok(())
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    fn get_role_members(env: &Env, role: &Symbol) -> Vec<Address> {
        env.storage()
            .persistent()
            .get(&DataKey::RoleMembers(role_to_id(env, role)))
            .unwrap_or(Vec::new(env))
    }

    fn require_role(env: &Env, role: &Symbol, caller: &Address) -> Result<(), ContractError> {
        let members = Self::get_role_members(env, role);
        helpers::require_role(caller, &members)
    }

    fn require_not_paused(env: &Env) -> Result<(), ContractError> {
        let paused: bool = env
            .storage()
            .instance()
            .get::<_, bool>(&DataKey::Paused)
            .unwrap_or(false);
        helpers::require_not_paused(paused)
    }

    fn get_config(env: &Env) -> Result<Config, ContractError> {
        env.storage()
            .instance()
            .get(&DataKey::Config)
            .ok_or(ContractError::NotInitialized)
    }

    fn compute_fee(amount: i128, fee_bps: u32) -> (i128, i128) {
        if fee_bps == 0 {
            return (0, amount);
        }
        let fee = amount
            .checked_mul(fee_bps as i128)
            .expect("overflow")
            .checked_div(10_000)
            .expect("div zero");
        let net = amount.checked_sub(fee).expect("underflow");
        (fee, net)
    }

    fn extend_payment_ttl(env: &Env, id: &Symbol) {
        extend_ttl(env, &DataKey::Payment(id.clone()));
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    /// Grant a role to an address. Caller must hold `ROLE_ADMIN`.
    pub fn grant_role(
        env: Env,
        caller: Address,
        role: Symbol,
        account: Address,
    ) -> Result<(), ContractError> {
        Self::require_role(&env, &Symbol::new(&env, ROLE_ADMIN), &caller)?;
        let mut members = Self::get_role_members(&env, &role);
        if !members.iter().any(|m| m == account) {
            members.push_back(account.clone());
        }
        env.storage()
            .persistent()
            .set(&DataKey::RoleMembers(role_to_id(&env, &role)), &members);
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
        Self::require_role(&env, &Symbol::new(&env, ROLE_ADMIN), &caller)?;
        let members = Self::get_role_members(&env, &role);
        let mut updated: Vec<Address> = Vec::new(&env);
        for m in members.iter() {
            if m != account {
                updated.push_back(m);
            }
        }
        env.storage()
            .persistent()
            .set(&DataKey::RoleMembers(role_to_id(&env, &role)), &updated);
        env.events()
            .publish((symbol_short!("RlRevk"), role), account);
        Ok(())
    }

    /// Return `true` if `account` holds `role`.
    pub fn has_role(env: Env, role: Symbol, account: Address) -> Result<bool, ContractError> {
        Ok(Self::get_role_members(&env, &role)
            .iter()
            .any(|m| m == account))
    }

    /// Update the protocol fee. Caller must hold `ROLE_FEE_MGR`.
    pub fn update_fee(env: Env, caller: Address, new_fee_bps: u32) -> Result<(), ContractError> {
        Self::require_role(&env, &Symbol::new(&env, ROLE_FEE_MGR), &caller)?;
        if new_fee_bps > MAX_FEE_BPS {
            return Err(ContractError::FeeBpsExceedsMaximum);
        }
        let mut config = Self::get_config(&env)?;
        config.fee_bps = new_fee_bps;
        env.storage().instance().set(&DataKey::Config, &config);
        env.events()
            .publish((symbol_short!("FeeUpd"), caller), new_fee_bps);
        Ok(())
    }

    /// Update the treasury (fee recipient). Caller must hold `ROLE_ADMIN`.
    pub fn set_treasury(
        env: Env,
        caller: Address,
        new_treasury: Address,
    ) -> Result<(), ContractError> {
        Self::require_role(&env, &Symbol::new(&env, ROLE_ADMIN), &caller)?;
        let mut config = Self::get_config(&env)?;
        config.fee_recipient = new_treasury.clone();
        env.storage().instance().set(&DataKey::Config, &config);
        env.events()
            .publish((symbol_short!("TrsSet"), caller), new_treasury);
        Ok(())
    }

    /// Pause the contract. Caller must hold `ROLE_PAUSER`.
    pub fn pause(env: Env, caller: Address) -> Result<(), ContractError> {
        Self::require_role(&env, &Symbol::new(&env, ROLE_PAUSER), &caller)?;
        env.storage().instance().set(&DataKey::Paused, &true);
        env.events().publish((symbol_short!("Paused"), caller), ());
        Ok(())
    }

    /// Unpause the contract. Caller must hold `ROLE_PAUSER`.
    pub fn unpause(env: Env, caller: Address) -> Result<(), ContractError> {
        Self::require_role(&env, &Symbol::new(&env, ROLE_PAUSER), &caller)?;
        env.storage().instance().set(&DataKey::Paused, &false);
        env.events()
            .publish((symbol_short!("Unpaused"), caller), ());
        Ok(())
    }

    pub fn is_paused(env: Env) -> Result<bool, ContractError> {
        Ok(env
            .storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false))
    }

    pub fn get_admin(env: Env) -> Result<Address, ContractError> {
        env.storage()
            .persistent()
            .get(&DataKey::Admin)
            .ok_or(ContractError::NotInitialized)
    }

    pub fn get_config_view(env: Env) -> Result<Config, ContractError> {
        Self::get_config(&env)
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
        // --- Checks ---
        Self::require_not_paused(&env)?;
        from.require_auth();
        if amount <= 0 {
            return Err(ContractError::AmountMustBePositive);
        }
        let config = Self::get_config(&env)?;

        // --- Effects (compute fee split) ---
        let (fee, net) = Self::compute_fee(amount, config.fee_bps);

        // --- Interactions ---
        let token = token::Client::new(&env, &token_addr);
        token.transfer(&from, &to, &net);
        if fee > 0 {
            token.transfer(&from, &config.fee_recipient, &fee);
        }
        env.events()
            .publish((symbol_short!("Pay"), from), (to, token_addr, amount, fee));
        Ok(())
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
        // --- Checks ---
        Self::require_not_paused(&env)?;
        from.require_auth();
        if amount <= 0 {
            return Err(ContractError::AmountMustBePositive);
        }
        if expiry <= env.ledger().timestamp() {
            return Err(ContractError::ExpiryMustBeInFuture);
        }
        if env
            .storage()
            .persistent()
            .has(&DataKey::Payment(id.clone()))
        {
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
        env.storage()
            .persistent()
            .set(&DataKey::Payment(id.clone()), &record);
        Self::extend_payment_ttl(&env, &id);

        // --- Interactions ---
        let token = token::Client::new(&env, &token_addr);
        token.transfer(&from, &env.current_contract_address(), &amount);
        env.events()
            .publish((symbol_short!("Locked"), id), (from, to, amount));
        Ok(())
    }

    /// Release a locked payment to the worker.
    pub fn release_payment(env: Env, caller: Address, id: Symbol) -> Result<(), ContractError> {
        // --- Checks ---
        Self::require_not_paused(&env)?;
        caller.require_auth();

        let mut record: LockedPayment = env
            .storage()
            .persistent()
            .get(&DataKey::Payment(id.clone()))
            .ok_or(ContractError::PaymentNotFound)?;

        let is_client = record.client == caller;
        let is_admin = Self::get_role_members(&env, &Symbol::new(&env, ROLE_ADMIN))
            .iter()
            .any(|m| m == caller);
        if !is_client && !is_admin {
            return Err(ContractError::NotAuthorized);
        }
        if record.status != PaymentStatus::Locked {
            return Err(ContractError::PaymentNotLocked);
        }

        // --- Effects ---
        record.status = PaymentStatus::Released;
        env.storage()
            .persistent()
            .set(&DataKey::Payment(id.clone()), &record);
        Self::extend_payment_ttl(&env, &id);

        // --- Interactions ---
        let token = token::Client::new(&env, &record.token);
        token.transfer(
            &env.current_contract_address(),
            &record.worker,
            &record.amount,
        );
        env.events().publish(
            (symbol_short!("Released"), id),
            (caller, record.worker, record.amount),
        );
        Ok(())
    }

    /// Refund a locked payment to the client.
    pub fn refund_payment(env: Env, caller: Address, id: Symbol) -> Result<(), ContractError> {
        // --- Checks ---
        Self::require_not_paused(&env)?;
        caller.require_auth();

        let mut record: LockedPayment = env
            .storage()
            .persistent()
            .get(&DataKey::Payment(id.clone()))
            .ok_or(ContractError::PaymentNotFound)?;

        if record.status != PaymentStatus::Locked {
            return Err(ContractError::PaymentNotLocked);
        }

        let is_admin = Self::get_role_members(&env, &Symbol::new(&env, ROLE_ADMIN))
            .iter()
            .any(|m| m == caller);
        let is_expired_client =
            record.client == caller && env.ledger().timestamp() >= record.expiry;
        if !is_admin && !is_expired_client {
            return Err(ContractError::NotAuthorized);
        }

        // --- Effects ---
        record.status = PaymentStatus::Refunded;
        env.storage()
            .persistent()
            .set(&DataKey::Payment(id.clone()), &record);
        Self::extend_payment_ttl(&env, &id);

        // --- Interactions ---
        let token = token::Client::new(&env, &record.token);
        token.transfer(
            &env.current_contract_address(),
            &record.client,
            &record.amount,
        );
        env.events().publish(
            (symbol_short!("Refunded"), id),
            (caller, record.client, record.amount),
        );
        Ok(())
    }

    /// Get a locked payment record by id.
    pub fn get_payment(env: Env, id: Symbol) -> Result<LockedPayment, ContractError> {
        env.storage()
            .persistent()
            .get(&DataKey::Payment(id))
            .ok_or(ContractError::PaymentNotFound)
    }

    /// Extend the TTL of a payment entry (permissionless).
    pub fn extend_payment_ttl_pub(env: Env, id: Symbol) -> Result<(), ContractError> {
        Self::extend_payment_ttl(&env, &id);
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
        Self::require_role(&env, &Symbol::new(&env, ROLE_UPGRADER), &caller)?;
        env.deployer().update_current_contract_wasm(new_wasm_hash);
        Ok(())
    }
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod test;
