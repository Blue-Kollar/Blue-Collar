//! # BlueCollar Reputation Contract
//!
//! Tracks on-chain reputation scores for workers. Reputation is updated by
//! authorised `rep_manager` addresses only. All state-mutating functions follow
//! the Checks-Effects-Interactions (CEI) pattern to prevent reentrancy.

#![no_std]

use bluecollar_types::{helpers, storage::extend_ttl, ContractError};
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, BytesN, Env, Symbol, Vec,
};

pub const VERSION: u32 = 1;

/// Maximum reputation score (100.00 % expressed in basis points).
pub const MAX_SCORE: u32 = 10_000;

/// Approximate TTL extension target (~1 year at 5 s/ledger).
const TTL_EXTEND_TO: u32 = 535_000;
/// Extend TTL only when it drops below this threshold (~6 months).
const TTL_THRESHOLD: u32 = 267_500;

// =============================================================================
// Roles
// =============================================================================

pub const ROLE_ADMIN: &str = "admin";
pub const ROLE_REP_MGR: &str = "rep_mgr";
pub const ROLE_UPGRADER: &str = "upgrader";
pub const ROLE_PAUSER: &str = "pauser";

const ROLE_ADMIN_ID: u64 = 0;
const ROLE_REP_MGR_ID: u64 = 1;
const ROLE_UPGRADER_ID: u64 = 2;
const ROLE_PAUSER_ID: u64 = 3;

fn role_to_id(env: &Env, role: &Symbol) -> u64 {
    if *role == Symbol::new(env, ROLE_ADMIN) {
        ROLE_ADMIN_ID
    } else if *role == Symbol::new(env, ROLE_REP_MGR) {
        ROLE_REP_MGR_ID
    } else if *role == Symbol::new(env, ROLE_UPGRADER) {
        ROLE_UPGRADER_ID
    } else if *role == Symbol::new(env, ROLE_PAUSER) {
        ROLE_PAUSER_ID
    } else {
        u64::MAX
    }
}

// =============================================================================
// Types
// =============================================================================

/// A single review record contributed by a verified reviewer.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct Review {
    /// Address of the reviewer (must hold `ROLE_REP_MGR`).
    pub reviewer: Address,
    /// Rating in basis points (0–10 000).
    pub rating_bps: u32,
    /// Optional short comment hash (SHA-256 of comment text), zero bytes = no comment.
    pub comment_hash: BytesN<32>,
    /// Ledger sequence number when review was submitted.
    pub ledger: u32,
}

/// Aggregated reputation record stored per worker.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct ReputationRecord {
    /// Current weighted score in basis points (0–10 000).
    pub score: u32,
    /// Total number of reviews received.
    pub review_count: u32,
    /// Running sum of rating_bps for average calculation.
    pub rating_sum: u64,
    /// Badges awarded to this worker (symbolic identifiers).
    pub badges: Vec<Symbol>,
    /// Ledger sequence of last update.
    pub last_updated: u32,
}

/// Storage keys.
#[contracttype]
pub enum DataKey {
    /// Instance — initialisation flag.
    Initialized,
    /// Instance — paused flag.
    Paused,
    /// Persistent — admin address.
    Admin,
    /// Persistent — role member lists keyed by compact role id.
    RoleMembers(u64),
    /// Persistent — `ReputationRecord` for a worker id.
    Reputation(Symbol),
    /// Persistent — list of `Review` entries for a worker id.
    Reviews(Symbol),
    /// Persistent — schema version for migrations.
    SchemaVersion,
}

// =============================================================================
// Contract
// =============================================================================

#[contract]
pub struct ReputationContract;

#[contractimpl]
impl ReputationContract {
    // -------------------------------------------------------------------------
    // Initialise
    // -------------------------------------------------------------------------

    /// Initialise the contract. Must be called exactly once.
    pub fn initialize(env: Env, admin: Address) -> Result<(), ContractError> {
        // --- Checks ---
        if env.storage().instance().has(&DataKey::Initialized) {
            return Err(ContractError::AlreadyInitialized);
        }
        // --- Effects ---
        env.storage().instance().set(&DataKey::Initialized, &true);
        env.storage().persistent().set(&DataKey::Admin, &admin);
        env.storage()
            .persistent()
            .set(&DataKey::SchemaVersion, &1u32);

        // Bootstrap ROLE_ADMIN for the initial admin.
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
    // Internal RBAC helpers
    // -------------------------------------------------------------------------

    fn get_role_members(env: &Env, role: &Symbol) -> Vec<Address> {
        env.storage()
            .persistent()
            .get(&DataKey::RoleMembers(role_to_id(env, role)))
            .unwrap_or(Vec::new(env))
    }

    /// Assert `caller` holds `role` and has authorised this transaction.
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
        Self::require_role(&env, &Symbol::new(&env, ROLE_ADMIN), &caller)?;
        Self::require_not_paused(&env)?;
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
        Self::require_not_paused(&env)?;
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

    /// Check whether `account` holds `role`.
    pub fn has_role(env: Env, role: Symbol, account: Address) -> Result<bool, ContractError> {
        Ok(Self::get_role_members(&env, &role)
            .iter()
            .any(|m| m == account))
    }

    // -------------------------------------------------------------------------
    // Pause / Unpause
    // -------------------------------------------------------------------------

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

    // -------------------------------------------------------------------------
    // Reputation — write (ROLE_REP_MGR only)
    // -------------------------------------------------------------------------

    /// Submit a review for a worker.
    pub fn submit_review(
        env: Env,
        caller: Address,
        worker_id: Symbol,
        rating_bps: u32,
        comment_hash: BytesN<32>,
    ) -> Result<(), ContractError> {
        // --- Checks ---
        Self::require_role(&env, &Symbol::new(&env, ROLE_REP_MGR), &caller)?;
        Self::require_not_paused(&env)?;
        if rating_bps > MAX_SCORE {
            return Err(ContractError::RatingOutOfRange);
        }

        // --- Effects ---
        let review = Review {
            reviewer: caller.clone(),
            rating_bps,
            comment_hash,
            ledger: env.ledger().sequence(),
        };

        // Load existing record or create default.
        let mut record = Self::load_record(&env, &worker_id);
        record.review_count += 1;
        record.rating_sum = record.rating_sum.saturating_add(rating_bps as u64);
        // Weighted average: rating_sum / review_count (in bps).
        record.score = (record.rating_sum / record.review_count as u64) as u32;
        record.last_updated = env.ledger().sequence();

        // Append review to history.
        let mut reviews: Vec<Review> = env
            .storage()
            .persistent()
            .get(&DataKey::Reviews(worker_id.clone()))
            .unwrap_or(Vec::new(&env));
        reviews.push_back(review);

        // Write state before emitting events (CEI).
        Self::save_record(&env, &worker_id, &record);
        env.storage()
            .persistent()
            .set(&DataKey::Reviews(worker_id.clone()), &reviews);
        Self::extend_record_ttl(&env, &worker_id);

        // --- Interactions ---
        env.events().publish(
            (symbol_short!("Review"), worker_id),
            (caller, rating_bps, record.score),
        );
        Ok(())
    }

    /// Slash a worker's reputation score by a fixed amount in basis points.
    pub fn slash_reputation(
        env: Env,
        caller: Address,
        worker_id: Symbol,
        slash_bps: u32,
    ) -> Result<(), ContractError> {
        // --- Checks ---
        Self::require_role(&env, &Symbol::new(&env, ROLE_REP_MGR), &caller)?;
        Self::require_not_paused(&env)?;
        if slash_bps > MAX_SCORE {
            return Err(ContractError::ScoreOutOfRange);
        }

        // --- Effects ---
        let mut record = Self::load_record(&env, &worker_id);
        record.score = record.score.saturating_sub(slash_bps);
        record.last_updated = env.ledger().sequence();
        Self::save_record(&env, &worker_id, &record); // write before emit
        Self::extend_record_ttl(&env, &worker_id);

        // --- Interactions ---
        env.events().publish(
            (symbol_short!("Slashed"), worker_id),
            (caller, slash_bps, record.score),
        );
        Ok(())
    }

    /// Reset a worker's reputation to zero. Caller must hold `ROLE_ADMIN`.
    pub fn reset_reputation(
        env: Env,
        caller: Address,
        worker_id: Symbol,
    ) -> Result<(), ContractError> {
        // --- Checks ---
        Self::require_role(&env, &Symbol::new(&env, ROLE_ADMIN), &caller)?;
        Self::require_not_paused(&env)?;

        // --- Effects ---
        let mut record = Self::load_record(&env, &worker_id);
        record.score = 0;
        record.review_count = 0;
        record.rating_sum = 0;
        record.last_updated = env.ledger().sequence();
        Self::save_record(&env, &worker_id, &record);
        Self::extend_record_ttl(&env, &worker_id);

        // --- Interactions ---
        env.events()
            .publish((symbol_short!("Reset"), worker_id), caller);
        Ok(())
    }

    /// Award a badge to a worker. Caller must hold `ROLE_REP_MGR`.
    pub fn award_badge(
        env: Env,
        caller: Address,
        worker_id: Symbol,
        badge: Symbol,
    ) -> Result<(), ContractError> {
        // --- Checks ---
        Self::require_role(&env, &Symbol::new(&env, ROLE_REP_MGR), &caller)?;
        Self::require_not_paused(&env)?;

        let mut record = Self::load_record(&env, &worker_id);
        if record.badges.iter().any(|b| b == badge) {
            return Err(ContractError::BadgeAlreadyAwarded);
        }

        // --- Effects ---
        record.badges.push_back(badge.clone()); // FIX: write before emit
        record.last_updated = env.ledger().sequence();
        Self::save_record(&env, &worker_id, &record);
        Self::extend_record_ttl(&env, &worker_id);

        // --- Interactions ---
        env.events()
            .publish((symbol_short!("Badge"), worker_id), (caller, badge));
        Ok(())
    }

    /// Revoke a badge from a worker. Caller must hold `ROLE_REP_MGR`.
    pub fn revoke_badge(
        env: Env,
        caller: Address,
        worker_id: Symbol,
        badge: Symbol,
    ) -> Result<(), ContractError> {
        // --- Checks ---
        Self::require_role(&env, &Symbol::new(&env, ROLE_REP_MGR), &caller)?;
        Self::require_not_paused(&env)?;

        let mut record = Self::load_record(&env, &worker_id);
        let mut updated_badges: Vec<Symbol> = Vec::new(&env);
        for b in record.badges.iter() {
            if b != badge {
                updated_badges.push_back(b);
            }
        }

        // --- Effects ---
        record.badges = updated_badges;
        record.last_updated = env.ledger().sequence();
        Self::save_record(&env, &worker_id, &record);
        Self::extend_record_ttl(&env, &worker_id);

        // --- Interactions ---
        env.events()
            .publish((symbol_short!("BdgRevk"), worker_id), (caller, badge));
        Ok(())
    }

    // -------------------------------------------------------------------------
    // Reputation — read (public)
    // -------------------------------------------------------------------------

    /// Get the current reputation score for a worker (0 if not yet rated).
    pub fn get_score(env: Env, worker_id: Symbol) -> Result<u32, ContractError> {
        Ok(Self::load_record(&env, &worker_id).score)
    }

    /// Get the full reputation record for a worker.
    pub fn get_record(env: Env, worker_id: Symbol) -> Result<ReputationRecord, ContractError> {
        Ok(Self::load_record(&env, &worker_id))
    }

    /// Get the full review history for a worker.
    pub fn get_reviews(env: Env, worker_id: Symbol) -> Result<Vec<Review>, ContractError> {
        Ok(env
            .storage()
            .persistent()
            .get(&DataKey::Reviews(worker_id))
            .unwrap_or(Vec::new(&env)))
    }

    /// Return `true` if the worker holds the given badge.
    pub fn has_badge(env: Env, worker_id: Symbol, badge: Symbol) -> Result<bool, ContractError> {
        Ok(Self::load_record(&env, &worker_id)
            .badges
            .iter()
            .any(|b| b == badge))
    }

    /// Extend the TTL of a worker's reputation entry (permissionless).
    pub fn extend_worker_ttl(env: Env, worker_id: Symbol) -> Result<(), ContractError> {
        Self::extend_record_ttl(&env, &worker_id);
        Ok(())
    }

    /// Get the contract admin address.
    pub fn get_admin(env: Env) -> Result<Address, ContractError> {
        env.storage()
            .persistent()
            .get(&DataKey::Admin)
            .ok_or(ContractError::NotInitialized)
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
        Self::require_role(&env, &Symbol::new(&env, ROLE_UPGRADER), &caller)?;
        env.deployer().update_current_contract_wasm(new_wasm_hash);
        Ok(())
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    fn load_record(env: &Env, worker_id: &Symbol) -> ReputationRecord {
        env.storage()
            .persistent()
            .get(&DataKey::Reputation(worker_id.clone()))
            .unwrap_or(ReputationRecord {
                score: 0,
                review_count: 0,
                rating_sum: 0,
                badges: Vec::new(env),
                last_updated: 0,
            })
    }

    fn save_record(env: &Env, worker_id: &Symbol, record: &ReputationRecord) {
        env.storage()
            .persistent()
            .set(&DataKey::Reputation(worker_id.clone()), record);
    }

    fn extend_record_ttl(env: &Env, worker_id: &Symbol) {
        extend_ttl(env, &DataKey::Reputation(worker_id.clone()));
    }
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod test;
