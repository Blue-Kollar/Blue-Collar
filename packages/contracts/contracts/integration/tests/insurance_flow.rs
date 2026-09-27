//! Insurance pool claims tied to a real job outcome.
//!
//! The per-contract tests exercise contribute/claim/payout in isolation. This
//! file drives the pool from an actual escrowed job that was lost at
//! arbitration, and checks the payout amount against the pool's own accounting.
//!
//! Run:
//!   cargo test -p bluecollar-integration --test insurance_flow

#![cfg(test)]

mod common;

use soroban_sdk::{testutils::Address as _, token, Address, Env, String, Symbol};

use bluecollar_dispute::DisputeOutcome;

use common::{deploy_dispute, deploy_escrow, deploy_insurance_pool, deploy_token, mint};

#[test]
fn job_lost_at_arbitration_pays_out_an_insurance_claim() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let arbitrator = Address::generate(&env);
    let claims_mgr = Address::generate(&env);
    let underwriter = Address::generate(&env);
    let payer = Address::generate(&env);
    let worker = Address::generate(&env);

    let token = deploy_token(&env, &admin, &payer, 100_000);
    mint(&env, &token.address, &underwriter, 100_000);

    let escrow = deploy_escrow(&env, &admin);
    escrow.grant_role(&admin, &Symbol::new(&env, "arbitrator"), &arbitrator);
    let dispute = deploy_dispute(&env, &admin, &arbitrator);
    let pool = deploy_insurance_pool(&env, &admin, &token.address, 500, &claims_mgr);

    // Fund the pool.
    token::Client::new(&env, &token.address).approve(&underwriter, &pool.address, &80_000, &200_000);
    pool.contribute(&underwriter, &token.address, &80_000);
    assert_eq!(pool.get_pool_stats(&token.address).total_balance, 80_000);

    // A job is escrowed, then disputed by the payer.
    let job_id = Symbol::new(&env, "job_ins");
    let expiry = env.ledger().timestamp() + 86_400;
    escrow.create_escrow(&payer, &worker, &token.address, &job_id, &30_000, &expiry);
    escrow.dispute_escrow(&payer, &job_id);

    let dispute_id = Symbol::new(&env, "dsp_ins");
    dispute.file_dispute(
        &dispute_id,
        &payer,
        &worker,
        &token.address,
        &1_000,
        &String::from_str(&env, "ipfs://payer-evidence"),
    );
    dispute.submit_evidence(
        &dispute_id,
        &worker,
        &String::from_str(&env, "ipfs://worker-evidence"),
    );

    // Arbitrator rules for the worker: escrowed funds are released away from
    // the payer, who is the party the pool covers.
    dispute.decide(&dispute_id, &arbitrator, &DisputeOutcome::ReleaseRespondent, &0);
    dispute.settle(&dispute_id);

    let release_to_beneficiary =
        dispute.get_dispute(&dispute_id).unwrap().outcome == DisputeOutcome::ReleaseRespondent;
    escrow.resolve_dispute(&arbitrator, &job_id, &release_to_beneficiary);

    // payer: 100_000 - 30_000 escrow - 1_000 bond
    assert_eq!(token.balance(&payer), 69_000);
    assert_eq!(token.balance(&worker), 31_000);

    // The payer claims the escrowed amount they lost.
    let claim_id = Symbol::new(&env, "clm_ins");
    pool.file_claim(&payer, &claim_id, &30_000);
    pool.approve_claim(&claims_mgr, &claim_id);
    pool.pay_claim(&claims_mgr, &claim_id, &token.address);

    assert_eq!(token.balance(&payer), 99_000);
    assert_eq!(token.balance(&pool.address), 50_000);

    let claim = pool.get_claim(&claim_id);
    assert_eq!(claim.amount, 30_000);
    assert_eq!(claim.claimant, payer);
    assert_eq!(claim.status, String::from_str(&env, "paid"));

    let stats = pool.get_pool_stats(&token.address);
    assert_eq!(stats.total_contributions, 80_000);
    assert_eq!(stats.total_claims_paid, 30_000);
    assert_eq!(stats.total_balance, 50_000);
}
