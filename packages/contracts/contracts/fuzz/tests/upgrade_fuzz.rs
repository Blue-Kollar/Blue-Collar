//! Property-based fuzz tests for the contract-upgrade / schema-migration paths.
//!
//! These run under the normal `cargo test` harness (via proptest) and assert
//! the core upgrade-safety invariant: a migration over arbitrary state must
//! preserve every stored value and advance the schema version by exactly one.
//! The `fuzz_migrate` libFuzzer target covers the same invariant under
//! coverage-guided fuzzing.
// `Env::register_contract` is deprecated in favour of `Env::register`; the test
// helpers here are migrated alongside the contracts, not ahead of them.
#![allow(deprecated)]

use proptest::prelude::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger, LedgerInfo},
    Address, BytesN, Env, String as SorobanString, Symbol,
};

use bluecollar_market::{MarketContract, MarketContractClient};
use bluecollar_registry::{RegistryContract, RegistryContractClient};

fn arb_worker_id() -> impl Strategy<Value = String> {
    "[a-z0-9]{1,16}".prop_map(|s| s)
}
fn arb_name() -> impl Strategy<Value = String> {
    "[a-zA-Z0-9 ]{1,32}".prop_map(|s| s)
}
fn arb_reputation() -> impl Strategy<Value = u32> {
    0u32..=10_000
}
fn arb_escrow_id() -> impl Strategy<Value = String> {
    "[a-z0-9]{1,16}".prop_map(|s| s)
}
fn arb_amount() -> impl Strategy<Value = i128> {
    1i128..=1_000_000
}

proptest! {
    /// Registry: a migration over an arbitrary worker preserves every field and
    /// bumps the schema version by one.
    #[test]
    fn fuzz_registry_migration_preserves_worker(
        worker_id in arb_worker_id(),
        name in arb_name(),
        reputation in arb_reputation(),
    ) {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let curator = Address::generate(&env);
        let owner = Address::generate(&env);

        let contract_id = env.register_contract(None, RegistryContract);
        let client = RegistryContractClient::new(&env, &contract_id);
        client.initialize(&admin);
        client.grant_role(&admin, &Symbol::new(&env, "curator_mgr"), &admin);
        client.grant_role(&admin, &Symbol::new(&env, "rep_mgr"), &admin);
        client.add_curator(&admin, &curator);

        let id = Symbol::new(&env, &worker_id);
        let zero = BytesN::from_array(&env, &[0u8; 32]);
        client.register(
            &id,
            &owner,
            &SorobanString::from_str(&env, &name),
            &Symbol::new(&env, "plumber"),
            &zero,
            &zero,
            &curator,
        );
        client.update_reputation(&admin, &id, &reputation);

        let before = client.get_worker(&id).unwrap();
        let version = client.get_schema_version();

        client.migrate(&admin, &version);

        let after = client.get_worker(&id).unwrap();
        prop_assert_eq!(after.owner, before.owner);
        prop_assert_eq!(after.name, before.name);
        prop_assert_eq!(after.category, before.category);
        prop_assert_eq!(after.reputation, before.reputation);
        prop_assert_eq!(after.is_active, before.is_active);
        prop_assert_eq!(client.get_schema_version(), version + 1);
    }

    /// Registry: worker_count is invariant across a migration regardless of how
    /// many workers exist.
    #[test]
    fn fuzz_registry_migration_preserves_worker_count(
        worker_ids in prop::collection::vec(arb_worker_id(), 1..=8),
    ) {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let curator = Address::generate(&env);
        let owner = Address::generate(&env);

        let contract_id = env.register_contract(None, RegistryContract);
        let client = RegistryContractClient::new(&env, &contract_id);
        client.initialize(&admin);
        client.grant_role(&admin, &Symbol::new(&env, "curator_mgr"), &admin);
        client.add_curator(&admin, &curator);

        let zero = BytesN::from_array(&env, &[0u8; 32]);
        let mut seen = std::collections::HashSet::new();
        for wid in &worker_ids {
            if !seen.insert(wid.clone()) { continue; }
            client.register(
                &Symbol::new(&env, wid),
                &owner,
                &SorobanString::from_str(&env, "W"),
                &Symbol::new(&env, "plumber"),
                &zero,
                &zero,
                &curator,
            );
        }

        let count_before = client.worker_count();
        client.migrate(&admin, &client.get_schema_version());
        prop_assert_eq!(client.worker_count(), count_before);
    }

    /// Market: a migration preserves an open escrow's fields and bumps the
    /// schema version by one.
    #[test]
    fn fuzz_market_migration_preserves_escrow(
        escrow_id in arb_escrow_id(),
        amount in arb_amount(),
    ) {
        let env = Env::default();
        env.mock_all_auths();
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

        let admin = Address::generate(&env);
        let payer = Address::generate(&env);
        let worker = Address::generate(&env);

        let token_id = env.register_stellar_asset_contract_v2(admin.clone());
        let token = token_id.address();
        soroban_sdk::token::StellarAssetClient::new(&env, &token).mint(&payer, &10_000_000);

        let contract_id = env.register_contract(None, MarketContract);
        let client = MarketContractClient::new(&env, &contract_id);
        client.initialize(&admin, &0, &admin);

        let id = Symbol::new(&env, &escrow_id);
        client.create_escrow(&id, &payer, &worker, &token, &amount, &9_999);

        let before = client.get_escrow(&id).unwrap();
        let version = client.get_schema_version();

        client.migrate(&admin, &version);

        let after = client.get_escrow(&id).unwrap();
        prop_assert_eq!(after.amount, before.amount);
        prop_assert_eq!(after.expiry, before.expiry);
        prop_assert_eq!(after.released, before.released);
        prop_assert_eq!(after.cancelled, before.cancelled);
        prop_assert_eq!(client.get_schema_version(), version + 1);
    }
}
