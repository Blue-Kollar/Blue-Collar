//! # Registry Contract â€” Storage Layer
//!
//! All persisted types, storage key definitions, constants, and pure
//! storage-accessor helpers live here.  No business logic, no
//! `require_auth` calls â€” those belong in `logic.rs` and `lib.rs`.

use soroban_sdk::{contracttype, Address, BytesN, Env, String, Symbol, Vec};

// =============================================================================
// Constants
// =============================================================================

/// Event schema version â€” bump when adding/removing/renaming events.
pub const VERSION: u32 = 1;

/// Approximate TTL extension target (~1 year at 5 s/ledger).
pub const TTL_EXTEND_TO: u32 = 535_000;

/// Extend TTL only when it drops below this threshold (~6 months).
pub const TTL_THRESHOLD: u32 = 267_500;

/// Cached role strings used for gas-efficient Symbol creation.
pub const ROLE_ADMIN_CACHED: &str = "admin";
pub const ROLE_PAUSER_CACHED: &str = "pauser";
pub const ROLE_CURATOR_MGR_CACHED: &str = "curator_mgr";
pub const ROLE_REP_MGR_CACHED: &str = "rep_mgr";
pub const ROLE_UPGRADER_CACHED: &str = "upgrader";

/// Role IDs for compact storage key optimisation.
pub const ROLE_ADMIN_ID: u64 = 0;
pub const ROLE_PAUSER_ID: u64 = 1;
pub const ROLE_CURATOR_MGR_ID: u64 = 2;
pub const ROLE_REP_MGR_ID: u64 = 3;
pub const ROLE_UPGRADER_ID: u64 = 4;

/// Full admin â€” can grant/revoke any role and call all privileged functions.
pub const ROLE_ADMIN: &str = "admin";
/// May pause and unpause the contract.
pub const ROLE_PAUSER: &str = "pauser";
/// May add and remove curators.
pub const ROLE_CURATOR_MGR: &str = "curator_mgr";
/// May update worker reputation scores.
pub const ROLE_REP_MGR: &str = "rep_mgr";
/// May upgrade the contract WASM.
pub const ROLE_UPGRADER: &str = "upgrader";

// =============================================================================
// Types
// =============================================================================

/// Subscription tier for a worker.
#[contracttype]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum SubscriptionTier {
    /// Free tier â€” no subscription.
    Free = 0,
    /// Basic tier â€” standard visibility.
    Basic = 1,
    /// Premium tier â€” enhanced visibility and features.
    Premium = 2,
}

/// Worker subscription information.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct WorkerSubscription {
    pub tier: SubscriptionTier,
    /// Unix timestamp when subscription expires (0 = never expires).
    pub expires_at: u64,
    pub last_renewed_at: u64,
}

/// On-chain worker profile stored in persistent contract storage.
///
/// `location_hash` and `contact_hash` are SHA-256 digests â€” raw PII is never
/// stored on-chain.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct Worker {
    /// Unique worker identifier (matches the off-chain database id).
    pub id: Symbol,
    pub owner: Address,
    pub name: String,
    pub category: Symbol,
    pub is_active: bool,
    pub wallet: Address,
    /// SHA-256( lowercase(city) + ":" + lowercase(country_iso2) )
    pub location_hash: BytesN<32>,
    /// SHA-256( lowercase(email_or_e164_phone) )
    pub contact_hash: BytesN<32>,
    /// Reputation score in basis points (0â€“10000, where 10000 = 100.00%).
    pub reputation: u32,
    pub verified_categories: Vec<Symbol>,
    pub staked_amount: i128,
    pub review_count: u32,
    /// Average rating in basis points (0â€“10000).
    pub avg_rating: u32,
    pub subscription: WorkerSubscription,
}

/// Delegate record for worker profile management.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct Delegate {
    pub address: Address,
    /// Unix timestamp when delegation expires (0 = no expiry).
    pub expires_at: u64,
}

/// Performance metrics for a worker.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct PerformanceMetrics {
    pub jobs_completed: u32,
    pub avg_rating: u32,
    pub total_ratings: u32,
    pub last_updated: u64,
    pub performance_score: u32,
}

/// On-chain record of a curator verifying a worker's category.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct CategoryVerification {
    pub category: Symbol,
    pub curator: Address,
    pub expires_at: u64,
}

/// Location verification record for a worker.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct LocationVerification {
    pub verifier: Address,
    pub verified_at: u64,
    pub expires_at: u64,
}

/// Worker availability status.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct AvailabilityStatus {
    pub is_available: bool,
    pub updated_at: u64,
    pub expires_at: u64,
}

/// Staking record for a worker.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct StakeInfo {
    pub token: Address,
    pub amount: i128,
    /// Ledger timestamp when unstake was requested (0 = no pending unstake).
    pub unstake_requested_at: u64,
    pub rewards_accumulated: i128,
    pub last_reward_ledger: u64,
}

/// Badge awarded to a worker for achievements.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct Badge {
    pub id: Symbol,
    pub name: String,
    pub issuer: Address,
    pub awarded_at: u64,
    pub expires_at: u64,
    pub active: bool,
}

/// Verification level for a worker.
#[contracttype]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum VerificationLevel {
    /// No verification â€” default state.
    None = 0,
    /// Identity checked by a curator.
    Basic = 1,
    /// Credentials and category skills verified.
    Verified = 2,
    /// Expert-level â€” multiple verified credentials and peer reviews.
    Expert = 3,
}

/// A certified skill entry for a worker.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct CertifiedSkill {
    pub skill: Symbol,
    pub certified_by: Address,
    pub certified_at: u64,
    pub expires_at: u64,
}

/// A single immutable reputation history entry.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct ReputationEvent {
    pub previous_score: u32,
    pub new_score: u32,
    pub reason: Symbol,
    pub timestamp: u64,
}

/// Aggregated inputs used to compute the weighted reputation score.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct ReputationInputs {
    /// Total tips/payments received (used as job-completion proxy).
    pub tip_count: u32,
    /// Running sum of review ratings (basis points).
    pub rating_sum: u64,
    pub rating_count: u32,
    pub last_review_at: u64,
}

/// Result of a single registration attempt in `batch_register`.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct BatchRegisterResult {
    pub id: Symbol,
    pub success: bool,
}

/// Paginated result for `list_workers_page`.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct WorkerPage {
    pub ids: Vec<Symbol>,
    pub total: u32,
}

/// Pending upgrade record for the timelock mechanism.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct PendingUpgrade {
    pub wasm_hash: BytesN<32>,
    pub execute_after_ledger: u32,
}

// =============================================================================
// Storage Keys
// =============================================================================

/// Storage keys used throughout the contract.
#[contracttype]
pub enum DataKey {
    /// Instance storage â€” bootstrap admin address, set once at `initialize`.
    Admin,
    /// Instance storage â€” paused flag; when `true` all state-mutating functions revert.
    Paused,
    /// Persistent storage â€” `Vec<Address>` of members for a given role.
    RoleMembers(u64),
    /// Persistent storage â€” ordered list of approved curator `Address`es.
    Curators,
    /// Persistent storage â€” `Worker` record keyed by its `id`.
    Worker(Symbol),
    /// Persistent storage â€” ordered list of all registered worker id `Symbol`s.
    WorkerList,
    /// Persistent storage â€” `CategoryVerification` keyed by `(worker_id, category)`.
    CategoryVerification(Symbol, Symbol),
    /// Persistent storage â€” `StakeInfo` keyed by worker id.
    StakeInfo(Symbol),
    /// Persistent storage â€” `PerformanceMetrics` keyed by worker id.
    PerformanceMetrics(Symbol),
    /// Persistent storage â€” list of delegate addresses for a worker.
    Delegates(Symbol),
    /// Persistent storage â€” list of badges for a worker.
    WorkerBadges(Symbol),
    /// Persistent storage â€” individual badge keyed by (worker_id, badge_id).
    Badge(Symbol, Symbol),
    /// Persistent storage â€” `WorkerSubscription` keyed by worker id.
    Subscription(Symbol),
    /// Persistent storage â€” current storage schema version (u32).
    SchemaVersion,
    /// Persistent storage â€” `LocationVerification` keyed by worker id.
    LocationVerification(Symbol),
    /// Persistent storage â€” `AvailabilityStatus` keyed by worker id.
    AvailabilityStatus(Symbol),
    /// Persistent storage â€” `Vec<Symbol>` of valid on-chain categories.
    Categories,
    /// Persistent storage â€” total worker count (u32) for efficient pagination.
    WorkerCount,
    /// Persistent storage â€” pending upgrade record for the timelock mechanism.
    PendingUpgrade,
    /// Persistent storage â€” `Vec<ReputationEvent>` history keyed by worker id.
    ReputationHistory(Symbol),
    /// Persistent storage â€” `ReputationInputs` keyed by worker id.
    ReputationInputs(Symbol),
    /// Persistent storage â€” `VerificationLevel` keyed by worker id.
    VerificationLevel(Symbol),
    /// Persistent storage â€” `Vec<CertifiedSkill>` keyed by worker id.
    CertifiedSkills(Symbol),
}

// =============================================================================
// Storage Accessors
// =============================================================================

/// Return the member list for a role by its compact u64 id, or an empty vec.
pub fn get_role_members(env: &Env, role_id: u64) -> Vec<Address> {
    env.storage()
        .persistent()
        .get(&DataKey::RoleMembers(role_id))
        .unwrap_or(Vec::new(env))
}

/// Persist an updated member list for a role.
pub fn set_role_members(env: &Env, role_id: u64, members: &Vec<Address>) {
    env.storage()
        .persistent()
        .set(&DataKey::RoleMembers(role_id), members);
}

/// Return the current curator list, or an empty vec.
pub fn get_curators(env: &Env) -> Vec<Address> {
    env.storage()
        .persistent()
        .get(&DataKey::Curators)
        .unwrap_or(Vec::new(env))
}

/// Persist the curator list.
pub fn set_curators(env: &Env, curators: &Vec<Address>) {
    env.storage()
        .persistent()
        .set(&DataKey::Curators, curators);
}

/// Return the delegate list for a worker, or an empty vec.
pub fn get_delegates(env: &Env, worker_id: &Symbol) -> Vec<Delegate> {
    env.storage()
        .persistent()
        .get(&DataKey::Delegates(worker_id.clone()))
        .unwrap_or(Vec::new(env))
}

/// Persist the delegate list for a worker.
pub fn set_delegates(env: &Env, worker_id: &Symbol, delegates: &Vec<Delegate>) {
    env.storage()
        .persistent()
        .set(&DataKey::Delegates(worker_id.clone()), delegates);
}

/// Fetch a worker record by id.
pub fn get_worker(env: &Env, id: &Symbol) -> Option<Worker> {
    env.storage().persistent().get(&DataKey::Worker(id.clone()))
}

/// Persist a worker record and extend its TTL.
pub fn set_worker(env: &Env, worker: &Worker) {
    let key = DataKey::Worker(worker.id.clone());
    env.storage().persistent().set(&key, worker);
    env.storage()
        .persistent()
        .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
}

/// Return the full worker id list.
pub fn get_worker_list(env: &Env) -> Vec<Symbol> {
    env.storage()
        .persistent()
        .get(&DataKey::WorkerList)
        .unwrap_or(Vec::new(env))
}

/// Persist the worker id list and extend its TTL.
pub fn set_worker_list(env: &Env, list: &Vec<Symbol>) {
    env.storage().persistent().set(&DataKey::WorkerList, list);
    env.storage()
        .persistent()
        .extend_ttl(&DataKey::WorkerList, TTL_THRESHOLD, TTL_EXTEND_TO);
}

/// Return the current worker count.
pub fn get_worker_count(env: &Env) -> u32 {
    env.storage()
        .persistent()
        .get(&DataKey::WorkerCount)
        .unwrap_or(0u32)
}

/// Increment the worker count by 1.
pub fn increment_worker_count(env: &Env) {
    let count = get_worker_count(env);
    env.storage()
        .persistent()
        .set(&DataKey::WorkerCount, &(count + 1));
}

/// Decrement the worker count by 1 (saturates at 0).
pub fn decrement_worker_count(env: &Env) {
    let count = get_worker_count(env);
    if count > 0 {
        env.storage()
            .persistent()
            .set(&DataKey::WorkerCount, &(count - 1));
    }
}

/// Return the schema version (defaults to 1 if not set).
pub fn get_schema_version(env: &Env) -> u32 {
    env.storage()
        .persistent()
        .get(&DataKey::SchemaVersion)
        .unwrap_or(1u32)
}

/// Persist the schema version.
pub fn set_schema_version(env: &Env, version: u32) {
    env.storage()
        .persistent()
        .set(&DataKey::SchemaVersion, &version);
}
