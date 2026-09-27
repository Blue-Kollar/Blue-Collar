//! End-to-end integration tests for BlueCollar Soroban contracts (#816).
//!
//! Tests run against the in-process Soroban testnet (soroban-sdk testutils),
//! so no live network connection is required. Each test deploys fresh contract
//! instances and exercises complete flows:
//!
//!   1. Registry: initialize → add_curator → register → get_worker → toggle
//!   2. Market:   initialize → tip (with fee split) → create_escrow → release_escrow
//!   3. Cross-contract: register a worker then tip them end-to-end
//!
//! Run:
//!   cargo test -p bluecollar-integration

#![cfg(test)]

use soroban_sdk::{testutils::Address as _, token, Address, BytesN, Env, String, Symbol};

use bluecollar_market::MarketContractClient;
use bluecollar_registry::RegistryContractClient;

// ── helpers ───────────────────────────────────────────────────────────────────

fn zero_hash(env: &Env) -> BytesN<32> {
    BytesN::from_array(env, &[0u8; 32])
}

/// Deploy and initialise a fresh Registry contract.
/// Grants all management roles to `admin` so integration tests can exercise
/// the full API (add_curator, etc.).
fn deploy_registry<'a>(env: &'a Env, admin: &Address) -> RegistryContractClient<'a> {
    let contract_id = env.register_contract(None, bluecollar_registry::RegistryContract);
    let client = RegistryContractClient::new(env, &contract_id);
    client.initialize(admin);
    // Grant the same roles that the registry unit-test fixture bootstraps.
    client.grant_role(admin, &Symbol::new(env, "pauser"), admin);
    client.grant_role(admin, &Symbol::new(env, "curator_mgr"), admin);
    client.grant_role(admin, &Symbol::new(env, "rep_mgr"), admin);
    client.grant_role(admin, &Symbol::new(env, "upgrader"), admin);
    client
}

/// Deploy a mock token (soroban-sdk built-in) and mint `amount` to `to`.
fn deploy_token<'a>(
    env: &'a Env,
    admin: &Address,
    to: &Address,
    amount: i128,
) -> token::Client<'a> {
    let token_id = env.register_stellar_asset_contract_v2(admin.clone());
    let admin_client = token::StellarAssetClient::new(env, &token_id.address());
    admin_client.mint(to, &amount);
    token::Client::new(env, &token_id.address())
}

/// Deploy and initialise a fresh Market contract.
fn deploy_market<'a>(
    env: &'a Env,
    admin: &Address,
    fee_bps: u32,
    fee_recipient: &Address,
) -> MarketContractClient<'a> {
    let contract_id = env.register_contract(None, bluecollar_market::MarketContract);
    let client = MarketContractClient::new(env, &contract_id);
    client.initialize(admin, &fee_bps, fee_recipient);
    client
}

// ── Registry integration tests ────────────────────────────────────────────────

#[test]
fn registry_register_and_get_worker() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let curator = Address::generate(&env);
    let owner = Address::generate(&env);

    let registry = deploy_registry(&env, &admin);

    // Add curator
    registry.add_curator(&admin, &curator);

    // Register worker
    let id = Symbol::new(&env, "worker_001");
    registry.register(
        &id,
        &owner,
        &String::from_str(&env, "Alice the Plumber"),
        &Symbol::new(&env, "plumber"),
        &zero_hash(&env),
        &zero_hash(&env),
        &curator,
    );

    // Assert worker exists and is active
    let worker = registry.get_worker(&id).unwrap();
    assert_eq!(worker.id, id);
    assert!(worker.is_active);
    assert_eq!(worker.owner, owner);
}

#[test]
fn registry_toggle_active_status() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let curator = Address::generate(&env);
    let owner = Address::generate(&env);

    let registry = deploy_registry(&env, &admin);
    registry.add_curator(&admin, &curator);

    let id = Symbol::new(&env, "worker_002");
    registry.register(
        &id,
        &owner,
        &String::from_str(&env, "Bob the Electrician"),
        &Symbol::new(&env, "electrician"),
        &zero_hash(&env),
        &zero_hash(&env),
        &curator,
    );

    // Toggle off
    registry.toggle(&id, &owner);
    let w = registry.get_worker(&id).unwrap();
    assert!(!w.is_active);

    // Toggle back on
    registry.toggle(&id, &owner);
    let w2 = registry.get_worker(&id).unwrap();
    assert!(w2.is_active);
}

#[test]
fn registry_register_without_curator_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let non_curator = Address::generate(&env);
    let owner = Address::generate(&env);

    let registry = deploy_registry(&env, &admin);

    let res = registry.try_register(
        &Symbol::new(&env, "worker_003"),
        &owner,
        &String::from_str(&env, "Carol"),
        &Symbol::new(&env, "welder"),
        &zero_hash(&env),
        &zero_hash(&env),
        &non_curator, // not a curator
    );
    assert_eq!(
        res,
        Err(Ok(bluecollar_types::ContractError::CallerIsNotCurator))
    );
}

// ── Market integration tests ──────────────────────────────────────────────────

#[test]
fn market_tip_transfers_net_amount_to_worker() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let fee_recv = Address::generate(&env);
    let payer = Address::generate(&env);
    let worker = Address::generate(&env);

    // 1% fee
    let market = deploy_market(&env, &admin, 100, &fee_recv);
    let token = deploy_token(&env, &admin, &payer, 10_000);

    market.tip(&payer, &worker, &token.address, &1_000);

    // fee = 1% of 1000 = 10; worker receives 990
    assert_eq!(token.balance(&worker), 990);
    assert_eq!(token.balance(&fee_recv), 10);
}

#[test]
fn market_tip_zero_fee() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let payer = Address::generate(&env);
    let worker = Address::generate(&env);

    let market = deploy_market(&env, &admin, 0, &admin);
    let token = deploy_token(&env, &admin, &payer, 5_000);

    market.tip(&payer, &worker, &token.address, &500);

    // No fee — worker receives full amount
    assert_eq!(token.balance(&worker), 500);
    assert_eq!(token.balance(&admin), 0);
}

#[test]
fn market_escrow_create_and_release() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let payer = Address::generate(&env);
    let worker = Address::generate(&env);

    let market = deploy_market(&env, &admin, 0, &admin);
    let token = deploy_token(&env, &admin, &payer, 10_000);

    let escrow_id = Symbol::new(&env, "esc_001");
    let expiry: u64 = env.ledger().timestamp() + 86_400; // 24 h

    market.create_escrow(&escrow_id, &payer, &worker, &token.address, &2_000, &expiry);

    // Funds should have moved to the contract
    assert_eq!(token.balance(&payer), 8_000);

    // Release – worker (or payer) releases funds
    market.release_escrow(&escrow_id, &worker);

    assert_eq!(token.balance(&worker), 2_000);
}

#[test]
fn market_escrow_duplicate_id_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let payer = Address::generate(&env);
    let worker = Address::generate(&env);

    let market = deploy_market(&env, &admin, 0, &admin);
    let token = deploy_token(&env, &admin, &payer, 10_000);

    let id = Symbol::new(&env, "dup");
    let expiry = env.ledger().timestamp() + 3_600;

    market.create_escrow(&id, &payer, &worker, &token.address, &100, &expiry);
    let res = market.try_create_escrow(&id, &payer, &worker, &token.address, &100, &expiry);
    assert_eq!(
        res,
        Err(Ok(bluecollar_types::ContractError::EscrowAlreadyExists))
    );
}

// ── Cross-contract: register then tip ────────────────────────────────────────

#[test]
fn register_worker_then_tip_end_to_end() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let curator = Address::generate(&env);
    let fee_recv = Address::generate(&env);
    let payer = Address::generate(&env);
    let owner = Address::generate(&env);

    // Deploy both contracts
    let registry = deploy_registry(&env, &admin);
    let market = deploy_market(&env, &admin, 200, &fee_recv); // 2% fee
    let token = deploy_token(&env, &admin, &payer, 50_000);

    // Register worker
    registry.add_curator(&admin, &curator);
    let worker_id = Symbol::new(&env, "alice_001");
    registry.register(
        &worker_id,
        &owner,
        &String::from_str(&env, "Alice"),
        &Symbol::new(&env, "plumber"),
        &zero_hash(&env),
        &zero_hash(&env),
        &curator,
    );

    // Verify worker is on-chain and active
    let w = registry.get_worker(&worker_id).unwrap();
    assert!(w.is_active);

    // Tip the worker's wallet address
    market.tip(&payer, &w.wallet, &token.address, &10_000);

    // fee = 2% of 10000 = 200; worker receives 9800
    assert_eq!(token.balance(&w.wallet), 9_800);
    assert_eq!(token.balance(&fee_recv), 200);
}
