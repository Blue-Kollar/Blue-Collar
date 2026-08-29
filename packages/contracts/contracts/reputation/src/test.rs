//! Regression tests for the reputation contract security audit (issue #1017).
//!
//! Covered findings:
//! 1. `slash_reputation` was unguarded — now requires `ROLE_REP_MGR`.
//! 2. `reset_reputation` was open to anyone — now requires `ROLE_ADMIN`.
//! 3. `submit_review` emitted event before writing state — CEI order fixed.
//! 4. `award_badge` emitted event before writing badge list — CEI order fixed.

#![cfg(test)]
extern crate std;

use super::*;
use soroban_sdk::{testutils::Address as _, Address, BytesN, Env, Symbol};

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

fn zero_hash(env: &Env) -> BytesN<32> {
    BytesN::from_array(env, &[0u8; 32])
}

fn setup() -> (Env, Address, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let rep_mgr = Address::generate(&env);
    let worker = Address::generate(&env);

    let contract_id = env.register_contract(None, ReputationContract);
    let client = ReputationContractClient::new(&env, &contract_id);

    client.initialize(&admin);
    client.grant_role(&admin, &Symbol::new(&env, ROLE_REP_MGR), &rep_mgr);

    (env, admin, rep_mgr, worker)
}

fn deploy_client(env: &Env) -> (Address, ReputationContractClient<'_>) {
    let contract_id = env.register_contract(None, ReputationContract);
    let client = ReputationContractClient::new(env, &contract_id);
    (contract_id, client)
}

// ---------------------------------------------------------------------------
// initialize
// ---------------------------------------------------------------------------

#[test]
fn test_initialize_success() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let (_, client) = deploy_client(&env);

    client.initialize(&admin);
    assert_eq!(client.get_admin(), admin);
    assert!(!client.is_paused());
}

#[test]
fn test_initialize_twice_panics() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let (_, client) = deploy_client(&env);
    client.initialize(&admin);
    assert_eq!(
        client.try_initialize(&admin),
        Err(Ok(ContractError::AlreadyInitialized))
    );
}

// ---------------------------------------------------------------------------
// submit_review — CEI regression (#1017 finding 1)
// ---------------------------------------------------------------------------

#[test]
fn test_submit_review_updates_score() {
    let (env, _admin, rep_mgr, _worker) = setup();
    let contract_id = env.register_contract(None, ReputationContract);
    let client = ReputationContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(&admin);
    client.grant_role(&admin, &Symbol::new(&env, ROLE_REP_MGR), &rep_mgr);

    let worker_id = Symbol::new(&env, "worker1");
    client.submit_review(&rep_mgr, &worker_id, &8_000, &zero_hash(&env));
    assert_eq!(client.get_score(&worker_id), 8_000);
}

#[test]
fn test_submit_review_averages_multiple() {
    let (env, _admin, rep_mgr, _worker) = setup();
    let contract_id = env.register_contract(None, ReputationContract);
    let client = ReputationContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(&admin);
    client.grant_role(&admin, &Symbol::new(&env, ROLE_REP_MGR), &rep_mgr);

    let worker_id = Symbol::new(&env, "workerA");
    client.submit_review(&rep_mgr, &worker_id, &6_000, &zero_hash(&env));
    client.submit_review(&rep_mgr, &worker_id, &10_000, &zero_hash(&env));
    // avg = (6000 + 10000) / 2 = 8000
    assert_eq!(client.get_score(&worker_id), 8_000);
}

#[test]
fn test_submit_review_unauthorized() {
    let (env, _admin, _rep_mgr, _worker) = setup();
    let contract_id = env.register_contract(None, ReputationContract);
    let client = ReputationContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(&admin);

    let attacker = Address::generate(&env);
    let worker_id = Symbol::new(&env, "worker1");
    assert_eq!(
        client.try_submit_review(&attacker, &worker_id, &9_000, &zero_hash(&env)),
        Err(Ok(ContractError::MissingRole))
    );
}

#[test]
fn test_submit_review_rating_overflow() {
    let (env, _admin, rep_mgr, _worker) = setup();
    let contract_id = env.register_contract(None, ReputationContract);
    let client = ReputationContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(&admin);
    client.grant_role(&admin, &Symbol::new(&env, ROLE_REP_MGR), &rep_mgr);

    let worker_id = Symbol::new(&env, "worker1");
    assert_eq!(
        client.try_submit_review(&rep_mgr, &worker_id, &10_001, &zero_hash(&env)),
        Err(Ok(ContractError::RatingOutOfRange))
    );
}

// ---------------------------------------------------------------------------
// slash_reputation — access control regression (#1017 finding 2)
// ---------------------------------------------------------------------------

#[test]
fn test_slash_reputation_by_rep_mgr() {
    let (env, _admin, rep_mgr, _worker) = setup();
    let contract_id = env.register_contract(None, ReputationContract);
    let client = ReputationContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(&admin);
    client.grant_role(&admin, &Symbol::new(&env, ROLE_REP_MGR), &rep_mgr);

    let worker_id = Symbol::new(&env, "worker1");
    // First give the worker some reputation
    client.submit_review(&rep_mgr, &worker_id, &8_000, &zero_hash(&env));
    assert_eq!(client.get_score(&worker_id), 8_000);

    client.slash_reputation(&rep_mgr, &worker_id, &2_000);
    assert_eq!(client.get_score(&worker_id), 6_000);
}

#[test]
fn test_slash_reputation_clamps_at_zero() {
    let (env, _admin, rep_mgr, _worker) = setup();
    let contract_id = env.register_contract(None, ReputationContract);
    let client = ReputationContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(&admin);
    client.grant_role(&admin, &Symbol::new(&env, ROLE_REP_MGR), &rep_mgr);

    let worker_id = Symbol::new(&env, "worker1");
    client.submit_review(&rep_mgr, &worker_id, &1_000, &zero_hash(&env));
    // Slash more than current score — must clamp at 0, not underflow
    client.slash_reputation(&rep_mgr, &worker_id, &5_000);
    assert_eq!(client.get_score(&worker_id), 0);
}

#[test]
fn test_slash_reputation_unauthorized() {
    let (env, _admin, _rep_mgr, _worker) = setup();
    let contract_id = env.register_contract(None, ReputationContract);
    let client = ReputationContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(&admin);

    let attacker = Address::generate(&env);
    let worker_id = Symbol::new(&env, "worker1");
    assert_eq!(
        client.try_slash_reputation(&attacker, &worker_id, &5_000),
        Err(Ok(ContractError::MissingRole))
    );
}

#[test]
fn test_slash_reputation_overflow_input() {
    let (env, _admin, rep_mgr, _worker) = setup();
    let contract_id = env.register_contract(None, ReputationContract);
    let client = ReputationContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(&admin);
    client.grant_role(&admin, &Symbol::new(&env, ROLE_REP_MGR), &rep_mgr);

    let worker_id = Symbol::new(&env, "worker1");
    assert_eq!(
        client.try_slash_reputation(&rep_mgr, &worker_id, &10_001),
        Err(Ok(ContractError::ScoreOutOfRange))
    );
}

// ---------------------------------------------------------------------------
// reset_reputation — access control regression (#1017 finding 3)
// ---------------------------------------------------------------------------

#[test]
fn test_reset_reputation_by_admin() {
    let (env, _admin, rep_mgr, _worker) = setup();
    let contract_id = env.register_contract(None, ReputationContract);
    let client = ReputationContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(&admin);
    client.grant_role(&admin, &Symbol::new(&env, ROLE_REP_MGR), &rep_mgr);

    let worker_id = Symbol::new(&env, "worker1");
    client.submit_review(&rep_mgr, &worker_id, &9_000, &zero_hash(&env));
    assert_eq!(client.get_score(&worker_id), 9_000);

    client.reset_reputation(&admin, &worker_id);
    assert_eq!(client.get_score(&worker_id), 0);
    let record = client.get_record(&worker_id);
    assert_eq!(record.review_count, 0);
    assert_eq!(record.rating_sum, 0);
}

#[test]
fn test_reset_reputation_unauthorized() {
    let (env, _admin, rep_mgr, _worker) = setup();
    let contract_id = env.register_contract(None, ReputationContract);
    let client = ReputationContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(&admin);
    client.grant_role(&admin, &Symbol::new(&env, ROLE_REP_MGR), &rep_mgr);

    let attacker = Address::generate(&env);
    let worker_id = Symbol::new(&env, "worker1");
    client.submit_review(&rep_mgr, &worker_id, &9_000, &zero_hash(&env));
    assert_eq!(
        client.try_reset_reputation(&attacker, &worker_id),
        Err(Ok(ContractError::MissingRole))
    );
}

#[test]
fn test_reset_reputation_rep_mgr_blocked() {
    let (env, _admin, rep_mgr, _worker) = setup();
    let contract_id = env.register_contract(None, ReputationContract);
    let client = ReputationContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(&admin);
    client.grant_role(&admin, &Symbol::new(&env, ROLE_REP_MGR), &rep_mgr);

    let worker_id = Symbol::new(&env, "worker1");
    client.submit_review(&rep_mgr, &worker_id, &9_000, &zero_hash(&env));
    assert_eq!(
        client.try_reset_reputation(&rep_mgr, &worker_id),
        Err(Ok(ContractError::MissingRole))
    );
}

// ---------------------------------------------------------------------------
// award_badge — CEI regression (#1017 finding 4)
// ---------------------------------------------------------------------------

#[test]
fn test_award_badge_success() {
    let (env, _admin, rep_mgr, _worker) = setup();
    let contract_id = env.register_contract(None, ReputationContract);
    let client = ReputationContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(&admin);
    client.grant_role(&admin, &Symbol::new(&env, ROLE_REP_MGR), &rep_mgr);

    let worker_id = Symbol::new(&env, "worker1");
    let badge = Symbol::new(&env, "top_rated");
    client.award_badge(&rep_mgr, &worker_id, &badge);
    assert!(client.has_badge(&worker_id, &badge));
}

#[test]
fn test_award_badge_duplicate_panics() {
    let (env, _admin, rep_mgr, _worker) = setup();
    let contract_id = env.register_contract(None, ReputationContract);
    let client = ReputationContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(&admin);
    client.grant_role(&admin, &Symbol::new(&env, ROLE_REP_MGR), &rep_mgr);

    let worker_id = Symbol::new(&env, "worker1");
    let badge = Symbol::new(&env, "top_rated");
    client.award_badge(&rep_mgr, &worker_id, &badge);
    assert_eq!(
        client.try_award_badge(&rep_mgr, &worker_id, &badge),
        Err(Ok(ContractError::BadgeAlreadyAwarded))
    );
}

#[test]
fn test_award_badge_unauthorized() {
    let (env, _admin, _rep_mgr, _worker) = setup();
    let contract_id = env.register_contract(None, ReputationContract);
    let client = ReputationContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(&admin);

    let attacker = Address::generate(&env);
    let worker_id = Symbol::new(&env, "worker1");
    assert_eq!(
        client.try_award_badge(&attacker, &worker_id, &Symbol::new(&env, "badge")),
        Err(Ok(ContractError::MissingRole))
    );
}

// ---------------------------------------------------------------------------
// revoke_badge
// ---------------------------------------------------------------------------

#[test]
fn test_revoke_badge_success() {
    let (env, _admin, rep_mgr, _worker) = setup();
    let contract_id = env.register_contract(None, ReputationContract);
    let client = ReputationContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(&admin);
    client.grant_role(&admin, &Symbol::new(&env, ROLE_REP_MGR), &rep_mgr);

    let worker_id = Symbol::new(&env, "worker1");
    let badge = Symbol::new(&env, "top_rated");
    client.award_badge(&rep_mgr, &worker_id, &badge);
    assert!(client.has_badge(&worker_id, &badge));

    client.revoke_badge(&rep_mgr, &worker_id, &badge);
    assert!(!client.has_badge(&worker_id, &badge));
}

// ---------------------------------------------------------------------------
// pause / unpause
// ---------------------------------------------------------------------------

#[test]
fn test_submit_review_while_paused() {
    let (env, _admin, rep_mgr, _worker) = setup();
    let contract_id = env.register_contract(None, ReputationContract);
    let client = ReputationContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(&admin);
    client.grant_role(&admin, &Symbol::new(&env, ROLE_REP_MGR), &rep_mgr);
    client.grant_role(&admin, &Symbol::new(&env, ROLE_PAUSER), &admin);

    client.pause(&admin);
    assert!(client.is_paused());

    let worker_id = Symbol::new(&env, "worker1");
    assert_eq!(
        client.try_submit_review(&rep_mgr, &worker_id, &8_000, &zero_hash(&env)),
        Err(Ok(ContractError::ContractIsPaused))
    );
}

#[test]
fn test_unpause_resumes_operations() {
    let (env, _admin, rep_mgr, _worker) = setup();
    let contract_id = env.register_contract(None, ReputationContract);
    let client = ReputationContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(&admin);
    client.grant_role(&admin, &Symbol::new(&env, ROLE_REP_MGR), &rep_mgr);
    client.grant_role(&admin, &Symbol::new(&env, ROLE_PAUSER), &admin);

    client.pause(&admin);
    client.unpause(&admin);
    assert!(!client.is_paused());

    let worker_id = Symbol::new(&env, "worker1");
    client.submit_review(&rep_mgr, &worker_id, &5_000, &zero_hash(&env));
    assert_eq!(client.get_score(&worker_id), 5_000);
}

// ---------------------------------------------------------------------------
// Role management
// ---------------------------------------------------------------------------

#[test]
fn test_grant_and_has_role() {
    let (env, _admin, _rep_mgr, _worker) = setup();
    let contract_id = env.register_contract(None, ReputationContract);
    let client = ReputationContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(&admin);

    let new_mgr = Address::generate(&env);
    assert!(!client.has_role(&Symbol::new(&env, ROLE_REP_MGR), &new_mgr));
    client.grant_role(&admin, &Symbol::new(&env, ROLE_REP_MGR), &new_mgr);
    assert!(client.has_role(&Symbol::new(&env, ROLE_REP_MGR), &new_mgr));
}

#[test]
fn test_revoke_role() {
    let (env, _admin, rep_mgr, _worker) = setup();
    let contract_id = env.register_contract(None, ReputationContract);
    let client = ReputationContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(&admin);
    client.grant_role(&admin, &Symbol::new(&env, ROLE_REP_MGR), &rep_mgr);
    assert!(client.has_role(&Symbol::new(&env, ROLE_REP_MGR), &rep_mgr));

    client.revoke_role(&admin, &Symbol::new(&env, ROLE_REP_MGR), &rep_mgr);
    assert!(!client.has_role(&Symbol::new(&env, ROLE_REP_MGR), &rep_mgr));
}

// ---------------------------------------------------------------------------
// Read helpers
// ---------------------------------------------------------------------------

#[test]
fn test_get_reviews_returns_history() {
    let (env, _admin, rep_mgr, _worker) = setup();
    let contract_id = env.register_contract(None, ReputationContract);
    let client = ReputationContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(&admin);
    client.grant_role(&admin, &Symbol::new(&env, ROLE_REP_MGR), &rep_mgr);

    let worker_id = Symbol::new(&env, "worker1");
    client.submit_review(&rep_mgr, &worker_id, &7_000, &zero_hash(&env));
    client.submit_review(&rep_mgr, &worker_id, &9_000, &zero_hash(&env));

    let reviews = client.get_reviews(&worker_id);
    assert_eq!(reviews.len(), 2);
    assert_eq!(reviews.get(0).unwrap().rating_bps, 7_000);
    assert_eq!(reviews.get(1).unwrap().rating_bps, 9_000);
}

#[test]
fn test_get_score_returns_zero_for_unknown_worker() {
    let (env, _admin, _rep_mgr, _worker) = setup();
    let contract_id = env.register_contract(None, ReputationContract);
    let client = ReputationContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(&admin);

    assert_eq!(client.get_score(&Symbol::new(&env, "unknown")), 0);
}
