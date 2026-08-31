//! Property-based fuzz tests for the Payment contract.
//!
//! Focus on critical entrypoints handling amounts, authorization edge cases,
//! and payment status transitions.

use proptest::prelude::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token::{Client as TokenClient, StellarAssetClient},
    Address, Env, Symbol,
};

use bluecollar_payment::{PaymentContract, PaymentContractClient};

/// Generate a random positive payment amount (1 to 10_000_000).
fn arb_amount() -> impl Strategy<Value = i128> {
    (1i128..=10_000_000i128).prop_map(|v| v)
}

/// Generate a random payment id (1-16 alphanumeric).
fn arb_payment_id() -> impl Strategy<Value = String> {
    "[a-z0-9]{1,16}".prop_map(|s| s)
}

/// Generate a random fee in basis points (0-500).
fn arb_fee_bps() -> impl Strategy<Value = u32> {
    0u32..=500
}

/// Generate a random expiry offset in seconds (1 to 1_000_000).
fn arb_expiry_offset() -> impl Strategy<Value = u64> {
    (1u64..=1_000_000u64).prop_map(|v| v)
}

proptest! {
    /// Fuzz test: locking payments with random amounts should store correctly.
    #[test]
    fn fuzz_lock_payment_stores_correctly(
        amount in arb_amount(),
        payment_id in arb_payment_id(),
        expiry_offset in arb_expiry_offset(),
    ) {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let client_addr = Address::generate(&env);
        let worker = Address::generate(&env);

        let token_id = env.register_stellar_asset_contract_v2(admin.clone());
        let token_addr = token_id.address();
        StellarAssetClient::new(&env, &token_addr).mint(&client_addr, &100_000_000);

        let contract_id = env.register_contract(None, PaymentContract);
        let client = PaymentContractClient::new(&env, &contract_id);
        client.initialize(&admin, &0, &admin);

        let id = Symbol::new(&env, &payment_id);
        let current_time = env.ledger().timestamp();
        let expiry = current_time + expiry_offset;

        client.lock_payment(&client_addr, &worker, &token_addr, &id, &amount, &expiry);

        let payment = client.get_payment(&id);
        assert_eq!(payment.amount, amount);
        assert_eq!(payment.client, client_addr);
        assert_eq!(payment.worker, worker);
    }

    /// Fuzz test: releasing locked payment should transfer correct amount.
    #[test]
    fn fuzz_release_payment_transfers_correctly(
        amount in arb_amount(),
        payment_id in arb_payment_id(),
    ) {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let client_addr = Address::generate(&env);
        let worker = Address::generate(&env);

        let token_id = env.register_stellar_asset_contract_v2(admin.clone());
        let token_addr = token_id.address();
        StellarAssetClient::new(&env, &token_addr).mint(&client_addr, &100_000_000);

        let contract_id = env.register_contract(None, PaymentContract);
        let client = PaymentContractClient::new(&env, &contract_id);
        client.initialize(&admin, &0, &admin);

        let id = Symbol::new(&env, &payment_id);
        let expiry = env.ledger().timestamp() + 1000;

        client.lock_payment(&client_addr, &worker, &token_addr, &id, &amount, &expiry);

        let worker_before = TokenClient::new(&env, &token_addr).balance(&worker);
        client.release_payment(&client_addr, &id);
        let worker_after = TokenClient::new(&env, &token_addr).balance(&worker);

        assert_eq!(worker_after - worker_before, amount);
    }

    /// Fuzz test: refunding expired payment should return funds to client.
    #[test]
    fn fuzz_refund_expired_payment(
        amount in arb_amount(),
        payment_id in arb_payment_id(),
    ) {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let client_addr = Address::generate(&env);
        let worker = Address::generate(&env);

        let token_id = env.register_stellar_asset_contract_v2(admin.clone());
        let token_addr = token_id.address();
        StellarAssetClient::new(&env, &token_addr).mint(&client_addr, &100_000_000);

        let contract_id = env.register_contract(None, PaymentContract);
        let client = PaymentContractClient::new(&env, &contract_id);
        client.initialize(&admin, &0, &admin);

        let id = Symbol::new(&env, &payment_id);
        let expiry = env.ledger().timestamp() + 100;

        client.lock_payment(&client_addr, &worker, &token_addr, &id, &amount, &expiry);

        // Fast forward to after expiry.
        let mut ledger_info = env.ledger().get();
        ledger_info.timestamp = expiry + 1;
        env.ledger().set(ledger_info);

        let client_before = TokenClient::new(&env, &token_addr).balance(&client_addr);
        client.refund_payment(&client_addr, &id);
        let client_after = TokenClient::new(&env, &token_addr).balance(&client_addr);

        assert_eq!(client_after - client_before, amount);
    }

    /// Fuzz test: fee deduction with random amounts and fee rates.
    #[test]
    fn fuzz_pay_with_fees(
        amount in arb_amount(),
        fee_bps in arb_fee_bps(),
    ) {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let payer = Address::generate(&env);
        let worker = Address::generate(&env);
        let treasury = Address::generate(&env);

        let token_id = env.register_stellar_asset_contract_v2(admin.clone());
        let token_addr = token_id.address();
        StellarAssetClient::new(&env, &token_addr).mint(&payer, &100_000_000);

        let contract_id = env.register_contract(None, PaymentContract);
        let client = PaymentContractClient::new(&env, &contract_id);
        client.initialize(&admin, &fee_bps, &treasury);

        client.pay(&payer, &worker, &token_addr, &amount);

        let expected_fee = (amount * fee_bps as i128) / 10_000;
        let expected_worker_amount = amount - expected_fee;

        let worker_balance = TokenClient::new(&env, &token_addr).balance(&worker);
        assert_eq!(worker_balance, expected_worker_amount);

        if expected_fee > 0 {
            let treasury_balance = TokenClient::new(&env, &token_addr).balance(&treasury);
            assert_eq!(treasury_balance, expected_fee);
        }
    }

    /// Fuzz test: verify payment amounts never overflow or underflow.
    #[test]
    fn fuzz_payment_amount_safety(
        amount in arb_amount(),
        payment_id in arb_payment_id(),
    ) {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let client_addr = Address::generate(&env);
        let worker = Address::generate(&env);

        let token_id = env.register_stellar_asset_contract_v2(admin.clone());
        let token_addr = token_id.address();
        StellarAssetClient::new(&env, &token_addr).mint(&client_addr, &100_000_000);

        let contract_id = env.register_contract(None, PaymentContract);
        let client = PaymentContractClient::new(&env, &contract_id);
        client.initialize(&admin, &0, &admin);

        let id = Symbol::new(&env, &payment_id);
        let expiry = env.ledger().timestamp() + 1000;

        // Should not panic on any valid positive amount
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            client.lock_payment(&client_addr, &worker, &token_addr, &id, &amount, &expiry);
        }));

        assert!(result.is_ok(), "lock_payment should not panic on valid positive amount");
    }

    /// Fuzz test: zero amount should fail validation.
    #[test]
    fn fuzz_zero_amount_rejected(
        payment_id in arb_payment_id(),
    ) {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let client_addr = Address::generate(&env);
        let worker = Address::generate(&env);

        let token_id = env.register_stellar_asset_contract_v2(admin.clone());
        let token_addr = token_id.address();
        StellarAssetClient::new(&env, &token_addr).mint(&client_addr, &100_000_000);

        let contract_id = env.register_contract(None, PaymentContract);
        let client = PaymentContractClient::new(&env, &contract_id);
        client.initialize(&admin, &0, &admin);

        let id = Symbol::new(&env, &payment_id);
        let expiry = env.ledger().timestamp() + 1000;

        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            client.lock_payment(&client_addr, &worker, &token_addr, &id, &0, &expiry);
        }));

        assert!(result.is_err(), "zero amount should be rejected");
    }
}
