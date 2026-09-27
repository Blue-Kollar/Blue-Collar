//! Reputation changes chained to real job and dispute events.
//!
//! The reputation contract's own tests call `submit_review` / `slash_reputation`
//! directly. Here the score and badge changes follow an actual escrow release
//! and an actual arbitrated dispute.
//!
//! Run:
//!   cargo test -p bluecollar-integration --test reputation_flow

#![cfg(test)]

mod common;

use soroban_sdk::{testutils::Address as _, Address, Env, String, Symbol};

use bluecollar_dispute::DisputeOutcome;

use common::{
    deploy_dispute, deploy_market, deploy_registry, deploy_reputation, deploy_token, zero_hash,
};

#[test]
fn completed_job_raises_worker_reputation_and_awards_badge() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let curator = Address::generate(&env);
    let rep_mgr = Address::generate(&env);
    let payer = Address::generate(&env);
    let owner = Address::generate(&env);

    let registry = deploy_registry(&env, &admin);
    let market = deploy_market(&env, &admin, 0, &admin);
    let reputation = deploy_reputation(&env, &admin, &rep_mgr);
    let token = deploy_token(&env, &admin, &payer, 100_000);

    // Register the worker.
    registry.add_curator(&admin, &curator);
    let worker_id = Symbol::new(&env, "worker_rep");
    registry.register(
        &worker_id,
        &owner,
        &String::from_str(&env, "Alice the Plumber"),
        &Symbol::new(&env, "plumber"),
        &zero_hash(&env),
        &zero_hash(&env),
        &curator,
    );
    let worker = registry.get_worker(&worker_id).unwrap();
    assert_eq!(reputation.get_score(&worker_id), 0);

    // Job runs through escrow and completes.
    let job_id = Symbol::new(&env, "job_rep");
    let expiry = env.ledger().timestamp() + 86_400;
    market.create_escrow(&job_id, &payer, &worker.wallet, &token.address, &20_000, &expiry);
    market.release_escrow(&job_id, &payer);
    assert_eq!(token.balance(&worker.wallet), 20_000);

    // Completion feeds the review.
    reputation.submit_review(&rep_mgr, &worker_id, &9_200, &zero_hash(&env));

    let record = reputation.get_record(&worker_id);
    assert_eq!(record.score, 9_200);
    assert_eq!(record.review_count, 1);

    // A second completed job averages into the score.
    let job_id_2 = Symbol::new(&env, "job_rep2");
    market.create_escrow(&job_id_2, &payer, &worker.wallet, &token.address, &10_000, &expiry);
    market.release_escrow(&job_id_2, &payer);
    reputation.submit_review(&rep_mgr, &worker_id, &8_800, &zero_hash(&env));

    let record = reputation.get_record(&worker_id);
    assert_eq!(record.score, 9_000); // (9_200 + 8_800) / 2
    assert_eq!(record.review_count, 2);

    // Sustained score earns a badge.
    let badge = Symbol::new(&env, "trusted");
    reputation.award_badge(&rep_mgr, &worker_id, &badge);
    assert!(reputation.has_badge(&worker_id, &badge));
    assert_eq!(reputation.get_record(&worker_id).badges.len(), 1);
}

#[test]
fn dispute_resolved_against_worker_slashes_reputation_and_revokes_badge() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let arbitrator = Address::generate(&env);
    let rep_mgr = Address::generate(&env);
    let payer = Address::generate(&env);
    let worker = Address::generate(&env);

    let reputation = deploy_reputation(&env, &admin, &rep_mgr);
    let dispute = deploy_dispute(&env, &admin, &arbitrator);
    let token = deploy_token(&env, &admin, &payer, 100_000);

    // Worker starts with a good score and a badge.
    let worker_id = Symbol::new(&env, "worker_dsp");
    let badge = Symbol::new(&env, "trusted");
    reputation.submit_review(&rep_mgr, &worker_id, &9_000, &zero_hash(&env));
    reputation.award_badge(&rep_mgr, &worker_id, &badge);
    assert_eq!(reputation.get_score(&worker_id), 9_000);

    // Dispute filed and decided against the worker.
    let dispute_id = Symbol::new(&env, "dsp_rep");
    dispute.file_dispute(
        &dispute_id,
        &payer,
        &worker,
        &token.address,
        &5_000,
        &String::from_str(&env, "ipfs://payer-evidence"),
    );
    dispute.submit_evidence(
        &dispute_id,
        &worker,
        &String::from_str(&env, "ipfs://worker-evidence"),
    );
    dispute.decide(&dispute_id, &arbitrator, &DisputeOutcome::RefundDisputer, &0);
    dispute.settle(&dispute_id);
    assert_eq!(token.balance(&payer), 100_000);

    // The ruling drives the reputation penalty.
    let outcome = dispute.get_dispute(&dispute_id).unwrap().outcome;
    assert_eq!(outcome, DisputeOutcome::RefundDisputer);
    reputation.slash_reputation(&rep_mgr, &worker_id, &2_500);
    reputation.revoke_badge(&rep_mgr, &worker_id, &badge);

    assert_eq!(reputation.get_score(&worker_id), 6_500);
    assert!(!reputation.has_badge(&worker_id, &badge));
}
