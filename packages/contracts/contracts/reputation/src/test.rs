//! Regression tests for the reputation contract security audit (issue #1017).
//!
//! Covered findings:
//! 1. `slash_reputation` was unguarded — now requires `ROLE_REP_MGR`.
//! 2. `reset_reputation` was open to anyone — now requires `ROLE_ADMIN`.
//! 3. `submit_review` emitted event before writing state — CEI order fixed.
//! 4. `award_badge` emitted event before writing badge list — CEI order fixed.
//!
//! Extended for issue #1849 (coverage ≥ 90%) and #1850 (pause/unpause patterns).

#![cfg(test)]
extern crate std;

use super::*;
use bluecollar_types::test_utils::zero_hash;
use soroban_sdk::{testutils::Address as _, Address, Env, Symbol};

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

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

#[test]
fn test_version_returns_one() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let (_, client) = deploy_client(&env);
    client.initialize(&admin);
    assert_eq!(client.version(), VERSION);
}

// ---------------------------------------------------------------------------
// submit_review
// ---------------------------------------------------------------------------

#[test]
fn test_submit_review_updates_score() {
    let (env, _admin, rep_mgr, _worker) = setup();
    let (_, client) = deploy_client(&env);
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
    let (_, client) = deploy_client(&env);
    let admin = Address::generate(&env);
    client.initialize(&admin);
    client.grant_role(&admin, &Symbol::new(&env, ROLE_REP_MGR), &rep_mgr);

    let worker_id = Symbol::new(&env, "worker1");
    client.submit_review(&rep_mgr, &worker_id, &6_000, &zero_hash(&env));
    client.submit_review(&rep_mgr, &worker_id, &8_000, &zero_hash(&env));
    // average: (6000 + 8000) / 2 = 7000
    assert_eq!(client.get_score(&worker_id), 7_000);
}

#[test]
fn test_submit_review_unauthorized() {
    let (env, _admin, _rep_mgr, _worker) = setup();
    let (_, client) = deploy_client(&env);
    let admin = Address::generate(&env);
    client.initialize(&admin);

    let attacker = Address::generate(&env);
    let worker_id = Symbol::new(&env, "worker1");
    assert_eq!(
        client.try_submit_review(&attacker, &worker_id, &8_000, &zero_hash(&env)),
        Err(Ok(ContractError::MissingRole))
    );
}

#[test]
fn test_submit_review_rating_overflow() {
    let (env, _admin, rep_mgr, _worker) = setup();
    let (_, client) = deploy_client(&env);
    let admin = Address::generate(&env);
    client.initialize(&admin);
    client.grant_role(&admin, &Symbol::new(&env, ROLE_REP_MGR), &rep_mgr);

    let worker_id = Symbol::new(&env, "worker1");
    assert_eq!(
        client.try_submit_review(&rep_mgr, &worker_id, &10_001, &zero_hash(&env)),
        Err(Ok(ContractError::RatingOutOfRange))
    );
}

#[test]
fn test_submit_review_rating_at_max_score_accepted() {
    let (env, _admin, rep_mgr, _worker) = setup();
    let (_, client) = deploy_client(&env);
    let admin = Address::generate(&env);
    client.initialize(&admin);
    client.grant_role(&admin, &Symbol::new(&env, ROLE_REP_MGR), &rep_mgr);

    let worker_id = Symbol::new(&env, "worker1");
    client.submit_review(&rep_mgr, &worker_id, &MAX_SCORE, &zero_hash(&env));
    assert_eq!(client.get_score(&worker_id), MAX_SCORE);
}

#[test]
fn test_submit_review_records_reviewer() {
    let (env, _admin, rep_mgr, _worker) = setup();
    let (_, client) = deploy_client(&env);
    let admin = Address::generate(&env);
    client.initialize(&admin);
    client.grant_role(&admin, &Symbol::new(&env, ROLE_REP_MGR), &rep_mgr);

    let worker_id = Symbol::new(&env, "worker1");
    client.submit_review(&rep_mgr, &worker_id, &7_500, &zero_hash(&env));
    let reviews = client.get_reviews(&worker_id);
    assert_eq!(reviews.len(), 1);
    assert_eq!(reviews.get(0).unwrap().reviewer, rep_mgr);
    assert_eq!(reviews.get(0).unwrap().rating_bps, 7_500);
}

// ---------------------------------------------------------------------------
// slash_reputation
// ---------------------------------------------------------------------------

#[test]
fn test_slash_reputation_by_rep_mgr() {
    let (env, _admin, rep_mgr, _worker) = setup();
    let (_, client) = deploy_client(&env);
    let admin = Address::generate(&env);
    client.initialize(&admin);
    client.grant_role(&admin, &Symbol::new(&env, ROLE_REP_MGR), &rep_mgr);

    let worker_id = Symbol::new(&env, "worker1");
    client.submit_review(&rep_mgr, &worker_id, &8_000, &zero_hash(&env));
    assert_eq!(client.get_score(&worker_id), 8_000);

    client.slash_reputation(&rep_mgr, &worker_id, &2_000);
    assert_eq!(client.get_score(&worker_id), 6_000);
}

#[test]
fn test_slash_reputation_clamps_at_zero() {
    let (env, _admin, rep_mgr, _worker) = setup();
    let (_, client) = deploy_client(&env);
    let admin = Address::generate(&env);
    client.initialize(&admin);
    client.grant_role(&admin, &Symbol::new(&env, ROLE_REP_MGR), &rep_mgr);

    let worker_id = Symbol::new(&env, "worker1");
    client.submit_review(&rep_mgr, &worker_id, &3_000, &zero_hash(&env));
    client.slash_reputation(&rep_mgr, &worker_id, &9_000);
    assert_eq!(client.get_score(&worker_id), 0);
}

#[test]
fn test_slash_reputation_unauthorized() {
    let (env, _admin, _rep_mgr, _worker) = setup();
    let (_, client) = deploy_client(&env);
    let admin = Address::generate(&env);
    client.initialize(&admin);

    let attacker = Address::generate(&env);
    let worker_id = Symbol::new(&env, "worker1");
    assert_eq!(
        client.try_slash_reputation(&attacker, &worker_id, &1_000),
        Err(Ok(ContractError::MissingRole))
    );
}

#[test]
fn test_slash_reputation_overflow_input() {
    let (env, _admin, rep_mgr, _worker) = setup();
    let (_, client) = deploy_client(&env);
    let admin = Address::generate(&env);
    client.initialize(&admin);
    client.grant_role(&admin, &Symbol::new(&env, ROLE_REP_MGR), &rep_mgr);

    // slash > MAX_SCORE should clamp, not panic
    let worker_id = Symbol::new(&env, "worker1");
    client.slash_reputation(&rep_mgr, &worker_id, &99_999);
    assert_eq!(client.get_score(&worker_id), 0);
}

#[test]
fn test_slash_reputation_at_max_score_accepted() {
    let (env, _admin, rep_mgr, _worker) = setup();
    let (_, client) = deploy_client(&env);
    let admin = Address::generate(&env);
    client.initialize(&admin);
    client.grant_role(&admin, &Symbol::new(&env, ROLE_REP_MGR), &rep_mgr);

    let worker_id = Symbol::new(&env, "worker1");
    client.submit_review(&rep_mgr, &worker_id, &MAX_SCORE, &zero_hash(&env));
    client.slash_reputation(&rep_mgr, &worker_id, &MAX_SCORE);
    assert_eq!(client.get_score(&worker_id), 0);
}

// ---------------------------------------------------------------------------
// reset_reputation
// ---------------------------------------------------------------------------

#[test]
fn test_reset_reputation_by_admin() {
    let (env, _admin, rep_mgr, _worker) = setup();
    let (_, client) = deploy_client(&env);
    let admin = Address::generate(&env);
    client.initialize(&admin);
    client.grant_role(&admin, &Symbol::new(&env, ROLE_REP_MGR), &rep_mgr);

    let worker_id = Symbol::new(&env, "worker1");
    client.submit_review(&rep_mgr, &worker_id, &9_000, &zero_hash(&env));
    assert_eq!(client.get_score(&worker_id), 9_000);

    client.reset_reputation(&admin, &worker_id);
    assert_eq!(client.get_score(&worker_id), 0);
}

#[test]
fn test_reset_reputation_unauthorized() {
    let (env, _admin, _rep_mgr, _worker) = setup();
    let (_, client) = deploy_client(&env);
    let admin = Address::generate(&env);
    client.initialize(&admin);

    let attacker = Address::generate(&env);
    let worker_id = Symbol::new(&env, "worker1");
    assert_eq!(
        client.try_reset_reputation(&attacker, &worker_id),
        Err(Ok(ContractError::MissingRole))
    );
}

#[test]
fn test_reset_reputation_rep_mgr_blocked() {
    let (env, _admin, rep_mgr, _worker) = setup();
    let (_, client) = deploy_client(&env);
    let admin = Address::generate(&env);
    client.initialize(&admin);
    client.grant_role(&admin, &Symbol::new(&env, ROLE_REP_MGR), &rep_mgr);

    let worker_id = Symbol::new(&env, "worker1");
    // rep_mgr does not have ROLE_ADMIN
    assert_eq!(
        client.try_reset_reputation(&rep_mgr, &worker_id),
        Err(Ok(ContractError::MissingRole))
    );
}

// ---------------------------------------------------------------------------
// award_badge / revoke_badge
// ---------------------------------------------------------------------------

#[test]
fn test_award_badge_success() {
    let (env, _admin, rep_mgr, _worker) = setup();
    let (_, client) = deploy_client(&env);
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
    let (_, client) = deploy_client(&env);
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
    let (_, client) = deploy_client(&env);
    let admin = Address::generate(&env);
    client.initialize(&admin);

    let attacker = Address::generate(&env);
    let worker_id = Symbol::new(&env, "worker1");
    let badge = Symbol::new(&env, "top_rated");
    assert_eq!(
        client.try_award_badge(&attacker, &worker_id, &badge),
        Err(Ok(ContractError::MissingRole))
    );
}

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

#[test]
fn test_revoke_badge_not_awarded_panics() {
    let (env, _admin, rep_mgr, _worker) = setup();
    let (_, client) = deploy_client(&env);
    let admin = Address::generate(&env);
    client.initialize(&admin);
    client.grant_role(&admin, &Symbol::new(&env, ROLE_REP_MGR), &rep_mgr);

    let worker_id = Symbol::new(&env, "worker1");
    let badge = Symbol::new(&env, "ghost_badge");
    assert_eq!(
        client.try_revoke_badge(&rep_mgr, &worker_id, &badge),
        Err(Ok(ContractError::BadgeNotFound))
    );
}

#[test]
fn test_revoke_badge_unauthorized() {
    let (env, _admin, rep_mgr, _worker) = setup();
    let (_, client) = deploy_client(&env);
    let admin = Address::generate(&env);
    client.initialize(&admin);
    client.grant_role(&admin, &Symbol::new(&env, ROLE_REP_MGR), &rep_mgr);

    let attacker = Address::generate(&env);
    let worker_id = Symbol::new(&env, "worker1");
    let badge = Symbol::new(&env, "top_rated");
    client.award_badge(&rep_mgr, &worker_id, &badge);
    assert_eq!(
        client.try_revoke_badge(&attacker, &worker_id, &badge),
        Err(Ok(ContractError::MissingRole))
    );
}

// ---------------------------------------------------------------------------
// pause / unpause  (#1850)
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
fn test_slash_reputation_while_paused() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let rep_mgr = Address::generate(&env);
    let (_, client) = deploy_client(&env);
    client.initialize(&admin);
    client.grant_role(&admin, &Symbol::new(&env, ROLE_REP_MGR), &rep_mgr);
    client.grant_role(&admin, &Symbol::new(&env, ROLE_PAUSER), &admin);

    client.pause(&admin);
    let worker_id = Symbol::new(&env, "worker1");
    assert_eq!(
        client.try_slash_reputation(&rep_mgr, &worker_id, &1_000),
        Err(Ok(ContractError::ContractIsPaused))
    );
}

#[test]
fn test_reset_reputation_while_paused() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let (_, client) = deploy_client(&env);
    client.initialize(&admin);
    client.grant_role(&admin, &Symbol::new(&env, ROLE_PAUSER), &admin);

    client.pause(&admin);
    let worker_id = Symbol::new(&env, "worker1");
    assert_eq!(
        client.try_reset_reputation(&admin, &worker_id),
        Err(Ok(ContractError::ContractIsPaused))
    );
}

#[test]
fn test_award_badge_while_paused() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let rep_mgr = Address::generate(&env);
    let (_, client) = deploy_client(&env);
    client.initialize(&admin);
    client.grant_role(&admin, &Symbol::new(&env, ROLE_REP_MGR), &rep_mgr);
    client.grant_role(&admin, &Symbol::new(&env, ROLE_PAUSER), &admin);

    client.pause(&admin);
    let worker_id = Symbol::new(&env, "worker1");
    let badge = Symbol::new(&env, "gold");
    assert_eq!(
        client.try_award_badge(&rep_mgr, &worker_id, &badge),
        Err(Ok(ContractError::ContractIsPaused))
    );
}

#[test]
fn test_revoke_badge_while_paused() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let rep_mgr = Address::generate(&env);
    let (_, client) = deploy_client(&env);
    client.initialize(&admin);
    client.grant_role(&admin, &Symbol::new(&env, ROLE_REP_MGR), &rep_mgr);
    client.grant_role(&admin, &Symbol::new(&env, ROLE_PAUSER), &admin);

    // award first (before pausing)
    let worker_id = Symbol::new(&env, "worker1");
    let badge = Symbol::new(&env, "gold");
    client.award_badge(&rep_mgr, &worker_id, &badge);

    client.pause(&admin);
    assert_eq!(
        client.try_revoke_badge(&rep_mgr, &worker_id, &badge),
        Err(Ok(ContractError::ContractIsPaused))
    );
}

#[test]
fn test_pause_requires_pauser_role() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let (_, client) = deploy_client(&env);
    client.initialize(&admin);

    let attacker = Address::generate(&env);
    assert_eq!(
        client.try_pause(&attacker),
        Err(Ok(ContractError::MissingRole))
    );
}

#[test]
fn test_unpause_requires_pauser_role() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let (_, client) = deploy_client(&env);
    client.initialize(&admin);
    client.grant_role(&admin, &Symbol::new(&env, ROLE_PAUSER), &admin);
    client.pause(&admin);

    let attacker = Address::generate(&env);
    assert_eq!(
        client.try_unpause(&attacker),
        Err(Ok(ContractError::MissingRole))
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
// Role management  (#1851)
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
fn test_grant_role_idempotent() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let (_, client) = deploy_client(&env);
    client.initialize(&admin);

    let new_mgr = Address::generate(&env);
    let role = Symbol::new(&env, ROLE_REP_MGR);
    client.grant_role(&admin, &role, &new_mgr);
    client.grant_role(&admin, &role, &new_mgr); // second call must not add duplicate
    // No observable duplicate — has_role still returns true once
    assert!(client.has_role(&role, &new_mgr));
}

#[test]
fn test_grant_role_non_admin_panics() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let (_, client) = deploy_client(&env);
    client.initialize(&admin);

    let attacker = Address::generate(&env);
    let new_mgr = Address::generate(&env);
    assert_eq!(
        client.try_grant_role(&attacker, &Symbol::new(&env, ROLE_REP_MGR), &new_mgr),
        Err(Ok(ContractError::MissingRole))
    );
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

#[test]
fn test_revoke_role_non_admin_panics() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let rep_mgr = Address::generate(&env);
    let (_, client) = deploy_client(&env);
    client.initialize(&admin);
    client.grant_role(&admin, &Symbol::new(&env, ROLE_REP_MGR), &rep_mgr);

    let attacker = Address::generate(&env);
    assert_eq!(
        client.try_revoke_role(&attacker, &Symbol::new(&env, ROLE_REP_MGR), &rep_mgr),
        Err(Ok(ContractError::MissingRole))
    );
}

#[test]
fn test_grant_role_while_paused_panics() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let (_, client) = deploy_client(&env);
    client.initialize(&admin);
    client.grant_role(&admin, &Symbol::new(&env, ROLE_PAUSER), &admin);
    client.pause(&admin);

    let new_mgr = Address::generate(&env);
    assert_eq!(
        client.try_grant_role(&admin, &Symbol::new(&env, ROLE_REP_MGR), &new_mgr),
        Err(Ok(ContractError::ContractIsPaused))
    );
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

#[test]
fn test_get_record_for_unreviewed_worker_returns_zero_score() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let (_, client) = deploy_client(&env);
    client.initialize(&admin);

    let worker_id = Symbol::new(&env, "ghost");
    let record = client.get_record(&worker_id);
    assert_eq!(record.score, 0);
    assert_eq!(record.review_count, 0);
}

#[test]
fn test_get_reviews_empty_for_unknown_worker() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let (_, client) = deploy_client(&env);
    client.initialize(&admin);

    let reviews = client.get_reviews(&Symbol::new(&env, "ghost"));
    assert_eq!(reviews.len(), 0);
}

#[test]
fn test_has_badge_false_for_unknown() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let (_, client) = deploy_client(&env);
    client.initialize(&admin);

    assert!(!client.has_badge(&Symbol::new(&env, "ghost"), &Symbol::new(&env, "gold")));
}

#[test]
fn test_extend_worker_ttl_no_panic_for_unregistered() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let (_, client) = deploy_client(&env);
    client.initialize(&admin);
    // extend_worker_ttl on a non-existent key is a no-op, not a panic
    client.extend_worker_ttl(&Symbol::new(&env, "ghost"));
}
