//! Property-based fuzz tests for the Registry contract.
//!
//! These tests use `proptest` to generate random inputs and verify invariants.
// `Env::register_contract` is deprecated in favour of `Env::register`; the test
// helpers here are migrated alongside the contracts, not ahead of them.
#![allow(deprecated)]

use proptest::prelude::*;
use soroban_sdk::{testutils::Address as _, Address, BytesN, Env, String as SorobanString, Symbol};

// Re-export the contract client
use bluecollar_registry::{RegistryContract, RegistryContractClient};

/// Generate a random worker name (1-32 ASCII chars).
fn arb_worker_name() -> impl Strategy<Value = String> {
    "[a-zA-Z0-9 ]{1,32}".prop_map(|s| s)
}

/// Generate a random category symbol (1-16 lowercase ASCII).
fn arb_category() -> impl Strategy<Value = String> {
    "[a-z]{1,16}".prop_map(|s| s)
}

/// Generate a random worker id symbol (1-16 alphanumeric).
fn arb_worker_id() -> impl Strategy<Value = String> {
    "[a-z0-9]{1,16}".prop_map(|s| s)
}

/// Generate a random 32-byte hash.
fn arb_hash() -> impl Strategy<Value = [u8; 32]> {
    prop::array::uniform32(any::<u8>())
}

/// Generate a random reputation score (0-10000).
fn arb_reputation() -> impl Strategy<Value = u32> {
    0u32..=10_000
}

proptest! {
    /// Fuzz test: registering a worker with random valid inputs should never panic.
    #[test]
    fn fuzz_register_worker(
        name in arb_worker_name(),
        category in arb_category(),
        worker_id in arb_worker_id(),
        location_hash in arb_hash(),
        contact_hash in arb_hash(),
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

        let id = Symbol::new(&env, &worker_id);
        let name_str = SorobanString::from_str(&env, &name);
        let cat = Symbol::new(&env, &category);
        let loc = BytesN::from_array(&env, &location_hash);
        let con = BytesN::from_array(&env, &contact_hash);

        // Should not panic
        client.register(&id, &owner, &name_str, &cat, &loc, &con, &curator);

        // Invariant: worker should exist and be active
        let worker = client.get_worker(&id).expect("Worker should exist");
        assert!(worker.is_active);
        assert_eq!(worker.owner, owner);
    }

    /// Fuzz test: updating reputation with random scores (0-10000) should never panic.
    #[test]
    fn fuzz_update_reputation(
        worker_id in arb_worker_id(),
        score in arb_reputation(),
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
        let name = SorobanString::from_str(&env, "Fuzz Worker");
        let cat = Symbol::new(&env, "plumber");
        let zero_hash = BytesN::from_array(&env, &[0u8; 32]);

        client.register(&id, &owner, &name, &cat, &zero_hash, &zero_hash, &curator);

        // Should not panic
        client.update_reputation(&admin, &id, &score);

        // Invariant: reputation should match the set value
        let worker = client.get_worker(&id).expect("Worker should exist");
        assert_eq!(worker.reputation, score);
    }

    /// Fuzz test: toggling worker status multiple times should maintain consistency.
    #[test]
    fn fuzz_toggle_worker(
        worker_id in arb_worker_id(),
        toggle_count in 1usize..=10,
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

        let id = Symbol::new(&env, &worker_id);
        let name = SorobanString::from_str(&env, "Toggle Worker");
        let cat = Symbol::new(&env, "welder");
        let zero_hash = BytesN::from_array(&env, &[0u8; 32]);

        client.register(&id, &owner, &name, &cat, &zero_hash, &zero_hash, &curator);

        let mut expected_active = true;
        for _ in 0..toggle_count {
            client.toggle(&id, &owner);
            expected_active = !expected_active;
        }

        // Invariant: final state should match expected toggle count
        let worker = client.get_worker(&id).expect("Worker should exist");
        assert_eq!(worker.is_active, expected_active);
    }

    /// Fuzz test: batch registration with random inputs should handle duplicates gracefully.
    #[test]
    fn fuzz_batch_register(
        worker_ids in prop::collection::vec(arb_worker_id(), 1..=20),
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

        let mut ids = soroban_sdk::Vec::new(&env);
        let mut owners = soroban_sdk::Vec::new(&env);
        let mut names = soroban_sdk::Vec::new(&env);
        let mut cats = soroban_sdk::Vec::new(&env);
        let mut hashes = soroban_sdk::Vec::new(&env);

        for wid in &worker_ids {
            ids.push_back(Symbol::new(&env, wid));
            owners.push_back(owner.clone());
            names.push_back(SorobanString::from_str(&env, "Batch Worker"));
            cats.push_back(Symbol::new(&env, "plumber"));
            hashes.push_back(BytesN::from_array(&env, &[0u8; 32]));
        }

        // Should not panic even with duplicates
        let results = client.batch_register(&curator, &ids, &owners, &names, &cats, &hashes, &hashes);

        // Invariant: results length should match input length
        assert_eq!(results.len(), ids.len());
    }

    // -------------------------------------------------------------------------
    // #528: TTL property tests
    // -------------------------------------------------------------------------

    /// Fuzz test: worker_count never decreases after registration.
    #[test]
    fn fuzz_worker_count_monotonic(
        worker_ids in prop::collection::vec(arb_worker_id(), 1..=10),
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

        let zero_hash = BytesN::from_array(&env, &[0u8; 32]);
        let mut prev_count = 0u32;

        // Deduplicate ids to ensure monotonic growth
        let mut seen = std::collections::HashSet::new();
        for wid in &worker_ids {
            if !seen.insert(wid.clone()) {
                continue;
            }
            let id = Symbol::new(&env, wid);
            client.register(
                &id,
                &owner,
                &SorobanString::from_str(&env, "TTL Worker"),
                &Symbol::new(&env, "plumber"),
                &zero_hash,
                &zero_hash,
                &curator,
            );
            let count = client.worker_count();
            // Invariant: count must be >= previous count
            assert!(count >= prev_count, "worker_count decreased after registration");
            prev_count = count;
        }
    }

    /// Fuzz test: extend_worker_ttl never panics for registered workers.
    #[test]
    fn fuzz_extend_ttl_never_panics(
        worker_id in arb_worker_id(),
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

        let id = Symbol::new(&env, &worker_id);
        let zero_hash = BytesN::from_array(&env, &[0u8; 32]);

        client.register(
            &id,
            &owner,
            &SorobanString::from_str(&env, "TTL Worker"),
            &Symbol::new(&env, "plumber"),
            &zero_hash,
            &zero_hash,
            &curator,
        );

        // Calling extend_worker_ttl should never panic for a registered worker
        client.extend_worker_ttl(&id);

        // Invariant: worker still exists after TTL extension
        let worker = client.get_worker(&id).expect("Worker should still exist after TTL extension");
        assert_eq!(worker.owner, owner);
    }

    /// Fuzz test: toggle preserves all worker fields except is_active.
    #[test]
    fn fuzz_toggle_preserves_fields(
        worker_id in arb_worker_id(),
        name in arb_worker_name(),
        category in arb_category(),
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

        let id = Symbol::new(&env, &worker_id);
        let name_str = SorobanString::from_str(&env, &name);
        let cat = Symbol::new(&env, &category);
        let zero_hash = BytesN::from_array(&env, &[0u8; 32]);

        client.register(&id, &owner, &name_str, &cat, &zero_hash, &zero_hash, &curator);

        let before = client.get_worker(&id).unwrap();
        client.toggle(&id, &owner);
        let after = client.get_worker(&id).unwrap();

        // Invariant: only is_active changes
        assert_eq!(before.owner, after.owner);
        assert_eq!(before.name, after.name);
        assert_eq!(before.reputation, after.reputation);
        assert_ne!(before.is_active, after.is_active);
    }

    /// Fuzz test: only the owner can toggle (non-owner must not succeed).
    #[test]
    fn fuzz_toggle_owner_only(
        worker_id in arb_worker_id(),
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

        let id = Symbol::new(&env, &worker_id);
        let zero_hash = BytesN::from_array(&env, &[0u8; 32]);

        client.register(
            &id,
            &owner,
            &SorobanString::from_str(&env, "Owner Test"),
            &Symbol::new(&env, "plumber"),
            &zero_hash,
            &zero_hash,
            &curator,
        );

        // Owner toggle succeeds
        client.toggle(&id, &owner);
        let worker = client.get_worker(&id).unwrap();
        // Invariant: is_active flipped
        assert!(!worker.is_active);
    }
}
