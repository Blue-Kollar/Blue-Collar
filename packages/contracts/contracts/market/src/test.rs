#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token::{Client as TokenClient, StellarAssetClient},
    Address, Env, Symbol,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn setup() -> (Env, Address, Address, Address, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let fee_recipient = Address::generate(&env);
    let from = Address::generate(&env);
    let to = Address::generate(&env);

    // Deploy a native-style token for testing
    let token_id = env.register_stellar_asset_contract_v2(admin.clone());
    let token_addr = token_id.address();

    // Mint tokens to `from`
    let asset_client = StellarAssetClient::new(&env, &token_addr);
    asset_client.mint(&from, &10_000);

    (env, admin, fee_recipient, from, to, token_addr)
}

fn init(env: &Env, contract: &Address, admin: &Address, fee_bps: u32, fee_recipient: &Address) {
    let client = MarketContractClient::new(env, contract);
    client.initialize(admin, &fee_bps, fee_recipient);
}

fn deploy(env: &Env) -> Address {
    env.register(MarketContract, ())
}

// ---------------------------------------------------------------------------
// initialize
// ---------------------------------------------------------------------------

#[test]
fn test_initialize_success() {
    let (env, admin, fee_recipient, _from, _to, _token) = setup();
    let contract = deploy(&env);
    init(&env, &contract, &admin, 100, &fee_recipient);

    let client = MarketContractClient::new(&env, &contract);
    let config = client.get_config();
    assert_eq!(config.fee_bps, 100);
    assert_eq!(config.admin, admin);
    assert_eq!(config.fee_recipient, fee_recipient);
}

#[test]
#[should_panic(expected = "Already initialized")]
fn test_initialize_twice_panics() {
    let (env, admin, fee_recipient, _from, _to, _token) = setup();
    let contract = deploy(&env);
    init(&env, &contract, &admin, 100, &fee_recipient);
    init(&env, &contract, &admin, 100, &fee_recipient);
}

#[test]
#[should_panic(expected = "fee_bps exceeds maximum")]
fn test_initialize_fee_too_high() {
    let (env, admin, fee_recipient, _from, _to, _token) = setup();
    let contract = deploy(&env);
    init(&env, &contract, &admin, 501, &fee_recipient);
}

// ---------------------------------------------------------------------------
// tip
// ---------------------------------------------------------------------------

#[test]
fn test_tip_success_with_fee() {
    let (env, admin, fee_recipient, from, to, token_addr) = setup();
    let contract = deploy(&env);
    init(&env, &contract, &admin, 100, &fee_recipient); // 1%

    let client = MarketContractClient::new(&env, &contract);
    client.tip(&from, &to, &token_addr, &1000);

    let token = TokenClient::new(&env, &token_addr);
    // worker gets 990, fee_recipient gets 10
    assert_eq!(token.balance(&to), 990);
    assert_eq!(token.balance(&fee_recipient), 10);
    assert_eq!(token.balance(&from), 9_000);
}

#[test]
fn test_tip_zero_fee() {
    let (env, admin, fee_recipient, from, to, token_addr) = setup();
    let contract = deploy(&env);
    init(&env, &contract, &admin, 0, &fee_recipient);

    let client = MarketContractClient::new(&env, &contract);
    client.tip(&from, &to, &token_addr, &500);

    let token = TokenClient::new(&env, &token_addr);
    assert_eq!(token.balance(&to), 500);
    assert_eq!(token.balance(&fee_recipient), 0);
}

#[test]
fn test_tip_max_fee() {
    let (env, admin, fee_recipient, from, to, token_addr) = setup();
    let contract = deploy(&env);
    init(&env, &contract, &admin, 500, &fee_recipient); // 5%

    let client = MarketContractClient::new(&env, &contract);
    client.tip(&from, &to, &token_addr, &1000);

    let token = TokenClient::new(&env, &token_addr);
    assert_eq!(token.balance(&to), 950);
    assert_eq!(token.balance(&fee_recipient), 50);
}

#[test]
#[should_panic]
fn test_tip_insufficient_balance() {
    let (env, admin, fee_recipient, from, to, token_addr) = setup();
    let contract = deploy(&env);
    init(&env, &contract, &admin, 100, &fee_recipient);

    let client = MarketContractClient::new(&env, &contract);
    // from only has 10_000; try to send 99_999
    client.tip(&from, &to, &token_addr, &99_999);
}

#[test]
#[should_panic(expected = "Amount must be positive")]
fn test_tip_zero_amount() {
    let (env, admin, fee_recipient, from, to, token_addr) = setup();
    let contract = deploy(&env);
    init(&env, &contract, &admin, 100, &fee_recipient);

    let client = MarketContractClient::new(&env, &contract);
    client.tip(&from, &to, &token_addr, &0);
}

// ---------------------------------------------------------------------------
// update_fee
// ---------------------------------------------------------------------------

#[test]
fn test_update_fee_success() {
    let (env, admin, fee_recipient, _from, _to, _token) = setup();
    let contract = deploy(&env);
    init(&env, &contract, &admin, 100, &fee_recipient);

    let client = MarketContractClient::new(&env, &contract);
    client.update_fee(&admin, &200);
    assert_eq!(client.get_config().fee_bps, 200);
}

#[test]
#[should_panic(expected = "fee_bps exceeds maximum")]
fn test_update_fee_too_high() {
    let (env, admin, fee_recipient, _from, _to, _token) = setup();
    let contract = deploy(&env);
    init(&env, &contract, &admin, 100, &fee_recipient);

    let client = MarketContractClient::new(&env, &contract);
    client.update_fee(&admin, &501);
}

#[test]
#[should_panic(expected = "Unauthorized")]
fn test_update_fee_non_admin() {
    let (env, admin, fee_recipient, from, _to, _token) = setup();
    let contract = deploy(&env);
    init(&env, &contract, &admin, 100, &fee_recipient);

    let client = MarketContractClient::new(&env, &contract);
    client.update_fee(&from, &200);
}

// ---------------------------------------------------------------------------
// escrow: create
// ---------------------------------------------------------------------------

#[test]
fn test_create_escrow_success() {
    let (env, admin, fee_recipient, from, to, token_addr) = setup();
    let contract = deploy(&env);
    init(&env, &contract, &admin, 100, &fee_recipient);

    let client = MarketContractClient::new(&env, &contract);
    let id = Symbol::new(&env, "esc1");
    client.create_escrow(&id, &from, &to, &token_addr, &1000, &9999);

    let escrow = client.get_escrow(&id).unwrap();
    assert_eq!(escrow.amount, 1000);
    assert_eq!(escrow.status, EscrowStatus::Active);

    // tokens locked in contract
    let token = TokenClient::new(&env, &token_addr);
    assert_eq!(token.balance(&contract), 1000);
    assert_eq!(token.balance(&from), 9_000);
}

#[test]
#[should_panic(expected = "Escrow id already exists")]
fn test_create_escrow_duplicate_id() {
    let (env, admin, fee_recipient, from, to, token_addr) = setup();
    let contract = deploy(&env);
    init(&env, &contract, &admin, 100, &fee_recipient);

    let client = MarketContractClient::new(&env, &contract);
    let id = Symbol::new(&env, "esc1");
    client.create_escrow(&id, &from, &to, &token_addr, &500, &9999);
    client.create_escrow(&id, &from, &to, &token_addr, &500, &9999);
}

#[test]
#[should_panic(expected = "Amount must be positive")]
fn test_create_escrow_zero_amount() {
    let (env, admin, fee_recipient, from, to, token_addr) = setup();
    let contract = deploy(&env);
    init(&env, &contract, &admin, 100, &fee_recipient);

    let client = MarketContractClient::new(&env, &contract);
    let id = Symbol::new(&env, "esc1");
    client.create_escrow(&id, &from, &to, &token_addr, &0, &9999);
}

// ---------------------------------------------------------------------------
// escrow: release
// ---------------------------------------------------------------------------

#[test]
fn test_release_escrow_success() {
    let (env, admin, fee_recipient, from, to, token_addr) = setup();
    let contract = deploy(&env);
    init(&env, &contract, &admin, 100, &fee_recipient); // 1%

    let client = MarketContractClient::new(&env, &contract);
    let id = Symbol::new(&env, "esc1");
    client.create_escrow(&id, &from, &to, &token_addr, &1000, &9999);
    client.release_escrow(&id, &from);

    let token = TokenClient::new(&env, &token_addr);
    assert_eq!(token.balance(&to), 990);
    assert_eq!(token.balance(&fee_recipient), 10);
    assert_eq!(token.balance(&contract), 0);

    let escrow = client.get_escrow(&id).unwrap();
    assert_eq!(escrow.status, EscrowStatus::Released);
}

#[test]
#[should_panic(expected = "Unauthorized")]
fn test_release_escrow_unauthorized() {
    let (env, admin, fee_recipient, from, to, token_addr) = setup();
    let contract = deploy(&env);
    init(&env, &contract, &admin, 100, &fee_recipient);

    let client = MarketContractClient::new(&env, &contract);
    let id = Symbol::new(&env, "esc1");
    client.create_escrow(&id, &from, &to, &token_addr, &1000, &9999);
    client.release_escrow(&id, &to); // `to` is not `from`
}

#[test]
#[should_panic(expected = "Escrow not active")]
fn test_release_escrow_already_released() {
    let (env, admin, fee_recipient, from, to, token_addr) = setup();
    let contract = deploy(&env);
    init(&env, &contract, &admin, 100, &fee_recipient);

    let client = MarketContractClient::new(&env, &contract);
    let id = Symbol::new(&env, "esc1");
    client.create_escrow(&id, &from, &to, &token_addr, &1000, &9999);
    client.release_escrow(&id, &from);
    client.release_escrow(&id, &from);
}

// ---------------------------------------------------------------------------
// escrow: cancel
// ---------------------------------------------------------------------------

#[test]
fn test_cancel_escrow_success() {
    let (env, admin, fee_recipient, from, to, token_addr) = setup();
    let contract = deploy(&env);
    init(&env, &contract, &admin, 100, &fee_recipient);

    let client = MarketContractClient::new(&env, &contract);
    let id = Symbol::new(&env, "esc1");
    client.create_escrow(&id, &from, &to, &token_addr, &1000, &9999);
    client.cancel_escrow(&id, &from);

    let token = TokenClient::new(&env, &token_addr);
    // full refund, no fee on cancel
    assert_eq!(token.balance(&from), 10_000);
    assert_eq!(token.balance(&contract), 0);

    let escrow = client.get_escrow(&id).unwrap();
    assert_eq!(escrow.status, EscrowStatus::Cancelled);
}

#[test]
#[should_panic(expected = "Unauthorized")]
fn test_cancel_escrow_unauthorized() {
    let (env, admin, fee_recipient, from, to, token_addr) = setup();
    let contract = deploy(&env);
    init(&env, &contract, &admin, 100, &fee_recipient);

    let client = MarketContractClient::new(&env, &contract);
    let id = Symbol::new(&env, "esc1");
    client.create_escrow(&id, &from, &to, &token_addr, &1000, &9999);
    client.cancel_escrow(&id, &to);
}

#[test]
#[should_panic(expected = "Escrow not active")]
fn test_cancel_escrow_already_cancelled() {
    let (env, admin, fee_recipient, from, to, token_addr) = setup();
    let contract = deploy(&env);
    init(&env, &contract, &admin, 100, &fee_recipient);

    let client = MarketContractClient::new(&env, &contract);
    let id = Symbol::new(&env, "esc1");
    client.create_escrow(&id, &from, &to, &token_addr, &1000, &9999);
    client.cancel_escrow(&id, &from);
    client.cancel_escrow(&id, &from);
}

// ---------------------------------------------------------------------------
// escrow: cancel expired
// ---------------------------------------------------------------------------

#[test]
fn test_cancel_expired_escrow_success() {
    let (env, admin, fee_recipient, from, to, token_addr) = setup();
    let contract = deploy(&env);
    init(&env, &contract, &admin, 100, &fee_recipient);

    let client = MarketContractClient::new(&env, &contract);
    let id = Symbol::new(&env, "esc1");
    client.create_escrow(&id, &from, &to, &token_addr, &1000, &100);

    // advance ledger past expiry
    env.ledger().set_timestamp(200);
    client.cancel_expired_escrow(&id);

    let token = TokenClient::new(&env, &token_addr);
    assert_eq!(token.balance(&from), 10_000);
    assert_eq!(token.balance(&contract), 0);
}

#[test]
#[should_panic(expected = "Escrow not yet expired")]
fn test_cancel_expired_escrow_not_expired() {
    let (env, admin, fee_recipient, from, to, token_addr) = setup();
    let contract = deploy(&env);
    init(&env, &contract, &admin, 100, &fee_recipient);

    let client = MarketContractClient::new(&env, &contract);
    let id = Symbol::new(&env, "esc1");
    client.create_escrow(&id, &from, &to, &token_addr, &1000, &9999);

    env.ledger().set_timestamp(50);
    client.cancel_expired_escrow(&id);
}

#[test]
#[should_panic(expected = "Escrow not active")]
fn test_cancel_expired_already_released() {
    let (env, admin, fee_recipient, from, to, token_addr) = setup();
    let contract = deploy(&env);
    init(&env, &contract, &admin, 100, &fee_recipient);

    let client = MarketContractClient::new(&env, &contract);
    let id = Symbol::new(&env, "esc1");
    client.create_escrow(&id, &from, &to, &token_addr, &1000, &100);
    client.release_escrow(&id, &from);

    env.ledger().set_timestamp(200);
    client.cancel_expired_escrow(&id);
}
