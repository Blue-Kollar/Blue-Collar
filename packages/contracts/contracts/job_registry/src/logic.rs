//! # Job-Registry — Business Logic
//!
//! All validation, state-transition rules, and RBAC helpers live here.
//! The `lib.rs` entry-point delegates to these functions after setting up
//! the `Env` context. No direct storage access from `lib.rs` — always via
//! `storage::*` or the helpers in this module.

use bluecollar_types::{helpers, ContractError};
use soroban_sdk::{symbol_short, Address, BytesN, Env, Symbol, Vec};

use crate::storage::{
    self, add_poster_job, load_job, load_job_list, load_role_members, save_job, save_job_list,
    save_role_members, Job, JobStatus,
};

// =============================================================================
// Roles
// =============================================================================

pub const ROLE_ADMIN: &str = "admin";
pub const ROLE_POSTER: &str = "poster";
pub const ROLE_UPGRADER: &str = "upgrader";
pub const ROLE_PAUSER: &str = "pauser";

pub const ROLE_ADMIN_ID: u64 = 0;
pub const ROLE_POSTER_ID: u64 = 1;
pub const ROLE_UPGRADER_ID: u64 = 2;
pub const ROLE_PAUSER_ID: u64 = 3;

/// Map a role `Symbol` to its compact storage id.
pub fn role_to_id(env: &Env, role: &Symbol) -> u64 {
    if *role == Symbol::new(env, ROLE_ADMIN) {
        ROLE_ADMIN_ID
    } else if *role == Symbol::new(env, ROLE_POSTER) {
        ROLE_POSTER_ID
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

/// Assert that `caller` holds `role` and has signed the transaction.
pub fn require_role(env: &Env, role: &Symbol, caller: &Address) -> Result<(), ContractError> {
    let id = role_to_id(env, role);
    let members = load_role_members(env, id);
    helpers::require_role(caller, &members)
}

/// Assert that the contract is not paused.
pub fn require_not_paused(env: &Env) -> Result<(), ContractError> {
    helpers::require_not_paused(storage::is_paused(env))
}

// =============================================================================
// Initialisation logic
// =============================================================================

/// Bootstrap the contract: write admin, initial roles, schema version.
pub fn do_initialize(env: &Env, admin: &Address) -> Result<(), ContractError> {
    if storage::is_initialized(env) {
        return Err(ContractError::AlreadyInitialized);
    }

    storage::set_initialized(env);
    storage::save_admin(env, admin);
    env.storage()
        .persistent()
        .set(&storage::DataKey::SchemaVersion, &1u32);

    // Grant ROLE_ADMIN to the initial admin.
    let mut members: Vec<Address> = Vec::new(env);
    members.push_back(admin.clone());
    save_role_members(env, ROLE_ADMIN_ID, &members);

    env.events()
        .publish((symbol_short!("Init"), admin.clone()), 1u32);
    Ok(())
}

// =============================================================================
// Job lifecycle logic
// =============================================================================

/// Post a new job listing.
pub fn do_post_job(
    env: &Env,
    poster: &Address,
    id: Symbol,
    category: Symbol,
    description_hash: BytesN<32>,
    budget: i128,
    token: Address,
) -> Result<Job, ContractError> {
    // --- Checks ---
    require_not_paused(env)?;
    poster.require_auth();
    if load_job(env, &id).is_some() {
        return Err(ContractError::JobAlreadyExists);
    }
    if budget < 0 {
        return Err(ContractError::AmountMustBePositive);
    }

    // --- Effects ---
    let job = Job {
        id: id.clone(),
        poster: poster.clone(),
        category,
        description_hash,
        budget,
        token,
        status: JobStatus::Open,
        worker: None,
        created_at: env.ledger().sequence(),
        updated_at: env.ledger().sequence(),
    };
    save_job(env, &job);

    let mut list = load_job_list(env);
    list.push_back(id.clone());
    save_job_list(env, &list);

    add_poster_job(env, poster, &id);

    // --- Interactions ---
    env.events()
        .publish((symbol_short!("JobPost"), id), (poster.clone(), budget));

    Ok(job)
}

/// Assign a worker to an open job. Only the job poster may call this.
pub fn do_assign_worker(
    env: &Env,
    caller: &Address,
    job_id: Symbol,
    worker: Address,
) -> Result<(), ContractError> {
    // --- Checks ---
    require_not_paused(env)?;
    caller.require_auth();

    let mut job = load_job(env, &job_id).ok_or(ContractError::JobNotFound)?;
    if job.poster != *caller {
        return Err(ContractError::UnauthorizedCaller);
    }
    if job.status != JobStatus::Open {
        return Err(ContractError::JobNotOpen);
    }

    // --- Effects ---
    job.worker = Some(worker.clone());
    job.status = JobStatus::Assigned;
    job.updated_at = env.ledger().sequence();
    save_job(env, &job);

    // --- Interactions ---
    env.events().publish(
        (symbol_short!("Assigned"), job_id),
        (caller.clone(), worker),
    );
    Ok(())
}

/// Mark a job as completed. Only the assigned worker may call this.
pub fn do_complete_job(env: &Env, caller: &Address, job_id: Symbol) -> Result<(), ContractError> {
    // --- Checks ---
    require_not_paused(env)?;
    caller.require_auth();

    let mut job = load_job(env, &job_id).ok_or(ContractError::JobNotFound)?;
    if job.worker.as_ref() != Some(caller) {
        return Err(ContractError::UnauthorizedCaller);
    }
    if job.status != JobStatus::Assigned {
        return Err(ContractError::JobNotAssigned);
    }

    // --- Effects ---
    job.status = JobStatus::Completed;
    job.updated_at = env.ledger().sequence();
    save_job(env, &job);

    // --- Interactions ---
    env.events()
        .publish((symbol_short!("Completed"), job_id), caller.clone());
    Ok(())
}

/// Cancel an open or assigned job. Only the poster may call this.
pub fn do_cancel_job(env: &Env, caller: &Address, job_id: Symbol) -> Result<(), ContractError> {
    // --- Checks ---
    require_not_paused(env)?;
    caller.require_auth();

    let mut job = load_job(env, &job_id).ok_or(ContractError::JobNotFound)?;
    if job.poster != *caller {
        return Err(ContractError::UnauthorizedCaller);
    }
    if job.status == JobStatus::Completed || job.status == JobStatus::Cancelled {
        return Err(ContractError::InvalidStatus);
    }

    // --- Effects ---
    job.status = JobStatus::Cancelled;
    job.updated_at = env.ledger().sequence();
    save_job(env, &job);

    // --- Interactions ---
    env.events()
        .publish((symbol_short!("Cancelled"), job_id), caller.clone());
    Ok(())
}

/// File a dispute on an assigned job. Either party (poster or worker) may call.
pub fn do_dispute_job(env: &Env, caller: &Address, job_id: Symbol) -> Result<(), ContractError> {
    // --- Checks ---
    require_not_paused(env)?;
    caller.require_auth();

    let mut job = load_job(env, &job_id).ok_or(ContractError::JobNotFound)?;
    let is_poster = job.poster == *caller;
    let is_worker = job.worker.as_ref() == Some(caller);
    if !is_poster && !is_worker {
        return Err(ContractError::NotAParty);
    }
    if job.status != JobStatus::Assigned {
        return Err(ContractError::JobNotAssigned);
    }

    // --- Effects ---
    job.status = JobStatus::Disputed;
    job.updated_at = env.ledger().sequence();
    save_job(env, &job);

    // --- Interactions ---
    env.events()
        .publish((symbol_short!("Disputed"), job_id), caller.clone());
    Ok(())
}
