//! # BlueCollar Registry Contract
//!
//! Deployed on Stellar (Soroban), this contract manages on-chain worker registrations
//! for the BlueCollar protocol. It provides a trustless, immutable record of worker
//! listings that can be verified by anyone on the network.
//!
//! ## Access Control
//! - **Admin**: Set once at [`initialize`]. Can add/remove curators and upgrade the contract.
//! - **Curators**: Approved addresses that may register workers on behalf of owners.
//! - **Owners**: The worker's on-chain owner address; may toggle, update, or deregister their own worker.
//!
//! ## Storage
//! - Instance storage: `Admin` key (set once).
//! - Persistent storage: `Curators` list, individual `Worker` entries, and `WorkerList` index.
//!
//! ## Privacy
//! Raw PII (location, contact details) is never stored on-chain.
//! Only SHA-256 digests are stored — see `location_hash` and `contact_hash` on [`Worker`].

#![no_std]

use bluecollar_types::{helpers, ContractError};
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, token, Address, BytesN, Env, String,
    Symbol, Vec,
};

/// Event schema version — bump when adding/removing/renaming events.
pub const VERSION: u32 = 1;

/// Approximate TTL extension target (~1 year at 5 s/ledger).
const TTL_EXTEND_TO: u32 = 535_000;
/// Extend TTL only when it drops below this threshold (~6 months).
const TTL_THRESHOLD: u32 = 267_500;

// =============================================================================
// Gas Optimization Constants (#351)
// =============================================================================

/// Cached role symbols to reduce symbol creation overhead.
const ROLE_ADMIN_CACHED: &str = "admin";
const ROLE_PAUSER_CACHED: &str = "pauser";
const ROLE_CURATOR_MGR_CACHED: &str = "curator_mgr";
const ROLE_REP_MGR_CACHED: &str = "rep_mgr";
const ROLE_UPGRADER_CACHED: &str = "upgrader";

/// Role IDs for storage key optimization.
/// Maps role strings to compact u64 IDs for efficient storage.
const ROLE_ADMIN_ID: u64 = 0;
const ROLE_PAUSER_ID: u64 = 1;
const ROLE_CURATOR_MGR_ID: u64 = 2;
const ROLE_REP_MGR_ID: u64 = 3;
const ROLE_UPGRADER_ID: u64 = 4;

// =============================================================================
// Types
// =============================================================================

/// Subscription tier for a worker.
#[contracttype]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum SubscriptionTier {
    /// Free tier - no subscription.
    Free = 0,
    /// Basic tier - standard visibility.
    Basic = 1,
    /// Premium tier - enhanced visibility and features.
    Premium = 2,
}

/// Worker subscription information.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct WorkerSubscription {
    /// Current subscription tier.
    pub tier: SubscriptionTier,
    /// Unix timestamp when subscription expires (0 = never expires).
    pub expires_at: u64,
    /// Unix timestamp of last renewal.
    pub last_renewed_at: u64,
}

/// On-chain worker profile stored in persistent contract storage.
///
/// `location_hash` and `contact_hash` are SHA-256 digests — raw PII is never
/// stored on-chain. See README § Hashing Scheme for the exact input format.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct Worker {
    /// Unique worker identifier (matches the off-chain database id).
    pub id: Symbol,
    /// Stellar address of the worker's owner account.
    pub owner: Address,
    /// Display name of the worker.
    pub name: String,
    /// Trade/skill category (e.g. `plumber`, `electrician`).
    pub category: Symbol,
    /// Whether the worker is currently accepting work.
    pub is_active: bool,
    /// Stellar wallet address used to receive tips/payments.
    pub wallet: Address,
    /// SHA-256( lowercase(city) + ":" + lowercase(country_iso2) )
    pub location_hash: BytesN<32>,
    /// SHA-256( lowercase(email_or_e164_phone) )
    pub contact_hash: BytesN<32>,
    /// Reputation score in basis points (0–10000, where 10000 = 100.00%).
    /// Updated by the admin via [`RegistryContract::update_reputation`].
    pub reputation: u32,
    /// On-chain verified categories for this worker (see [`CategoryVerification`]).
    pub verified_categories: Vec<Symbol>,
    /// Total tokens staked by this worker for visibility boost.
    pub staked_amount: i128,
    /// Total number of reviews received by this worker.
    pub review_count: u32,
    /// Average rating in basis points (0–10000, where 10000 = 100.00%).
    pub avg_rating: u32,
    /// Worker subscription status.
    pub subscription: WorkerSubscription,
}

/// Delegate record for worker profile management.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct Delegate {
    /// Address granted delegation.
    pub address: Address,
    /// Unix timestamp when delegation expires (0 = no expiry).
    pub expires_at: u64,
}

/// Performance metrics for a worker (#378).
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct PerformanceMetrics {
    /// Total number of jobs completed.
    pub jobs_completed: u32,
    /// Average rating (0-10000 basis points).
    pub avg_rating: u32,
    /// Total number of ratings received.
    pub total_ratings: u32,
    /// Last update timestamp.
    pub last_updated: u64,
    /// Performance score (calculated from metrics).
    pub performance_score: u32,
}

/// On-chain record of a curator verifying a worker's category.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct CategoryVerification {
    /// The category that was verified.
    pub category: Symbol,
    /// Curator who performed the verification.
    pub curator: Address,
    /// Unix timestamp when this verification expires.
    pub expires_at: u64,
}

/// Location verification record for a worker.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct LocationVerification {
    /// Verifier address.
    pub verifier: Address,
    /// Unix timestamp when verification was recorded.
    pub verified_at: u64,
    /// Unix timestamp when verification expires.
    pub expires_at: u64,
}

/// Worker availability status.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct AvailabilityStatus {
    /// Whether worker is currently available.
    pub is_available: bool,
    /// Unix timestamp of last availability update.
    pub updated_at: u64,
    /// Unix timestamp when availability status expires (0 = no expiry).
    pub expires_at: u64,
}

/// Staking record for a worker.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct StakeInfo {
    /// Token contract used for staking.
    pub token: Address,
    /// Total amount currently staked.
    pub amount: i128,
    /// Ledger timestamp when unstake was requested (0 = no pending unstake).
    pub unstake_requested_at: u64,
    /// Accumulated rewards in basis points of staked amount per ledger.
    pub rewards_accumulated: i128,
    /// Ledger timestamp of last reward calculation.
    pub last_reward_ledger: u64,
}

/// Badge awarded to a worker for achievements (#380).
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct Badge {
    /// Badge identifier.
    pub id: Symbol,
    /// Badge name/title.
    pub name: String,
    /// Issuer address (admin or curator).
    pub issuer: Address,
    /// Timestamp when badge was awarded.
    pub awarded_at: u64,
    /// Expiry timestamp (0 = no expiry).
    pub expires_at: u64,
    /// Whether badge is currently active.
    pub active: bool,
}

/// Verification level for a worker (#778).
#[contracttype]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum VerificationLevel {
    /// No verification — default state.
    None = 0,
    /// Identity checked by a curator.
    Basic = 1,
    /// Credentials and category skills verified.
    Verified = 2,
    /// Expert-level — multiple verified credentials and peer reviews.
    Expert = 3,
}

/// A certified skill entry for a worker (#778).
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct CertifiedSkill {
    /// Skill identifier (e.g., "pipe_fitting", "arc_welding").
    pub skill: Symbol,
    /// Curator or admin who certified this skill.
    pub certified_by: Address,
    /// Unix timestamp when certification was granted.
    pub certified_at: u64,
    /// Unix timestamp when certification expires (0 = no expiry).
    pub expires_at: u64,
}

/// A single immutable reputation history entry (#677).
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct ReputationEvent {
    /// Previous reputation score.
    pub previous_score: u32,
    /// New reputation score after this event.
    pub new_score: u32,
    /// Human-readable reason (e.g. "review", "slash", "job_completion").
    pub reason: Symbol,
    /// Ledger timestamp when this event was recorded.
    pub timestamp: u64,
}

/// Aggregated inputs used to compute the weighted reputation score (#677).
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct ReputationInputs {
    /// Total tips/payments received (used as job-completion proxy).
    pub tip_count: u32,
    /// Running sum of review ratings (basis points) for weighted-average calc.
    pub rating_sum: u64,
    /// Total number of ratings submitted.
    pub rating_count: u32,
    /// Timestamp of the most recent review (for recency decay).
    pub last_review_at: u64,
}

/// Result of a single registration attempt in [`RegistryContract::batch_register`].
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct BatchRegisterResult {
    pub id: Symbol,
    pub success: bool,
}

/// Paginated result for [`RegistryContract::list_workers_page`].
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct WorkerPage {
    /// Worker ids in this page.
    pub ids: Vec<Symbol>,
    /// Total number of registered workers.
    pub total: u32,
}

/// Pending upgrade record for the timelock mechanism.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct PendingUpgrade {
    /// New WASM hash to apply.
    pub wasm_hash: BytesN<32>,
    /// Ledger sequence number after which the upgrade may be executed.
    pub execute_after_ledger: u32,
}

// =============================================================================
// Roles
// =============================================================================

/// Full admin — can grant/revoke any role and call all privileged functions.
pub const ROLE_ADMIN: &str = "admin";
/// May pause and unpause the contract.
pub const ROLE_PAUSER: &str = "pauser";
/// May add and remove curators.
pub const ROLE_CURATOR_MGR: &str = "curator_mgr";
/// May update worker reputation scores.
pub const ROLE_REP_MGR: &str = "rep_mgr";
/// May upgrade the contract WASM.
pub const ROLE_UPGRADER: &str = "upgrader";

/// Storage keys used throughout the contract.
#[contracttype]
pub enum DataKey {
    /// Instance storage — bootstrap admin address, set once at [`RegistryContract::initialize`].
    Admin,
    /// Instance storage — paused flag; when `true` all state-mutating functions revert.
    Paused,
    /// Persistent storage — `Vec<Address>` of members for a given role.
    RoleMembers(u64),
    /// Persistent storage — ordered list of approved curator [`Address`]es.
    Curators,
    /// Persistent storage — [`Worker`] record keyed by its `id` [`Symbol`].
    Worker(Symbol),
    /// Persistent storage — ordered list of all registered worker id [`Symbol`]s.
    WorkerList,
    /// Persistent storage — [`CategoryVerification`] keyed by `(worker_id, category)`.
    CategoryVerification(Symbol, Symbol),
    /// Persistent storage — [`StakeInfo`] keyed by worker id.
    StakeInfo(Symbol),
    /// Persistent storage — [`PerformanceMetrics`] keyed by worker id.
    PerformanceMetrics(Symbol),
    /// Persistent storage — list of delegate addresses for a worker.
    Delegates(Symbol),
    /// Persistent storage — list of badges for a worker.
    WorkerBadges(Symbol),
    /// Persistent storage — individual badge keyed by (worker_id, badge_id).
    Badge(Symbol, Symbol),
    /// Persistent storage — [`WorkerSubscription`] keyed by worker id.
    Subscription(Symbol),
    /// Persistent storage — current storage schema version (u32), used by [`migrate`].
    SchemaVersion,
    /// Persistent storage — [`LocationVerification`] keyed by worker id.
    LocationVerification(Symbol),
    /// Persistent storage — [`AvailabilityStatus`] keyed by worker id.
    AvailabilityStatus(Symbol),
    /// Persistent storage — `Vec<String>` of valid on-chain categories.
    Categories,
    /// Persistent storage — total worker count (u32) for efficient pagination.
    WorkerCount,
    /// Persistent storage — pending upgrade record for the timelock mechanism.
    PendingUpgrade,
    /// Persistent storage — `Vec<ReputationEvent>` history keyed by worker id (#677).
    ReputationHistory(Symbol),
    /// Persistent storage — [`ReputationInputs`] keyed by worker id (#677).
    ReputationInputs(Symbol),
    /// Persistent storage — [`VerificationLevel`] keyed by worker id (#778).
    VerificationLevel(Symbol),
    /// Persistent storage — `Vec<CertifiedSkill>` keyed by worker id (#778).
    CertifiedSkills(Symbol),
}

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
        // Store admin in persistent storage
        env.storage().persistent().set(&DataKey::Admin, &admin);
        // Set initial schema version
        env.storage()
            .persistent()
            .set(&DataKey::SchemaVersion, &1u32);
        // Bootstrap: grant ROLE_ADMIN to the initial admin.
        let role = Symbol::new(&env, ROLE_ADMIN);
        let mut members: Vec<Address> = Vec::new(&env);
        members.push_back(admin.clone());
        env.storage().persistent().set(
            &DataKey::RoleMembers(Self::role_to_id_with_env(&env, &role)),
            &members,
        );
        env.events()
            .publish((symbol_short!("RlGrnt"), role, admin), ());
        Ok(())
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    /// Return the member list for a role, or empty vec if no members exist.
    fn get_role_members(env: &Env, role: &Symbol) -> Vec<Address> {
        env.storage()
            .persistent()
            .get(&DataKey::RoleMembers(Self::role_to_id_with_env(&env, role)))
            .unwrap_or(Vec::new(env))
    }

    /// Create a role symbol efficiently (gas optimization #351).
    fn role_symbol(env: &Env, role_str: &str) -> Symbol {
        Symbol::new(env, role_str)
    }

    /// Convert a role symbol to its compact u64 ID for storage optimization.
    fn role_to_id_with_env(env: &Env, role: &Symbol) -> u64 {
        if *role == Symbol::new(env, ROLE_ADMIN_CACHED) {
            ROLE_ADMIN_ID
        } else if *role == Symbol::new(env, ROLE_PAUSER_CACHED) {
            ROLE_PAUSER_ID
        } else if *role == Symbol::new(env, ROLE_CURATOR_MGR_CACHED) {
            ROLE_CURATOR_MGR_ID
        } else if *role == Symbol::new(env, ROLE_REP_MGR_CACHED) {
            ROLE_REP_MGR_ID
        } else if *role == Symbol::new(env, ROLE_UPGRADER_CACHED) {
            ROLE_UPGRADER_ID
        } else {
            u64::MAX
        }
    }

    /// Assert that `caller` holds `role` and has authorised this call.
    fn require_role(env: &Env, role: &Symbol, caller: &Address) -> Result<(), ContractError> {
        let members = Self::get_role_members(env, role);
        helpers::require_role(caller, &members)
    }

    /// Assert that the contract is not paused.
    fn require_not_paused(env: &Env) -> Result<(), ContractError> {
        let paused: bool = env
            .storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false);
        helpers::require_not_paused(paused)
    }

    /// Return the delegate list for a worker, or empty vec if none exist.
    fn get_delegates(env: &Env, worker_id: &Symbol) -> Vec<Delegate> {
        env.storage()
            .persistent()
            .get(&DataKey::Delegates(worker_id.clone()))
            .unwrap_or(Vec::new(env))
    }

    /// Assert that `caller` is either the worker's owner or an active (non-expired) delegate.
    fn require_owner_or_delegate(
        env: &Env,
        worker: &Worker,
        caller: &Address,
    ) -> Result<(), ContractError> {
        if worker.owner == *caller {
            return Ok(());
        }
        let now = env.ledger().timestamp();
        let delegates = Self::get_delegates(env, &worker.id);
        let is_valid_delegate = delegates
            .iter()
            .any(|d| d.address == *caller && (d.expires_at == 0 || d.expires_at > now));
        if !is_valid_delegate {
            return Err(ContractError::NotAuthorized);
        }
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
        let admin_role = Self::role_symbol(&env, ROLE_ADMIN_CACHED);
        Self::require_role(&env, &admin_role, &caller)?;
        Self::require_not_paused(&env)?;

        let mut members = Self::get_role_members(&env, &role);
        if members.iter().all(|m| m != account) {
            members.push_back(account.clone());
            env.storage().persistent().set(
                &DataKey::RoleMembers(Self::role_to_id_with_env(&env, &role)),
                &members,
            );
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
        let admin_role = Self::role_symbol(&env, ROLE_ADMIN_CACHED);
        Self::require_role(&env, &admin_role, &caller)?;
        Self::require_not_paused(&env)?;

        let members = Self::get_role_members(&env, &role);
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
        env.storage().persistent().set(
            &DataKey::RoleMembers(Self::role_to_id_with_env(&env, &role)),
            &updated,
        );

        env.events()
            .publish((symbol_short!("RlRvkd"), role, account), ());
        Ok(())
    }

    /// Returns `true` if `account` holds `role`.
    pub fn has_role(env: Env, role: Symbol, account: Address) -> Result<bool, ContractError> {
        Ok(Self::get_role_members(&env, &role)
            .iter()
            .any(|m| m == account))
    }

    /// Return all members of a role.
    pub fn get_role_members_list(env: Env, role: Symbol) -> Result<Vec<Address>, ContractError> {
        Ok(Self::get_role_members(&env, &role))
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
        Self::require_not_paused(&env)?;

        let worker: Worker = env
            .storage()
            .persistent()
            .get(&DataKey::Worker(id.clone()))
            .ok_or(ContractError::WorkerNotFound)?;
        if worker.owner != owner {
            return Err(ContractError::NotAuthorized);
        }

        let mut delegates = Self::get_delegates(&env, &id);

        // Update expiry if delegate already exists, otherwise push.
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

        env.storage()
            .persistent()
            .set(&DataKey::Delegates(id.clone()), &delegates);

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
        Self::require_not_paused(&env)?;

        let worker: Worker = env
            .storage()
            .persistent()
            .get(&DataKey::Worker(id.clone()))
            .ok_or(ContractError::WorkerNotFound)?;
        if worker.owner != owner {
            return Err(ContractError::NotAuthorized);
        }

        let delegates = Self::get_delegates(&env, &id);
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

        env.storage()
            .persistent()
            .set(&DataKey::Delegates(id.clone()), &updated);

        env.events()
            .publish((symbol_short!("DlgRem"), id, delegate), ());
        Ok(())
    }

    /// Get all delegates for a worker.
    pub fn get_worker_delegates(env: Env, id: Symbol) -> Result<Vec<Delegate>, ContractError> {
        Ok(Self::get_delegates(&env, &id))
    }

    // -------------------------------------------------------------------------
    // Pause / Unpause (admin only)
    // -------------------------------------------------------------------------

    /// Pause the contract, blocking all state-mutating operations.
    pub fn pause(env: Env, admin: Address) -> Result<(), ContractError> {
        let pauser_role = Self::role_symbol(&env, ROLE_PAUSER_CACHED);
        Self::require_role(&env, &pauser_role, &admin)?;
        env.storage().instance().set(&DataKey::Paused, &true);
        env.events().publish((symbol_short!("Paused"), admin), ());
        Ok(())
    }

    /// Unpause the contract, re-enabling all state-mutating operations.
    pub fn unpause(env: Env, admin: Address) -> Result<(), ContractError> {
        let pauser_role = Self::role_symbol(&env, ROLE_PAUSER_CACHED);
        Self::require_role(&env, &pauser_role, &admin)?;
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

    /// Return the current curator list, or an empty vec if none have been added yet.
    fn get_curators(env: &Env) -> Vec<Address> {
        env.storage()
            .persistent()
            .get(&DataKey::Curators)
            .unwrap_or(Vec::new(env))
    }

    // -------------------------------------------------------------------------
    // Curator management
    // -------------------------------------------------------------------------

    /// Add a curator (admin only). Idempotent — adding an existing curator is a no-op.
    pub fn add_curator(env: Env, admin: Address, curator: Address) -> Result<(), ContractError> {
        let curator_mgr_role = Self::role_symbol(&env, ROLE_CURATOR_MGR_CACHED);
        Self::require_role(&env, &curator_mgr_role, &admin)?;
        Self::require_not_paused(&env)?;

        let mut curators = Self::get_curators(&env);
        if curators.iter().all(|c| c != curator) {
            curators.push_back(curator.clone());
            env.storage()
                .persistent()
                .set(&DataKey::Curators, &curators);
        }

        env.events()
            .publish((symbol_short!("CurAdd"), admin, curator), ());
        Ok(())
    }

    /// Remove a curator (admin only).
    pub fn remove_curator(env: Env, admin: Address, curator: Address) -> Result<(), ContractError> {
        let curator_mgr_role = Self::role_symbol(&env, ROLE_CURATOR_MGR_CACHED);
        Self::require_role(&env, &curator_mgr_role, &admin)?;
        Self::require_not_paused(&env)?;

        let curators = Self::get_curators(&env);
        let mut updated: Vec<Address> = Vec::new(&env);
        for c in curators.iter() {
            if c != curator {
                updated.push_back(c);
            }
        }
        env.storage().persistent().set(&DataKey::Curators, &updated);

        env.events()
            .publish((symbol_short!("CurRem"), admin, curator), ());
        Ok(())
    }

    /// Returns `true` if `addr` is an approved curator.
    pub fn is_curator(env: Env, addr: Address) -> Result<bool, ContractError> {
        Ok(Self::get_curators(&env).iter().any(|c| c == addr))
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
        Self::require_not_paused(&env)?;
        if !Self::get_curators(&env).iter().any(|c| c == curator) {
            return Err(ContractError::CallerIsNotCurator);
        }

        // #531: Validate category against on-chain list (if any categories are set).
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

        let key = DataKey::Worker(id.clone());
        env.storage().persistent().set(&key, &worker);
        env.storage()
            .persistent()
            .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);

        let list_key = DataKey::WorkerList;
        let mut list: Vec<Symbol> = env
            .storage()
            .persistent()
            .get(&list_key)
            .unwrap_or(Vec::new(&env));
        list.push_back(id.clone());
        env.storage().persistent().set(&list_key, &list);
        env.storage()
            .persistent()
            .extend_ttl(&list_key, TTL_THRESHOLD, TTL_EXTEND_TO);

        // #529: Maintain WorkerCount for efficient pagination.
        let count: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::WorkerCount)
            .unwrap_or(0u32);
        env.storage()
            .persistent()
            .set(&DataKey::WorkerCount, &(count + 1));

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
        Self::require_not_paused(&env)?;
        let mut worker: Worker = env
            .storage()
            .persistent()
            .get(&DataKey::Worker(id.clone()))
            .ok_or(ContractError::WorkerNotFound)?;
        Self::require_owner_or_delegate(&env, &worker, &caller)?;
        worker.is_active = !worker.is_active;
        let new_status = worker.is_active;
        env.storage()
            .persistent()
            .set(&DataKey::Worker(id.clone()), &worker);

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
        Self::require_not_paused(&env)?;
        let mut worker: Worker = env
            .storage()
            .persistent()
            .get(&DataKey::Worker(id.clone()))
            .ok_or(ContractError::WorkerNotFound)?;
        Self::require_owner_or_delegate(&env, &worker, &caller)?;

        worker.name = name.clone();
        worker.category = category.clone();
        worker.location_hash = location_hash;
        worker.contact_hash = contact_hash;

        env.storage()
            .persistent()
            .set(&DataKey::Worker(id.clone()), &worker);

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
        Self::require_not_paused(&env)?;

        let mut worker: Worker = env
            .storage()
            .persistent()
            .get(&DataKey::Worker(id.clone()))
            .ok_or(ContractError::WorkerNotFound)?;

        Self::require_owner_or_delegate(&env, &worker, &caller)?;

        worker.name = name.clone();
        worker.category = category.clone();
        worker.wallet = wallet.clone();
        env.storage()
            .persistent()
            .set(&DataKey::Worker(id.clone()), &worker);

        env.events().publish(
            (symbol_short!("WrkUpd"), id, caller),
            (name, category, wallet),
        );
        Ok(())
    }

    /// Permanently remove a worker from the registry. Owner only.
    pub fn deregister(env: Env, id: Symbol, caller: Address) -> Result<(), ContractError> {
        caller.require_auth();
        Self::require_not_paused(&env)?;
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

        let mut list: Vec<Symbol> = env
            .storage()
            .persistent()
            .get(&DataKey::WorkerList)
            .unwrap_or(Vec::new(&env));
        if let Some(pos) = list.iter().position(|x| x == id) {
            list.remove(pos as u32);
        }
        env.storage().persistent().set(&DataKey::WorkerList, &list);

        // #529: Decrement WorkerCount.
        let count: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::WorkerCount)
            .unwrap_or(0u32);
        if count > 0 {
            env.storage()
                .persistent()
                .set(&DataKey::WorkerCount, &(count - 1));
        }

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
        Ok(env
            .storage()
            .persistent()
            .get(&DataKey::WorkerList)
            .unwrap_or(Vec::new(&env)))
    }

    /// Return a page of worker ids starting at `offset`, up to `limit` items.
    pub fn list_workers_paginated(
        env: Env,
        offset: u32,
        limit: u32,
    ) -> Result<Vec<Symbol>, ContractError> {
        let list: Vec<Symbol> = env
            .storage()
            .persistent()
            .get(&DataKey::WorkerList)
            .unwrap_or(Vec::new(&env));

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
        let list: Vec<Symbol> = env
            .storage()
            .persistent()
            .get(&DataKey::WorkerList)
            .unwrap_or(Vec::new(&env));
        Ok(list.len())
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

        let admin_role = Self::role_symbol(&env, ROLE_ADMIN);
        let mut members = Self::get_role_members(&env, &admin_role);
        let mut updated: Vec<Address> = Vec::new(&env);
        for m in members.iter() {
            if m != current_admin {
                updated.push_back(m);
            }
        }
        if updated.iter().all(|m| m != new_admin) {
            updated.push_back(new_admin.clone());
        }
        env.storage().persistent().set(
            &DataKey::RoleMembers(Self::role_to_id_with_env(&env, &admin_role)),
            &updated,
        );
        Ok(())
    }

    // -------------------------------------------------------------------------
    // Reputation
    // -------------------------------------------------------------------------

    /// Update a worker's on-chain reputation score (admin only).
    pub fn update_reputation(
        env: Env,
        admin: Address,
        id: Symbol,
        score: u32,
    ) -> Result<(), ContractError> {
        let rep_mgr_role = Self::role_symbol(&env, ROLE_REP_MGR_CACHED);
        Self::require_role(&env, &rep_mgr_role, &admin)?;
        Self::require_not_paused(&env)?;
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
        env.storage()
            .persistent()
            .set(&DataKey::Worker(id.clone()), &worker);

        Self::append_reputation_history(&env, &id, prev, score, Symbol::new(&env, "manual"));

        env.events().publish((symbol_short!("RepUpd"), id), score);
        Ok(())
    }

    // -------------------------------------------------------------------------
    // Reputation system (#677)
    // -------------------------------------------------------------------------

    /// Weights (out of 100) for the three reputation factors.
    const REP_WEIGHT_QUALITY: u32 = 60; // review quality (avg rating)
    const REP_WEIGHT_VOLUME: u32 = 25; // tip/job-completion volume
    const REP_WEIGHT_RECENCY: u32 = 15; // how recent the last review is

    /// Recency half-life in seconds (~90 days).
    const RECENCY_HALF_LIFE_SECS: u64 = 7_776_000;

    /// Maximum tip count considered for volume score (caps at 10_000 bps).
    const MAX_TIP_VOLUME: u32 = 50;

    /// Maximum history entries stored per worker.
    const MAX_HISTORY_LEN: u32 = 100;

    /// Minimum rating sum to trigger a slash (quality below this threshold).
    /// Below 3000 bps avg with at least 3 reviews triggers automatic slashing.
    const SLASH_THRESHOLD_RATING: u32 = 3_000;
    const SLASH_MIN_REVIEWS: u32 = 3;

    /// Compute the weighted reputation score from [`ReputationInputs`].
    ///
    /// Formula:
    /// - quality_score  = avg_rating (bps) × 0.60
    /// - volume_score   = min(tip_count / MAX_TIP_VOLUME, 1) × 10000 × 0.25
    /// - recency_score  = decay(last_review_at, now) × 10000 × 0.15
    ///   where decay = 0.5 ^ (elapsed / HALF_LIFE)  (approximated as linear for gas efficiency)
    ///
    /// Returns a score in basis points (0–10000).
    fn compute_weighted_reputation(inputs: &ReputationInputs, now: u64) -> u32 {
        // quality component
        let avg_rating = if inputs.rating_count == 0 {
            0u32
        } else {
            (inputs.rating_sum / inputs.rating_count as u64) as u32
        };
        let quality = avg_rating
            .checked_mul(Self::REP_WEIGHT_QUALITY)
            .expect("overflow")
            / 100;

        // volume component (saturates at MAX_TIP_VOLUME)
        let volume_fraction = inputs.tip_count.min(Self::MAX_TIP_VOLUME);
        let volume = (volume_fraction as u64)
            .checked_mul(10_000)
            .expect("overflow")
            / Self::MAX_TIP_VOLUME as u64;
        let volume = (volume as u32)
            .checked_mul(Self::REP_WEIGHT_VOLUME)
            .expect("overflow")
            / 100;

        // recency component (linear approximation of exponential decay)
        let recency = if inputs.last_review_at == 0 {
            0u32
        } else {
            let elapsed = now.saturating_sub(inputs.last_review_at);
            let decay_bps = if elapsed >= Self::RECENCY_HALF_LIFE_SECS {
                0u32
            } else {
                10_000u32
                    - ((elapsed as u64).checked_mul(10_000).expect("overflow")
                        / Self::RECENCY_HALF_LIFE_SECS) as u32
            };
            decay_bps
                .checked_mul(Self::REP_WEIGHT_RECENCY)
                .expect("overflow")
                / 100
        };

        quality
            .checked_add(volume)
            .expect("overflow")
            .checked_add(recency)
            .expect("overflow")
            .min(10_000)
    }

    /// Append an entry to the immutable reputation history (capped at MAX_HISTORY_LEN).
    fn append_reputation_history(
        env: &Env,
        id: &Symbol,
        previous: u32,
        new_score: u32,
        reason: Symbol,
    ) {
        let mut history: Vec<ReputationEvent> = env
            .storage()
            .persistent()
            .get(&DataKey::ReputationHistory(id.clone()))
            .unwrap_or(Vec::new(env));

        // Drop oldest entry if at capacity
        if history.len() >= Self::MAX_HISTORY_LEN {
            let mut trimmed: Vec<ReputationEvent> = Vec::new(env);
            for i in 1..history.len() {
                trimmed.push_back(history.get(i).unwrap());
            }
            history = trimmed;
        }

        history.push_back(ReputationEvent {
            previous_score: previous,
            new_score,
            reason,
            timestamp: env.ledger().timestamp(),
        });
        env.storage()
            .persistent()
            .set(&DataKey::ReputationHistory(id.clone()), &history);
    }

    /// Submit a user review for a worker (#677).
    pub fn submit_review(
        env: Env,
        reviewer: Address,
        worker_id: Symbol,
        rating: u32,
    ) -> Result<(), ContractError> {
        reviewer.require_auth();
        Self::require_not_paused(&env)?;
        if rating > 10_000 {
            return Err(ContractError::RatingOutOfRange);
        }

        let mut worker: Worker = env
            .storage()
            .persistent()
            .get(&DataKey::Worker(worker_id.clone()))
            .ok_or(ContractError::WorkerNotFound)?;

        let now = env.ledger().timestamp();

        // Update ReputationInputs
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

        let new_score = Self::compute_weighted_reputation(&inputs, now);

        env.storage()
            .persistent()
            .set(&DataKey::ReputationInputs(worker_id.clone()), &inputs);

        // Update worker aggregate fields
        let prev_rep = worker.reputation;
        worker.review_count = worker.review_count.checked_add(1).expect("overflow");
        worker.avg_rating = (inputs.rating_sum / inputs.rating_count as u64) as u32;
        worker.reputation = new_score;

        // Slash check: avg below threshold with enough reviews
        if worker.avg_rating < Self::SLASH_THRESHOLD_RATING
            && worker.review_count >= Self::SLASH_MIN_REVIEWS
        {
            let slashed = worker.reputation / 2;
            Self::append_reputation_history(
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

        env.storage()
            .persistent()
            .set(&DataKey::Worker(worker_id.clone()), &worker);

        Self::append_reputation_history(
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

    /// Record a completed job/tip payment to boost a worker's volume score (#677).
    pub fn record_job_completion(
        env: Env,
        caller: Address,
        worker_id: Symbol,
    ) -> Result<(), ContractError> {
        let rep_mgr_role = Self::role_symbol(&env, ROLE_REP_MGR_CACHED);
        Self::require_role(&env, &rep_mgr_role, &caller)?;
        Self::require_not_paused(&env)?;

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

        let new_score = Self::compute_weighted_reputation(&inputs, now);
        let prev_rep = worker.reputation;
        worker.reputation = new_score;

        env.storage()
            .persistent()
            .set(&DataKey::ReputationInputs(worker_id.clone()), &inputs);
        env.storage()
            .persistent()
            .set(&DataKey::Worker(worker_id.clone()), &worker);

        Self::append_reputation_history(
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

    /// Slash a worker's reputation for poor performance (#677).
    pub fn slash_reputation(
        env: Env,
        caller: Address,
        worker_id: Symbol,
        slash_bps: u32,
    ) -> Result<(), ContractError> {
        let rep_mgr_role = Self::role_symbol(&env, ROLE_REP_MGR_CACHED);
        Self::require_role(&env, &rep_mgr_role, &caller)?;
        Self::require_not_paused(&env)?;
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

        env.storage()
            .persistent()
            .set(&DataKey::Worker(worker_id.clone()), &worker);

        Self::append_reputation_history(
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

    /// Get the immutable reputation history for a worker (#677).
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

    /// Get the raw reputation inputs for a worker (#677).
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
        Self::require_role(&env, &Symbol::new(&env, ROLE_ADMIN), &admin)?;
        Self::require_not_paused(&env)?;
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
        env.storage()
            .persistent()
            .set(&DataKey::Worker(id.clone()), &worker);
        env.storage().persistent().extend_ttl(
            &DataKey::Worker(id.clone()),
            TTL_THRESHOLD,
            TTL_EXTEND_TO,
        );

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
        Self::require_role(&env, &Symbol::new(&env, ROLE_ADMIN), &admin)?;
        Self::require_not_paused(&env)?;

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

        env.storage()
            .persistent()
            .set(&DataKey::Worker(id.clone()), &worker);
        env.storage().persistent().extend_ttl(
            &DataKey::Worker(id.clone()),
            TTL_THRESHOLD,
            TTL_EXTEND_TO,
        );

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
        Self::require_not_paused(&env)?;

        let mut worker: Worker = env
            .storage()
            .persistent()
            .get(&DataKey::Worker(id.clone()))
            .ok_or(ContractError::WorkerNotFound)?;

        Self::require_owner_or_delegate(&env, &worker, &caller)?;

        let now = env.ledger().timestamp();
        worker.subscription.expires_at = new_expires_at;
        worker.subscription.last_renewed_at = now;

        env.storage()
            .persistent()
            .set(&DataKey::Worker(id.clone()), &worker);
        env.storage().persistent().extend_ttl(
            &DataKey::Worker(id.clone()),
            TTL_THRESHOLD,
            TTL_EXTEND_TO,
        );

        env.events()
            .publish((symbol_short!("SubRnw"), id), new_expires_at);
        Ok(())
    }

    /// Get a worker's subscription status.
    pub fn get_subscription(env: Env, id: Symbol) -> Result<WorkerSubscription, ContractError> {
        let worker: Worker = env
            .storage()
            .persistent()
            .get(&DataKey::Worker(id))
            .ok_or(ContractError::WorkerNotFound)?;

        Ok(worker.subscription)
    }

    // -------------------------------------------------------------------------
    // Category verification (#338)
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
        if !Self::get_curators(&env).iter().any(|c| c == curator) {
            return Err(ContractError::CallerIsNotCurator);
        }

        let mut worker: Worker = env
            .storage()
            .persistent()
            .get(&DataKey::Worker(worker_id.clone()))
            .ok_or(ContractError::WorkerNotFound)?;

        if worker.verified_categories.iter().all(|c| c != category) {
            worker.verified_categories.push_back(category.clone());
            env.storage()
                .persistent()
                .set(&DataKey::Worker(worker_id.clone()), &worker);
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
    // Location verification (#352)
    // -------------------------------------------------------------------------

    /// Verify a worker's location on-chain. Verifier role required.
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
    // Availability status (#376)
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
    // Batch registration (#340)
    // -------------------------------------------------------------------------

    /// Maximum number of workers that can be registered in a single batch call.
    pub const MAX_BATCH_SIZE: u32 = 20;

    /// Toggle the `is_active` status of multiple workers in one transaction. Curator only.
    pub fn batch_toggle(
        env: Env,
        caller: Address,
        ids: Vec<Symbol>,
    ) -> Result<Vec<Symbol>, ContractError> {
        caller.require_auth();
        Self::require_not_paused(&env)?;
        if !Self::get_curators(&env).iter().any(|c| c == caller) {
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
                env.storage().persistent().set(&key, &worker);
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
        if !Self::get_curators(&env).iter().any(|c| c == curator) {
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
        let list_key = DataKey::WorkerList;
        let mut list: Vec<Symbol> = env
            .storage()
            .persistent()
            .get(&list_key)
            .unwrap_or(Vec::new(&env));

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

            env.storage().persistent().set(&key, &worker);
            env.storage()
                .persistent()
                .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
            list.push_back(id.clone());

            env.events().publish(
                (symbol_short!("WrkReg"), id.clone()),
                (owner, categories.get(i).unwrap()),
            );

            results.push_back(BatchRegisterResult { id, success: true });
        }

        env.storage().persistent().set(&list_key, &list);
        env.storage()
            .persistent()
            .extend_ttl(&list_key, TTL_THRESHOLD, TTL_EXTEND_TO);

        Ok(results)
    }

    // -------------------------------------------------------------------------
    // Worker staking (#341)
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
            // bps (÷10_000) × per-1000-seconds (÷1_000) = ÷10_000_000
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
        env.storage()
            .persistent()
            .set(&DataKey::Worker(worker_id.clone()), &worker);

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
            // bps (÷10_000) × per-1000-seconds (÷1_000) = ÷10_000_000
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
        env.storage()
            .persistent()
            .set(&DataKey::Worker(worker_id.clone()), &worker);

        env.events().publish(
            (symbol_short!("Unstaked"), worker_id, caller),
            (staked, rewards),
        );
        Ok(())
    }

    /// Get staking info for a worker.
    pub fn get_stake_info(env: Env, worker_id: Symbol) -> Result<Option<StakeInfo>, ContractError> {
        Ok(env
            .storage()
            .persistent()
            .get(&DataKey::StakeInfo(worker_id)))
    }

    // -------------------------------------------------------------------------
    // Performance Metrics (#378)
    // -------------------------------------------------------------------------

    /// Update performance metrics for a worker.
    pub fn update_metrics(
        env: Env,
        admin: Address,
        worker_id: Symbol,
        jobs_completed: u32,
        rating: u32,
    ) -> Result<(), ContractError> {
        Self::require_role(&env, &Symbol::new(&env, ROLE_REP_MGR), &admin)?;
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
        metrics.performance_score = Self::calculate_performance_score(&metrics);

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

    /// Calculate performance score from metrics.
    fn calculate_performance_score(metrics: &PerformanceMetrics) -> u32 {
        if metrics.total_ratings == 0 {
            return 0;
        }
        let rating_weight = 70u32;
        let completion_weight = 30u32;
        let rating_score = metrics
            .avg_rating
            .checked_mul(rating_weight)
            .expect("overflow")
            / 100;
        let completion_score = metrics
            .jobs_completed
            .min(100)
            .checked_mul(completion_weight)
            .expect("overflow");
        rating_score
            .checked_add(completion_score)
            .expect("overflow")
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
    // Badge System (#380)
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
        let is_admin = Self::has_role(env.clone(), Symbol::new(&env, ROLE_ADMIN), issuer.clone())?;
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

        env.storage()
            .persistent()
            .set(&DataKey::Badge(worker_id.clone(), badge_id.clone()), &badge);

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

        let is_admin = Self::has_role(env.clone(), Symbol::new(&env, ROLE_ADMIN), caller.clone())?;
        if !(is_admin || badge.issuer == caller) {
            return Err(ContractError::NotAuthorized);
        }

        badge.active = false;
        env.storage()
            .persistent()
            .set(&DataKey::Badge(worker_id.clone(), badge_id.clone()), &badge);

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
    pub fn get_worker_badges(env: Env, worker_id: Symbol) -> Result<Vec<Badge>, ContractError> {
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
    // Schema migration (#535)
    // -------------------------------------------------------------------------

    /// Return the current storage schema version.
    pub fn get_schema_version(env: Env) -> Result<u32, ContractError> {
        Ok(env
            .storage()
            .persistent()
            .get(&DataKey::SchemaVersion)
            .unwrap_or(1u32))
    }

    /// Run version-specific storage migration logic.
    pub fn migrate(env: Env, admin: Address, expected_version: u32) -> Result<(), ContractError> {
        Self::require_role(&env, &Symbol::new(&env, ROLE_ADMIN), &admin)?;

        let current: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::SchemaVersion)
            .unwrap_or(1u32);

        if current != expected_version {
            return Err(ContractError::WrongSchemaVersion);
        }

        // ---- version-specific migration logic --------------------------------
        // Version 1 → 2: placeholder (add real field backfills here as needed)
        if expected_version == 1 {
            // Example: no structural change needed for v1→v2 in this release.
            // Future migrations add logic here.
        }
        // ----------------------------------------------------------------------

        let new_version = expected_version.checked_add(1).expect("Version overflow");
        env.storage()
            .persistent()
            .set(&DataKey::SchemaVersion, &new_version);

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
    pub fn upgrade(env: Env, new_wasm_hash: soroban_sdk::BytesN<32>) -> Result<(), ContractError> {
        let upgrader_role = Self::role_symbol(&env, ROLE_UPGRADER_CACHED);
        let admin: Address = env
            .storage()
            .persistent()
            .get(&DataKey::Admin)
            .ok_or(ContractError::NotInitialized)?;
        Self::require_role(&env, &upgrader_role, &admin)?;
        env.deployer().update_current_contract_wasm(new_wasm_hash);
        Ok(())
    }

    // -------------------------------------------------------------------------
    // #529: Pagination
    // -------------------------------------------------------------------------

    /// Return a paginated result of worker ids.
    pub fn list_workers_page(
        env: Env,
        offset: u32,
        limit: u32,
    ) -> Result<WorkerPage, ContractError> {
        let total: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::WorkerCount)
            .unwrap_or(0u32);

        let list: Vec<Symbol> = env
            .storage()
            .persistent()
            .get(&DataKey::WorkerList)
            .unwrap_or(Vec::new(&env));

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
    // #531: On-chain category validation
    // -------------------------------------------------------------------------

    /// Add a valid category to on-chain storage. Admin only.
    pub fn add_category(env: Env, admin: Address, name: Symbol) -> Result<(), ContractError> {
        let admin_role = Self::role_symbol(&env, ROLE_ADMIN_CACHED);
        Self::require_role(&env, &admin_role, &admin)?;
        Self::require_not_paused(&env)?;

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
    pub fn remove_category(env: Env, admin: Address, name: Symbol) -> Result<(), ContractError> {
        let admin_role = Self::role_symbol(&env, ROLE_ADMIN_CACHED);
        Self::require_role(&env, &admin_role, &admin)?;
        Self::require_not_paused(&env)?;

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
        env.storage()
            .persistent()
            .set(&DataKey::Categories, &updated);

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
    // #530: Upgrade timelock
    // -------------------------------------------------------------------------

    /// Approximate ledger count for 48 hours (~5 s/ledger).
    pub const TIMELOCK_LEDGERS: u32 = 34_560; // 48 * 3600 / 5

    /// Propose a contract upgrade with a 48-hour timelock. Admin only.
    pub fn propose_upgrade(
        env: Env,
        admin: Address,
        new_wasm_hash: BytesN<32>,
    ) -> Result<(), ContractError> {
        let upgrader_role = Self::role_symbol(&env, ROLE_UPGRADER_CACHED);
        Self::require_role(&env, &upgrader_role, &admin)?;
        Self::require_not_paused(&env)?;

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
        let upgrader_role = Self::role_symbol(&env, ROLE_UPGRADER_CACHED);
        Self::require_role(&env, &upgrader_role, &admin)?;

        if !env.storage().persistent().has(&DataKey::PendingUpgrade) {
            return Err(ContractError::NoPendingUpgrade);
        }

        env.storage().persistent().remove(&DataKey::PendingUpgrade);
        env.events().publish((symbol_short!("UpgCancld"),), ());
        Ok(())
    }

    /// Get the pending upgrade, if any.
    pub fn get_pending_upgrade(env: Env) -> Result<Option<PendingUpgrade>, ContractError> {
        Ok(env.storage().persistent().get(&DataKey::PendingUpgrade))
    }

    // -------------------------------------------------------------------------
    // Verification levels & certified skills (#778)
    // -------------------------------------------------------------------------

    /// Set the verification level for a worker. Admin or curator-manager only.
    pub fn set_verification_level(
        env: Env,
        caller: Address,
        worker_id: Symbol,
        level: VerificationLevel,
    ) -> Result<(), ContractError> {
        let curator_mgr = Self::role_symbol(&env, ROLE_CURATOR_MGR_CACHED);
        Self::require_role(&env, &curator_mgr, &caller)?;
        Self::require_not_paused(&env)?;
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

    /// Add or update a certified skill for a worker. Admin or curator-manager only.
    pub fn add_certified_skill(
        env: Env,
        caller: Address,
        worker_id: Symbol,
        skill: Symbol,
        expires_at: u64,
    ) -> Result<(), ContractError> {
        let curator_mgr = Self::role_symbol(&env, ROLE_CURATOR_MGR_CACHED);
        Self::require_role(&env, &curator_mgr, &caller)?;
        Self::require_not_paused(&env)?;
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

        // Replace existing entry for the same skill, or append.
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

    /// Revoke a certified skill from a worker. Admin or curator-manager only.
    pub fn revoke_certified_skill(
        env: Env,
        caller: Address,
        worker_id: Symbol,
        skill: Symbol,
    ) -> Result<(), ContractError> {
        let curator_mgr = Self::role_symbol(&env, ROLE_CURATOR_MGR_CACHED);
        Self::require_role(&env, &curator_mgr, &caller)?;
        Self::require_not_paused(&env)?;

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

// Integration-style unit tests and the contract-upgrade testing framework
// live in `test.rs`; the `mod tests` block below holds the original inline tests.
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

            // Grant all operational roles to the bootstrap admin for convenience in tests.
            client.grant_role(&admin, &Symbol::new(&env, ROLE_PAUSER), &admin);
            client.grant_role(&admin, &Symbol::new(&env, ROLE_CURATOR_MGR), &admin);
            client.grant_role(&admin, &Symbol::new(&env, ROLE_REP_MGR), &admin);
            client.grant_role(&admin, &Symbol::new(&env, ROLE_UPGRADER), &admin);

            TestEnv {
                env,
                contract_id,
                admin,
                curator,
                owner,
            }
        }

        fn client(&self) -> RegistryContractClient {
            RegistryContractClient::new(&self.env, &self.contract_id)
        }

        fn worker_id(&self) -> Symbol {
            Symbol::new(&self.env, "worker1")
        }

        fn zero_hash(&self) -> BytesN<32> {
            BytesN::from_array(&self.env, &[0u8; 32])
        }

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
        t.client()
            .update_reputation(&t.admin, &t.worker_id(), &8500);
        let worker = t.client().get_worker(&t.worker_id()).unwrap();
        assert_eq!(worker.reputation, 8500);
    }

    #[test]
    fn test_update_reputation_out_of_range() {
        let t = TestEnv::new();
        t.client().add_curator(&t.admin, &t.curator);
        t.register_worker(&t.curator);
        assert_eq!(
            t.client()
                .try_update_reputation(&t.admin, &t.worker_id(), &10_001),
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
            t.client()
                .try_update_reputation(&stranger, &t.worker_id(), &5000),
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

    // -------------------------------------------------------------------------
    // Category verification tests (#338)
    // -------------------------------------------------------------------------

    #[test]
    fn test_verify_category_stores_record() {
        let t = TestEnv::new();
        t.client().add_curator(&t.admin, &t.curator);
        t.register_worker(&t.curator);

        let cat = Symbol::new(&t.env, "plumber");
        t.client()
            .verify_category(&t.curator, &t.worker_id(), &cat, &9999);

        let v = t
            .client()
            .get_category_verification(&t.worker_id(), &cat)
            .unwrap();
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
        t.client()
            .verify_category(&t.curator, &t.worker_id(), &cat, &9999);
        t.client()
            .verify_category(&t.curator, &t.worker_id(), &cat, &9999);

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

    // -------------------------------------------------------------------------
    // Batch registration tests (#340)
    // -------------------------------------------------------------------------

    #[test]
    fn test_batch_register_all_succeed() {
        let t = TestEnv::new();
        t.client().add_curator(&t.admin, &t.curator);

        let ids = soroban_sdk::vec![&t.env, Symbol::new(&t.env, "b1"), Symbol::new(&t.env, "b2"),];
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

        let results = t
            .client()
            .batch_register(&t.curator, &ids, &owners, &names, &cats, &hashes, &hashes);

        assert_eq!(results.len(), 2);
        assert!(results.get(0).unwrap().success);
        assert!(results.get(1).unwrap().success);
        assert_eq!(t.client().worker_count(), 2);
    }

    #[test]
    fn test_batch_register_partial_success_on_duplicate() {
        let t = TestEnv::new();
        t.client().add_curator(&t.admin, &t.curator);
        t.register_worker(&t.curator); // registers "worker1"

        let ids = soroban_sdk::vec![
            &t.env,
            t.worker_id(), // duplicate
            Symbol::new(&t.env, "b2"),
        ];
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

        let results = t
            .client()
            .batch_register(&t.curator, &ids, &owners, &names, &cats, &hashes, &hashes);

        assert!(!results.get(0).unwrap().success); // duplicate
        assert!(results.get(1).unwrap().success);
        assert_eq!(t.client().worker_count(), 2); // original + b2
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
            t.client()
                .try_batch_register(&t.curator, &ids, &owners, &names, &cats, &hashes, &hashes),
            Err(Ok(ContractError::BatchTooLarge))
        );
    }

    // -------------------------------------------------------------------------
    // Staking tests (#341)
    // -------------------------------------------------------------------------

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
            // Mint to contract for reward payouts
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
        s.base
            .client()
            .stake(&s.base.owner, &s.base.worker_id(), &s.token_addr, &500_000);

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
        s.base
            .client()
            .stake(&s.base.owner, &s.base.worker_id(), &s.token_addr, &500_000);

        s.set_time(2000);
        s.base
            .client()
            .request_unstake(&s.base.owner, &s.base.worker_id());

        // advance past cooldown
        s.set_time(2000 + 604_800 + 1);
        s.base.client().unstake(&s.base.owner, &s.base.worker_id());

        // owner gets back at least their stake
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
        s.base
            .client()
            .stake(&s.base.owner, &s.base.worker_id(), &s.token_addr, &100_000);
        s.base
            .client()
            .request_unstake(&s.base.owner, &s.base.worker_id());
        assert_eq!(
            s.base
                .client()
                .try_unstake(&s.base.owner, &s.base.worker_id()),
            Err(Ok(ContractError::CooldownNotElapsed))
        );
    }

    #[test]
    fn test_double_request_unstake_panics() {
        let s = StakeTestEnv::new();
        s.base.client().add_curator(&s.base.admin, &s.base.curator);
        s.base.register_worker(&s.base.curator);

        s.set_time(1000);
        s.base
            .client()
            .stake(&s.base.owner, &s.base.worker_id(), &s.token_addr, &100_000);
        s.base
            .client()
            .request_unstake(&s.base.owner, &s.base.worker_id());
        assert_eq!(
            s.base
                .client()
                .try_request_unstake(&s.base.owner, &s.base.worker_id()),
            Err(Ok(ContractError::UnstakeAlreadyRequested))
        );
    }

    // -------------------------------------------------------------------------
    // Location verification tests (#352)
    // -------------------------------------------------------------------------

    #[test]
    fn test_verify_location_stores_record() {
        let t = TestEnv::new();
        t.client().add_curator(&t.admin, &t.curator);
        t.register_worker(&t.curator);

        let verifier = Address::generate(&t.env);
        t.client().verify_location(&verifier, &t.worker_id(), &9999);

        let v = t
            .client()
            .get_location_verification(&t.worker_id())
            .unwrap();
        assert_eq!(v.verifier, verifier);
        assert_eq!(v.expires_at, 9999);
    }

    #[test]
    fn test_verify_location_nonexistent_worker_panics() {
        let t = TestEnv::new();
        let verifier = Address::generate(&t.env);
        let nonexistent = Symbol::new(&t.env, "nonexistent");
        assert_eq!(
            t.client()
                .try_verify_location(&verifier, &nonexistent, &9999),
            Err(Ok(ContractError::WorkerNotFound))
        );
    }

    // -------------------------------------------------------------------------
    // Availability status tests (#376)
    // -------------------------------------------------------------------------

    #[test]
    fn test_update_availability_stores_status() {
        let t = TestEnv::new();
        t.client().add_curator(&t.admin, &t.curator);
        t.register_worker(&t.curator);

        t.client()
            .update_availability(&t.worker_id(), &t.owner, &true, &9999);

        let status = t.client().get_availability(&t.worker_id()).unwrap();
        assert!(status.is_available);
        assert_eq!(status.expires_at, 9999);
    }

    #[test]
    fn test_update_availability_toggle() {
        let t = TestEnv::new();
        t.client().add_curator(&t.admin, &t.curator);
        t.register_worker(&t.curator);

        t.client()
            .update_availability(&t.worker_id(), &t.owner, &true, &0);
        let status1 = t.client().get_availability(&t.worker_id()).unwrap();
        assert!(status1.is_available);

        t.client()
            .update_availability(&t.worker_id(), &t.owner, &false, &0);
        let status2 = t.client().get_availability(&t.worker_id()).unwrap();
        assert!(!status2.is_available);
    }

    #[test]
    fn test_update_availability_non_owner_panics() {
        let t = TestEnv::new();
        t.client().add_curator(&t.admin, &t.curator);
        t.register_worker(&t.curator);

        let stranger = Address::generate(&t.env);
        assert_eq!(
            t.client()
                .try_update_availability(&t.worker_id(), &stranger, &true, &0),
            Err(Ok(ContractError::NotAuthorized))
        );
    }

    #[test]
    fn test_update_availability_nonexistent_worker_panics() {
        let t = TestEnv::new();
        let nonexistent = Symbol::new(&t.env, "nonexistent");
        assert_eq!(
            t.client()
                .try_update_availability(&nonexistent, &t.owner, &true, &0),
            Err(Ok(ContractError::WorkerNotFound))
        );
    }

    // -------------------------------------------------------------------------
    // Contract upgrade tests (#375)
    // -------------------------------------------------------------------------

    /// State-migration data integrity: a schema migration must preserve all
    /// existing worker storage. (A real WASM-swap upgrade is exercised in
    /// `test.rs` behind the `wasm-upgrade-tests` feature, since the in-process
    /// host cannot install a WASM blob from a dummy hash.)
    #[test]
    fn test_upgrade_preserves_storage() {
        let t = TestEnv::new();
        t.client().add_curator(&t.admin, &t.curator);
        t.register_worker(&t.curator);

        let worker_before = t.client().get_worker(&t.worker_id()).unwrap();
        assert_eq!(worker_before.name, String::from_str(&t.env, "Alice"));
        assert_eq!(t.client().get_schema_version(), 1u32);

        // Run a schema migration (the data-integrity path of an upgrade).
        t.client().migrate(&t.admin, &1u32);

        // Storage must be preserved across the migration.
        let worker_after = t.client().get_worker(&t.worker_id()).unwrap();
        assert_eq!(worker_after.name, worker_before.name);
        assert_eq!(worker_after.owner, worker_before.owner);
        assert_eq!(worker_after.reputation, worker_before.reputation);
        assert_eq!(t.client().get_schema_version(), 2u32);
    }

    #[test]
    fn test_upgrade_requires_upgrader_role() {
        // Build a contract whose admin was NOT granted ROLE_UPGRADER.
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let contract_id = env.register_contract(None, RegistryContract);
        let client = RegistryContractClient::new(&env, &contract_id);
        client.initialize(&admin);

        // `upgrade` requires the stored admin to hold ROLE_UPGRADER, which was
        // never granted here, so this must return Err with MissingRole.
        let dummy_hash = BytesN::from_array(&env, &[1u8; 32]);
        assert_eq!(
            client.try_upgrade(&dummy_hash),
            Err(Ok(ContractError::MissingRole))
        );
    }

    // -------------------------------------------------------------------------
    // Migration tests (#535)
    // -------------------------------------------------------------------------

    #[test]
    fn test_initial_schema_version_is_1() {
        let t = TestEnv::new();
        assert_eq!(t.client().get_schema_version(), 1u32);
    }

    #[test]
    fn test_migrate_v1_to_v2_bumps_version() {
        let t = TestEnv::new();
        assert_eq!(t.client().get_schema_version(), 1u32);
        t.client().migrate(&t.admin, &1u32);
        assert_eq!(t.client().get_schema_version(), 2u32);
    }

    #[test]
    fn test_migrate_double_run_panics() {
        let t = TestEnv::new();
        t.client().migrate(&t.admin, &1u32);
        // Running again with the same expected_version should error
        assert_eq!(
            t.client().try_migrate(&t.admin, &1u32),
            Err(Ok(ContractError::WrongSchemaVersion))
        );
    }

    #[test]
    fn test_migrate_wrong_version_panics() {
        let t = TestEnv::new();
        // Current version is 1, passing 2 should error
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
        // v1 → v2
        t.client().migrate(&t.admin, &1u32);
        assert_eq!(t.client().get_schema_version(), 2u32);
        // v2 → v3
        t.client().migrate(&t.admin, &2u32);
        assert_eq!(t.client().get_schema_version(), 3u32);
    }

    // -------------------------------------------------------------------------
    // #529: Pagination tests
    // -------------------------------------------------------------------------

    #[test]
    fn test_list_workers_page_basic() {
        let t = TestEnv::new();
        t.client().add_curator(&t.admin, &t.curator);

        for i in 0..5u8 {
            let id_str = std::format!("p{i}");
            let id = Symbol::new(&t.env, &id_str);
            t.client().register(
                &id,
                &t.owner,
                &String::from_str(&t.env, "W"),
                &Symbol::new(&t.env, "plumber"),
                &t.zero_hash(),
                &t.zero_hash(),
                &t.curator,
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
                &id,
                &t.owner,
                &String::from_str(&t.env, "W"),
                &Symbol::new(&t.env, "plumber"),
                &t.zero_hash(),
                &t.zero_hash(),
                &t.curator,
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

    // -------------------------------------------------------------------------
    // #531: On-chain category tests
    // -------------------------------------------------------------------------

    #[test]
    fn test_add_and_list_categories() {
        let t = TestEnv::new();
        t.client()
            .add_category(&t.admin, &Symbol::new(&t.env, "plumber"));
        t.client()
            .add_category(&t.admin, &Symbol::new(&t.env, "welder"));

        let cats = t.client().list_categories();
        assert_eq!(cats.len(), 2);
    }

    #[test]
    fn test_add_category_idempotent() {
        let t = TestEnv::new();
        t.client()
            .add_category(&t.admin, &Symbol::new(&t.env, "plumber"));
        t.client()
            .add_category(&t.admin, &Symbol::new(&t.env, "plumber"));
        assert_eq!(t.client().list_categories().len(), 1);
    }

    #[test]
    fn test_remove_category() {
        let t = TestEnv::new();
        t.client()
            .add_category(&t.admin, &Symbol::new(&t.env, "plumber"));
        t.client()
            .remove_category(&t.admin, &Symbol::new(&t.env, "plumber"));
        assert_eq!(t.client().list_categories().len(), 0);
    }

    #[test]
    fn test_register_valid_category_succeeds() {
        let t = TestEnv::new();
        t.client().add_curator(&t.admin, &t.curator);
        t.client()
            .add_category(&t.admin, &Symbol::new(&t.env, "plumber"));
        // Should not panic
        t.register_worker(&t.curator);
    }

    #[test]
    fn test_register_invalid_category_panics() {
        let t = TestEnv::new();
        t.client().add_curator(&t.admin, &t.curator);
        t.client()
            .add_category(&t.admin, &Symbol::new(&t.env, "welder"));
        // "plumber" is not in the on-chain list
        let res = t.client().try_register(
            &t.worker_id(),
            &t.owner,
            &String::from_str(&t.env, "Alice"),
            &Symbol::new(&t.env, "plumber"),
            &t.zero_hash(),
            &t.zero_hash(),
            &t.curator,
        );
        assert_eq!(res, Err(Ok(ContractError::UnknownCategory)));
    }

    #[test]
    fn test_register_no_categories_set_allows_any() {
        let t = TestEnv::new();
        t.client().add_curator(&t.admin, &t.curator);
        // No categories set — any category is allowed
        t.register_worker(&t.curator);
    }

    // -------------------------------------------------------------------------
    // #530: Upgrade timelock tests
    // -------------------------------------------------------------------------

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
