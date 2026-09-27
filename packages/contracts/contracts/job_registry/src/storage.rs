//! # Job-Registry — Storage Layer
//!
//! All persistent/instance storage reads and writes live here.
//! Business logic and contract entry-points import from this module only.
//! Keeping storage access centralised makes schema migrations straightforward.

use bluecollar_types::storage::extend_ttl;
use soroban_sdk::{contracttype, Address, BytesN, Env, Symbol, Vec};

// =============================================================================
// TTL Constants
// =============================================================================

pub use bluecollar_types::storage::{TTL_EXTEND_TO, TTL_THRESHOLD};

// =============================================================================
// Types
// =============================================================================

/// Job lifecycle status.
#[contracttype]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum JobStatus {
    /// Job posted, open for applications.
    Open = 0,
    /// A worker has been assigned.
    Assigned = 1,
    /// Work completed; pending client sign-off.
    Completed = 2,
    /// Cancelled by the poster.
    Cancelled = 3,
    /// Marked as disputed.
    Disputed = 4,
}

/// A single on-chain job listing.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct Job {
    /// Unique job identifier.
    pub id: Symbol,
    /// Address of the client that posted the job.
    pub poster: Address,
    /// Trade category required (e.g. `plumber`).
    pub category: Symbol,
    /// SHA-256 of the off-chain job description text.
    pub description_hash: BytesN<32>,
    /// Budget in token smallest units (0 = no budget specified).
    pub budget: i128,
    /// Token contract address for budget/payment (zero address = unspecified).
    pub token: Address,
    /// Current lifecycle status.
    pub status: JobStatus,
    /// Address of the assigned worker (`None` until assigned).
    pub worker: Option<Address>,
    /// Ledger sequence when the job was posted.
    pub created_at: u32,
    /// Ledger sequence of last status change.
    pub updated_at: u32,
}

/// Storage key enumeration.
#[contracttype]
pub enum DataKey {
    /// Instance — initialisation flag.
    Initialized,
    /// Instance — paused flag.
    Paused,
    /// Persistent — admin address.
    Admin,
    /// Persistent — role member lists (keyed by compact role id).
    RoleMembers(u64),
    /// Persistent — individual `Job` struct.
    Job(Symbol),
    /// Persistent — ordered list of all job ids.
    JobList,
    /// Persistent — jobs posted by a specific address.
    PosterJobs(Address),
    /// Persistent — schema version for migrations.
    SchemaVersion,
}

// =============================================================================
// Storage accessors
// =============================================================================

/// Read the job list index from persistent storage.
pub fn load_job_list(env: &Env) -> Vec<Symbol> {
    env.storage()
        .persistent()
        .get(&DataKey::JobList)
        .unwrap_or(Vec::new(env))
}

/// Write the job list index.
pub fn save_job_list(env: &Env, list: &Vec<Symbol>) {
    env.storage().persistent().set(&DataKey::JobList, list);
}

/// Read a single job by id. Returns `None` if not found.
pub fn load_job(env: &Env, id: &Symbol) -> Option<Job> {
    env.storage().persistent().get(&DataKey::Job(id.clone()))
}

/// Write a single job record.
pub fn save_job(env: &Env, job: &Job) {
    env.storage()
        .persistent()
        .set(&DataKey::Job(job.id.clone()), job);
    extend_job_ttl(env, &job.id);
}

/// Extend the TTL on a job entry. A missing entry is a no-op.
pub fn extend_job_ttl(env: &Env, id: &Symbol) {
    extend_ttl(env, &DataKey::Job(id.clone()));
}

/// Read the job list for a specific poster.
pub fn load_poster_jobs(env: &Env, poster: &Address) -> Vec<Symbol> {
    env.storage()
        .persistent()
        .get(&DataKey::PosterJobs(poster.clone()))
        .unwrap_or(Vec::new(env))
}

/// Append a job id to the poster's job list.
pub fn add_poster_job(env: &Env, poster: &Address, job_id: &Symbol) {
    let mut list = load_poster_jobs(env, poster);
    list.push_back(job_id.clone());
    env.storage()
        .persistent()
        .set(&DataKey::PosterJobs(poster.clone()), &list);
}

/// Read the admin from persistent storage.
pub fn load_admin(env: &Env) -> Option<Address> {
    env.storage().persistent().get(&DataKey::Admin)
}

/// Write the admin address.
pub fn save_admin(env: &Env, admin: &Address) {
    env.storage().persistent().set(&DataKey::Admin, admin);
}

/// Read the role members list.
pub fn load_role_members(env: &Env, role_id: u64) -> Vec<Address> {
    env.storage()
        .persistent()
        .get(&DataKey::RoleMembers(role_id))
        .unwrap_or(Vec::new(env))
}

/// Write the role members list.
pub fn save_role_members(env: &Env, role_id: u64, members: &Vec<Address>) {
    env.storage()
        .persistent()
        .set(&DataKey::RoleMembers(role_id), members);
}

/// Return `true` if the contract has been initialised.
pub fn is_initialized(env: &Env) -> bool {
    env.storage().instance().has(&DataKey::Initialized)
}

/// Mark the contract as initialised.
pub fn set_initialized(env: &Env) {
    env.storage().instance().set(&DataKey::Initialized, &true);
}

/// Return `true` if the contract is paused.
pub fn is_paused(env: &Env) -> bool {
    env.storage()
        .instance()
        .get::<_, bool>(&DataKey::Paused)
        .unwrap_or(false)
}

/// Set the paused flag.
pub fn set_paused(env: &Env, paused: bool) {
    env.storage().instance().set(&DataKey::Paused, &paused);
}
