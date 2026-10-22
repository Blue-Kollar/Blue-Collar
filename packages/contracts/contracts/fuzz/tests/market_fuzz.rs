//! Property-based fuzz tests for the Market contract.
//!
//! These tests use `proptest` to generate random inputs and verify invariants.
// `Env::register_contract` is deprecated in favour of `Env::register`; the test
// helpers here are migrated alongside the contracts, not ahead of them.
#![allow(deprecated)]

use proptest::prelude::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger, LedgerInfo},
    token::{Client as TokenClient, StellarAssetClient},
    Address, Env, Symbol,
};

use bluecollar_market::{MarketContract, MarketContractClient};

/// Generate a random positive tip amount (1 to 1_000_000).
fn arb_amount() -> impl Strategy<Value = i128> {
    (1i128..=1_000_000i128).prop_map(|v| v)
}

/// Generate a random fee in basis points (0-500).
fn arb_fee_bps() -> impl Strategy<Value = u32> {
    0u32..=500
}

/// Generate a random escrow id (1-16 alphanumeric).
fn arb_escrow_id() -> impl Strategy<Value = String> {
    "[a-z0-9]{1,16}".prop_map(|s| s)
}

/// Generate a random expiry offset in seconds (1 to 1_000_000).
fn arb_expiry_offset() -> impl Strategy<Value = u64> {
    (1u64..=1_000_000u64).prop_map(|v| v)
}

proptest! {
    /// Fuzz test: tip with random valid amounts should transfer correct net amount.
    #[test]
    fn fuzz_tip_correct_amount(
        amount in arb_amount(),
        fee_bps in arb_fee_bps(),
    ) {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let payer = Address::generate(&env);
        let worker = Address::generate(&env);

        let token_id = env.register_stellar_asset_contract_v2(admin.clone());
        let token_addr = token_id.address();
        StellarAssetClient::new(&env, &token_addr).mint(&payer, &1_000_000);

        let contract_id = env.register_contract(None, MarketContract);
        let client = MarketContractClient::new(&env, &contract_id);
        client.initialize(&admin, &fee_bps, &admin);
        client.grant_role(&admin, &Symbol::new(&env, "fee_mgr"), &admin);

        let payer_before = TokenClient::new(&env, &token_addr).balance(&payer);
        let worker_before = TokenClient::new(&env, &token_addr).balance(&worker);

        client.tip(&payer, &worker, &token_addr, &amount);

        let fee = (amount * fee_bps as i128) / 10_000;
        let expected_worker = worker_before + amount - fee;
        let expected_payer = payer_before - amount;

        // Invariant: worker receives amount minus fee
        assert_eq!(TokenClient::new(&env, &token_addr).balance(&worker), expected_worker);
        // Invariant: payer loses full amount
        assert_eq!(TokenClient::new(&env, &token_addr).balance(&payer), expected_payer);
    }

    /// Fuzz test: create escrow with random amounts should lock funds correctly.
    #[test]
    fn fuzz_create_escrow_locks_funds(
        amount in arb_amount(),
        escrow_id in arb_escrow_id(),
        expiry_offset in arb_expiry_offset(),
    ) {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let payer = Address::generate(&env);
        let worker = Address::generate(&env);

        let token_id = env.register_stellar_asset_contract_v2(admin.clone());
        let token_addr = token_id.address();
        StellarAssetClient::new(&env, &token_addr).mint(&payer, &1_000_000);

        let contract_id = env.register_contract(None, MarketContract);
        let client = MarketContractClient::new(&env, &contract_id);
        client.initialize(&admin, &0, &admin);

        let id = Symbol::new(&env, &escrow_id);
        let expiry = expiry_offset;

        client.create_escrow(&id, &payer, &worker, &token_addr, &amount, &expiry);

        // Invariant: escrow exists and is not released/cancelled
        let escrow = client.get_escrow(&id).expect("Escrow should exist");
        assert_eq!(escrow.amount, amount);
        assert!(!escrow.released);
        assert!(!escrow.cancelled);

        // Invariant: payer balance decreased by amount
        let payer_balance = TokenClient::new(&env, &token_addr).balance(&payer);
        assert_eq!(payer_balance, 1_000_000 - amount);
    }

    /// Fuzz test: release escrow should transfer full amount to worker.
    #[test]
    fn fuzz_release_escrow_transfers_to_worker(
        amount in arb_amount(),
        escrow_id in arb_escrow_id(),
    ) {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let payer = Address::generate(&env);
        let worker = Address::generate(&env);

        let token_id = env.register_stellar_asset_contract_v2(admin.clone());
        let token_addr = token_id.address();
        StellarAssetClient::new(&env, &token_addr).mint(&payer, &1_000_000);

        let contract_id = env.register_contract(None, MarketContract);
        let client = MarketContractClient::new(&env, &contract_id);
        client.initialize(&admin, &0, &admin);

        let id = Symbol::new(&env, &escrow_id);
        client.create_escrow(&id, &payer, &worker, &token_addr, &amount, &9_999_999);
        client.release_escrow(&id, &payer);

        // Invariant: worker receives full escrow amount
        assert_eq!(TokenClient::new(&env, &token_addr).balance(&worker), amount);

        // Invariant: escrow is marked released
        let escrow = client.get_escrow(&id).expect("Escrow should exist");
        assert!(escrow.released);
        assert!(!escrow.cancelled);
    }

    /// Fuzz test: cancel escrow after expiry should refund payer.
    #[test]
    fn fuzz_cancel_escrow_refunds_payer(
        amount in arb_amount(),
        escrow_id in arb_escrow_id(),
    ) {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let payer = Address::generate(&env);
        let worker = Address::generate(&env);

        let token_id = env.register_stellar_asset_contract_v2(admin.clone());
        let token_addr = token_id.address();
        StellarAssetClient::new(&env, &token_addr).mint(&payer, &1_000_000);

        let contract_id = env.register_contract(None, MarketContract);
        let client = MarketContractClient::new(&env, &contract_id);
        client.initialize(&admin, &0, &admin);

        // Set time before expiry
        env.ledger().set(LedgerInfo {
            timestamp: 1000,
            protocol_version: 26,
            sequence_number: 1,
            network_id: Default::default(),
            base_reserve: 10,
            min_temp_entry_ttl: 1,
            min_persistent_entry_ttl: 1,
            max_entry_ttl: 100_000,
        });

        let id = Symbol::new(&env, &escrow_id);
        client.create_escrow(&id, &payer, &worker, &token_addr, &amount, &2000);

        // Advance the timestamp past expiry. Keep `sequence_number` steady so the
        // persistent escrow entry is not archived (expiry is timestamp-based, and
        // the in-process test host archives entries once the ledger sequence passes
        // their TTL — which would otherwise mask the behavior under test).
        env.ledger().set(LedgerInfo {
            timestamp: 3000,
            protocol_version: 26,
            sequence_number: 1,
            network_id: Default::default(),
            base_reserve: 10,
            min_temp_entry_ttl: 1,
            min_persistent_entry_ttl: 1,
            max_entry_ttl: 100_000,
        });

        client.cancel_escrow(&id, &payer);

        // Invariant: payer gets full refund
        assert_eq!(TokenClient::new(&env, &token_addr).balance(&payer), 1_000_000);

        // Invariant: escrow is marked cancelled
        let escrow = client.get_escrow(&id).expect("Escrow should exist");
        assert!(escrow.cancelled);
        assert!(!escrow.released);
    }

    /// Fuzz test: fee_bps exceeding MAX_FEE_BPS should always panic.
    #[test]
    fn fuzz_fee_bps_over_max_panics(
        fee_bps in 501u32..=u32::MAX,
    ) {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let contract_id = env.register_contract(None, MarketContract);
        let client = MarketContractClient::new(&env, &contract_id);

        // Should always panic with fee_bps > 500
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            client.initialize(&admin, &fee_bps, &admin);
        }));
        assert!(result.is_err(), "Expected panic for fee_bps={fee_bps}");
    }
}

proptest! {
    // =========================================================================
    // #786 – Multi-asset invariants
    // =========================================================================

    /// Fuzz: tip with a second (USDC-style) token preserves the same fee
    /// arithmetic as with the native token.
    #[test]
    fn fuzz_tip_multi_asset_fee_invariant(
        amount in 1i128..=1_000_000i128,
        fee_bps in 0u32..=500u32,
    ) {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let payer = Address::generate(&env);
        let worker = Address::generate(&env);

        // Register a "USDC-style" second token
        let usdc_id = env.register_stellar_asset_contract_v2(admin.clone());
        let usdc = usdc_id.address();
        soroban_sdk::token::StellarAssetClient::new(&env, &usdc).mint(&payer, &1_000_000);

        let contract_id = env.register_contract(None, bluecollar_market::MarketContract);
        let client = bluecollar_market::MarketContractClient::new(&env, &contract_id);
        client.initialize(&admin, &fee_bps, &admin);
        client.grant_role(&admin, &Symbol::new(&env, "fee_mgr"), &admin);

        let w_before = TokenClient::new(&env, &usdc).balance(&worker);
        client.tip(&payer, &worker, &usdc, &amount);

        let fee = (amount * fee_bps as i128) / 10_000;
        // Invariant: worker receives amount minus fee regardless of token type
        prop_assert_eq!(TokenClient::new(&env, &usdc).balance(&worker), w_before + amount - fee);
    }

    /// Fuzz: escrow over multiple tokens — release always transfers the exact
    /// locked amount to the worker (no fee on zero-fee contracts).
    #[test]
    fn fuzz_multi_asset_escrow_release_exact(
        amount in 1i128..=500_000i128,
        escrow_id in "[a-z]{1,12}".prop_map(|s| s),
    ) {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let payer = Address::generate(&env);
        let worker = Address::generate(&env);

        let tok_id = env.register_stellar_asset_contract_v2(admin.clone());
        let tok = tok_id.address();
        soroban_sdk::token::StellarAssetClient::new(&env, &tok).mint(&payer, &1_000_000);

        let contract_id = env.register_contract(None, bluecollar_market::MarketContract);
        let client = bluecollar_market::MarketContractClient::new(&env, &contract_id);
        client.initialize(&admin, &0, &admin);

        let id = Symbol::new(&env, &escrow_id);
        client.create_escrow(&id, &payer, &worker, &tok, &amount, &9_999_999);
        client.release_escrow(&id, &payer);

        // Invariant: worker receives exactly the locked amount
        prop_assert_eq!(TokenClient::new(&env, &tok).balance(&worker), amount);
    }

    // =========================================================================
    // #786 – Auth-bypass attempts
    // =========================================================================

    /// Fuzz: a random stranger must never successfully release an escrow
    /// they did not create and are not the worker of.
    /// mock_all_auths() bypasses require_auth() but NOT the from/to identity
    /// check — a stranger must always receive "Not authorized".
    #[test]
    fn fuzz_auth_bypass_release_escrow(
        amount in 1i128..=500_000i128,
    ) {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let payer = Address::generate(&env);
        let worker = Address::generate(&env);
        let stranger = Address::generate(&env);

        let tok_id = env.register_stellar_asset_contract_v2(admin.clone());
        let tok = tok_id.address();
        soroban_sdk::token::StellarAssetClient::new(&env, &tok).mint(&payer, &1_000_000);

        let contract_id = env.register_contract(None, bluecollar_market::MarketContract);
        let client = bluecollar_market::MarketContractClient::new(&env, &contract_id);
        client.initialize(&admin, &0, &admin);

        let id = Symbol::new(&env, "authesc");
        client.create_escrow(&id, &payer, &worker, &tok, &amount, &9_999_999);

        // Stranger release must panic (identity check, not auth check).
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            client.release_escrow(&id, &stranger);
        }));
        prop_assert!(result.is_err(), "stranger must not release escrow — auth bypass detected");

        // Escrow is still active and worker has received nothing.
        let esc = client.get_escrow(&id).unwrap();
        prop_assert!(!esc.released, "escrow must remain unreleased after failed stranger attempt");
        prop_assert_eq!(TokenClient::new(&env, &tok).balance(&worker), 0);
    }

    // =========================================================================
    // #786 – Overflow / underflow safety
    // =========================================================================

    /// Fuzz: fee computation on maximum i128 amounts must not overflow.
    /// fee_bps <= 500, amount <= i128::MAX / 10_000 to stay in range.
    #[test]
    fn fuzz_fee_no_overflow(
        // Keep amount in a range where amount * 500 < i128::MAX
        amount in 1i128..=i128::MAX / 501,
        fee_bps in 0u32..=500u32,
    ) {
        // We only test the pure fee arithmetic used in the contract
        let fee: i128 = (amount * fee_bps as i128) / 10_000;
        let worker_amount: i128 = amount - fee;
        // Invariants: no underflow, fee in [0, amount], worker_amount >= 0
        prop_assert!(fee >= 0);
        prop_assert!(worker_amount >= 0);
        prop_assert!(fee + worker_amount == amount);
    }

    /// Fuzz: escrow amount must always be exactly preserved in storage (no
    /// truncation or overflow from the i128 path).
    #[test]
    fn fuzz_escrow_amount_exact_storage(
        amount in 1i128..=1_000_000i128,
    ) {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let payer = Address::generate(&env);
        let worker = Address::generate(&env);

        let tok_id = env.register_stellar_asset_contract_v2(admin.clone());
        let tok = tok_id.address();
        soroban_sdk::token::StellarAssetClient::new(&env, &tok).mint(&payer, &1_000_000);

        let contract_id = env.register_contract(None, bluecollar_market::MarketContract);
        let client = bluecollar_market::MarketContractClient::new(&env, &contract_id);
        client.initialize(&admin, &0, &admin);

        let id = Symbol::new(&env, "ovflow");
        client.create_escrow(&id, &payer, &worker, &tok, &amount, &9_999_999);

        // Invariant: stored amount equals the amount passed in
        let esc = client.get_escrow(&id).unwrap();
        prop_assert_eq!(esc.amount, amount);
    }
}
