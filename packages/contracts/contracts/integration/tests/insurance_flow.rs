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

use soroban_sdk::{testutils::{Address as _, Ledger as _}, token, Address, Env, String, Symbol};

use bluecollar_insurance_pool::InsurancePoolContractClient;

use bluecollar_dispute::DisputeOutcome;
use bluecollar_types::ContractError;

use common::{
    deploy_dispute, deploy_escrow_with_arbitrator, deploy_insurance_pool, deploy_token, mint,
};

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
    mint(&env, &token.address, &payer, 10_000);

    let escrow = deploy_escrow_with_arbitrator(&env, &admin, &arbitrator);
    let dispute = deploy_dispute(&env, &admin, &arbitrator);
    let pool = deploy_insurance_pool(&env, &admin, &token.address, 500, &claims_mgr);

    // Fund the pool.
    token::Client::new(&env, &token.address).approve(
        &underwriter,
        &pool.address,
        &80_000,
        &200_000,
    );
    pool.contribute(&underwriter, &token.address, &80_000);
    // Payer must contribute to be eligible for claims.
    token::Client::new(&env, &token.address).approve(
        &payer,
        &pool.address,
        &10_000,
        &20_000,
    );
    pool.contribute(&payer, &token.address, &10_000);
    assert_eq!(pool.get_pool_stats(&token.address).total_balance, 90_000);

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
    dispute.decide(
        &dispute_id,
        &arbitrator,
        &DisputeOutcome::ReleaseRespondent,
        &0,
    );
    dispute.settle(&dispute_id);

    let release_to_beneficiary =
        dispute.get_dispute(&dispute_id).unwrap().outcome == DisputeOutcome::ReleaseRespondent;
    escrow.resolve_dispute(&arbitrator, &job_id, &release_to_beneficiary);

    // payer: 110_000 minted - 10_000 contrib - 30_000 escrow - 1_000 bond = 69_000
    assert_eq!(token.balance(&payer), 69_000);
    assert_eq!(token.balance(&worker), 31_000);

    // The payer claims the escrowed amount they lost.
    let claim_id = Symbol::new(&env, "clm_ins");
    pool.file_claim(&payer, &claim_id, &30_000);
    pool.approve_claim(&claims_mgr, &claim_id);
    pool.pay_claim(&claims_mgr, &claim_id, &token.address);

    // payer: 69_000 + 30_000 claim = 99_000
    assert_eq!(token.balance(&payer), 99_000);
    assert_eq!(token.balance(&pool.address), 60_000);

    let claim = pool.get_claim(&claim_id);
    assert_eq!(claim.amount, 30_000);
    assert_eq!(claim.claimant, payer);
    assert_eq!(claim.status, String::from_str(&env, "paid"));

    let stats = pool.get_pool_stats(&token.address);
    assert_eq!(stats.total_contributions, 90_000);
    assert_eq!(stats.total_claims_paid, 30_000);
    assert_eq!(stats.total_balance, 60_000);
}

#[test]
fn claim_after_expiry_returns_error() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let claims_mgr = Address::generate(&env);
    let payer = Address::generate(&env);
    let underwriter = Address::generate(&env);

    let token = deploy_token(&env, &admin, &payer, 100_000);
    mint(&env, &token.address, &underwriter, 100_000);
    mint(&env, &token.address, &payer, 10_000);

    let pool = deploy_insurance_pool(&env, &admin, &token.address, 500, &claims_mgr);

    token::Client::new(&env, &token.address).approve(
        &underwriter,
        &pool.address,
        &80_000,
        &200_000,
    );
    pool.contribute(&underwriter, &token.address, &80_000);
    token::Client::new(&env, &token.address).approve(
        &payer,
        &pool.address,
        &10_000,
        &20_000,
    );
    pool.contribute(&payer, &token.address, &10_000);

    // Set ledger timestamp to a known value, then set policy expiry to before it.
    env.ledger().set_timestamp(1_000_000);
    let past_expiry = 500_000;
    pool.set_policy_expiry(&admin, &token.address, &past_expiry);

    let claim_id = Symbol::new(&env, "clm_expired");
    let result = pool.try_file_claim(&payer, &claim_id, &30_000);
    assert!(result.is_err());
    assert_eq!(result.unwrap_err(), Ok(ContractError::InvalidExpiry));
}

#[test]
fn double_claim_returns_error() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let claims_mgr = Address::generate(&env);
    let payer = Address::generate(&env);
    let underwriter = Address::generate(&env);

    let token = deploy_token(&env, &admin, &payer, 100_000);
    mint(&env, &token.address, &underwriter, 100_000);
    mint(&env, &token.address, &payer, 10_000);

    let pool = deploy_insurance_pool(&env, &admin, &token.address, 500, &claims_mgr);

    token::Client::new(&env, &token.address).approve(
        &underwriter,
        &pool.address,
        &80_000,
        &200_000,
    );
    pool.contribute(&underwriter, &token.address, &80_000);
    token::Client::new(&env, &token.address).approve(
        &payer,
        &pool.address,
        &10_000,
        &20_000,
    );
    pool.contribute(&payer, &token.address, &10_000);

    let claim_id = Symbol::new(&env, "clm_double");
    pool.file_claim(&payer, &claim_id, &30_000);

    let result = pool.try_file_claim(&payer, &claim_id, &30_000);
    assert!(result.is_err());
    assert_eq!(result.unwrap_err(), Ok(ContractError::AlreadyExists));
}

#[test]
fn claim_without_premium_returns_error() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let claims_mgr = Address::generate(&env);
    let payer = Address::generate(&env);
    let underwriter = Address::generate(&env);
    let non_contributor = Address::generate(&env);

    let token = deploy_token(&env, &admin, &payer, 100_000);
    mint(&env, &token.address, &underwriter, 100_000);
    mint(&env, &token.address, &non_contributor, 10_000);

    let pool = deploy_insurance_pool(&env, &admin, &token.address, 500, &claims_mgr);

    token::Client::new(&env, &token.address).approve(
        &underwriter,
        &pool.address,
        &80_000,
        &200_000,
    );
    pool.contribute(&underwriter, &token.address, &80_000);

    let claim_id = Symbol::new(&env, "clm_no_premium");
    let result = pool.try_file_claim(&non_contributor, &claim_id, &5_000);
    assert!(result.is_err());
    assert_eq!(result.unwrap_err(), Ok(ContractError::NoActiveStake));
}