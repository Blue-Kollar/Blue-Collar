//! Cross-contract dispute resolution flows.
//!
//! Covers the chain the per-contract unit tests cannot: an active escrow is
//! disputed, evidence is attached, an arbitrator decides, and the payout that
//! follows is checked against that decision.
//!
//! Run:
//!   cargo test -p bluecollar-integration --test dispute_flow

#![cfg(test)]

mod common;

use soroban_sdk::{testutils::Address as _, Address, Env, String, Symbol};

use bluecollar_dispute::{DisputeOutcome, DisputeStatus};

use common::{deploy_dispute, deploy_escrow, deploy_market, deploy_token};

// === Dispute contract: file -> evidence -> decide -> settle

#[test]
fn dispute_split_decision_splits_locked_funds() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let arbitrator = Address::generate(&env);
    let payer = Address::generate(&env);
    let worker = Address::generate(&env);

    let token = deploy_token(&env, &admin, &payer, 100_000);
    let dispute = deploy_dispute(&env, &admin, &arbitrator);

    let id = Symbol::new(&env, "dsp_split");
    dispute.file_dispute(
        &id,
        &payer,
        &worker,
        &token.address,
        &10_000,
        &String::from_str(&env, "ipfs://payer-evidence"),
    );

    // Funds leave the payer and sit in the dispute contract until settlement.
    assert_eq!(token.balance(&payer), 90_000);
    assert_eq!(token.balance(&dispute.address), 10_000);

    dispute.submit_evidence(&id, &worker, &String::from_str(&env, "ipfs://worker-evidence"));
    assert_eq!(dispute.get_dispute(&id).unwrap().status, DisputeStatus::Evidence);

    // 60% to the worker, remainder back to the payer.
    dispute.decide(&id, &arbitrator, &DisputeOutcome::Split, &6_000);
    dispute.settle(&id);

    assert_eq!(token.balance(&worker), 6_000);
    assert_eq!(token.balance(&payer), 94_000);
    assert_eq!(token.balance(&dispute.address), 0);

    let record = dispute.get_dispute(&id).unwrap();
    assert_eq!(record.status, DisputeStatus::Settled);
    assert_eq!(record.outcome, DisputeOutcome::Split);
    assert_eq!(record.arbitrator, Some(arbitrator));
    assert!(record.disputer_evidence.is_some());
    assert!(record.respondent_evidence.is_some());
}

// === Market escrow payout driven by the dispute contract's decision

#[test]
fn market_escrow_payout_follows_arbitrator_decision() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let arbitrator = Address::generate(&env);
    let payer = Address::generate(&env);
    let worker = Address::generate(&env);

    let token = deploy_token(&env, &admin, &payer, 100_000);
    let market = deploy_market(&env, &admin, 0, &admin);
    let dispute = deploy_dispute(&env, &admin, &arbitrator);

    // Job funds locked in market escrow.
    let escrow_id = Symbol::new(&env, "job_esc");
    let expiry = env.ledger().timestamp() + 86_400;
    market.create_escrow(&escrow_id, &payer, &worker, &token.address, &40_000, &expiry);
    assert_eq!(token.balance(&payer), 60_000);

    // Payer raises the dispute on the active escrow and pays the arbitration fee.
    market.add_arbitrator(&arbitrator);
    market.request_arbitration(&escrow_id, &payer, &arbitrator, &1_000);
    assert_eq!(token.balance(&arbitrator), 1_000);

    // The dispute contract carries the evidence and the ruling; the filing
    // bond is separate from the escrowed job funds.
    let dispute_id = Symbol::new(&env, "job_dsp");
    dispute.file_dispute(
        &dispute_id,
        &payer,
        &worker,
        &token.address,
        &2_000,
        &String::from_str(&env, "ipfs://payer-evidence"),
    );
    dispute.submit_evidence(
        &dispute_id,
        &worker,
        &String::from_str(&env, "ipfs://worker-evidence"),
    );
    dispute.decide(&dispute_id, &arbitrator, &DisputeOutcome::ReleaseRespondent, &0);
    dispute.settle(&dispute_id);

    // Bond follows the ruling: worker takes it.
    assert_eq!(token.balance(&worker), 2_000);

    // The escrow payout is then adjusted to match that same ruling.
    let outcome = dispute.get_dispute(&dispute_id).unwrap().outcome;
    let release_to_worker = outcome == DisputeOutcome::ReleaseRespondent;
    market.resolve_arbitration(&escrow_id, &arbitrator, &release_to_worker);

    assert_eq!(token.balance(&worker), 42_000);
    assert_eq!(token.balance(&payer), 57_000);
    assert_eq!(token.balance(&market.address), 0);

    let escrow = market.get_escrow(&escrow_id).unwrap();
    assert!(escrow.released);
    assert!(market.get_arbitration(&escrow_id).unwrap().resolved);
}

// === Escrow contract: dispute resolved against the worker refunds the payer

#[test]
fn escrow_dispute_resolved_against_worker_refunds_depositor() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let arbitrator = Address::generate(&env);
    let payer = Address::generate(&env);
    let worker = Address::generate(&env);

    let token = deploy_token(&env, &admin, &payer, 100_000);
    let escrow = deploy_escrow(&env, &admin);
    escrow.grant_role(&admin, &Symbol::new(&env, "arbitrator"), &arbitrator);

    let id = Symbol::new(&env, "esc_dsp");
    let expiry = env.ledger().timestamp() + 86_400;
    escrow.create_escrow(&payer, &worker, &token.address, &id, &25_000, &expiry);
    assert_eq!(token.balance(&payer), 75_000);

    // Worker disputes, arbitrator rules for the payer.
    escrow.dispute_escrow(&worker, &id);
    escrow.resolve_dispute(&arbitrator, &id, &false);

    assert_eq!(token.balance(&payer), 100_000);
    assert_eq!(token.balance(&worker), 0);
    assert_eq!(token.balance(&escrow.address), 0);
}
