#![no_std]
// soroban-sdk 26 deprecates `Events::publish` in favour of the `#[contractevent]`
// macro, and `Env::register_contract` in favour of `Env::register`. Migrating the
// event API changes the on-chain event ABI, so both are deliberately deferred to a
// dedicated upgrade rather than mixed into unrelated changes.
#![allow(deprecated)]

use bluecollar_types::ContractError;
use soroban_sdk::{contract, contractimpl, symbol_short, Address, BytesN, Env, Symbol, Vec};

mod logic;
mod storage;

#[cfg(test)]
mod test;

use logic::{
    do_assign_worker, do_cancel_job, do_complete_job, do_dispute_job, do_initialize, do_post_job,
    require_not_paused, require_role, role_to_id, ROLE_ADMIN, ROLE_PAUSER, ROLE_UPGRADER,
};
use storage::{
    is_paused, load_admin, load_job, load_job_list, load_poster_jobs, load_role_members,
    save_role_members, set_paused, Job,
};

pub const VERSION: u32 = 1;

#[contract]
pub struct JobRegistryContract;

#[contractimpl]
impl JobRegistryContract {
    // -------------------------------------------------------------------------
    // Initialise
    // -------------------------------------------------------------------------

    /// Initialise the contract with an admin address.
    pub fn initialize(env: Env, admin: Address) -> Result<(), ContractError> {
        do_initialize(&env, &admin)
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
        require_role(&env, &Symbol::new(&env, ROLE_ADMIN), &caller)?;
        require_not_paused(&env)?;
        let id = role_to_id(&env, &role);
        let mut members = load_role_members(&env, id);
        if !members.iter().any(|m| m == account) {
            members.push_back(account.clone());
        }
        save_role_members(&env, id, &members);
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
        require_role(&env, &Symbol::new(&env, ROLE_ADMIN), &caller)?;
        require_not_paused(&env)?;
        let id = role_to_id(&env, &role);
        let members = load_role_members(&env, id);
        let mut updated: Vec<Address> = Vec::new(&env);
        for m in members.iter() {
            if m != account {
                updated.push_back(m);
            }
        }
        save_role_members(&env, id, &updated);
        env.events()
            .publish((symbol_short!("RlRevk"), role), account);
        Ok(())
    }

    /// Return `true` if `account` holds `role`.
    pub fn has_role(env: Env, role: Symbol, account: Address) -> Result<bool, ContractError> {
        let id = role_to_id(&env, &role);
        Ok(load_role_members(&env, id).iter().any(|m| m == account))
    }

    // -------------------------------------------------------------------------
    // Pause / Unpause
    // -------------------------------------------------------------------------

    /// Pause the contract. Caller must hold `ROLE_PAUSER`.
    pub fn pause(env: Env, caller: Address) -> Result<(), ContractError> {
        require_role(&env, &Symbol::new(&env, ROLE_PAUSER), &caller)?;
        set_paused(&env, true);
        env.events().publish((symbol_short!("Paused"), caller), ());
        Ok(())
    }

    /// Unpause the contract. Caller must hold `ROLE_PAUSER`.
    pub fn unpause(env: Env, caller: Address) -> Result<(), ContractError> {
        require_role(&env, &Symbol::new(&env, ROLE_PAUSER), &caller)?;
        set_paused(&env, false);
        env.events()
            .publish((symbol_short!("Unpaused"), caller), ());
        Ok(())
    }

    /// Return `true` if the contract is paused.
    pub fn is_paused(env: Env) -> Result<bool, ContractError> {
        Ok(is_paused(&env))
    }

    /// Return the admin address.
    pub fn get_admin(env: Env) -> Result<Address, ContractError> {
        load_admin(&env).ok_or(ContractError::NotInitialized)
    }

    // -------------------------------------------------------------------------
    // Job lifecycle
    // -------------------------------------------------------------------------

    /// Post a new job listing.
    pub fn post_job(
        env: Env,
        poster: Address,
        id: Symbol,
        category: Symbol,
        description_hash: BytesN<32>,
        budget: i128,
        token: Address,
    ) -> Result<Job, ContractError> {
        do_post_job(&env, &poster, id, category, description_hash, budget, token)
    }

    /// Assign a worker to an open job. Only the job poster may call this.
    pub fn assign_worker(
        env: Env,
        caller: Address,
        job_id: Symbol,
        worker: Address,
    ) -> Result<(), ContractError> {
        do_assign_worker(&env, &caller, job_id, worker)
    }

    /// Mark an assigned job as completed. Only the assigned worker may call this.
    pub fn complete_job(env: Env, caller: Address, job_id: Symbol) -> Result<(), ContractError> {
        do_complete_job(&env, &caller, job_id)
    }

    /// Cancel a job. Only the poster may call this.
    pub fn cancel_job(env: Env, caller: Address, job_id: Symbol) -> Result<(), ContractError> {
        do_cancel_job(&env, &caller, job_id)
    }

    /// File a dispute on an assigned job. Either party may call this.
    pub fn dispute_job(env: Env, caller: Address, job_id: Symbol) -> Result<(), ContractError> {
        do_dispute_job(&env, &caller, job_id)
    }

    // -------------------------------------------------------------------------
    // Queries
    // -------------------------------------------------------------------------

    /// Get a single job by id. Returns the `Job` struct.
    pub fn get_job(env: Env, id: Symbol) -> Result<Job, ContractError> {
        load_job(&env, &id).ok_or(ContractError::JobNotFound)
    }

    /// Return all job ids in registration order.
    pub fn list_jobs(env: Env) -> Result<Vec<Symbol>, ContractError> {
        Ok(load_job_list(&env))
    }

    /// Return all job ids posted by a specific address.
    pub fn poster_jobs(env: Env, poster: Address) -> Result<Vec<Symbol>, ContractError> {
        Ok(load_poster_jobs(&env, &poster))
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
        require_role(&env, &Symbol::new(&env, ROLE_UPGRADER), &caller)?;
        env.deployer().update_current_contract_wasm(new_wasm_hash);
        Ok(())
    }
}
