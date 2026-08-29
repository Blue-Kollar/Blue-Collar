#![no_main]
use arbitrary::Arbitrary;
use bluecollar_registry::{RegistryContract, RegistryContractClient};
use libfuzzer_sys::fuzz_target;
use soroban_sdk::{testutils::Address as _, Address, BytesN, Env, String as SorobanString, Symbol};

#[derive(Arbitrary, Debug)]
struct RegisterInput {
    worker_id: String,
    name: String,
    category: String,
}

fuzz_target!(|input: RegisterInput| {
    // Sanitize inputs to valid lengths
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

    let category = if input.category.is_empty() {
        "plumber".to_string()
    } else {
        input.category.chars().take(16).collect::<String>()
    };

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

    // This should never panic with arbitrary inputs
    let _ = client.register(
        &id, &owner, &name_str, &cat, &zero_hash, &zero_hash, &curator,
    );
});
