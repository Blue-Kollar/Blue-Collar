//! Tests for the job-registry contract (issue #1018).
//! Verifies that the public interface is unchanged after the modular refactor.

#![cfg(test)]
extern crate std;

use super::*;
use bluecollar_types::{test_utils::zero_hash, ContractError};
use soroban_sdk::{testutils::Address as _, Address, Env, Symbol};
use std::format;

fn setup(env: &Env) -> (Address, Address, JobRegistryContractClient) {
    env.mock_all_auths();
    let admin = Address::generate(env);
    let poster = Address::generate(env);
    let contract_id = env.register_contract(None, JobRegistryContract);
    let client = JobRegistryContractClient::new(env, &contract_id);
    client.initialize(&admin);
    (admin, poster, client)
}

// ---------------------------------------------------------------------------
// initialize
// ---------------------------------------------------------------------------

#[test]
fn test_initialize_sets_admin() {
    let env = Env::default();
    let (admin, _poster, client) = setup(&env);
    assert_eq!(client.get_admin(), admin);
}

#[test]
fn test_initialize_twice_panics() {
    let env = Env::default();
    let (admin, _poster, client) = setup(&env);
    assert_eq!(
        client.try_initialize(&admin),
        Err(Ok(ContractError::AlreadyInitialized))
    );
}

// ---------------------------------------------------------------------------
// post_job
// ---------------------------------------------------------------------------

#[test]
fn test_post_job_success() {
    let env = Env::default();
    let (_admin, poster, client) = setup(&env);
    let job_id = Symbol::new(&env, "job1");
    let token = Address::generate(&env);

    let job = client.post_job(
        &poster,
        &job_id,
        &Symbol::new(&env, "plumber"),
        &zero_hash(&env),
        &1_000_000,
        &token,
    );

    assert_eq!(job.id, job_id);
    assert_eq!(job.poster, poster);
    assert_eq!(job.budget, 1_000_000);
}

#[test]
fn test_post_job_duplicate_panics() {
    let env = Env::default();
    let (_admin, poster, client) = setup(&env);
    let job_id = Symbol::new(&env, "job1");
    let token = Address::generate(&env);

    client.post_job(
        &poster,
        &job_id,
        &Symbol::new(&env, "plumber"),
        &zero_hash(&env),
        &0,
        &token,
    );
    assert_eq!(
        client.try_post_job(
            &poster,
            &job_id,
            &Symbol::new(&env, "plumber"),
            &zero_hash(&env),
            &0,
            &token,
        ),
        Err(Ok(ContractError::JobAlreadyExists))
    );
}

#[test]
fn test_post_job_negative_budget_panics() {
    let env = Env::default();
    let (_admin, poster, client) = setup(&env);
    let token = Address::generate(&env);

    assert_eq!(
        client.try_post_job(
            &poster,
            &Symbol::new(&env, "job1"),
            &Symbol::new(&env, "plumber"),
            &zero_hash(&env),
            &-1,
            &token,
        ),
        Err(Ok(ContractError::AmountMustBePositive))
    );
}

// ---------------------------------------------------------------------------
// assign_worker
// ---------------------------------------------------------------------------

#[test]
fn test_assign_worker_success() {
    let env = Env::default();
    let (_admin, poster, client) = setup(&env);
    let job_id = Symbol::new(&env, "job1");
    let token = Address::generate(&env);
    let worker = Address::generate(&env);

    client.post_job(
        &poster,
        &job_id,
        &Symbol::new(&env, "plumber"),
        &zero_hash(&env),
        &0,
        &token,
    );
    client.assign_worker(&poster, &job_id, &worker);

    let job = client.get_job(&job_id);
    assert_eq!(job.worker, Some(worker));
}

#[test]
fn test_assign_worker_not_poster_panics() {
    let env = Env::default();
    let (_admin, poster, client) = setup(&env);
    let job_id = Symbol::new(&env, "job1");
    let token = Address::generate(&env);
    let worker = Address::generate(&env);
    let attacker = Address::generate(&env);

    client.post_job(
        &poster,
        &job_id,
        &Symbol::new(&env, "plumber"),
        &zero_hash(&env),
        &0,
        &token,
    );
    assert_eq!(
        client.try_assign_worker(&attacker, &job_id, &worker),
        Err(Ok(ContractError::UnauthorizedCaller))
    );
}

// ---------------------------------------------------------------------------
// complete_job
// ---------------------------------------------------------------------------

#[test]
fn test_complete_job_success() {
    let env = Env::default();
    let (_admin, poster, client) = setup(&env);
    let job_id = Symbol::new(&env, "job1");
    let token = Address::generate(&env);
    let worker = Address::generate(&env);

    client.post_job(
        &poster,
        &job_id,
        &Symbol::new(&env, "plumber"),
        &zero_hash(&env),
        &0,
        &token,
    );
    client.assign_worker(&poster, &job_id, &worker);
    client.complete_job(&worker, &job_id);

    let job = client.get_job(&job_id);
    assert_eq!(job.status, storage::JobStatus::Completed);
}

#[test]
fn test_complete_job_wrong_caller_panics() {
    let env = Env::default();
    let (_admin, poster, client) = setup(&env);
    let job_id = Symbol::new(&env, "job1");
    let token = Address::generate(&env);
    let worker = Address::generate(&env);

    client.post_job(
        &poster,
        &job_id,
        &Symbol::new(&env, "plumber"),
        &zero_hash(&env),
        &0,
        &token,
    );
    client.assign_worker(&poster, &job_id, &worker);
    assert_eq!(
        client.try_complete_job(&poster, &job_id),
        Err(Ok(ContractError::UnauthorizedCaller))
    );
}

// ---------------------------------------------------------------------------
// cancel_job
// ---------------------------------------------------------------------------

#[test]
fn test_cancel_job_success() {
    let env = Env::default();
    let (_admin, poster, client) = setup(&env);
    let job_id = Symbol::new(&env, "job1");
    let token = Address::generate(&env);

    client.post_job(
        &poster,
        &job_id,
        &Symbol::new(&env, "plumber"),
        &zero_hash(&env),
        &0,
        &token,
    );
    client.cancel_job(&poster, &job_id);

    let job = client.get_job(&job_id);
    assert_eq!(job.status, storage::JobStatus::Cancelled);
}

#[test]
fn test_cancel_completed_job_panics() {
    let env = Env::default();
    let (_admin, poster, client) = setup(&env);
    let job_id = Symbol::new(&env, "job1");
    let token = Address::generate(&env);
    let worker = Address::generate(&env);

    client.post_job(
        &poster,
        &job_id,
        &Symbol::new(&env, "plumber"),
        &zero_hash(&env),
        &0,
        &token,
    );
    client.assign_worker(&poster, &job_id, &worker);
    client.complete_job(&worker, &job_id);
    assert_eq!(
        client.try_cancel_job(&poster, &job_id),
        Err(Ok(ContractError::InvalidStatus))
    );
}

// ---------------------------------------------------------------------------
// dispute_job
// ---------------------------------------------------------------------------

#[test]
fn test_dispute_job_by_poster() {
    let env = Env::default();
    let (_admin, poster, client) = setup(&env);
    let job_id = Symbol::new(&env, "job1");
    let token = Address::generate(&env);
    let worker = Address::generate(&env);

    client.post_job(
        &poster,
        &job_id,
        &Symbol::new(&env, "plumber"),
        &zero_hash(&env),
        &0,
        &token,
    );
    client.assign_worker(&poster, &job_id, &worker);
    client.dispute_job(&poster, &job_id);

    let job = client.get_job(&job_id);
    assert_eq!(job.status, storage::JobStatus::Disputed);
}

#[test]
fn test_dispute_job_by_stranger_panics() {
    let env = Env::default();
    let (_admin, poster, client) = setup(&env);
    let job_id = Symbol::new(&env, "job1");
    let token = Address::generate(&env);
    let worker = Address::generate(&env);
    let stranger = Address::generate(&env);

    client.post_job(
        &poster,
        &job_id,
        &Symbol::new(&env, "plumber"),
        &zero_hash(&env),
        &0,
        &token,
    );
    client.assign_worker(&poster, &job_id, &worker);
    assert_eq!(
        client.try_dispute_job(&stranger, &job_id),
        Err(Ok(ContractError::NotAParty))
    );
}

// ---------------------------------------------------------------------------
// list / query
// ---------------------------------------------------------------------------

#[test]
fn test_list_jobs_and_poster_jobs() {
    let env = Env::default();
    let (_admin, poster, client) = setup(&env);
    let token = Address::generate(&env);

    client.post_job(
        &poster,
        &Symbol::new(&env, "job1"),
        &Symbol::new(&env, "plumber"),
        &zero_hash(&env),
        &0,
        &token,
    );
    client.post_job(
        &poster,
        &Symbol::new(&env, "job2"),
        &Symbol::new(&env, "welder"),
        &zero_hash(&env),
        &0,
        &token,
    );

    assert_eq!(client.list_jobs().len(), 2);
    assert_eq!(client.poster_jobs(&poster).len(), 2);
}

// ---------------------------------------------------------------------------
// pause / unpause
// ---------------------------------------------------------------------------

#[test]
fn test_post_job_while_paused_panics() {
    let env = Env::default();
    let (admin, poster, client) = setup(&env);
    let token = Address::generate(&env);

    client.grant_role(&admin, &Symbol::new(&env, logic::ROLE_PAUSER), &admin);
    client.pause(&admin);

    assert_eq!(
        client.try_post_job(
            &poster,
            &Symbol::new(&env, "job1"),
            &Symbol::new(&env, "plumber"),
            &zero_hash(&env),
            &0,
            &token,
        ),
        Err(Ok(ContractError::ContractIsPaused))
    );
}

#[test]
fn test_pause_unpause_cycle() {
    let env = Env::default();
    let (admin, poster, client) = setup(&env);
    let token = Address::generate(&env);

    client.grant_role(&admin, &Symbol::new(&env, logic::ROLE_PAUSER), &admin);

    // Initially not paused
    assert!(!client.is_paused());

    // Pause the contract
    client.pause(&admin);
    assert!(client.is_paused());

    // Unpause the contract
    client.unpause(&admin);
    assert!(!client.is_paused());

    // Can post job after unpause
    let job = client.post_job(
        &poster,
        &Symbol::new(&env, "job1"),
        &Symbol::new(&env, "plumber"),
        &zero_hash(&env),
        &1_000_000,
        &token,
    );
    assert_eq!(job.budget, 1_000_000);
}

#[test]
fn test_pause_without_role_panics() {
    let env = Env::default();
    let (_admin, _poster, client) = setup(&env);
    let unauthorized = Address::generate(&env);

    assert_eq!(
        client.try_pause(&unauthorized),
        Err(Ok(ContractError::MissingRole))
    );
}

#[test]
fn test_unpause_without_role_panics() {
    let env = Env::default();
    let (admin, _poster, client) = setup(&env);

    client.grant_role(&admin, &Symbol::new(&env, logic::ROLE_PAUSER), &admin);
    client.pause(&admin);

    let unauthorized = Address::generate(&env);
    assert_eq!(
        client.try_unpause(&unauthorized),
        Err(Ok(ContractError::MissingRole))
    );
}

#[test]
fn test_assign_worker_while_paused_panics() {
    let env = Env::default();
    let (admin, poster, client) = setup(&env);
    let job_id = Symbol::new(&env, "job1");
    let token = Address::generate(&env);
    let worker = Address::generate(&env);

    client.post_job(
        &poster,
        &job_id,
        &Symbol::new(&env, "plumber"),
        &zero_hash(&env),
        &0,
        &token,
    );

    client.grant_role(&admin, &Symbol::new(&env, logic::ROLE_PAUSER), &admin);
    client.pause(&admin);

    assert_eq!(
        client.try_assign_worker(&poster, &job_id, &worker),
        Err(Ok(ContractError::ContractIsPaused))
    );
}

#[test]
fn test_complete_job_while_paused_panics() {
    let env = Env::default();
    let (admin, poster, client) = setup(&env);
    let job_id = Symbol::new(&env, "job1");
    let token = Address::generate(&env);
    let worker = Address::generate(&env);

    client.post_job(
        &poster,
        &job_id,
        &Symbol::new(&env, "plumber"),
        &zero_hash(&env),
        &0,
        &token,
    );
    client.assign_worker(&poster, &job_id, &worker);

    client.grant_role(&admin, &Symbol::new(&env, logic::ROLE_PAUSER), &admin);
    client.pause(&admin);

    assert_eq!(
        client.try_complete_job(&worker, &job_id),
        Err(Ok(ContractError::ContractIsPaused))
    );
}

#[test]
fn test_cancel_job_while_paused_panics() {
    let env = Env::default();
    let (admin, poster, client) = setup(&env);
    let job_id = Symbol::new(&env, "job1");
    let token = Address::generate(&env);

    client.post_job(
        &poster,
        &job_id,
        &Symbol::new(&env, "plumber"),
        &zero_hash(&env),
        &0,
        &token,
    );

    client.grant_role(&admin, &Symbol::new(&env, logic::ROLE_PAUSER), &admin);
    client.pause(&admin);

    assert_eq!(
        client.try_cancel_job(&poster, &job_id),
        Err(Ok(ContractError::ContractIsPaused))
    );
}

#[test]
fn test_dispute_job_while_paused_panics() {
    let env = Env::default();
    let (admin, poster, client) = setup(&env);
    let job_id = Symbol::new(&env, "job1");
    let token = Address::generate(&env);
    let worker = Address::generate(&env);

    client.post_job(
        &poster,
        &job_id,
        &Symbol::new(&env, "plumber"),
        &zero_hash(&env),
        &0,
        &token,
    );
    client.assign_worker(&poster, &job_id, &worker);

    client.grant_role(&admin, &Symbol::new(&env, logic::ROLE_PAUSER), &admin);
    client.pause(&admin);

    assert_eq!(
        client.try_dispute_job(&poster, &job_id),
        Err(Ok(ContractError::ContractIsPaused))
    );
}

// ---------------------------------------------------------------------------
// Role management (grant_role, revoke_role, has_role)
// ---------------------------------------------------------------------------

#[test]
fn test_grant_role_success() {
    let env = Env::default();
    let (admin, _poster, client) = setup(&env);
    let user = Address::generate(&env);
    let role = Symbol::new(&env, logic::ROLE_PAUSER);

    assert!(!client.has_role(&role, &user));
    client.grant_role(&admin, &role, &user);
    assert!(client.has_role(&role, &user));
}

#[test]
fn test_grant_role_idempotent() {
    let env = Env::default();
    let (admin, _poster, client) = setup(&env);
    let user = Address::generate(&env);
    let role = Symbol::new(&env, logic::ROLE_PAUSER);

    client.grant_role(&admin, &role, &user);
    assert!(client.has_role(&role, &user));

    // Grant again should be idempotent
    client.grant_role(&admin, &role, &user);
    assert!(client.has_role(&role, &user));
}

#[test]
fn test_grant_role_non_admin_panics() {
    let env = Env::default();
    let (_admin, _poster, client) = setup(&env);
    let user = Address::generate(&env);
    let unauthorized = Address::generate(&env);
    let role = Symbol::new(&env, logic::ROLE_PAUSER);

    assert_eq!(
        client.try_grant_role(&unauthorized, &role, &user),
        Err(Ok(ContractError::MissingRole))
    );
}

#[test]
fn test_revoke_role_success() {
    let env = Env::default();
    let (admin, _poster, client) = setup(&env);
    let user = Address::generate(&env);
    let role = Symbol::new(&env, logic::ROLE_PAUSER);

    client.grant_role(&admin, &role, &user);
    assert!(client.has_role(&role, &user));

    client.revoke_role(&admin, &role, &user);
    assert!(!client.has_role(&role, &user));
}

#[test]
fn test_revoke_role_non_admin_panics() {
    let env = Env::default();
    let (admin, _poster, client) = setup(&env);
    let user = Address::generate(&env);
    let unauthorized = Address::generate(&env);
    let role = Symbol::new(&env, logic::ROLE_PAUSER);

    client.grant_role(&admin, &role, &user);
    assert_eq!(
        client.try_revoke_role(&unauthorized, &role, &user),
        Err(Ok(ContractError::MissingRole))
    );
}

#[test]
fn test_has_role_returns_false_for_ungranted_role() {
    let env = Env::default();
    let (_admin, _poster, client) = setup(&env);
    let user = Address::generate(&env);
    let role = Symbol::new(&env, logic::ROLE_PAUSER);

    assert!(!client.has_role(&role, &user));
}

#[test]
fn test_get_admin_returns_correct_admin() {
    let env = Env::default();
    let (admin, _poster, client) = setup(&env);

    assert_eq!(client.get_admin(), admin);
}

// ---------------------------------------------------------------------------
// post_job edge cases
// ---------------------------------------------------------------------------

#[test]
fn test_post_job_with_large_budget() {
    let env = Env::default();
    let (_admin, poster, client) = setup(&env);
    let job_id = Symbol::new(&env, "job1");
    let token = Address::generate(&env);
    let large_budget = i128::MAX;

    let job = client.post_job(
        &poster,
        &job_id,
        &Symbol::new(&env, "plumber"),
        &zero_hash(&env),
        &large_budget,
        &token,
    );

    assert_eq!(job.budget, large_budget);
}

#[test]
fn test_post_job_with_zero_budget() {
    let env = Env::default();
    let (_admin, poster, client) = setup(&env);
    let job_id = Symbol::new(&env, "job1");
    let token = Address::generate(&env);

    let job = client.post_job(
        &poster,
        &job_id,
        &Symbol::new(&env, "plumber"),
        &zero_hash(&env),
        &0,
        &token,
    );

    assert_eq!(job.budget, 0);
}

#[test]
fn test_post_multiple_jobs_from_same_poster() {
    let env = Env::default();
    let (_admin, poster, client) = setup(&env);
    let token = Address::generate(&env);

    for i in 0..5 {
        let job_id = Symbol::new(&env, &format!("job{}", i));
        let _ = client.post_job(
            &poster,
            &job_id,
            &Symbol::new(&env, "plumber"),
            &zero_hash(&env),
            &(1_000 * (i as i128)),
            &token,
        );
    }

    assert_eq!(client.list_jobs().len(), 5);
    assert_eq!(client.poster_jobs(&poster).len(), 5);
}

// ---------------------------------------------------------------------------
// assign_worker edge cases
// ---------------------------------------------------------------------------

#[test]
fn test_assign_worker_nonexistent_job_panics() {
    let env = Env::default();
    let (_admin, poster, client) = setup(&env);
    let job_id = Symbol::new(&env, "nonexistent");
    let worker = Address::generate(&env);

    assert_eq!(
        client.try_assign_worker(&poster, &job_id, &worker),
        Err(Ok(ContractError::JobNotFound))
    );
}

#[test]
fn test_assign_worker_imposter_panics() {
    let env = Env::default();
    let (_admin, poster, client) = setup(&env);
    let job_id = Symbol::new(&env, "job1");
    let token = Address::generate(&env);
    let worker = Address::generate(&env);
    let imposter = Address::generate(&env);

    client.post_job(
        &poster,
        &job_id,
        &Symbol::new(&env, "plumber"),
        &zero_hash(&env),
        &1_000_000,
        &token,
    );
    assert_eq!(
        client.try_assign_worker(&imposter, &job_id, &worker),
        Err(Ok(ContractError::UnauthorizedCaller))
    );
}

#[test]
fn test_assign_worker_updates_job_state() {
    let env = Env::default();
    let (_admin, poster, client) = setup(&env);
    let job_id = Symbol::new(&env, "job1");
    let token = Address::generate(&env);
    let worker = Address::generate(&env);

    client.post_job(
        &poster,
        &job_id,
        &Symbol::new(&env, "plumber"),
        &zero_hash(&env),
        &1_000_000,
        &token,
    );

    let job_before = client.get_job(&job_id);
    assert_eq!(job_before.worker, None);
    assert_eq!(job_before.status, storage::JobStatus::Open);

    client.assign_worker(&poster, &job_id, &worker);

    let job_after = client.get_job(&job_id);
    assert_eq!(job_after.worker, Some(worker.clone()));
    assert_eq!(job_after.status, storage::JobStatus::Assigned);
}

// ---------------------------------------------------------------------------
// complete_job edge cases
// ---------------------------------------------------------------------------

#[test]
fn test_complete_job_nonexistent_job_panics() {
    let env = Env::default();
    let (_admin, _poster, client) = setup(&env);
    let job_id = Symbol::new(&env, "nonexistent");
    let worker = Address::generate(&env);

    assert_eq!(
        client.try_complete_job(&worker, &job_id),
        Err(Ok(ContractError::JobNotFound))
    );
}

#[test]
fn test_complete_job_by_poster_panics() {
    let env = Env::default();
    let (_admin, poster, client) = setup(&env);
    let job_id = Symbol::new(&env, "job1");
    let token = Address::generate(&env);
    let worker = Address::generate(&env);

    client.post_job(
        &poster,
        &job_id,
        &Symbol::new(&env, "plumber"),
        &zero_hash(&env),
        &1_000_000,
        &token,
    );
    client.assign_worker(&poster, &job_id, &worker);
    assert_eq!(
        client.try_complete_job(&poster, &job_id),
        Err(Ok(ContractError::UnauthorizedCaller))
    );
}

#[test]
fn test_complete_job_updates_status() {
    let env = Env::default();
    let (_admin, poster, client) = setup(&env);
    let job_id = Symbol::new(&env, "job1");
    let token = Address::generate(&env);
    let worker = Address::generate(&env);

    client.post_job(
        &poster,
        &job_id,
        &Symbol::new(&env, "plumber"),
        &zero_hash(&env),
        &1_000_000,
        &token,
    );
    client.assign_worker(&poster, &job_id, &worker);

    let job_before = client.get_job(&job_id);
    assert_eq!(job_before.status, storage::JobStatus::Assigned);

    client.complete_job(&worker, &job_id);

    let job_after = client.get_job(&job_id);
    assert_eq!(job_after.status, storage::JobStatus::Completed);
}

// ---------------------------------------------------------------------------
// cancel_job edge cases
// ---------------------------------------------------------------------------

#[test]
fn test_cancel_job_nonexistent_job_panics() {
    let env = Env::default();
    let (_admin, poster, client) = setup(&env);
    let job_id = Symbol::new(&env, "nonexistent");

    assert_eq!(
        client.try_cancel_job(&poster, &job_id),
        Err(Ok(ContractError::JobNotFound))
    );
}

#[test]
fn test_cancel_job_not_poster_panics() {
    let env = Env::default();
    let (_admin, poster, client) = setup(&env);
    let job_id = Symbol::new(&env, "job1");
    let token = Address::generate(&env);
    let not_poster = Address::generate(&env);

    client.post_job(
        &poster,
        &job_id,
        &Symbol::new(&env, "plumber"),
        &zero_hash(&env),
        &1_000_000,
        &token,
    );
    assert_eq!(
        client.try_cancel_job(&not_poster, &job_id),
        Err(Ok(ContractError::UnauthorizedCaller))
    );
}

#[test]
fn test_cancel_job_open_status() {
    let env = Env::default();
    let (_admin, poster, client) = setup(&env);
    let job_id = Symbol::new(&env, "job1");
    let token = Address::generate(&env);

    client.post_job(
        &poster,
        &job_id,
        &Symbol::new(&env, "plumber"),
        &zero_hash(&env),
        &1_000_000,
        &token,
    );

    let job_before = client.get_job(&job_id);
    assert_eq!(job_before.status, storage::JobStatus::Open);

    client.cancel_job(&poster, &job_id);

    let job_after = client.get_job(&job_id);
    assert_eq!(job_after.status, storage::JobStatus::Cancelled);
}

#[test]
fn test_cancel_job_after_completion_panics() {
    let env = Env::default();
    let (_admin, poster, client) = setup(&env);
    let job_id = Symbol::new(&env, "job1");
    let token = Address::generate(&env);
    let worker = Address::generate(&env);

    client.post_job(
        &poster,
        &job_id,
        &Symbol::new(&env, "plumber"),
        &zero_hash(&env),
        &1_000_000,
        &token,
    );
    client.assign_worker(&poster, &job_id, &worker);
    client.complete_job(&worker, &job_id);

    assert_eq!(
        client.try_cancel_job(&poster, &job_id),
        Err(Ok(ContractError::InvalidStatus))
    );
}

// ---------------------------------------------------------------------------
// dispute_job edge cases
// ---------------------------------------------------------------------------

#[test]
fn test_dispute_job_nonexistent_job_panics() {
    let env = Env::default();
    let (_admin, poster, client) = setup(&env);
    let job_id = Symbol::new(&env, "nonexistent");

    assert_eq!(
        client.try_dispute_job(&poster, &job_id),
        Err(Ok(ContractError::JobNotFound))
    );
}

#[test]
fn test_dispute_job_by_worker() {
    let env = Env::default();
    let (_admin, poster, client) = setup(&env);
    let job_id = Symbol::new(&env, "job1");
    let token = Address::generate(&env);
    let worker = Address::generate(&env);

    client.post_job(
        &poster,
        &job_id,
        &Symbol::new(&env, "plumber"),
        &zero_hash(&env),
        &1_000_000,
        &token,
    );
    client.assign_worker(&poster, &job_id, &worker);
    client.dispute_job(&worker, &job_id);

    let job = client.get_job(&job_id);
    assert_eq!(job.status, storage::JobStatus::Disputed);
}

#[test]
fn test_dispute_job_updates_status() {
    let env = Env::default();
    let (_admin, poster, client) = setup(&env);
    let job_id = Symbol::new(&env, "job1");
    let token = Address::generate(&env);
    let worker = Address::generate(&env);

    client.post_job(
        &poster,
        &job_id,
        &Symbol::new(&env, "plumber"),
        &zero_hash(&env),
        &1_000_000,
        &token,
    );
    client.assign_worker(&poster, &job_id, &worker);

    let job_before = client.get_job(&job_id);
    assert_eq!(job_before.status, storage::JobStatus::Assigned);

    client.dispute_job(&poster, &job_id);

    let job_after = client.get_job(&job_id);
    assert_eq!(job_after.status, storage::JobStatus::Disputed);
}

// ---------------------------------------------------------------------------
// query functions (list_jobs, poster_jobs, get_job)
// ---------------------------------------------------------------------------

#[test]
fn test_list_jobs_empty() {
    let env = Env::default();
    let (_admin, _poster, client) = setup(&env);

    assert_eq!(client.list_jobs().len(), 0);
}

#[test]
fn test_get_job_nonexistent_panics() {
    let env = Env::default();
    let (_admin, _poster, client) = setup(&env);
    let job_id = Symbol::new(&env, "nonexistent");

    assert_eq!(
        client.try_get_job(&job_id),
        Err(Ok(ContractError::JobNotFound))
    );
}

#[test]
fn test_poster_jobs_only_returns_user_jobs() {
    let env = Env::default();
    let (_admin, poster1, client) = setup(&env);
    let poster2 = Address::generate(&env);
    let token = Address::generate(&env);

    for i in 0..3 {
        let job_id = Symbol::new(&env, &format!("job_p1_{}", i));
        client.post_job(
            &poster1,
            &job_id,
            &Symbol::new(&env, "plumber"),
            &zero_hash(&env),
            &1_000_000,
            &token,
        );
    }

    for i in 0..2 {
        let job_id = Symbol::new(&env, &format!("job_p2_{}", i));
        client.post_job(
            &poster2,
            &job_id,
            &Symbol::new(&env, "plumber"),
            &zero_hash(&env),
            &1_000_000,
            &token,
        );
    }

    assert_eq!(client.list_jobs().len(), 5);
    assert_eq!(client.poster_jobs(&poster1).len(), 3);
    assert_eq!(client.poster_jobs(&poster2).len(), 2);
}

// ---------------------------------------------------------------------------
// upgrade
// ---------------------------------------------------------------------------

#[test]
fn test_upgrade_without_role_panics() {
    let env = Env::default();
    let (_admin, _poster, client) = setup(&env);
    let unauthorized = Address::generate(&env);
    let new_wasm_hash = zero_hash(&env);

    assert_eq!(
        client.try_upgrade(&unauthorized, &new_wasm_hash),
        Err(Ok(ContractError::MissingRole))
    );
}

#[test]
fn test_upgrade_with_role_succeeds() {
    let env = Env::default();
    let (admin, _poster, client) = setup(&env);
    let new_wasm_hash = zero_hash(&env);

    client.grant_role(&admin, &Symbol::new(&env, logic::ROLE_UPGRADER), &admin);
    // Role check passes; fails at host level because dummy WASM is not registered
    let res = client.try_upgrade(&admin, &new_wasm_hash);
    assert_ne!(res, Err(Ok(ContractError::MissingRole)));
}

// ---------------------------------------------------------------------------
// upgrade / migration simulation (issue #1445)
// ---------------------------------------------------------------------------
//
// Simulates the two-step upgrade (WASM swap + schema migration) against
// pre-existing ledger state and asserts data integrity afterwards. The actual
// `update_current_contract_wasm` call needs a registered WASM blob, which the
// in-process test host cannot install from a dummy hash, so step 1 is
// represented by the upgrade entry point's role gate and step 2 by `migrate`.

/// Full upgrade simulation: jobs, indexes and roles written under schema v1,
/// the WASM-swap role gate, then the post-swap `migrate` step. Every stored
/// value must survive unchanged and the schema version must advance by exactly
/// one.
#[test]
fn test_upgrade_simulation_preserves_pre_existing_state() {
    let env = Env::default();
    let (admin, poster, client) = setup(&env);
    let token = Address::generate(&env);
    let worker = Address::generate(&env);

    // --- Pre-upgrade writes (schema v1) ---
    let job1 = Symbol::new(&env, "job1");
    let job2 = Symbol::new(&env, "job2");
    client.post_job(
        &poster,
        &job1,
        &Symbol::new(&env, "plumber"),
        &zero_hash(&env),
        &1_000_000,
        &token,
    );
    client.post_job(
        &poster,
        &job2,
        &Symbol::new(&env, "electrician"),
        &zero_hash(&env),
        &2_500,
        &token,
    );
    client.assign_worker(&poster, &job1, &worker);
    client.grant_role(&admin, &Symbol::new(&env, logic::ROLE_PAUSER), &admin);

    let job1_before = client.get_job(&job1);
    let job2_before = client.get_job(&job2);
    let jobs_before = client.list_jobs();
    let poster_jobs_before = client.poster_jobs(&poster);
    assert_eq!(client.get_schema_version(), 1);

    // --- Step 1: the WASM swap is gated on ROLE_UPGRADER ---
    let unauthorized = Address::generate(&env);
    assert_eq!(
        client.try_upgrade(&unauthorized, &zero_hash(&env)),
        Err(Ok(ContractError::MissingRole))
    );

    // --- Step 2: post-swap schema migration ---
    client.migrate(&admin, &1u32);

    // --- Integrity assertions ---
    assert_eq!(client.get_job(&job1), job1_before);
    assert_eq!(client.get_job(&job2), job2_before);
    assert_eq!(client.get_job(&job1).status, storage::JobStatus::Assigned);
    assert_eq!(client.get_job(&job2).status, storage::JobStatus::Open);
    assert_eq!(client.get_job(&job1).worker, Some(worker));
    assert_eq!(client.list_jobs(), jobs_before);
    assert_eq!(client.poster_jobs(&poster), poster_jobs_before);
    assert!(client.has_role(&Symbol::new(&env, logic::ROLE_ADMIN), &admin));
    assert!(client.has_role(&Symbol::new(&env, logic::ROLE_PAUSER), &admin));
    assert_eq!(client.get_admin(), admin);
    assert_eq!(client.get_schema_version(), 2);
}

/// A fresh deployment reports schema version 1, the baseline old clients read.
#[test]
fn test_upgrade_simulation_fresh_deploy_reports_baseline_version() {
    let env = Env::default();
    let (_admin, _poster, client) = setup(&env);
    assert_eq!(client.get_schema_version(), 1);
}

/// Only a `ROLE_ADMIN` holder may run the post-upgrade migration.
#[test]
fn test_migrate_requires_admin_role() {
    let env = Env::default();
    let (_admin, _poster, client) = setup(&env);
    let stranger = Address::generate(&env);
    assert_eq!(
        client.try_migrate(&stranger, &1u32),
        Err(Ok(ContractError::MissingRole))
    );
    assert_eq!(client.get_schema_version(), 1);
}

/// Migrating with a stale or fabricated `expected_version` is rejected.
#[test]
fn test_migrate_wrong_version_rejected() {
    let env = Env::default();
    let (admin, _poster, client) = setup(&env);
    assert_eq!(
        client.try_migrate(&admin, &2u32),
        Err(Ok(ContractError::WrongSchemaVersion))
    );
    assert_eq!(client.get_schema_version(), 1);
}

/// A replayed migration (same `expected_version` twice) is rejected, so a
/// duplicated post-upgrade call cannot transform already-migrated state.
#[test]
fn test_migrate_replay_rejected() {
    let env = Env::default();
    let (admin, poster, client) = setup(&env);
    let token = Address::generate(&env);
    let job_id = Symbol::new(&env, "job1");
    client.post_job(
        &poster,
        &job_id,
        &Symbol::new(&env, "plumber"),
        &zero_hash(&env),
        &1_000,
        &token,
    );
    client.migrate(&admin, &1u32);
    assert_eq!(
        client.try_migrate(&admin, &1u32),
        Err(Ok(ContractError::WrongSchemaVersion))
    );
    // State written before the first migrate is still intact.
    assert_eq!(client.get_job(&job_id).budget, 1_000);
    assert_eq!(client.get_schema_version(), 2);
}

/// Sequential migrations each advance the version by exactly one.
#[test]
fn test_migrate_sequential_versions() {
    let env = Env::default();
    let (admin, _poster, client) = setup(&env);
    client.migrate(&admin, &1u32);
    assert_eq!(client.get_schema_version(), 2);
    client.migrate(&admin, &2u32);
    assert_eq!(client.get_schema_version(), 3);
    assert_eq!(
        client.try_migrate(&admin, &1u32),
        Err(Ok(ContractError::WrongSchemaVersion))
    );
}
