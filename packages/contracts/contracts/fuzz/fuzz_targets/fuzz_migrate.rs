#![no_main]
//! Coverage-guided fuzz target for the Registry schema-migration path.
//!
//! Invariant: running `migrate` over arbitrary registered-worker state must
//! never corrupt or drop existing storage, and must bump the schema version
//! by exactly one. This is the data-integrity guarantee an upgrade relies on.
use arbitrary::Arbitrary;
use bluecollar_registry::{RegistryContract, RegistryContractClient};
use libfuzzer_sys::fuzz_target;
use soroban_sdk::{testutils::Address as _, Address, BytesN, Env, String as SorobanString, Symbol};

#[derive(Arbitrary, Debug)]
struct MigrateInput {
    worker_id: String,
    name: String,
    reputation: u32,
}

fuzz_target!(|input: MigrateInput| {
    let worker_id = if input.worker_id.is_empty() {
        "w1".to_string()
    } else {
        input.worker_id.chars().take(16).collect::<String>()
    };
    let name = if input.name.is_empty() {
        "Worker".to_string()
    } else {
        input.name.chars().take(32).collect::<String>()
    };
    // Reputation is range-checked by the contract (0..=10000).
    let reputation = input.reputation % 10_001;

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
    let name_str = SorobanString::from_str(&env, &name);
    let cat = Symbol::new(&env, "plumber");
    let zero_hash = BytesN::from_array(&env, &[0u8; 32]);

    client.register(
        &id, &owner, &name_str, &cat, &zero_hash, &zero_hash, &curator,
    );
    client.update_reputation(&admin, &id, &reputation);

    // Capture pre-migration state.
    let before = client
        .get_worker(&id)
        .expect("worker must exist before migrate");
    let version_before = client.get_schema_version();

    // Run the migration (the data-integrity path of an upgrade).
    client.migrate(&admin, &version_before);

    // Invariant 1: every stored field is preserved across the migration.
    let after = client.get_worker(&id).expect("worker must survive migrate");
    assert_eq!(after.owner, before.owner, "owner changed during migrate");
    assert_eq!(after.name, before.name, "name changed during migrate");
    assert_eq!(
        after.category, before.category,
        "category changed during migrate"
    );
    assert_eq!(
        after.reputation, before.reputation,
        "reputation changed during migrate"
    );
    assert_eq!(
        after.is_active, before.is_active,
        "is_active changed during migrate"
    );

    // Invariant 2: the schema version advances by exactly one.
    assert_eq!(
        client.get_schema_version(),
        version_before + 1,
        "version not bumped by one"
    );
});
