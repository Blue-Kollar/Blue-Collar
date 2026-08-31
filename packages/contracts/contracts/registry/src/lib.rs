//! # BlueCollar Registry Contract
//!
//! Deployed on Stellar (Soroban), this contract manages on-chain worker
//! registrations for the BlueCollar protocol.
//!
//! ## Module layout
//! - **`storage`** â€” all persisted types, `DataKey`, constants, and pure
//!   storage-accessor helpers.
//! - **`logic`** â€” internal business-logic helpers (access-control,
//!   reputation computation, performance scoring).
//! - **`lib`** (this file) â€” thin public entrypoint: the `#[contract]` struct
//!   and its `#[contractimpl]` block, delegating to `storage` and `logic`.
//!
//! ## Access Control
//! - **Admin**: Set once at [`initialize`]. Can add/remove curators and
//!   upgrade the contract.
//! - **Curators**: Approved addresses that may register workers.
//! - **Owners**: The worker's on-chain owner address; may toggle, update, or
//!   deregister their own worker.
//!
//! ## Privacy
//! Raw PII is never stored on-chain. Only SHA-256 digests are stored.

#![no_std]
// Lint policy: clippy::pedantic enabled at workspace level (issue #1254).
// Blanket Soroban exceptions (needless_pass_by_value, must_use_candidate, etc.)
// are configured in the workspace Cargo.toml; per-function overrides go here.

mod logic;
mod storage;

use bluecollar_types::ContractError;
use soroban_sdk::{
    contract, contractimpl, symbol_short, token, Address, BytesN, Env, String, Symbol, Vec,
};

pub use storage::{
    AvailabilityStatus, Badge, BatchRegisterResult, CategoryVerification, CertifiedSkill,
    DataKey, Delegate, LocationVerification, PerformanceMetrics, PendingUpgrade,
    ReputationEvent, ReputationInputs, StakeInfo, SubscriptionTier, TTL_EXTEND_TO,
    TTL_THRESHOLD, VerificationLevel, Worker, WorkerPage, WorkerSubscription,
};
pub use storage::{
    ROLE_ADMIN, ROLE_ADMIN_CACHED, ROLE_CURATOR_MGR, ROLE_CURATOR_MGR_CACHED, ROLE_PAUSER,
    ROLE_PAUSER_CACHED, ROLE_REP_MGR, ROLE_REP_MGR_CACHED, ROLE_UPGRADER, ROLE_UPGRADER_CACHED,
};

pub use storage::VERSION;

// =============================================================================
// Contract
// =============================================================================

#[contract]
pub struct RegistryContract;

#[contractimpl]
impl RegistryContract {
    // -------------------------------------------------------------------------
    // Init
    // -------------------------------------------------------------------------

    /// Initialise the contract and set the admin address.
    ///
    /// Grants [`ROLE_ADMIN`] to `admin` automatically.
    pub fn initialize(env: Env, admin: Address) -> Result<(), ContractError> {
        if env.storage().persistent().has(&DataKey::Admin) {
            return Err(ContractError::AlreadyInitialized);
        }
        env.storage().persistent().set(&DataKey::Admin, &admin);
        storage::set_schema_version(&env, 1u32);

        // Bootstrap: grant ROLE_ADMIN to the initial admin.
        let role = Symbol::new(&env, ROLE_ADMIN_CACHED);
        let role_id = logic::role_to_id(&env, &role);
        let mut members: Vec<Address> = Vec::new(&env);
        members.push_back(admin.clone());
        storage::set_role_members(&env, role_id, &members);

        env.events()
            .publish((symbol_short!("RlGrnt"), role, admin), ());
        Ok(())
    }

    // -------------------------------------------------------------------------
    // Role management (ROLE_ADMIN only)
    // -------------------------------------------------------------------------

    /// Grant a role to an address. Caller must hold [`ROLE_ADMIN`].
    pub fn grant_role(
        env: Env,
        caller: Address,
        role: Symbol,
        account: Address,
    ) -> Result<(), ContractError> {
        let admin_role = logic::role_symbol(&env, ROLE_ADMIN_CACHED);
        logic::require_role(&env, &admin_role, &caller)?;
        logic::require_not_paused(&env)?;

        let role_id = logic::role_to_id(&env, &role);
        let mut members = storage::get_role_members(&env, role_id);
        if members.iter().all(|m| m != account) {
            members.push_back(account.clone());
            storage::set_role_members(&env, role_id, &members);
        }
        env.events()
            .publish((symbol_short!("RlGrnt"), role, account), ());
        Ok(())
    }

    /// Revoke a role from an address. Caller must hold [`ROLE_ADMIN`].
    pub fn revoke_role(
        env: Env,
        caller: Address,
        role: Symbol,
        account: Address,
    ) -> Result<(), ContractError> {
        let admin_role = logic::role_symbol(&env, ROLE_ADMIN_CACHED);
        logic::require_role(&env, &admin_role, &caller)?;
        logic::require_not_paused(&env)?;

        let role_id = logic::role_to_id(&env, &role);
        let members = storage::get_role_members(&env, role_id);
        let mut updated: Vec<Address> = Vec::new(&env);
        let mut found = false;
        for m in members.iter() {
            if m == account {
                found = true;
            } else {
                updated.push_back(m);
            }
        }
        if !found {
            return Err(ContractError::AccountDoesNotHoldRole);
        }
        storage::set_role_members(&env, role_id, &updated);
        env.events()
            .publish((symbol_short!("RlRvkd"), role, account), ());
        Ok(())
    }

    /// Returns `true` if `account` holds `role`.
    pub fn has_role(env: Env, role: Symbol, account: Address) -> Result<bool, ContractError> {
        let role_id = logic::role_to_id(&env, &role);
        Ok(storage::get_role_members(&env, role_id)
            .iter()
            .any(|m| m == account))
    }

    /// Return all members of a role.
    pub fn get_role_members_list(
        env: Env,
        role: Symbol,
    ) -> Result<Vec<Address>, ContractError> {
        let role_id = logic::role_to_id(&env, &role);
        Ok(storage::get_role_members(&env, role_id))
    }

    // -------------------------------------------------------------------------
    // Delegation management
    // -------------------------------------------------------------------------

    /// Add a delegate for a worker profile. Owner only.
    pub fn add_delegate(
        env: Env,
        id: Symbol,
        owner: Address,
        delegate: Address,
        expires_at: u64,
    ) -> Result<(), ContractError> {
        owner.require_auth();
        logic::require_not_paused(&env)?;
        let worker: Worker = env
            .storage()
            .persistent()
            .get(&DataKey::Worker(id.clone()))
            .ok_or(ContractError::WorkerNotFound)?;
        if worker.owner != owner {
            return Err(ContractError::NotAuthorized);
        }
        let mut delegates = storage::get_delegates(&env, &id);
        let mut found = false;
        for i in 0..delegates.len() {
            let mut d = delegates.get(i).unwrap();
            if d.address == delegate {
                d.expires_at = expires_at;
                delegates.set(i, d);
                found = true;
                break;
            }
        }
        if !found {
            delegates.push_back(Delegate {
                address: delegate.clone(),
                expires_at,
            });
        }
        storage::set_delegates(&env, &id, &delegates);
        env.events()
            .publish((symbol_short!("DlgAdd"), id, delegate), expires_at);
        Ok(())
    }

    /// Remove a delegate from a worker profile. Owner only.
    pub fn remove_delegate(
        env: Env,
        id: Symbol,
        owner: Address,
        delegate: Address,
    ) -> Result<(), ContractError> {
        owner.require_auth();
        logic::require_not_paused(&env)?;
        let worker: Worker = env
            .storage()
            .persistent()
            .get(&DataKey::Worker(id.clone()))
            .ok_or(ContractError::WorkerNotFound)?;
        if worker.owner != owner {
            return Err(ContractError::NotAuthorized);
        }
        let delegates = storage::get_delegates(&env, &id);
        let mut updated: Vec<Delegate> = Vec::new(&env);
        let mut removed = false;
        for d in delegates.iter() {
            if d.address == delegate {
                removed = true;
            } else {
                updated.push_back(d);
            }
        }
        if !removed {
            return Err(ContractError::DelegateNotFound);
        }
        storage::set_delegates(&env, &id, &updated);
        env.events()
            .publish((symbol_short!("DlgRem"), id, delegate), ());
        Ok(())
    }

    /// Get all delegates for a worker.
    pub fn get_worker_delegates(
        env: Env,
        id: Symbol,
    ) -> Result<Vec<Delegate>, ContractError> {
        Ok(storage::get_delegates(&env, &id))
    }

    // -------------------------------------------------------------------------
    // Pause / Unpause
    // -------------------------------------------------------------------------

    /// Pause the contract, blocking all state-mutating operations.
    pub fn pause(env: Env, admin: Address) -> Result<(), ContractError> {
        let pauser_role = logic::role_symbol(&env, ROLE_PAUSER_CACHED);
        logic::require_role(&env, &pauser_role, &admin)?;
        env.storage().instance().set(&DataKey::Paused, &true);
        env.events().publish((symbol_short!("Paused"), admin), ());
        Ok(())
    }

    /// Unpause the contract.
    pub fn unpause(env: Env, admin: Address) -> Result<(), ContractError> {
        let pauser_role = logic::role_symbol(&env, ROLE_PAUSER_CACHED);
        logic::require_role(&env, &pauser_role, &admin)?;
        env.storage().instance().set(&DataKey::Paused, &false);
        env.events().publish((symbol_short!("Unpaused"), admin), ());
        Ok(())
    }

    /// Returns `true` if the contract is currently paused.
    pub fn is_paused(env: Env) -> Result<bool, ContractError> {
        Ok(env
            .storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false))
    }

    // -------------------------------------------------------------------------
    // Curator management
    // -------------------------------------------------------------------------

    /// Add a curator (admin only). Idempotent.
    pub fn add_curator(
        env: Env,
        admin: Address,
        curator: Address,
    ) -> Result<(), ContractError> {
        let curator_mgr_role = logic::role_symbol(&env, ROLE_CURATOR_MGR_CACHED);
        logic::require_role(&env, &curator_mgr_role, &admin)?;
        logic::require_not_paused(&env)?;
        let mut curators = storage::get_curators(&env);
        if curators.iter().all(|c| c != curator) {
            curators.push_back(curator.clone());
            storage::set_curators(&env, &curators);
        }
        env.events()
            .publish((symbol_short!("CurAdd"), admin, curator), ());
        Ok(())
    }

    /// Remove a curator (admin only).
    pub fn remove_curator(
        env: Env,
        admin: Address,
        curator: Address,
    ) -> Result<(), ContractError> {
        let curator_mgr_role = logic::role_symbol(&env, ROLE_CURATOR_MGR_CACHED);
        logic::require_role(&env, &curator_mgr_role, &admin)?;
        logic::require_not_paused(&env)?;
        let curators = storage::get_curators(&env);
        let mut updated: Vec<Address> = Vec::new(&env);
        for c in curators.iter() {
            if c != curator {
                updated.push_back(c);
            }
        }
        storage::set_curators(&env, &updated);
        env.events()
            .publish((symbol_short!("CurRem"), admin, curator), ());
        Ok(())
    }

    /// Returns `true` if `addr` is an approved curator.
    pub fn is_curator(env: Env, addr: Address) -> Result<bool, ContractError> {
        Ok(storage::get_curators(&env).iter().any(|c| c == addr))
    }

    // -------------------------------------------------------------------------
    // Worker registration (curator-gated)
    // -------------------------------------------------------------------------

    /// Register a new worker on-chain. Caller must be an authorised curator.
    pub fn register(
        env: Env,
        id: Symbol,
        owner: Address,
        name: String,
        category: Symbol,
        location_hash: BytesN<32>,
        contact_hash: BytesN<32>,
        curator: Address,
    ) -> Result<(), ContractError> {
        curator.require_auth();
        logic::require_not_paused(&env)?;
        if !storage::get_curators(&env).iter().any(|c| c == curator) {
            return Err(ContractError::CallerIsNotCurator);
        }
        // Validate category against on-chain list (if any categories are set).
        let cats: Vec<Symbol> = env
            .storage()
            .persistent()
            .get(&DataKey::Categories)
            .unwrap_or(Vec::new(&env));
        if !cats.is_empty() && !cats.iter().any(|c| c == category) {
            return Err(ContractError::UnknownCategory);
        }

        let worker = Worker {
            id: id.clone(),
            owner: owner.clone(),
            name,
            category: category.clone(),
            is_active: true,
            wallet: owner.clone(),
            location_hash,
            contact_hash,
            reputation: 0,
            verified_categories: Vec::new(&env),
            staked_amount: 0,
            review_count: 0,
            avg_rating: 0,
            subscription: WorkerSubscription {
                tier: SubscriptionTier::Free,
                expires_at: 0,
                last_renewed_at: env.ledger().timestamp(),
            },
        };

        storage::set_worker(&env, &worker);

        let mut list = storage::get_worker_list(&env);
        list.push_back(id.clone());
        storage::set_worker_list(&env, &list);
        storage::increment_worker_count(&env);

        env.events()
            .publish((symbol_short!("WrkReg"), id), (owner, category));
        Ok(())
    }

    // -------------------------------------------------------------------------
    // Worker owner functions
    // -------------------------------------------------------------------------

    /// Toggle a worker's `is_active` status. Only the worker's owner may call this.
    pub fn toggle(env: Env, id: Symbol, caller: Address) -> Result<(), ContractError> {
        caller.require_auth();
        logic::require_not_paused(&env)?;
        let mut worker: Worker = env
            .storage()
            .persistent()
            .get(&DataKey::Worker(id.clone()))
            .ok_or(ContractError::WorkerNotFound)?;
        logic::require_owner_or_delegate(&env, &worker, &caller)?;
        worker.is_active = !worker.is_active;
        let new_status = worker.is_active;
        storage::set_worker(&env, &worker);
        env.events()
            .publish((symbol_short!("WrkTgl"), id), new_status);
        Ok(())
    }

    /// Update a worker's name, category, location hash, and contact hash. Owner only.
    pub fn update(
        env: Env,
        id: Symbol,
        caller: Address,
        name: String,
        category: Symbol,
        location_hash: BytesN<32>,
        contact_hash: BytesN<32>,
    ) -> Result<(), ContractError> {
        caller.require_auth();
        logic::require_not_paused(&env)?;
        let mut worker: Worker = env
            .storage()
            .persistent()
            .get(&DataKey::Worker(id.clone()))
            .ok_or(ContractError::WorkerNotFound)?;
        logic::require_owner_or_delegate(&env, &worker, &caller)?;
        worker.name = name.clone();
        worker.category = category.clone();
        worker.location_hash = location_hash;
        worker.contact_hash = contact_hash;
        storage::set_worker(&env, &worker);
        env.events()
            .publish((symbol_short!("WrkUpd"), id), (name, category));
        Ok(())
    }

    /// Update a worker's name, category, and wallet address. Owner only.
    pub fn update_worker(
        env: Env,
        id: Symbol,
        caller: Address,
        name: String,
        category: Symbol,
        wallet: Address,
    ) -> Result<(), ContractError> {
        caller.require_auth();
        logic::require_not_paused(&env)?;
        let mut worker: Worker = env
            .storage()
            .persistent()
            .get(&DataKey::Worker(id.clone()))
            .ok_or(ContractError::WorkerNotFound)?;
        logic::require_owner_or_delegate(&env, &worker, &caller)?;
        worker.name = name.clone();
        worker.category = category.clone();
        worker.wallet = wallet.clone();
        storage::set_worker(&env, &worker);
        env.events().publish(
            (symbol_short!("WrkUpd"), id, caller),
            (name, category, wallet),
        );
        Ok(())
    }

    /// Permanently remove a worker from the registry. Owner only.
    pub fn deregister(env: Env, id: Symbol, caller: Address) -> Result<(), ContractError> {
        caller.require_auth();
        logic::require_not_paused(&env)?;
        let worker: Worker = env
            .storage()
            .persistent()
            .get(&DataKey::Worker(id.clone()))
            .ok_or(ContractError::WorkerNotFound)?;
        if worker.owner != caller {
            return Err(ContractError::NotAuthorized);
        }
        env.storage()
            .persistent()
            .remove(&DataKey::Worker(id.clone()));
        let mut list = storage::get_worker_list(&env);
        if let Some(pos) = list.iter().position(|x| x == id) {
            list.remove(pos as u32);
        }
        storage::set_worker_list(&env, &list);
        storage::decrement_worker_count(&env);
        env.events()
            .publish((symbol_short!("WrkDrg"), id, caller), ());
        Ok(())
    }

    // -------------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------------

    /// Get a worker by id.
    pub fn get_worker(env: Env, id: Symbol) -> Result<Option<Worker>, ContractError> {
        Ok(env.storage().persistent().get(&DataKey::Worker(id)))
    }

    /// List all registered worker ids.
    pub fn list_workers(env: Env) -> Result<Vec<Symbol>, ContractError> {
        Ok(storage::get_worker_list(&env))
    }

    /// Return a page of worker ids starting at `offset`, up to `limit` items.
    pub fn list_workers_paginated(
        env: Env,
        offset: u32,
        limit: u32,
    ) -> Result<Vec<Symbol>, ContractError> {
        let list = storage::get_worker_list(&env);
        let total = list.len();
        let mut page: Vec<Symbol> = Vec::new(&env);
        if offset >= total || limit == 0 {
            return Ok(page);
        }
        let end = (offset + limit).min(total);
        for i in offset..end {
            page.push_back(list.get(i).unwrap());
        }
        Ok(page)
    }

    /// Return the total number of registered workers.
    pub fn worker_count(env: Env) -> Result<u32, ContractError> {
        Ok(storage::get_worker_list(&env).len())
    }

    /// Extend the TTL of a worker entry. Callable by anyone.
    pub fn extend_worker_ttl(env: Env, id: Symbol) -> Result<(), ContractError> {
        let key = DataKey::Worker(id.clone());
        if !env.storage().persistent().has(&key) {
            return Err(ContractError::WorkerNotFound);
        }
        env.storage()
            .persistent()
            .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
        Ok(())
    }

    /// Returns `true` if the contract has been initialised.
    pub fn is_initialized(env: Env) -> Result<bool, ContractError> {
        Ok(env.storage().persistent().has(&DataKey::Admin))
    }

    /// Return the event schema version.
    pub fn version(_env: Env) -> Result<u32, ContractError> {
        Ok(VERSION)
    }

    /// Get the admin address.
    pub fn get_admin(env: Env) -> Result<Address, ContractError> {
        env.storage()
            .persistent()
            .get(&DataKey::Admin)
            .ok_or(ContractError::NotInitialized)
    }

    /// Set a new admin address. Caller must be the current admin.
    pub fn set_admin(env: Env, new_admin: Address) -> Result<(), ContractError> {
        let current_admin: Address = env
            .storage()
            .persistent()
            .get(&DataKey::Admin)
            .ok_or(ContractError::NotInitialized)?;
        current_admin.require_auth();
        env.storage().persistent().set(&DataKey::Admin, &new_admin);
        let admin_role = logic::role_symbol(&env, ROLE_ADMIN);
        let role_id = logic::role_to_id(&env, &admin_role);
        let members = storage::get_role_members(&env, role_id);
        let mut updated: Vec<Address> = Vec::new(&env);
        for m in members.iter() {
            if m != current_admin {
                updated.push_back(m);
            }
        }
        if updated.iter().all(|m| m != new_admin) {
            updated.push_back(new_admin.clone());
        }
        storage::set_role_members(&env, role_id, &updated);
        Ok(())
    }

    // -------------------------------------------------------------------------
    // Reputation
    // -------------------------------------------------------------------------

    /// Update a worker's on-chain reputation score (rep_mgr only).
    pub fn update_reputation(
        env: Env,
        admin: Address,
        id: Symbol,
        score: u32,
    ) -> Result<(), ContractError> {
        let rep_mgr_role = logic::role_symbol(&env, ROLE_REP_MGR_CACHED);
        logic::require_role(&env, &rep_mgr_role, &admin)?;
        logic::require_not_paused(&env)?;
        if score > 10_000 {
            return Err(ContractError::ScoreOutOfRange);
        }
        let mut worker: Worker = env
            .storage()
            .persistent()
            .get(&DataKey::Worker(id.clone()))
            .ok_or(ContractError::WorkerNotFound)?;
        let prev = worker.reputation;
        worker.reputation = score;
        storage::set_worker(&env, &worker);
        logic::append_reputation_history(&env, &id, prev, score, Symbol::new(&env, "manual"));
        env.events().publish((symbol_short!("RepUpd"), id), score);
        Ok(())
    }

    /// Submit a user review for a worker.
    pub fn submit_review(
        env: Env,
        reviewer: Address,
        worker_id: Symbol,
        rating: u32,
    ) -> Result<(), ContractError> {
        reviewer.require_auth();
        logic::require_not_paused(&env)?;
        if rating > 10_000 {
            return Err(ContractError::RatingOutOfRange);
        }
        let mut worker: Worker = env
            .storage()
            .persistent()
            .get(&DataKey::Worker(worker_id.clone()))
            .ok_or(ContractError::WorkerNotFound)?;
        let now = env.ledger().timestamp();
        let mut inputs: ReputationInputs = env
            .storage()
            .persistent()
            .get(&DataKey::ReputationInputs(worker_id.clone()))
            .unwrap_or(ReputationInputs {
                tip_count: 0,
                rating_sum: 0,
                rating_count: 0,
                last_review_at: 0,
            });
        inputs.rating_sum = inputs
            .rating_sum
            .checked_add(rating as u64)
            .expect("overflow");
        inputs.rating_count = inputs.rating_count.checked_add(1).expect("overflow");
        inputs.last_review_at = now;

        let new_score = logic::compute_weighted_reputation(&inputs, now);
        env.storage()
            .persistent()
            .set(&DataKey::ReputationInputs(worker_id.clone()), &inputs);

        let prev_rep = worker.reputation;
        worker.review_count = worker.review_count.checked_add(1).expect("overflow");
        worker.avg_rating = (inputs.rating_sum / inputs.rating_count as u64) as u32;
        worker.reputation = new_score;

        // Slash check: avg below threshold with enough reviews.
        if worker.avg_rating < logic::SLASH_THRESHOLD_RATING
            && worker.review_count >= logic::SLASH_MIN_REVIEWS
        {
            let slashed = worker.reputation / 2;
            logic::append_reputation_history(
                &env,
                &worker_id,
                worker.reputation,
                slashed,
                Symbol::new(&env, "slash"),
            );
            worker.reputation = slashed;
            env.events().publish(
                (Symbol::new(&env, "RepSlashed"), worker_id.clone()),
                (worker.avg_rating, slashed),
            );
        }
        storage::set_worker(&env, &worker);
        logic::append_reputation_history(
            &env,
            &worker_id,
            prev_rep,
            new_score,
            Symbol::new(&env, "review"),
        );
        env.events().publish(
            (symbol_short!("RevSub"), worker_id),
            (reviewer, rating, worker.reputation),
        );
        Ok(())
    }

    /// Record a completed job/tip payment to boost a worker's volume score.
    pub fn record_job_completion(
        env: Env,
        caller: Address,
        worker_id: Symbol,
    ) -> Result<(), ContractError> {
        let rep_mgr_role = logic::role_symbol(&env, ROLE_REP_MGR_CACHED);
        logic::require_role(&env, &rep_mgr_role, &caller)?;
        logic::require_not_paused(&env)?;
        let mut worker: Worker = env
            .storage()
            .persistent()
            .get(&DataKey::Worker(worker_id.clone()))
            .ok_or(ContractError::WorkerNotFound)?;
        let now = env.ledger().timestamp();
        let mut inputs: ReputationInputs = env
            .storage()
            .persistent()
            .get(&DataKey::ReputationInputs(worker_id.clone()))
            .unwrap_or(ReputationInputs {
                tip_count: 0,
                rating_sum: 0,
                rating_count: 0,
                last_review_at: 0,
            });
        inputs.tip_count = inputs.tip_count.checked_add(1).expect("overflow");
        let new_score = logic::compute_weighted_reputation(&inputs, now);
        let prev_rep = worker.reputation;
        worker.reputation = new_score;
        env.storage()
            .persistent()
            .set(&DataKey::ReputationInputs(worker_id.clone()), &inputs);
        storage::set_worker(&env, &worker);
        logic::append_reputation_history(
            &env,
            &worker_id,
            prev_rep,
            new_score,
            Symbol::new(&env, "job_comp"),
        );
        env.events().publish(
            (symbol_short!("JobComp"), worker_id),
            (inputs.tip_count, new_score),
        );
        Ok(())
    }

    /// Slash a worker's reputation for poor performance.
    pub fn slash_reputation(
        env: Env,
        caller: Address,
        worker_id: Symbol,
        slash_bps: u32,
    ) -> Result<(), ContractError> {
        let rep_mgr_role = logic::role_symbol(&env, ROLE_REP_MGR_CACHED);
        logic::require_role(&env, &rep_mgr_role, &caller)?;
        logic::require_not_paused(&env)?;
        if slash_bps > 10_000 {
            return Err(ContractError::ScoreOutOfRange);
        }
        let mut worker: Worker = env
            .storage()
            .persistent()
            .get(&DataKey::Worker(worker_id.clone()))
            .ok_or(ContractError::WorkerNotFound)?;
        let prev = worker.reputation;
        worker.reputation = worker.reputation.saturating_sub(slash_bps);
        storage::set_worker(&env, &worker);
        logic::append_reputation_history(
            &env,
            &worker_id,
            prev,
            worker.reputation,
            Symbol::new(&env, "slash"),
        );
        env.events().publish(
            (symbol_short!("RepSlash"), worker_id),
            (slash_bps, worker.reputation),
        );
        Ok(())
    }

    /// Get the immutable reputation history for a worker.
    pub fn get_reputation_history(
        env: Env,
        worker_id: Symbol,
    ) -> Result<Vec<ReputationEvent>, ContractError> {
        Ok(env
            .storage()
            .persistent()
            .get(&DataKey::ReputationHistory(worker_id))
            .unwrap_or(Vec::new(&env)))
    }

    /// Get the raw reputation inputs for a worker.
    pub fn get_reputation_inputs(
        env: Env,
        worker_id: Symbol,
    ) -> Result<Option<ReputationInputs>, ContractError> {
        Ok(env
            .storage()
            .persistent()
            .get(&DataKey::ReputationInputs(worker_id)))
    }

    /// Update a worker's review count and average rating. Admin only.
    pub fn update_reviews(
        env: Env,
        admin: Address,
        id: Symbol,
        review_count: u32,
        avg_rating: u32,
    ) -> Result<(), ContractError> {
        logic::require_role(&env, &Symbol::new(&env, ROLE_ADMIN), &admin)?;
        logic::require_not_paused(&env)?;
        if avg_rating > 10_000 {
            return Err(ContractError::RatingOutOfRange);
        }
        let mut worker: Worker = env
            .storage()
            .persistent()
            .get(&DataKey::Worker(id.clone()))
            .ok_or(ContractError::WorkerNotFound)?;
        worker.review_count = review_count;
        worker.avg_rating = avg_rating;
        storage::set_worker(&env, &worker);
        env.events()
            .publish((symbol_short!("RevUpd"), id), (review_count, avg_rating));
        Ok(())
    }

    /// Update a worker's subscription tier and expiration. Admin only.
    pub fn update_subscription(
        env: Env,
        admin: Address,
        id: Symbol,
        tier: u32,
        expires_at: u64,
    ) -> Result<(), ContractError> {
        logic::require_role(&env, &Symbol::new(&env, ROLE_ADMIN), &admin)?;
        logic::require_not_paused(&env)?;
        let tier_enum = match tier {
            0 => SubscriptionTier::Free,
            1 => SubscriptionTier::Basic,
            2 => SubscriptionTier::Premium,
            _ => return Err(ContractError::InvalidSubscriptionTier),
        };
        let mut worker: Worker = env
            .storage()
            .persistent()
            .get(&DataKey::Worker(id.clone()))
            .ok_or(ContractError::WorkerNotFound)?;
        let now = env.ledger().timestamp();
        worker.subscription = WorkerSubscription {
            tier: tier_enum,
            expires_at,
            last_renewed_at: now,
        };
        storage::set_worker(&env, &worker);
        env.events()
            .publish((symbol_short!("SubUpd"), id), (tier, expires_at));
        Ok(())
    }

    /// Renew a worker's subscription. Owner or delegate only.
    pub fn renew_subscription(
        env: Env,
        caller: Address,
        id: Symbol,
        new_expires_at: u64,
    ) -> Result<(), ContractError> {
        caller.require_auth();
        logic::require_not_paused(&env)?;
        let mut worker: Worker = env
            .storage()
            .persistent()
            .get(&DataKey::Worker(id.clone()))
            .ok_or(ContractError::WorkerNotFound)?;
        logic::require_owner_or_delegate(&env, &worker, &caller)?;
        let now = env.ledger().timestamp();
        worker.subscription.expires_at = new_expires_at;
        worker.subscription.last_renewed_at = now;
        storage::set_worker(&env, &worker);
        env.events()
            .publish((symbol_short!("SubRnw"), id), new_expires_at);
        Ok(())
    }

    /// Get a worker's subscription status.
    pub fn get_subscription(
        env: Env,
        id: Symbol,
    ) -> Result<WorkerSubscription, ContractError> {
        let worker: Worker = env
            .storage()
            .persistent()
            .get(&DataKey::Worker(id))
            .ok_or(ContractError::WorkerNotFound)?;
        Ok(worker.subscription)
    }

    // -------------------------------------------------------------------------
    // Category verification
    // -------------------------------------------------------------------------

    /// Verify a worker's category on-chain. Curator only.
    pub fn verify_category(
        env: Env,
        curator: Address,
        worker_id: Symbol,
        category: Symbol,
        expires_at: u64,
    ) -> Result<(), ContractError> {
        curator.require_auth();
        if !storage::get_curators(&env).iter().any(|c| c == curator) {
            return Err(ContractError::CallerIsNotCurator);
        }
        let mut worker: Worker = env
            .storage()
            .persistent()
            .get(&DataKey::Worker(worker_id.clone()))
            .ok_or(ContractError::WorkerNotFound)?;
        if worker.verified_categories.iter().all(|c| c != category) {
            worker.verified_categories.push_back(category.clone());
            storage::set_worker(&env, &worker);
        }
        let verification = CategoryVerification {
            category: category.clone(),
            curator: curator.clone(),
            expires_at,
        };
        env.storage().persistent().set(
            &DataKey::CategoryVerification(worker_id.clone(), category.clone()),
            &verification,
        );
        env.events().publish(
            (symbol_short!("CatVfy"), worker_id, category),
            (curator, expires_at),
        );
        Ok(())
    }

    /// Get the verification record for a specific worker + category pair.
    pub fn get_category_verification(
        env: Env,
        worker_id: Symbol,
        category: Symbol,
    ) -> Result<Option<CategoryVerification>, ContractError> {
        Ok(env
            .storage()
            .persistent()
            .get(&DataKey::CategoryVerification(worker_id, category)))
    }

    // -------------------------------------------------------------------------
    // Location verification
    // -------------------------------------------------------------------------

    /// Verify a worker's location on-chain.
    pub fn verify_location(
        env: Env,
        verifier: Address,
        worker_id: Symbol,
        expires_at: u64,
    ) -> Result<(), ContractError> {
        verifier.require_auth();
        let _worker: Worker = env
            .storage()
            .persistent()
            .get(&DataKey::Worker(worker_id.clone()))
            .ok_or(ContractError::WorkerNotFound)?;
        let now = env.ledger().timestamp();
        let verification = LocationVerification {
            verifier: verifier.clone(),
            verified_at: now,
            expires_at,
        };
        env.storage().persistent().set(
            &DataKey::LocationVerification(worker_id.clone()),
            &verification,
        );
        env.events().publish(
            (symbol_short!("LocVfy"), worker_id),
            (verifier, now, expires_at),
        );
        Ok(())
    }

    /// Get the location verification record for a worker.
    pub fn get_location_verification(
        env: Env,
        worker_id: Symbol,
    ) -> Result<Option<LocationVerification>, ContractError> {
        Ok(env
            .storage()
            .persistent()
            .get(&DataKey::LocationVerification(worker_id)))
    }

    // -------------------------------------------------------------------------
    // Availability status
    // -------------------------------------------------------------------------

    /// Update a worker's availability status. Owner only.
    pub fn update_availability(
        env: Env,
        id: Symbol,
        caller: Address,
        is_available: bool,
        expires_at: u64,
    ) -> Result<(), ContractError> {
        caller.require_auth();
        let worker: Worker = env
            .storage()
            .persistent()
            .get(&DataKey::Worker(id.clone()))
            .ok_or(ContractError::WorkerNotFound)?;
        if worker.owner != caller {
            return Err(ContractError::NotAuthorized);
        }
        let now = env.ledger().timestamp();
        let status = AvailabilityStatus {
            is_available,
            updated_at: now,
            expires_at,
        };
        env.storage()
            .persistent()
            .set(&DataKey::AvailabilityStatus(id.clone()), &status);
        env.events().publish(
            (symbol_short!("AvlUpd"), id),
            (is_available, now, expires_at),
        );
        Ok(())
    }

    /// Get the availability status for a worker.
    pub fn get_availability(
        env: Env,
        worker_id: Symbol,
    ) -> Result<Option<AvailabilityStatus>, ContractError> {
        Ok(env
            .storage()
            .persistent()
            .get(&DataKey::AvailabilityStatus(worker_id)))
    }

    // -------------------------------------------------------------------------
    // Batch operations
    // -------------------------------------------------------------------------

    /// Maximum number of workers that can be processed in a single batch call.
    pub const MAX_BATCH_SIZE: u32 = 20;

    /// Toggle the `is_active` status of multiple workers in one transaction.
    pub fn batch_toggle(
        env: Env,
        caller: Address,
        ids: Vec<Symbol>,
    ) -> Result<Vec<Symbol>, ContractError> {
        caller.require_auth();
        logic::require_not_paused(&env)?;
        if !storage::get_curators(&env).iter().any(|c| c == caller) {
            return Err(ContractError::CallerIsNotCurator);
        }
        if ids.len() > Self::MAX_BATCH_SIZE {
            return Err(ContractError::BatchTooLarge);
        }
        let mut toggled: Vec<Symbol> = Vec::new(&env);
        for id in ids.iter() {
            let key = DataKey::Worker(id.clone());
            if let Some(mut worker) = env.storage().persistent().get::<DataKey, Worker>(&key) {
                worker.is_active = !worker.is_active;
                let new_status = worker.is_active;
                storage::set_worker(&env, &worker);
                env.events()
                    .publish((symbol_short!("WrkTgl"), id.clone()), new_status);
                toggled.push_back(id);
            }
        }
        Ok(toggled)
    }

    /// Register multiple workers in one transaction. Curator only.
    pub fn batch_register(
        env: Env,
        curator: Address,
        ids: Vec<Symbol>,
        owners: Vec<Address>,
        names: Vec<String>,
        categories: Vec<Symbol>,
        location_hashes: Vec<BytesN<32>>,
        contact_hashes: Vec<BytesN<32>>,
    ) -> Result<Vec<BatchRegisterResult>, ContractError> {
        curator.require_auth();
        if !storage::get_curators(&env).iter().any(|c| c == curator) {
            return Err(ContractError::CallerIsNotCurator);
        }
        let n = ids.len();
        if n > Self::MAX_BATCH_SIZE {
            return Err(ContractError::BatchTooLarge);
        }
        if !(owners.len() == n
            && names.len() == n
            && categories.len() == n
            && location_hashes.len() == n
            && contact_hashes.len() == n)
        {
            return Err(ContractError::MismatchedInputLengths);
        }
        let mut results: Vec<BatchRegisterResult> = Vec::new(&env);
        let mut list = storage::get_worker_list(&env);
        for i in 0..n {
            let id = ids.get(i).unwrap();
            let key = DataKey::Worker(id.clone());
            if env.storage().persistent().has(&key) {
                results.push_back(BatchRegisterResult { id, success: false });
                continue;
            }
            let owner = owners.get(i).unwrap();
            let worker = Worker {
                id: id.clone(),
                owner: owner.clone(),
                name: names.get(i).unwrap(),
                category: categories.get(i).unwrap(),
                is_active: true,
                wallet: owner.clone(),
                location_hash: location_hashes.get(i).unwrap(),
                contact_hash: contact_hashes.get(i).unwrap(),
                reputation: 0,
                verified_categories: Vec::new(&env),
                staked_amount: 0,
                review_count: 0,
                avg_rating: 0,
                subscription: WorkerSubscription {
                    tier: SubscriptionTier::Free,
                    expires_at: 0,
                    last_renewed_at: env.ledger().timestamp(),
                },
            };
            storage::set_worker(&env, &worker);
            list.push_back(id.clone());
            env.events().publish(
                (symbol_short!("WrkReg"), id.clone()),
                (owner, categories.get(i).unwrap()),
            );
            results.push_back(BatchRegisterResult { id, success: true });
        }
        storage::set_worker_list(&env, &list);
        Ok(results)
    }

    // -------------------------------------------------------------------------
    // Worker staking
    // -------------------------------------------------------------------------

    /// Cooldown period in seconds before an unstake request can be finalised (~7 days).
    pub const UNSTAKE_COOLDOWN_SECS: u64 = 604_800;
    /// Reward rate: 1 basis point per 1000 seconds of staking.
    pub const REWARD_RATE_BPS_PER_1000_SECS: i128 = 1;

    /// Stake tokens for a worker to boost visibility.
    pub fn stake(
        env: Env,
        caller: Address,
        worker_id: Symbol,
        token_addr: Address,
        amount: i128,
    ) -> Result<(), ContractError> {
        caller.require_auth();
        if amount <= 0 {
            return Err(ContractError::AmountMustBePositive);
        }
        let mut worker: Worker = env
            .storage()
            .persistent()
            .get(&DataKey::Worker(worker_id.clone()))
            .ok_or(ContractError::WorkerNotFound)?;
        if worker.owner != caller {
            return Err(ContractError::NotAuthorized);
        }
        let client = token::Client::new(&env, &token_addr);
        client.transfer(&caller, &env.current_contract_address(), &amount);
        let now = env.ledger().timestamp();
        let mut info: StakeInfo = env
            .storage()
            .persistent()
            .get(&DataKey::StakeInfo(worker_id.clone()))
            .unwrap_or(StakeInfo {
                token: token_addr.clone(),
                amount: 0,
                unstake_requested_at: 0,
                rewards_accumulated: 0,
                last_reward_ledger: now,
            });
        let elapsed = now.saturating_sub(info.last_reward_ledger);
        let new_rewards = info
            .amount
            .checked_mul(Self::REWARD_RATE_BPS_PER_1000_SECS)
            .and_then(|v| v.checked_mul(elapsed as i128))
            .and_then(|v| v.checked_div(10_000_000))
            .expect("Reward overflow");
        info.rewards_accumulated = info
            .rewards_accumulated
            .checked_add(new_rewards)
            .expect("Reward overflow");
        info.last_reward_ledger = now;
        info.amount = info.amount.checked_add(amount).expect("Stake overflow");
        info.unstake_requested_at = 0;
        env.storage()
            .persistent()
            .set(&DataKey::StakeInfo(worker_id.clone()), &info);
        worker.staked_amount = info.amount;
        storage::set_worker(&env, &worker);
        env.events().publish(
            (symbol_short!("Staked"), worker_id, caller),
            (amount, info.amount),
        );
        Ok(())
    }

    /// Request an unstake. Starts the cooldown timer.
    pub fn request_unstake(
        env: Env,
        caller: Address,
        worker_id: Symbol,
    ) -> Result<(), ContractError> {
        caller.require_auth();
        let worker: Worker = env
            .storage()
            .persistent()
            .get(&DataKey::Worker(worker_id.clone()))
            .ok_or(ContractError::WorkerNotFound)?;
        if worker.owner != caller {
            return Err(ContractError::NotAuthorized);
        }
        let mut info: StakeInfo = env
            .storage()
            .persistent()
            .get(&DataKey::StakeInfo(worker_id.clone()))
            .ok_or(ContractError::NoActiveStake)?;
        if info.amount <= 0 {
            return Err(ContractError::NoActiveStake);
        }
        if info.unstake_requested_at != 0 {
            return Err(ContractError::UnstakeAlreadyRequested);
        }
        let now = env.ledger().timestamp();
        info.unstake_requested_at = now;
        env.storage()
            .persistent()
            .set(&DataKey::StakeInfo(worker_id.clone()), &info);
        env.events()
            .publish((symbol_short!("UnstakeRq"), worker_id, caller), now);
        Ok(())
    }

    /// Finalise unstake after cooldown. Returns staked tokens + rewards to caller.
    pub fn unstake(env: Env, caller: Address, worker_id: Symbol) -> Result<(), ContractError> {
        caller.require_auth();
        let mut worker: Worker = env
            .storage()
            .persistent()
            .get(&DataKey::Worker(worker_id.clone()))
            .ok_or(ContractError::WorkerNotFound)?;
        if worker.owner != caller {
            return Err(ContractError::NotAuthorized);
        }
        let mut info: StakeInfo = env
            .storage()
            .persistent()
            .get(&DataKey::StakeInfo(worker_id.clone()))
            .ok_or(ContractError::NoActiveStake)?;
        if info.amount <= 0 {
            return Err(ContractError::NoActiveStake);
        }
        if info.unstake_requested_at == 0 {
            return Err(ContractError::UnstakeNotRequested);
        }
        let now = env.ledger().timestamp();
        if now < info.unstake_requested_at + Self::UNSTAKE_COOLDOWN_SECS {
            return Err(ContractError::CooldownNotElapsed);
        }
        let elapsed = now.saturating_sub(info.last_reward_ledger);
        let final_rewards = info
            .amount
            .checked_mul(Self::REWARD_RATE_BPS_PER_1000_SECS)
            .and_then(|v| v.checked_mul(elapsed as i128))
            .and_then(|v| v.checked_div(10_000_000))
            .expect("Reward overflow");
        info.rewards_accumulated = info
            .rewards_accumulated
            .checked_add(final_rewards)
            .expect("Reward overflow");
        let total_return = info
            .amount
            .checked_add(info.rewards_accumulated)
            .expect("Return overflow");
        let client = token::Client::new(&env, &info.token);
        client.transfer(&env.current_contract_address(), &caller, &total_return);
        let staked = info.amount;
        let rewards = info.rewards_accumulated;
        info.amount = 0;
        info.rewards_accumulated = 0;
        info.unstake_requested_at = 0;
        env.storage()
            .persistent()
            .set(&DataKey::StakeInfo(worker_id.clone()), &info);
        worker.staked_amount = 0;
        storage::set_worker(&env, &worker);
        env.events().publish(
            (symbol_short!("Unstaked"), worker_id, caller),
            (staked, rewards),
        );
        Ok(())
    }

    /// Get staking info for a worker.
    pub fn get_stake_info(
        env: Env,
        worker_id: Symbol,
    ) -> Result<Option<StakeInfo>, ContractError> {
        Ok(env
            .storage()
            .persistent()
            .get(&DataKey::StakeInfo(worker_id)))
    }

    // -------------------------------------------------------------------------
    // Performance Metrics
    // -------------------------------------------------------------------------

    /// Update performance metrics for a worker.
    pub fn update_metrics(
        env: Env,
        admin: Address,
        worker_id: Symbol,
        jobs_completed: u32,
        rating: u32,
    ) -> Result<(), ContractError> {
        logic::require_role(&env, &Symbol::new(&env, ROLE_REP_MGR), &admin)?;
        if rating > 10_000 {
            return Err(ContractError::RatingOutOfRange);
        }
        let mut metrics: PerformanceMetrics = env
            .storage()
            .persistent()
            .get(&DataKey::PerformanceMetrics(worker_id.clone()))
            .unwrap_or(PerformanceMetrics {
                jobs_completed: 0,
                avg_rating: 0,
                total_ratings: 0,
                last_updated: 0,
                performance_score: 0,
            });
        metrics.jobs_completed = jobs_completed;
        if rating > 0 {
            let total = (metrics.avg_rating as u64)
                .checked_mul(metrics.total_ratings as u64)
                .and_then(|v| v.checked_add(rating as u64))
                .expect("Rating overflow");
            metrics.total_ratings = metrics.total_ratings.checked_add(1).expect("overflow");
            metrics.avg_rating = (total / metrics.total_ratings as u64) as u32;
        }
        metrics.last_updated = env.ledger().timestamp();
        metrics.performance_score = logic::calculate_performance_score(&metrics);
        env.storage()
            .persistent()
            .set(&DataKey::PerformanceMetrics(worker_id.clone()), &metrics);
        env.events().publish(
            (symbol_short!("MetUpd"), worker_id),
            (
                jobs_completed,
                metrics.avg_rating,
                metrics.performance_score,
            ),
        );
        Ok(())
    }

    /// Get performance metrics for a worker.
    pub fn get_metrics(
        env: Env,
        worker_id: Symbol,
    ) -> Result<Option<PerformanceMetrics>, ContractError> {
        Ok(env
            .storage()
            .persistent()
            .get(&DataKey::PerformanceMetrics(worker_id)))
    }

    // -------------------------------------------------------------------------
    // Badge System
    // -------------------------------------------------------------------------

    /// Award a badge to a worker (admin or curator).
    pub fn award_badge(
        env: Env,
        issuer: Address,
        worker_id: Symbol,
        badge_id: Symbol,
        name: String,
        expires_at: u64,
    ) -> Result<(), ContractError> {
        issuer.require_auth();
        let is_admin =
            Self::has_role(env.clone(), Symbol::new(&env, ROLE_ADMIN), issuer.clone())?;
        let is_curator = Self::is_curator(env.clone(), issuer.clone())?;
        if !(is_admin || is_curator) {
            return Err(ContractError::NotAuthorized);
        }
        let _worker: Worker = env
            .storage()
            .persistent()
            .get(&DataKey::Worker(worker_id.clone()))
            .ok_or(ContractError::WorkerNotFound)?;
        let badge = Badge {
            id: badge_id.clone(),
            name: name.clone(),
            issuer: issuer.clone(),
            awarded_at: env.ledger().timestamp(),
            expires_at,
            active: true,
        };
        env.storage().persistent().set(
            &DataKey::Badge(worker_id.clone(), badge_id.clone()),
            &badge,
        );
        let mut badges: Vec<Symbol> = env
            .storage()
            .persistent()
            .get(&DataKey::WorkerBadges(worker_id.clone()))
            .unwrap_or(Vec::new(&env));
        if badges.iter().all(|b| b != badge_id) {
            badges.push_back(badge_id.clone());
            env.storage()
                .persistent()
                .set(&DataKey::WorkerBadges(worker_id.clone()), &badges);
        }
        env.events().publish(
            (symbol_short!("BdgAwd"), worker_id, badge_id),
            (issuer, name),
        );
        Ok(())
    }

    /// Revoke a badge from a worker (admin or original issuer).
    pub fn revoke_badge(
        env: Env,
        caller: Address,
        worker_id: Symbol,
        badge_id: Symbol,
    ) -> Result<(), ContractError> {
        caller.require_auth();
        let mut badge: Badge = env
            .storage()
            .persistent()
            .get(&DataKey::Badge(worker_id.clone(), badge_id.clone()))
            .ok_or(ContractError::BadgeNotFound)?;
        let is_admin =
            Self::has_role(env.clone(), Symbol::new(&env, ROLE_ADMIN), caller.clone())?;
        if !(is_admin || badge.issuer == caller) {
            return Err(ContractError::NotAuthorized);
        }
        badge.active = false;
        env.storage().persistent().set(
            &DataKey::Badge(worker_id.clone(), badge_id.clone()),
            &badge,
        );
        env.events()
            .publish((symbol_short!("BdgRvk"), worker_id, badge_id), caller);
        Ok(())
    }

    /// Verify if a worker has a specific active badge.
    pub fn verify_badge(
        env: Env,
        worker_id: Symbol,
        badge_id: Symbol,
    ) -> Result<bool, ContractError> {
        if let Some(badge) = env
            .storage()
            .persistent()
            .get::<DataKey, Badge>(&DataKey::Badge(worker_id, badge_id))
        {
            let now = env.ledger().timestamp();
            Ok(badge.active && (badge.expires_at == 0 || badge.expires_at > now))
        } else {
            Ok(false)
        }
    }

    /// Get all badges for a worker.
    pub fn get_worker_badges(
        env: Env,
        worker_id: Symbol,
    ) -> Result<Vec<Badge>, ContractError> {
        let badge_ids: Vec<Symbol> = env
            .storage()
            .persistent()
            .get(&DataKey::WorkerBadges(worker_id.clone()))
            .unwrap_or(Vec::new(&env));
        let mut badges: Vec<Badge> = Vec::new(&env);
        for badge_id in badge_ids.iter() {
            if let Some(badge) = env
                .storage()
                .persistent()
                .get(&DataKey::Badge(worker_id.clone(), badge_id))
            {
                badges.push_back(badge);
            }
        }
        Ok(badges)
    }

    /// Get a specific badge.
    pub fn get_badge(
        env: Env,
        worker_id: Symbol,
        badge_id: Symbol,
    ) -> Result<Option<Badge>, ContractError> {
        Ok(env
            .storage()
            .persistent()
            .get(&DataKey::Badge(worker_id, badge_id)))
    }

    // -------------------------------------------------------------------------
    // Schema migration
    // -------------------------------------------------------------------------

    /// Return the current storage schema version.
    pub fn get_schema_version(env: Env) -> Result<u32, ContractError> {
        Ok(storage::get_schema_version(&env))
    }

    /// Run version-specific storage migration logic.
    pub fn migrate(
        env: Env,
        admin: Address,
        expected_version: u32,
    ) -> Result<(), ContractError> {
        logic::require_role(&env, &Symbol::new(&env, ROLE_ADMIN), &admin)?;
        let current = storage::get_schema_version(&env);
        if current != expected_version {
            return Err(ContractError::WrongSchemaVersion);
        }
        if expected_version == 1 {
            // placeholder for v1â†’v2 migration logic
        }
        let new_version = expected_version.checked_add(1).expect("Version overflow");
        storage::set_schema_version(&env, new_version);
        env.events().publish(
            (symbol_short!("Migrated"),),
            (expected_version, new_version),
        );
        Ok(())
    }

    // -------------------------------------------------------------------------
    // Upgrade
    // -------------------------------------------------------------------------

    /// Upgrade the contract WASM in-place, preserving the contract ID and all storage.
    pub fn upgrade(
        env: Env,
        new_wasm_hash: soroban_sdk::BytesN<32>,
    ) -> Result<(), ContractError> {
        let upgrader_role = logic::role_symbol(&env, ROLE_UPGRADER_CACHED);
        let admin: Address = env
            .storage()
            .persistent()
            .get(&DataKey::Admin)
            .ok_or(ContractError::NotInitialized)?;
        logic::require_role(&env, &upgrader_role, &admin)?;
        env.deployer().update_current_contract_wasm(new_wasm_hash);
        Ok(())
    }

    // -------------------------------------------------------------------------
    // Pagination
    // -------------------------------------------------------------------------

    /// Return a paginated result of worker ids.
    pub fn list_workers_page(
        env: Env,
        offset: u32,
        limit: u32,
    ) -> Result<WorkerPage, ContractError> {
        let total = storage::get_worker_count(&env);
        let list = storage::get_worker_list(&env);
        let mut ids: Vec<Symbol> = Vec::new(&env);
        if offset < total && limit > 0 {
            let end = (offset + limit).min(total);
            for i in offset..end {
                ids.push_back(list.get(i).unwrap());
            }
        }
        Ok(WorkerPage { ids, total })
    }

    // -------------------------------------------------------------------------
    // On-chain category validation
    // -------------------------------------------------------------------------

    /// Add a valid category to on-chain storage. Admin only.
    pub fn add_category(
        env: Env,
        admin: Address,
        name: Symbol,
    ) -> Result<(), ContractError> {
        let admin_role = logic::role_symbol(&env, ROLE_ADMIN_CACHED);
        logic::require_role(&env, &admin_role, &admin)?;
        logic::require_not_paused(&env)?;
        let mut cats: Vec<Symbol> = env
            .storage()
            .persistent()
            .get(&DataKey::Categories)
            .unwrap_or(Vec::new(&env));
        if cats.iter().all(|c| c != name) {
            cats.push_back(name.clone());
            env.storage().persistent().set(&DataKey::Categories, &cats);
        }
        env.events().publish((symbol_short!("CatAdded"), name), ());
        Ok(())
    }

    /// Remove a category from on-chain storage. Admin only.
    pub fn remove_category(
        env: Env,
        admin: Address,
        name: Symbol,
    ) -> Result<(), ContractError> {
        let admin_role = logic::role_symbol(&env, ROLE_ADMIN_CACHED);
        logic::require_role(&env, &admin_role, &admin)?;
        logic::require_not_paused(&env)?;
        let cats: Vec<Symbol> = env
            .storage()
            .persistent()
            .get(&DataKey::Categories)
            .unwrap_or(Vec::new(&env));
        let mut updated: Vec<Symbol> = Vec::new(&env);
        for c in cats.iter() {
            if c != name {
                updated.push_back(c);
            }
        }
        env.storage().persistent().set(&DataKey::Categories, &updated);
        env.events()
            .publish((Symbol::new(&env, "CatRemoved"), name), ());
        Ok(())
    }

    /// Return all valid on-chain categories.
    pub fn list_categories(env: Env) -> Result<Vec<Symbol>, ContractError> {
        Ok(env
            .storage()
            .persistent()
            .get(&DataKey::Categories)
            .unwrap_or(Vec::new(&env)))
    }

    // -------------------------------------------------------------------------
    // Upgrade timelock
    // -------------------------------------------------------------------------

    /// Approximate ledger count for 48 hours (~5 s/ledger).
    pub const TIMELOCK_LEDGERS: u32 = 34_560;

    /// Propose a contract upgrade with a 48-hour timelock. Admin only.
    pub fn propose_upgrade(
        env: Env,
        admin: Address,
        new_wasm_hash: BytesN<32>,
    ) -> Result<(), ContractError> {
        let upgrader_role = logic::role_symbol(&env, ROLE_UPGRADER_CACHED);
        logic::require_role(&env, &upgrader_role, &admin)?;
        logic::require_not_paused(&env)?;
        if env.storage().persistent().has(&DataKey::PendingUpgrade) {
            return Err(ContractError::UpgradeAlreadyPending);
        }
        let execute_after_ledger = env
            .ledger()
            .sequence()
            .checked_add(Self::TIMELOCK_LEDGERS)
            .expect("Ledger overflow");
        let pending = PendingUpgrade {
            wasm_hash: new_wasm_hash,
            execute_after_ledger,
        };
        env.storage()
            .persistent()
            .set(&DataKey::PendingUpgrade, &pending);
        env.events()
            .publish((symbol_short!("UpgPropsd"), execute_after_ledger), ());
        Ok(())
    }

    /// Execute a pending upgrade after the timelock has expired. Callable by anyone.
    pub fn execute_upgrade(env: Env) -> Result<(), ContractError> {
        let pending: PendingUpgrade = env
            .storage()
            .persistent()
            .get(&DataKey::PendingUpgrade)
            .ok_or(ContractError::NoPendingUpgrade)?;
        if env.ledger().sequence() < pending.execute_after_ledger {
            return Err(ContractError::TimelockNotExpired);
        }
        env.storage().persistent().remove(&DataKey::PendingUpgrade);
        env.events().publish((symbol_short!("UpgExecd"),), ());
        env.deployer()
            .update_current_contract_wasm(pending.wasm_hash);
        Ok(())
    }

    /// Cancel a pending upgrade. Admin only.
    pub fn cancel_upgrade(env: Env, admin: Address) -> Result<(), ContractError> {
        let upgrader_role = logic::role_symbol(&env, ROLE_UPGRADER_CACHED);
        logic::require_role(&env, &upgrader_role, &admin)?;
        if !env.storage().persistent().has(&DataKey::PendingUpgrade) {
            return Err(ContractError::NoPendingUpgrade);
        }
        env.storage().persistent().remove(&DataKey::PendingUpgrade);
        env.events().publish((symbol_short!("UpgCancld"),), ());
        Ok(())
    }

    /// Get the pending upgrade, if any.
    pub fn get_pending_upgrade(
        env: Env,
    ) -> Result<Option<PendingUpgrade>, ContractError> {
        Ok(env.storage().persistent().get(&DataKey::PendingUpgrade))
    }

    // -------------------------------------------------------------------------
    // Verification levels & certified skills
    // -------------------------------------------------------------------------

    /// Set the verification level for a worker. Curator-manager only.
    pub fn set_verification_level(
        env: Env,
        caller: Address,
        worker_id: Symbol,
        level: VerificationLevel,
    ) -> Result<(), ContractError> {
        let curator_mgr = logic::role_symbol(&env, ROLE_CURATOR_MGR_CACHED);
        logic::require_role(&env, &curator_mgr, &caller)?;
        logic::require_not_paused(&env)?;
        if !env
            .storage()
            .persistent()
            .has(&DataKey::Worker(worker_id.clone()))
        {
            return Err(ContractError::WorkerNotFound);
        }
        env.storage()
            .persistent()
            .set(&DataKey::VerificationLevel(worker_id.clone()), &level);
        env.events().publish(
            (symbol_short!("VrfLvlSet"), worker_id),
            (caller, level as u32),
        );
        Ok(())
    }

    /// Get the verification level for a worker.
    pub fn get_verification_level(
        env: Env,
        worker_id: Symbol,
    ) -> Result<VerificationLevel, ContractError> {
        Ok(env
            .storage()
            .persistent()
            .get(&DataKey::VerificationLevel(worker_id))
            .unwrap_or(VerificationLevel::None))
    }

    /// Add or update a certified skill for a worker. Curator-manager only.
    pub fn add_certified_skill(
        env: Env,
        caller: Address,
        worker_id: Symbol,
        skill: Symbol,
        expires_at: u64,
    ) -> Result<(), ContractError> {
        let curator_mgr = logic::role_symbol(&env, ROLE_CURATOR_MGR_CACHED);
        logic::require_role(&env, &curator_mgr, &caller)?;
        logic::require_not_paused(&env)?;
        if !env
            .storage()
            .persistent()
            .has(&DataKey::Worker(worker_id.clone()))
        {
            return Err(ContractError::WorkerNotFound);
        }
        let now = env.ledger().timestamp();
        let entry = CertifiedSkill {
            skill: skill.clone(),
            certified_by: caller.clone(),
            certified_at: now,
            expires_at,
        };
        let mut skills: Vec<CertifiedSkill> = env
            .storage()
            .persistent()
            .get(&DataKey::CertifiedSkills(worker_id.clone()))
            .unwrap_or(Vec::new(&env));
        let mut found = false;
        let mut updated: Vec<CertifiedSkill> = Vec::new(&env);
        for s in skills.iter() {
            if s.skill == skill {
                updated.push_back(entry.clone());
                found = true;
            } else {
                updated.push_back(s);
            }
        }
        if !found {
            updated.push_back(entry);
        }
        env.storage()
            .persistent()
            .set(&DataKey::CertifiedSkills(worker_id.clone()), &updated);
        env.events().publish(
            (symbol_short!("SkillCert"), worker_id, skill),
            (caller, expires_at),
        );
        Ok(())
    }

    /// Revoke a certified skill from a worker. Curator-manager only.
    pub fn revoke_certified_skill(
        env: Env,
        caller: Address,
        worker_id: Symbol,
        skill: Symbol,
    ) -> Result<(), ContractError> {
        let curator_mgr = logic::role_symbol(&env, ROLE_CURATOR_MGR_CACHED);
        logic::require_role(&env, &curator_mgr, &caller)?;
        logic::require_not_paused(&env)?;
        let skills: Vec<CertifiedSkill> = env
            .storage()
            .persistent()
            .get(&DataKey::CertifiedSkills(worker_id.clone()))
            .unwrap_or(Vec::new(&env));
        let mut updated: Vec<CertifiedSkill> = Vec::new(&env);
        let mut removed = false;
        for s in skills.iter() {
            if s.skill == skill {
                removed = true;
            } else {
                updated.push_back(s);
            }
        }
        if !removed {
            return Err(ContractError::SkillNotFound);
        }
        env.storage()
            .persistent()
            .set(&DataKey::CertifiedSkills(worker_id.clone()), &updated);
        env.events()
            .publish((symbol_short!("SkillRvkd"), worker_id, skill), caller);
        Ok(())
    }

    /// Get all certified skills for a worker.
    pub fn get_certified_skills(
        env: Env,
        worker_id: Symbol,
    ) -> Result<Vec<CertifiedSkill>, ContractError> {
        Ok(env
            .storage()
            .persistent()
            .get(&DataKey::CertifiedSkills(worker_id))
            .unwrap_or(Vec::new(&env)))
    }
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod test;
#[cfg(test)]
mod tests {
    extern crate std;
    use super::*;
    use soroban_sdk::{
        testutils::{Address as _, Ledger, LedgerInfo},
        Address, BytesN, Env, String, Symbol,
    };

    struct TestEnv {
        env: Env,
        contract_id: Address,
        admin: Address,
        curator: Address,
        owner: Address,
    }

    impl TestEnv {
        fn new() -> Self {
            let env = Env::default();
            env.mock_all_auths();
            let admin = Address::generate(&env);
            let curator = Address::generate(&env);
            let owner = Address::generate(&env);
            let contract_id = env.register_contract(None, RegistryContract);
            let client = RegistryContractClient::new(&env, &contract_id);
            client.initialize(&admin);
            client.grant_role(&admin, &Symbol::new(&env, ROLE_PAUSER), &admin);
            client.grant_role(&admin, &Symbol::new(&env, ROLE_CURATOR_MGR), &admin);
            client.grant_role(&admin, &Symbol::new(&env, ROLE_REP_MGR), &admin);
            client.grant_role(&admin, &Symbol::new(&env, ROLE_UPGRADER), &admin);
            TestEnv { env, contract_id, admin, curator, owner }
        }

        fn client(&self) -> RegistryContractClient {
            RegistryContractClient::new(&self.env, &self.contract_id)
        }

        fn worker_id(&self) -> Symbol { Symbol::new(&self.env, "worker1") }

        fn zero_hash(&self) -> BytesN<32> { BytesN::from_array(&self.env, &[0u8; 32]) }

        fn register_worker(&self, curator: &Address) {
            self.client().register(
                &self.worker_id(),
                &self.owner,
                &String::from_str(&self.env, "Alice"),
                &Symbol::new(&self.env, "plumber"),
                &self.zero_hash(),
                &self.zero_hash(),
                curator,
            );
        }
    }

    #[test]
    fn test_initialize_sets_admin() {
        let t = TestEnv::new();
        assert_eq!(t.client().get_admin(), t.admin);
    }

    #[test]
    fn test_initialize_twice_panics() {
        let t = TestEnv::new();
        assert_eq!(
            t.client().try_initialize(&t.admin),
            Err(Ok(ContractError::AlreadyInitialized))
        );
    }

    #[test]
    fn test_add_curator() {
        let t = TestEnv::new();
        t.client().add_curator(&t.admin, &t.curator);
        assert!(t.client().is_curator(&t.curator));
    }

    #[test]
    fn test_add_curator_idempotent() {
        let t = TestEnv::new();
        t.client().add_curator(&t.admin, &t.curator);
        t.client().add_curator(&t.admin, &t.curator);
        t.client().remove_curator(&t.admin, &t.curator);
        assert!(!t.client().is_curator(&t.curator));
    }

    #[test]
    fn test_add_curator_non_admin_panics() {
        let t = TestEnv::new();
        let stranger = Address::generate(&t.env);
        assert_eq!(
            t.client().try_add_curator(&stranger, &t.curator),
            Err(Ok(ContractError::MissingRole))
        );
    }

    #[test]
    fn test_remove_curator() {
        let t = TestEnv::new();
        t.client().add_curator(&t.admin, &t.curator);
        t.client().remove_curator(&t.admin, &t.curator);
        assert!(!t.client().is_curator(&t.curator));
    }

    #[test]
    fn test_register_by_curator_succeeds() {
        let t = TestEnv::new();
        t.client().add_curator(&t.admin, &t.curator);
        t.register_worker(&t.curator);
        let worker = t.client().get_worker(&t.worker_id()).unwrap();
        assert_eq!(worker.owner, t.owner);
        assert!(worker.is_active);
    }

    #[test]
    fn test_register_stores_hashes() {
        let t = TestEnv::new();
        t.client().add_curator(&t.admin, &t.curator);
        let loc = BytesN::from_array(&t.env, &[1u8; 32]);
        let con = BytesN::from_array(&t.env, &[2u8; 32]);
        t.client().register(
            &t.worker_id(),
            &t.owner,
            &String::from_str(&t.env, "Alice"),
            &Symbol::new(&t.env, "plumber"),
            &loc,
            &con,
            &t.curator,
        );
        let worker = t.client().get_worker(&t.worker_id()).unwrap();
        assert_eq!(worker.location_hash, loc);
        assert_eq!(worker.contact_hash, con);
    }

    #[test]
    fn test_update_stores_new_hashes() {
        let t = TestEnv::new();
        t.client().add_curator(&t.admin, &t.curator);
        t.register_worker(&t.curator);
        let new_loc = BytesN::from_array(&t.env, &[3u8; 32]);
        let new_con = BytesN::from_array(&t.env, &[4u8; 32]);
        t.client().update(
            &t.worker_id(),
            &t.owner,
            &String::from_str(&t.env, "Alice B"),
            &Symbol::new(&t.env, "electrician"),
            &new_loc,
            &new_con,
        );
        let worker = t.client().get_worker(&t.worker_id()).unwrap();
        assert_eq!(worker.location_hash, new_loc);
        assert_eq!(worker.contact_hash, new_con);
    }

    #[test]
    fn test_register_by_non_curator_panics() {
        let t = TestEnv::new();
        let res = t.client().try_register(
            &t.worker_id(),
            &t.owner,
            &String::from_str(&t.env, "Alice"),
            &Symbol::new(&t.env, "plumber"),
            &t.zero_hash(),
            &t.zero_hash(),
            &t.curator,
        );
        assert_eq!(res, Err(Ok(ContractError::CallerIsNotCurator)));
    }

    #[test]
    fn test_toggle_by_owner() {
        let t = TestEnv::new();
        t.client().add_curator(&t.admin, &t.curator);
        t.register_worker(&t.curator);
        t.client().toggle(&t.worker_id(), &t.owner);
        assert!(!t.client().get_worker(&t.worker_id()).unwrap().is_active);
        t.client().toggle(&t.worker_id(), &t.owner);
        assert!(t.client().get_worker(&t.worker_id()).unwrap().is_active);
    }

    #[test]
    fn test_deregister_by_owner() {
        let t = TestEnv::new();
        t.client().add_curator(&t.admin, &t.curator);
        t.register_worker(&t.curator);
        t.client().deregister(&t.worker_id(), &t.owner);
        assert!(t.client().get_worker(&t.worker_id()).is_none());
        assert_eq!(t.client().list_workers().len(), 0);
    }

    #[test]
    fn test_worker_count() {
        let t = TestEnv::new();
        t.client().add_curator(&t.admin, &t.curator);
        assert_eq!(t.client().worker_count(), 0);
        t.register_worker(&t.curator);
        assert_eq!(t.client().worker_count(), 1);
    }

    #[test]
    fn test_reputation_defaults_to_zero() {
        let t = TestEnv::new();
        t.client().add_curator(&t.admin, &t.curator);
        t.register_worker(&t.curator);
        let worker = t.client().get_worker(&t.worker_id()).unwrap();
        assert_eq!(worker.reputation, 0);
    }

    #[test]
    fn test_update_reputation() {
        let t = TestEnv::new();
        t.client().add_curator(&t.admin, &t.curator);
        t.register_worker(&t.curator);
        t.client().update_reputation(&t.admin, &t.worker_id(), &8500);
        let worker = t.client().get_worker(&t.worker_id()).unwrap();
        assert_eq!(worker.reputation, 8500);
    }

    #[test]
    fn test_update_reputation_out_of_range() {
        let t = TestEnv::new();
        t.client().add_curator(&t.admin, &t.curator);
        t.register_worker(&t.curator);
        assert_eq!(
            t.client().try_update_reputation(&t.admin, &t.worker_id(), &10_001),
            Err(Ok(ContractError::ScoreOutOfRange))
        );
    }

    #[test]
    fn test_update_reputation_non_admin_panics() {
        let t = TestEnv::new();
        t.client().add_curator(&t.admin, &t.curator);
        t.register_worker(&t.curator);
        let stranger = Address::generate(&t.env);
        assert_eq!(
            t.client().try_update_reputation(&stranger, &t.worker_id(), &5000),
            Err(Ok(ContractError::MissingRole))
        );
    }

    #[test]
    fn test_list_workers_paginated() {
        let t = TestEnv::new();
        t.client().add_curator(&t.admin, &t.curator);
        for i in 0..5u8 {
            let id = Symbol::new(&t.env, &std::format!("w{i}"));
            t.client().register(
                &id,
                &t.owner,
                &String::from_str(&t.env, "Worker"),
                &Symbol::new(&t.env, "plumber"),
                &t.zero_hash(),
                &t.zero_hash(),
                &t.curator,
            );
        }
        let page = t.client().list_workers_paginated(&0, &3);
        assert_eq!(page.len(), 3);
        let page2 = t.client().list_workers_paginated(&3, &3);
        assert_eq!(page2.len(), 2);
    }

    // Category verification tests
    #[test]
    fn test_verify_category_stores_record() {
        let t = TestEnv::new();
        t.client().add_curator(&t.admin, &t.curator);
        t.register_worker(&t.curator);
        let cat = Symbol::new(&t.env, "plumber");
        t.client().verify_category(&t.curator, &t.worker_id(), &cat, &9999);
        let v = t.client().get_category_verification(&t.worker_id(), &cat).unwrap();
        assert_eq!(v.curator, t.curator);
        assert_eq!(v.expires_at, 9999);
        let worker = t.client().get_worker(&t.worker_id()).unwrap();
        assert_eq!(worker.verified_categories.len(), 1);
    }

    #[test]
    fn test_verify_category_idempotent() {
        let t = TestEnv::new();
        t.client().add_curator(&t.admin, &t.curator);
        t.register_worker(&t.curator);
        let cat = Symbol::new(&t.env, "plumber");
        t.client().verify_category(&t.curator, &t.worker_id(), &cat, &9999);
        t.client().verify_category(&t.curator, &t.worker_id(), &cat, &9999);
        let worker = t.client().get_worker(&t.worker_id()).unwrap();
        assert_eq!(worker.verified_categories.len(), 1);
    }

    #[test]
    fn test_verify_category_non_curator_panics() {
        let t = TestEnv::new();
        t.client().add_curator(&t.admin, &t.curator);
        t.register_worker(&t.curator);
        let stranger = Address::generate(&t.env);
        assert_eq!(
            t.client().try_verify_category(
                &stranger,
                &t.worker_id(),
                &Symbol::new(&t.env, "plumber"),
                &9999
            ),
            Err(Ok(ContractError::CallerIsNotCurator))
        );
    }

    // Batch registration tests
    #[test]
    fn test_batch_register_all_succeed() {
        let t = TestEnv::new();
        t.client().add_curator(&t.admin, &t.curator);
        let ids = soroban_sdk::vec![&t.env, Symbol::new(&t.env, "b1"), Symbol::new(&t.env, "b2")];
        let owners = soroban_sdk::vec![&t.env, t.owner.clone(), t.owner.clone()];
        let names = soroban_sdk::vec![
            &t.env,
            String::from_str(&t.env, "Alice"),
            String::from_str(&t.env, "Bob"),
        ];
        let cats = soroban_sdk::vec![
            &t.env,
            Symbol::new(&t.env, "plumber"),
            Symbol::new(&t.env, "welder"),
        ];
        let hashes = soroban_sdk::vec![&t.env, t.zero_hash(), t.zero_hash()];
        let results =
            t.client().batch_register(&t.curator, &ids, &owners, &names, &cats, &hashes, &hashes);
        assert_eq!(results.len(), 2);
        assert!(results.get(0).unwrap().success);
        assert!(results.get(1).unwrap().success);
        assert_eq!(t.client().worker_count(), 2);
    }

    #[test]
    fn test_batch_register_partial_success_on_duplicate() {
        let t = TestEnv::new();
        t.client().add_curator(&t.admin, &t.curator);
        t.register_worker(&t.curator);
        let ids = soroban_sdk::vec![&t.env, t.worker_id(), Symbol::new(&t.env, "b2")];
        let owners = soroban_sdk::vec![&t.env, t.owner.clone(), t.owner.clone()];
        let names = soroban_sdk::vec![
            &t.env,
            String::from_str(&t.env, "Alice"),
            String::from_str(&t.env, "Bob"),
        ];
        let cats = soroban_sdk::vec![
            &t.env,
            Symbol::new(&t.env, "plumber"),
            Symbol::new(&t.env, "welder"),
        ];
        let hashes = soroban_sdk::vec![&t.env, t.zero_hash(), t.zero_hash()];
        let results =
            t.client().batch_register(&t.curator, &ids, &owners, &names, &cats, &hashes, &hashes);
        assert!(!results.get(0).unwrap().success);
        assert!(results.get(1).unwrap().success);
        assert_eq!(t.client().worker_count(), 2);
    }

    #[test]
    fn test_batch_register_too_large_panics() {
        let t = TestEnv::new();
        t.client().add_curator(&t.admin, &t.curator);
        let mut ids = Vec::new(&t.env);
        let mut owners = Vec::new(&t.env);
        let mut names = Vec::new(&t.env);
        let mut cats = Vec::new(&t.env);
        let mut hashes = Vec::new(&t.env);
        for i in 0..21u32 {
            let id_str = std::format!("w{i}");
            ids.push_back(Symbol::new(&t.env, &id_str));
            owners.push_back(t.owner.clone());
            names.push_back(String::from_str(&t.env, "W"));
            cats.push_back(Symbol::new(&t.env, "plumber"));
            hashes.push_back(t.zero_hash());
        }
        assert_eq!(
            t.client().try_batch_register(&t.curator, &ids, &owners, &names, &cats, &hashes, &hashes),
            Err(Ok(ContractError::BatchTooLarge))
        );
    }

    // Staking tests
    struct StakeTestEnv {
        base: TestEnv,
        token_addr: Address,
    }

    impl StakeTestEnv {
        fn new() -> Self {
            use soroban_sdk::token::StellarAssetClient;
            let base = TestEnv::new();
            let admin = base.admin.clone();
            let token_id = base.env.register_stellar_asset_contract_v2(admin.clone());
            let token_addr = token_id.address();
            StellarAssetClient::new(&base.env, &token_addr).mint(&base.owner, &1_000_000);
            StellarAssetClient::new(&base.env, &token_addr).mint(&base.contract_id, &1_000_000);
            StakeTestEnv { base, token_addr }
        }

        fn set_time(&self, ts: u64) {
            use soroban_sdk::testutils::Ledger;
            let mut info = self.base.env.ledger().get();
            info.timestamp = ts;
            self.base.env.ledger().set(info);
        }

        fn token_balance(&self, addr: &Address) -> i128 {
            soroban_sdk::token::Client::new(&self.base.env, &self.token_addr).balance(addr)
        }
    }

    #[test]
    fn test_stake_increases_staked_amount() {
        let s = StakeTestEnv::new();
        s.base.client().add_curator(&s.base.admin, &s.base.curator);
        s.base.register_worker(&s.base.curator);
        s.set_time(1000);
        s.base.client().stake(&s.base.owner, &s.base.worker_id(), &s.token_addr, &500_000);
        let info = s.base.client().get_stake_info(&s.base.worker_id()).unwrap();
        assert_eq!(info.amount, 500_000);
        let worker = s.base.client().get_worker(&s.base.worker_id()).unwrap();
        assert_eq!(worker.staked_amount, 500_000);
    }

    #[test]
    fn test_unstake_after_cooldown_returns_tokens() {
        let s = StakeTestEnv::new();
        s.base.client().add_curator(&s.base.admin, &s.base.curator);
        s.base.register_worker(&s.base.curator);
        s.set_time(1000);
        s.base.client().stake(&s.base.owner, &s.base.worker_id(), &s.token_addr, &500_000);
        s.set_time(2000);
        s.base.client().request_unstake(&s.base.owner, &s.base.worker_id());
        s.set_time(2000 + 604_800 + 1);
        s.base.client().unstake(&s.base.owner, &s.base.worker_id());
        assert!(s.token_balance(&s.base.owner) >= 500_000);
        let info = s.base.client().get_stake_info(&s.base.worker_id()).unwrap();
        assert_eq!(info.amount, 0);
    }

    #[test]
    fn test_unstake_before_cooldown_panics() {
        let s = StakeTestEnv::new();
        s.base.client().add_curator(&s.base.admin, &s.base.curator);
        s.base.register_worker(&s.base.curator);
        s.set_time(1000);
        s.base.client().stake(&s.base.owner, &s.base.worker_id(), &s.token_addr, &100_000);
        s.base.client().request_unstake(&s.base.owner, &s.base.worker_id());
        assert_eq!(
            s.base.client().try_unstake(&s.base.owner, &s.base.worker_id()),
            Err(Ok(ContractError::CooldownNotElapsed))
        );
    }

    #[test]
    fn test_double_request_unstake_panics() {
        let s = StakeTestEnv::new();
        s.base.client().add_curator(&s.base.admin, &s.base.curator);
        s.base.register_worker(&s.base.curator);
        s.set_time(1000);
        s.base.client().stake(&s.base.owner, &s.base.worker_id(), &s.token_addr, &100_000);
        s.base.client().request_unstake(&s.base.owner, &s.base.worker_id());
        assert_eq!(
            s.base.client().try_request_unstake(&s.base.owner, &s.base.worker_id()),
            Err(Ok(ContractError::UnstakeAlreadyRequested))
        );
    }

    // Location verification tests
    #[test]
    fn test_verify_location_stores_record() {
        let t = TestEnv::new();
        t.client().add_curator(&t.admin, &t.curator);
        t.register_worker(&t.curator);
        let verifier = Address::generate(&t.env);
        t.client().verify_location(&verifier, &t.worker_id(), &9999);
        let v = t.client().get_location_verification(&t.worker_id()).unwrap();
        assert_eq!(v.verifier, verifier);
        assert_eq!(v.expires_at, 9999);
    }

    #[test]
    fn test_verify_location_nonexistent_worker_panics() {
        let t = TestEnv::new();
        let verifier = Address::generate(&t.env);
        let nonexistent = Symbol::new(&t.env, "nonexistent");
        assert_eq!(
            t.client().try_verify_location(&verifier, &nonexistent, &9999),
            Err(Ok(ContractError::WorkerNotFound))
        );
    }

    // Availability status tests
    #[test]
    fn test_update_availability_stores_status() {
        let t = TestEnv::new();
        t.client().add_curator(&t.admin, &t.curator);
        t.register_worker(&t.curator);
        t.client().update_availability(&t.worker_id(), &t.owner, &true, &9999);
        let status = t.client().get_availability(&t.worker_id()).unwrap();
        assert!(status.is_available);
        assert_eq!(status.expires_at, 9999);
    }

    #[test]
    fn test_update_availability_toggle() {
        let t = TestEnv::new();
        t.client().add_curator(&t.admin, &t.curator);
        t.register_worker(&t.curator);
        t.client().update_availability(&t.worker_id(), &t.owner, &true, &0);
        assert!(t.client().get_availability(&t.worker_id()).unwrap().is_available);
        t.client().update_availability(&t.worker_id(), &t.owner, &false, &0);
        assert!(!t.client().get_availability(&t.worker_id()).unwrap().is_available);
    }

    #[test]
    fn test_update_availability_non_owner_panics() {
        let t = TestEnv::new();
        t.client().add_curator(&t.admin, &t.curator);
        t.register_worker(&t.curator);
        let stranger = Address::generate(&t.env);
        assert_eq!(
            t.client().try_update_availability(&t.worker_id(), &stranger, &true, &0),
            Err(Ok(ContractError::NotAuthorized))
        );
    }

    #[test]
    fn test_update_availability_nonexistent_worker_panics() {
        let t = TestEnv::new();
        let nonexistent = Symbol::new(&t.env, "nonexistent");
        assert_eq!(
            t.client().try_update_availability(&nonexistent, &t.owner, &true, &0),
            Err(Ok(ContractError::WorkerNotFound))
        );
    }

    // Schema migration tests
    #[test]
    fn test_upgrade_preserves_storage() {
        let t = TestEnv::new();
        t.client().add_curator(&t.admin, &t.curator);
        t.register_worker(&t.curator);
        let worker_before = t.client().get_worker(&t.worker_id()).unwrap();
        assert_eq!(worker_before.name, String::from_str(&t.env, "Alice"));
        assert_eq!(t.client().get_schema_version(), 1u32);
        t.client().migrate(&t.admin, &1u32);
        let worker_after = t.client().get_worker(&t.worker_id()).unwrap();
        assert_eq!(worker_after.name, worker_before.name);
        assert_eq!(worker_after.owner, worker_before.owner);
        assert_eq!(worker_after.reputation, worker_before.reputation);
        assert_eq!(t.client().get_schema_version(), 2u32);
    }

    #[test]
    fn test_upgrade_requires_upgrader_role() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let contract_id = env.register_contract(None, RegistryContract);
        let client = RegistryContractClient::new(&env, &contract_id);
        client.initialize(&admin);
        let dummy_hash = BytesN::from_array(&env, &[1u8; 32]);
        assert_eq!(
            client.try_upgrade(&dummy_hash),
            Err(Ok(ContractError::MissingRole))
        );
    }

    #[test]
    fn test_initial_schema_version_is_1() {
        let t = TestEnv::new();
        assert_eq!(t.client().get_schema_version(), 1u32);
    }

    #[test]
    fn test_migrate_v1_to_v2_bumps_version() {
        let t = TestEnv::new();
        t.client().migrate(&t.admin, &1u32);
        assert_eq!(t.client().get_schema_version(), 2u32);
    }

    #[test]
    fn test_migrate_double_run_panics() {
        let t = TestEnv::new();
        t.client().migrate(&t.admin, &1u32);
        assert_eq!(
            t.client().try_migrate(&t.admin, &1u32),
            Err(Ok(ContractError::WrongSchemaVersion))
        );
    }

    #[test]
    fn test_migrate_wrong_version_panics() {
        let t = TestEnv::new();
        assert_eq!(
            t.client().try_migrate(&t.admin, &2u32),
            Err(Ok(ContractError::WrongSchemaVersion))
        );
    }

    #[test]
    fn test_migrate_non_admin_panics() {
        let t = TestEnv::new();
        let stranger = Address::generate(&t.env);
        assert_eq!(
            t.client().try_migrate(&stranger, &1u32),
            Err(Ok(ContractError::MissingRole))
        );
    }

    #[test]
    fn test_migrate_sequential_versions() {
        let t = TestEnv::new();
        t.client().migrate(&t.admin, &1u32);
        assert_eq!(t.client().get_schema_version(), 2u32);
        t.client().migrate(&t.admin, &2u32);
        assert_eq!(t.client().get_schema_version(), 3u32);
    }

    // Pagination tests
    #[test]
    fn test_list_workers_page_basic() {
        let t = TestEnv::new();
        t.client().add_curator(&t.admin, &t.curator);
        for i in 0..5u8 {
            let id_str = std::format!("p{i}");
            let id = Symbol::new(&t.env, &id_str);
            t.client().register(
                &id, &t.owner, &String::from_str(&t.env, "W"),
                &Symbol::new(&t.env, "plumber"), &t.zero_hash(), &t.zero_hash(), &t.curator,
            );
        }
        let page = t.client().list_workers_page(&0, &3);
        assert_eq!(page.ids.len(), 3);
        assert_eq!(page.total, 5);
    }

    #[test]
    fn test_list_workers_page_last_page() {
        let t = TestEnv::new();
        t.client().add_curator(&t.admin, &t.curator);
        for i in 0..5u8 {
            let id_str = std::format!("q{i}");
            let id = Symbol::new(&t.env, &id_str);
            t.client().register(
                &id, &t.owner, &String::from_str(&t.env, "W"),
                &Symbol::new(&t.env, "plumber"), &t.zero_hash(), &t.zero_hash(), &t.curator,
            );
        }
        let page = t.client().list_workers_page(&3, &10);
        assert_eq!(page.ids.len(), 2);
        assert_eq!(page.total, 5);
    }

    #[test]
    fn test_list_workers_page_out_of_range() {
        let t = TestEnv::new();
        t.client().add_curator(&t.admin, &t.curator);
        t.register_worker(&t.curator);
        let page = t.client().list_workers_page(&100, &10);
        assert_eq!(page.ids.len(), 0);
        assert_eq!(page.total, 1);
    }

    #[test]
    fn test_list_workers_page_empty() {
        let t = TestEnv::new();
        let page = t.client().list_workers_page(&0, &10);
        assert_eq!(page.ids.len(), 0);
        assert_eq!(page.total, 0);
    }

    // Category management tests
    #[test]
    fn test_add_and_list_categories() {
        let t = TestEnv::new();
        t.client().add_category(&t.admin, &Symbol::new(&t.env, "plumber"));
        t.client().add_category(&t.admin, &Symbol::new(&t.env, "welder"));
        let cats = t.client().list_categories();
        assert_eq!(cats.len(), 2);
    }

    #[test]
    fn test_add_category_idempotent() {
        let t = TestEnv::new();
        t.client().add_category(&t.admin, &Symbol::new(&t.env, "plumber"));
        t.client().add_category(&t.admin, &Symbol::new(&t.env, "plumber"));
        assert_eq!(t.client().list_categories().len(), 1);
    }

    #[test]
    fn test_remove_category() {
        let t = TestEnv::new();
        t.client().add_category(&t.admin, &Symbol::new(&t.env, "plumber"));
        t.client().remove_category(&t.admin, &Symbol::new(&t.env, "plumber"));
        assert_eq!(t.client().list_categories().len(), 0);
    }

    #[test]
    fn test_register_valid_category_succeeds() {
        let t = TestEnv::new();
        t.client().add_curator(&t.admin, &t.curator);
        t.client().add_category(&t.admin, &Symbol::new(&t.env, "plumber"));
        t.register_worker(&t.curator);
    }

    #[test]
    fn test_register_invalid_category_panics() {
        let t = TestEnv::new();
        t.client().add_curator(&t.admin, &t.curator);
        t.client().add_category(&t.admin, &Symbol::new(&t.env, "welder"));
        let res = t.client().try_register(
            &t.worker_id(), &t.owner, &String::from_str(&t.env, "Alice"),
            &Symbol::new(&t.env, "plumber"), &t.zero_hash(), &t.zero_hash(), &t.curator,
        );
        assert_eq!(res, Err(Ok(ContractError::UnknownCategory)));
    }

    #[test]
    fn test_register_no_categories_set_allows_any() {
        let t = TestEnv::new();
        t.client().add_curator(&t.admin, &t.curator);
        t.register_worker(&t.curator);
    }

    // Upgrade timelock tests
    #[test]
    fn test_propose_upgrade_stores_pending() {
        let t = TestEnv::new();
        let hash = BytesN::from_array(&t.env, &[9u8; 32]);
        t.client().propose_upgrade(&t.admin, &hash);
        let pending = t.client().get_pending_upgrade().unwrap();
        assert_eq!(pending.wasm_hash, hash);
    }

    #[test]
    fn test_propose_upgrade_twice_panics() {
        let t = TestEnv::new();
        let hash = BytesN::from_array(&t.env, &[9u8; 32]);
        t.client().propose_upgrade(&t.admin, &hash);
        assert_eq!(
            t.client().try_propose_upgrade(&t.admin, &hash),
            Err(Ok(ContractError::UpgradeAlreadyPending))
        );
    }

    #[test]
    fn test_cancel_upgrade_removes_pending() {
        let t = TestEnv::new();
        let hash = BytesN::from_array(&t.env, &[9u8; 32]);
        t.client().propose_upgrade(&t.admin, &hash);
        t.client().cancel_upgrade(&t.admin);
        assert!(t.client().get_pending_upgrade().is_none());
    }

    #[test]
    fn test_cancel_upgrade_no_pending_panics() {
        let t = TestEnv::new();
        assert_eq!(
            t.client().try_cancel_upgrade(&t.admin),
            Err(Ok(ContractError::NoPendingUpgrade))
        );
    }

    #[test]
    fn test_execute_upgrade_before_timelock_panics() {
        let t = TestEnv::new();
        let hash = BytesN::from_array(&t.env, &[9u8; 32]);
        t.client().propose_upgrade(&t.admin, &hash);
        assert_eq!(
            t.client().try_execute_upgrade(),
            Err(Ok(ContractError::TimelockNotExpired))
        );
    }

    #[test]
    fn test_execute_upgrade_no_pending_panics() {
        let t = TestEnv::new();
        assert_eq!(
            t.client().try_execute_upgrade(),
            Err(Ok(ContractError::NoPendingUpgrade))
        );
    }
}
