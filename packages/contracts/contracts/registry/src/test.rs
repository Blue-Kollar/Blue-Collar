#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::Address as _,
    Address, Env, String, Symbol,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn setup() -> (Env, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let contract = env.register(RegistryContract, ());
    (env, contract)
}

fn make_worker(
    env: &Env,
    contract: &Address,
    id: &str,
    owner: &Address,
) {
    let client = RegistryContractClient::new(env, contract);
    client.register(
        &Symbol::new(env, id),
        owner,
        &String::from_str(env, id),
        &Symbol::new(env, "plumber"),
    );
}

// ---------------------------------------------------------------------------
// register
// ---------------------------------------------------------------------------

#[test]
fn test_register_success() {
    let (env, contract) = setup();
    let owner = Address::generate(&env);
    let client = RegistryContractClient::new(&env, &contract);

    client.register(
        &Symbol::new(&env, "w1"),
        &owner,
        &String::from_str(&env, "Alice"),
        &Symbol::new(&env, "electrician"),
    );

    let worker = client.get_worker(&Symbol::new(&env, "w1")).unwrap();
    assert_eq!(worker.owner, owner);
    assert_eq!(worker.is_active, true);
    assert_eq!(worker.category, Symbol::new(&env, "electrician"));
}

#[test]
fn test_register_same_owner_updates_entry() {
    // The existing owner may re-register their own id to update their
    // profile; the second write from the SAME owner wins.
    let (env, contract) = setup();
    let owner = Address::generate(&env);
    let client = RegistryContractClient::new(&env, &contract);

    client.register(
        &Symbol::new(&env, "w1"),
        &owner,
        &String::from_str(&env, "Alice"),
        &Symbol::new(&env, "plumber"),
    );
    client.register(
        &Symbol::new(&env, "w1"),
        &owner,
        &String::from_str(&env, "Alice V2"),
        &Symbol::new(&env, "electrician"),
    );

    let worker = client.get_worker(&Symbol::new(&env, "w1")).unwrap();
    assert_eq!(worker.owner, owner);
    assert_eq!(worker.category, Symbol::new(&env, "electrician"));

    // re-registering the same id does not duplicate the WorkerList entry
    let list = client.list_workers();
    assert_eq!(list.len(), 1);
}

#[test]
#[should_panic(expected = "Not authorized")]
fn test_register_duplicate_id_by_different_owner_rejected() {
    // Regression test for a missing auth check: registering an id that is
    // already owned by someone else used to silently overwrite it — any
    // address could hijack an existing worker's profile without the
    // original owner's consent. It must now be rejected.
    let (env, contract) = setup();
    let owner1 = Address::generate(&env);
    let owner2 = Address::generate(&env);
    let client = RegistryContractClient::new(&env, &contract);

    client.register(
        &Symbol::new(&env, "w1"),
        &owner1,
        &String::from_str(&env, "Alice"),
        &Symbol::new(&env, "plumber"),
    );
    client.register(
        &Symbol::new(&env, "w1"),
        &owner2,
        &String::from_str(&env, "Bob"),
        &Symbol::new(&env, "electrician"),
    );
}

#[test]
#[should_panic]
fn test_register_unauthorized() {
    let env = Env::default();
    // Do NOT mock auths — require_auth will panic
    let contract = env.register(RegistryContract, ());
    let owner = Address::generate(&env);
    let client = RegistryContractClient::new(&env, &contract);

    client.register(
        &Symbol::new(&env, "w1"),
        &owner,
        &String::from_str(&env, "Alice"),
        &Symbol::new(&env, "plumber"),
    );
}

// ---------------------------------------------------------------------------
// get_worker
// ---------------------------------------------------------------------------

#[test]
fn test_get_worker_found() {
    let (env, contract) = setup();
    let owner = Address::generate(&env);
    make_worker(&env, &contract, "w1", &owner);

    let client = RegistryContractClient::new(&env, &contract);
    let result = client.get_worker(&Symbol::new(&env, "w1"));
    assert!(result.is_some());
    assert_eq!(result.unwrap().owner, owner);
}

#[test]
fn test_get_worker_not_found() {
    let (env, contract) = setup();
    let client = RegistryContractClient::new(&env, &contract);
    let result = client.get_worker(&Symbol::new(&env, "nonexistent"));
    assert!(result.is_none());
}

// ---------------------------------------------------------------------------
// toggle
// ---------------------------------------------------------------------------

#[test]
fn test_toggle_owner_deactivates_then_activates() {
    let (env, contract) = setup();
    let owner = Address::generate(&env);
    make_worker(&env, &contract, "w1", &owner);

    let client = RegistryContractClient::new(&env, &contract);

    // starts active
    assert_eq!(
        client.get_worker(&Symbol::new(&env, "w1")).unwrap().is_active,
        true
    );

    // toggle off
    client.toggle(&Symbol::new(&env, "w1"), &owner);
    assert_eq!(
        client.get_worker(&Symbol::new(&env, "w1")).unwrap().is_active,
        false
    );

    // toggle back on
    client.toggle(&Symbol::new(&env, "w1"), &owner);
    assert_eq!(
        client.get_worker(&Symbol::new(&env, "w1")).unwrap().is_active,
        true
    );
}

#[test]
#[should_panic(expected = "Not authorized")]
fn test_toggle_non_owner_panics() {
    let (env, contract) = setup();
    let owner = Address::generate(&env);
    let other = Address::generate(&env);
    make_worker(&env, &contract, "w1", &owner);

    let client = RegistryContractClient::new(&env, &contract);
    client.toggle(&Symbol::new(&env, "w1"), &other);
}

#[test]
#[should_panic(expected = "Worker not found")]
fn test_toggle_nonexistent_worker() {
    let (env, contract) = setup();
    let caller = Address::generate(&env);
    let client = RegistryContractClient::new(&env, &contract);
    client.toggle(&Symbol::new(&env, "ghost"), &caller);
}

// ---------------------------------------------------------------------------
// list_workers
// ---------------------------------------------------------------------------

#[test]
fn test_list_workers_empty() {
    let (env, contract) = setup();
    let client = RegistryContractClient::new(&env, &contract);
    let list = client.list_workers();
    assert_eq!(list.len(), 0);
}

#[test]
fn test_list_workers_multiple() {
    let (env, contract) = setup();
    let owner = Address::generate(&env);
    make_worker(&env, &contract, "w1", &owner);
    make_worker(&env, &contract, "w2", &owner);
    make_worker(&env, &contract, "w3", &owner);

    let client = RegistryContractClient::new(&env, &contract);
    let list = client.list_workers();
    assert_eq!(list.len(), 3);
    assert_eq!(list.get(0).unwrap(), Symbol::new(&env, "w1"));
    assert_eq!(list.get(1).unwrap(), Symbol::new(&env, "w2"));
    assert_eq!(list.get(2).unwrap(), Symbol::new(&env, "w3"));
}

#[test]
fn test_list_workers_after_toggle_still_listed() {
    // toggling active status does not remove from list
    let (env, contract) = setup();
    let owner = Address::generate(&env);
    make_worker(&env, &contract, "w1", &owner);

    let client = RegistryContractClient::new(&env, &contract);
    client.toggle(&Symbol::new(&env, "w1"), &owner);

    let list = client.list_workers();
    assert_eq!(list.len(), 1);
}

// ---------------------------------------------------------------------------
// initialize / upgrade: access control
// ---------------------------------------------------------------------------

#[test]
#[should_panic(expected = "Already initialized")]
fn test_initialize_twice_panics() {
    let (env, contract) = setup();
    let admin = Address::generate(&env);
    let client = RegistryContractClient::new(&env, &contract);
    client.initialize(&admin);
    client.initialize(&admin);
}

#[test]
#[should_panic(expected = "Not initialized")]
fn test_upgrade_before_initialize_rejected() {
    let (env, contract) = setup();
    let admin = Address::generate(&env);
    let client = RegistryContractClient::new(&env, &contract);
    let fake_hash = soroban_sdk::BytesN::from_array(&env, &[0u8; 32]);
    client.upgrade(&admin, &fake_hash);
}

#[test]
#[should_panic(expected = "Unauthorized")]
fn test_upgrade_non_admin_rejected() {
    // Regression test for a missing auth check: `upgrade` used to have no
    // stored admin at all — it only required that *some* address sign the
    // call, so any caller could authorize as themselves and replace the
    // contract's WASM.
    let (env, contract) = setup();
    let admin = Address::generate(&env);
    let attacker = Address::generate(&env);
    let client = RegistryContractClient::new(&env, &contract);
    client.initialize(&admin);

    let fake_hash = soroban_sdk::BytesN::from_array(&env, &[0u8; 32]);
    client.upgrade(&attacker, &fake_hash);
}
