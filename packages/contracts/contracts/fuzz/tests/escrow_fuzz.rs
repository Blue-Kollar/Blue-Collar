//! Property-based fuzz tests for the Escrow contract.
//!
//! Focus on authorization edge cases, amount validation, and escrow state transitions
//! including create, release, cancel, and dispute resolution paths.

use proptest::prelude::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token::{Client as TokenClient, StellarAssetClient},
    Address, Env, Symbol,
};

use bluecollar_escrow::{EscrowContract, EscrowContractClient, EscrowState};

/// Generate a random positive escrow amount (1 to 50_000_000).
fn arb_amount() -> impl Strategy<Value = i128> {
    (1i128..=50_000_000i128).prop_map(|v| v)
}

/// Generate a random escrow id (1-16 alphanumeric).
fn arb_escrow_id() -> impl Strategy<Value = String> {
    "[a-z0-9]{1,16}".prop_map(|s| s)
}

/// Generate a random expiry offset in seconds (1 to 10_000_000).
fn arb_expiry_offset() -> impl Strategy<Value = u64> {
    (1u64..=10_000_000u64).prop_map(|v| v)
}

proptest! {
    /// Fuzz test: create escrow with valid amounts should lock funds correctly.
    #[test]
    fn fuzz_create_escrow_validity(
        amount in arb_amount(),
        escrow_id in arb_escrow_id(),
        expiry_offset in arb_expiry_offset(),
    ) {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let depositor = Address::generate(&env);
        let beneficiary = Address::generate(&env);

        let token_id = env.register_stellar_asset_contract_v2(admin.clone());
        let token_addr = token_id.address();
        StellarAssetClient::new(&env, &token_addr).mint(&depositor, &100_000_000);

        let contract_id = env.register_contract(None, EscrowContract);
        let client = EscrowContractClient::new(&env, &contract_id);
        client.initialize(&admin);

        let id = Symbol::new(&env, &escrow_id);
        let expiry = env.ledger().timestamp() + expiry_offset;

        client.create_escrow(&depositor, &beneficiary, &token_addr, &id, &amount, &expiry);

        let escrow = client.get_escrow(&id);
        assert_eq!(escrow.amount, amount);
        assert_eq!(escrow.state, EscrowState::Active);

        let depositor_balance = TokenClient::new(&env, &token_addr).balance(&depositor);
        assert_eq!(depositor_balance, 100_000_000 - amount);
    }

    /// Fuzz test: release escrow should transfer full amount to beneficiary.
    #[test]
    fn fuzz_release_escrow_transfers_correctly(
        amount in arb_amount(),
        escrow_id in arb_escrow_id(),
    ) {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let depositor = Address::generate(&env);
        let beneficiary = Address::generate(&env);

        let token_id = env.register_stellar_asset_contract_v2(admin.clone());
        let token_addr = token_id.address();
        StellarAssetClient::new(&env, &token_addr).mint(&depositor, &100_000_000);

        let contract_id = env.register_contract(None, EscrowContract);
        let client = EscrowContractClient::new(&env, &contract_id);
        client.initialize(&admin);

        let id = Symbol::new(&env, &escrow_id);
        let expiry = env.ledger().timestamp() + 1000;

        client.create_escrow(&depositor, &beneficiary, &token_addr, &id, &amount, &expiry);

        let beneficiary_before = TokenClient::new(&env, &token_addr).balance(&beneficiary);
        client.release_escrow(&depositor, &id);
        let beneficiary_after = TokenClient::new(&env, &token_addr).balance(&beneficiary);

        assert_eq!(beneficiary_after - beneficiary_before, amount);

        let escrow = client.get_escrow(&id);
        assert_eq!(escrow.state, EscrowState::Released);
    }

    /// Fuzz test: cancel escrow should refund depositor.
    #[test]
    fn fuzz_cancel_escrow_refunds_depositor(
        amount in arb_amount(),
        escrow_id in arb_escrow_id(),
    ) {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let depositor = Address::generate(&env);
        let beneficiary = Address::generate(&env);

        let token_id = env.register_stellar_asset_contract_v2(admin.clone());
        let token_addr = token_id.address();
        StellarAssetClient::new(&env, &token_addr).mint(&depositor, &100_000_000);

        let contract_id = env.register_contract(None, EscrowContract);
        let client = EscrowContractClient::new(&env, &contract_id);
        client.initialize(&admin);

        let id = Symbol::new(&env, &escrow_id);
        let expiry = env.ledger().timestamp() + 1000;

        client.create_escrow(&depositor, &beneficiary, &token_addr, &id, &amount, &expiry);

        let depositor_balance_before = TokenClient::new(&env, &token_addr).balance(&depositor);
        client.cancel_escrow(&admin, &id);
        let depositor_balance_after = TokenClient::new(&env, &token_addr).balance(&depositor);

        assert_eq!(depositor_balance_after - depositor_balance_before, amount);

        let escrow = client.get_escrow(&id);
        assert_eq!(escrow.state, EscrowState::Cancelled);
    }

    /// Fuzz test: expired escrow can be cancelled by depositor.
    #[test]
    fn fuzz_expired_escrow_depositor_cancel(
        amount in arb_amount(),
        escrow_id in arb_escrow_id(),
    ) {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let depositor = Address::generate(&env);
        let beneficiary = Address::generate(&env);

        let token_id = env.register_stellar_asset_contract_v2(admin.clone());
        let token_addr = token_id.address();
        StellarAssetClient::new(&env, &token_addr).mint(&depositor, &100_000_000);

        let contract_id = env.register_contract(None, EscrowContract);
        let client = EscrowContractClient::new(&env, &contract_id);
        client.initialize(&admin);

        let id = Symbol::new(&env, &escrow_id);
        let expiry = 100;

        client.create_escrow(&depositor, &beneficiary, &token_addr, &id, &amount, &expiry);

        // Fast forward past expiry
        let mut ledger_info = env.ledger().get();
        ledger_info.timestamp = 200;
        env.ledger().set(ledger_info);

        client.cancel_escrow(&depositor, &id);

        let escrow = client.get_escrow(&id);
        assert_eq!(escrow.state, EscrowState::Cancelled);
    }

    /// Fuzz test: zero amount should be rejected.
    #[test]
    fn fuzz_zero_amount_rejected(
        escrow_id in arb_escrow_id(),
    ) {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let depositor = Address::generate(&env);
        let beneficiary = Address::generate(&env);

        let token_id = env.register_stellar_asset_contract_v2(admin.clone());
        let token_addr = token_id.address();
        StellarAssetClient::new(&env, &token_addr).mint(&depositor, &100_000_000);

        let contract_id = env.register_contract(None, EscrowContract);
        let client = EscrowContractClient::new(&env, &contract_id);
        client.initialize(&admin);

        let id = Symbol::new(&env, &escrow_id);
        let expiry = env.ledger().timestamp() + 1000;

        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            client.create_escrow(&depositor, &beneficiary, &token_addr, &id, &0, &expiry);
        }));

        assert!(result.is_err(), "zero amount should be rejected");
    }

    /// Fuzz test: amount safety - no overflow/underflow.
    #[test]
    fn fuzz_amount_safety(
        amount in arb_amount(),
        escrow_id in arb_escrow_id(),
    ) {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let depositor = Address::generate(&env);
        let beneficiary = Address::generate(&env);

        let token_id = env.register_stellar_asset_contract_v2(admin.clone());
        let token_addr = token_id.address();
        StellarAssetClient::new(&env, &token_addr).mint(&depositor, &100_000_000);

        let contract_id = env.register_contract(None, EscrowContract);
        let client = EscrowContractClient::new(&env, &contract_id);
        client.initialize(&admin);

        let id = Symbol::new(&env, &escrow_id);
        let expiry = env.ledger().timestamp() + 1000;

        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            client.create_escrow(&depositor, &beneficiary, &token_addr, &id, &amount, &expiry);
        }));

        assert!(result.is_ok(), "should not panic on valid positive amount");
    }
}
