//! Property-based fuzz tests for the Dispute contract.
//!
//! Uses `proptest` to generate random inputs and verify invariants across the
//! dispute lifecycle:
//!   1. `file_dispute` with random amounts should lock tokens correctly.
//!   2. `submit_evidence` with arbitrary hashes should never corrupt state.
//!   3. Auth-bypass invariant: a stranger calling `decide` must always fail.
//!
// `Env::register_contract` is deprecated in favour of `Env::register`; the
// helpers here are migrated alongside the contracts, not ahead of them.
#![allow(deprecated)]

use proptest::prelude::*;
use soroban_sdk::{
    testutils::Address as _,
    token::{Client as TokenClient, StellarAssetClient},
    Address, Env, String as SorobanString, Symbol,
};

use bluecollar_dispute::{
    DisputeContract, DisputeContractClient, DisputeOutcome, DisputeStatus,
};

// ---------------------------------------------------------------------------
// Strategy helpers
// ---------------------------------------------------------------------------

/// Random positive dispute amount (1 to 1_000_000).
fn arb_amount() -> impl Strategy<Value = i128> {
    1i128..=1_000_000i128
}

/// Random evidence hash as a hex string (32 hex chars = 16 bytes represented).
fn arb_evidence_hash() -> impl Strategy<Value = String> {
    prop::array::uniform32(any::<u8>())
        .prop_map(|bytes| bytes.iter().fold(String::new(), |mut s, b| {
            use std::fmt::Write as _;
            let _ = write!(s, "{b:02x}");
            s
        }))
}

/// Random dispute id (1–8 lowercase letters so it fits in a Soroban Symbol).
fn arb_dispute_id() -> impl Strategy<Value = String> {
    "[a-z]{1,8}".prop_map(|s| s)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

proptest! {
    /// Fuzz: `file_dispute` with random valid amounts locks exactly `amount`
    /// tokens in the contract and sets status to `Open`.
    #[test]
    fn fuzz_file_dispute_locks_tokens(
        amount in arb_amount(),
        dispute_id in arb_dispute_id(),
        evidence_hash in arb_evidence_hash(),
    ) {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let disputer = Address::generate(&env);
        let respondent = Address::generate(&env);

        let token_id = env.register_stellar_asset_contract_v2(admin.clone());
        let token_addr = token_id.address();
        StellarAssetClient::new(&env, &token_addr).mint(&disputer, &1_000_000);

        let contract_id = env.register_contract(None, DisputeContract);
        let client = DisputeContractClient::new(&env, &contract_id);
        client.initialize(&admin);

        let id = Symbol::new(&env, &dispute_id);
        let ev = SorobanString::from_str(&env, &evidence_hash);

        client.file_dispute(&id, &disputer, &respondent, &token_addr, &amount, &ev);

        // Invariant: dispute exists and is Open.
        let dispute = client.get_dispute(&id).unwrap();
        prop_assert_eq!(dispute.status, DisputeStatus::Open);
        prop_assert_eq!(dispute.amount, amount);

        // Invariant: tokens are locked in the contract.
        let contract_balance = TokenClient::new(&env, &token_addr).balance(&contract_id);
        prop_assert_eq!(contract_balance, amount);

        // Invariant: disputer balance decreased by exactly `amount`.
        let disputer_balance = TokenClient::new(&env, &token_addr).balance(&disputer);
        prop_assert_eq!(disputer_balance, 1_000_000 - amount);
    }

    /// Fuzz: `submit_evidence` with arbitrary hash strings by both parties
    /// advances the dispute to `Evidence` status and stores the hashes without
    /// corrupting other dispute fields.
    #[test]
    fn fuzz_submit_evidence_arbitrary_hashes(
        amount in arb_amount(),
        dispute_id in arb_dispute_id(),
        hash1 in arb_evidence_hash(),
        hash2 in arb_evidence_hash(),
    ) {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let disputer = Address::generate(&env);
        let respondent = Address::generate(&env);

        let token_id = env.register_stellar_asset_contract_v2(admin.clone());
        let token_addr = token_id.address();
        StellarAssetClient::new(&env, &token_addr).mint(&disputer, &1_000_000);

        let contract_id = env.register_contract(None, DisputeContract);
        let client = DisputeContractClient::new(&env, &contract_id);
        client.initialize(&admin);

        let id = Symbol::new(&env, &dispute_id);
        let initial_ev = SorobanString::from_str(&env, &hash1);

        client.file_dispute(&id, &disputer, &respondent, &token_addr, &amount, &initial_ev);

        // Respondent submits evidence.
        let ev2 = SorobanString::from_str(&env, &hash2);
        client.submit_evidence(&id, &respondent, &ev2);

        // Invariant: status advances to Evidence.
        let dispute = client.get_dispute(&id).unwrap();
        prop_assert_eq!(dispute.status, DisputeStatus::Evidence);

        // Invariant: amount and parties are unchanged.
        prop_assert_eq!(dispute.amount, amount);
        prop_assert_eq!(dispute.disputer, disputer);
        prop_assert_eq!(dispute.respondent, respondent);

        // Disputer may also submit evidence; must not panic.
        let ev3 = SorobanString::from_str(&env, &hash1);
        client.submit_evidence(&id, &disputer, &ev3);
    }

    /// Fuzz: a stranger (neither disputer, respondent, nor arbitrator) calling
    /// `decide` must always fail — `decide` enforces the arbitrator list.
    ///
    /// This is the auth-bypass invariant: even with `mock_all_auths()` active
    /// (which bypasses `require_auth` signature checks), the contract's own
    /// identity / role check on the arbitrator list must still reject strangers.
    #[test]
    fn fuzz_auth_bypass_stranger_decide_always_fails(
        amount in arb_amount(),
        dispute_id in arb_dispute_id(),
        evidence_hash in arb_evidence_hash(),
    ) {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let disputer = Address::generate(&env);
        let respondent = Address::generate(&env);
        // stranger is deliberately NOT added as an arbitrator.
        let stranger = Address::generate(&env);

        let token_id = env.register_stellar_asset_contract_v2(admin.clone());
        let token_addr = token_id.address();
        StellarAssetClient::new(&env, &token_addr).mint(&disputer, &1_000_000);

        let contract_id = env.register_contract(None, DisputeContract);
        let client = DisputeContractClient::new(&env, &contract_id);
        client.initialize(&admin);
        // No add_arbitrator call — stranger has no role.

        let id = Symbol::new(&env, &dispute_id);
        let ev = SorobanString::from_str(&env, &evidence_hash);
        client.file_dispute(&id, &disputer, &respondent, &token_addr, &amount, &ev);

        // Stranger's decide call must panic (contract panics on auth failure in
        // the Soroban test harness, which surfaces as a Rust panic).
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            client.decide(&id, &stranger, &DisputeOutcome::RefundDisputer, &0);
        }));
        prop_assert!(
            result.is_err(),
            "stranger must not be able to decide — auth bypass detected"
        );

        // Invariant: dispute is still Open (not decided).
        let dispute = client.get_dispute(&id).unwrap();
        prop_assert_ne!(dispute.status, DisputeStatus::Decided);

        // Invariant: locked tokens remain in the contract.
        let contract_balance = TokenClient::new(&env, &token_addr).balance(&contract_id);
        prop_assert_eq!(contract_balance, amount);
    }

    /// Fuzz: duplicate dispute IDs must be rejected with an error, not a panic,
    /// and the original dispute must remain intact.
    #[test]
    fn fuzz_duplicate_dispute_id_rejected(
        amount in arb_amount(),
        dispute_id in arb_dispute_id(),
        evidence_hash in arb_evidence_hash(),
    ) {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let disputer = Address::generate(&env);
        let respondent = Address::generate(&env);

        let token_id = env.register_stellar_asset_contract_v2(admin.clone());
        let token_addr = token_id.address();
        StellarAssetClient::new(&env, &token_addr).mint(&disputer, &1_000_000);

        let contract_id = env.register_contract(None, DisputeContract);
        let client = DisputeContractClient::new(&env, &contract_id);
        client.initialize(&admin);

        let id = Symbol::new(&env, &dispute_id);
        let ev = SorobanString::from_str(&env, &evidence_hash);

        client.file_dispute(&id, &disputer, &respondent, &token_addr, &amount, &ev);

        // Second call with the same id must fail.
        let result = client.try_file_dispute(
            &id,
            &disputer,
            &respondent,
            &token_addr,
            &amount,
            &ev,
        );
        prop_assert!(result.is_err(), "duplicate dispute id must be rejected");

        // Original dispute is unmodified.
        let dispute = client.get_dispute(&id).unwrap();
        prop_assert_eq!(dispute.status, DisputeStatus::Open);
        prop_assert_eq!(dispute.amount, amount);
    }

    /// Fuzz: full happy-path `RefundDisputer` settlement returns all tokens to
    /// the disputer regardless of the amount.
    #[test]
    fn fuzz_settle_refund_disputer_returns_all_tokens(
        amount in arb_amount(),
        dispute_id in arb_dispute_id(),
        evidence_hash in arb_evidence_hash(),
    ) {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let disputer = Address::generate(&env);
        let respondent = Address::generate(&env);
        let arbitrator = Address::generate(&env);

        let token_id = env.register_stellar_asset_contract_v2(admin.clone());
        let token_addr = token_id.address();
        StellarAssetClient::new(&env, &token_addr).mint(&disputer, &1_000_000);

        let contract_id = env.register_contract(None, DisputeContract);
        let client = DisputeContractClient::new(&env, &contract_id);
        client.initialize(&admin);
        client.add_arbitrator(&admin, &arbitrator);

        let id = Symbol::new(&env, &dispute_id);
        let ev = SorobanString::from_str(&env, &evidence_hash);

        client.file_dispute(&id, &disputer, &respondent, &token_addr, &amount, &ev);
        client.decide(&id, &arbitrator, &DisputeOutcome::RefundDisputer, &0);
        client.settle(&id);

        // Invariant: disputer gets full refund.
        let disputer_balance = TokenClient::new(&env, &token_addr).balance(&disputer);
        prop_assert_eq!(disputer_balance, 1_000_000);

        // Invariant: contract holds nothing.
        let contract_balance = TokenClient::new(&env, &token_addr).balance(&contract_id);
        prop_assert_eq!(contract_balance, 0);

        // Invariant: dispute is Settled.
        let dispute = client.get_dispute(&id).unwrap();
        prop_assert_eq!(dispute.status, DisputeStatus::Settled);
    }
}
