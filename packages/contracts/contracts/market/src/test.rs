#![cfg(test)]

use super::*;
use soroban_sdk::{
    contract, contractimpl,
    testutils::{Address as _, Ledger},
    token::{Client as TokenClient, StellarAssetClient, TokenInterface},
    Address, Env, String, Symbol,
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

#[test]
#[should_panic(expected = "Amount must be positive")]
fn test_tip_negative_amount() {
    let (env, admin, fee_recipient, from, to, token_addr) = setup();
    let contract = deploy(&env);
    init(&env, &contract, &admin, 100, &fee_recipient);

    let client = MarketContractClient::new(&env, &contract);
    client.tip(&from, &to, &token_addr, &-1);
}

#[test]
#[should_panic]
fn test_tip_unauthorized_caller_rejected() {
    // `from` must authorize the tip itself; without a mocked/real auth
    // entry for `from`, require_auth() must reject the call.
    let env = Env::default();
    let admin = Address::generate(&env);
    let fee_recipient = Address::generate(&env);
    let from = Address::generate(&env);
    let to = Address::generate(&env);

    let token_id = env.register_stellar_asset_contract_v2(admin.clone());
    let token_addr = token_id.address();

    let contract = deploy(&env);
    // Only mock auth for the admin's initialize call, not for `from`'s tip.
    env.mock_all_auths();
    init(&env, &contract, &admin, 100, &fee_recipient);
    env.set_auths(&[]);

    let client = MarketContractClient::new(&env, &contract);
    client.tip(&from, &to, &token_addr, &100);
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

// ---------------------------------------------------------------------------
// escrow: unauthorized caller / nonexistent id
// ---------------------------------------------------------------------------

#[test]
#[should_panic]
fn test_create_escrow_unauthorized_caller_rejected() {
    // `from` must authorize the escrow deposit itself.
    let env = Env::default();
    let admin = Address::generate(&env);
    let fee_recipient = Address::generate(&env);
    let from = Address::generate(&env);
    let to = Address::generate(&env);

    let token_id = env.register_stellar_asset_contract_v2(admin.clone());
    let token_addr = token_id.address();

    let contract = deploy(&env);
    env.mock_all_auths();
    init(&env, &contract, &admin, 100, &fee_recipient);
    env.set_auths(&[]);

    let client = MarketContractClient::new(&env, &contract);
    let id = Symbol::new(&env, "esc1");
    client.create_escrow(&id, &from, &to, &token_addr, &100, &9999);
}

#[test]
#[should_panic(expected = "Escrow not found")]
fn test_release_escrow_nonexistent_id() {
    let (env, admin, fee_recipient, from, _to, _token) = setup();
    let contract = deploy(&env);
    init(&env, &contract, &admin, 100, &fee_recipient);

    let client = MarketContractClient::new(&env, &contract);
    client.release_escrow(&Symbol::new(&env, "ghost"), &from);
}

#[test]
#[should_panic(expected = "Escrow not found")]
fn test_cancel_escrow_nonexistent_id() {
    let (env, admin, fee_recipient, from, _to, _token) = setup();
    let contract = deploy(&env);
    init(&env, &contract, &admin, 100, &fee_recipient);

    let client = MarketContractClient::new(&env, &contract);
    client.cancel_escrow(&Symbol::new(&env, "ghost"), &from);
}

#[test]
#[should_panic(expected = "Escrow not found")]
fn test_cancel_expired_escrow_nonexistent_id() {
    let (env, admin, fee_recipient, _from, _to, _token) = setup();
    let contract = deploy(&env);
    init(&env, &contract, &admin, 100, &fee_recipient);

    let client = MarketContractClient::new(&env, &contract);
    client.cancel_expired_escrow(&Symbol::new(&env, "ghost"));
}

#[test]
fn test_get_escrow_nonexistent_id_returns_none() {
    let (env, admin, fee_recipient, _from, _to, _token) = setup();
    let contract = deploy(&env);
    init(&env, &contract, &admin, 100, &fee_recipient);

    let client = MarketContractClient::new(&env, &contract);
    assert!(client.get_escrow(&Symbol::new(&env, "ghost")).is_none());
}

// ---------------------------------------------------------------------------
// escrow: overflow / underflow / boundary amounts
// ---------------------------------------------------------------------------

#[test]
#[should_panic]
fn test_create_escrow_amount_overflows_fee_math() {
    // amount * fee_bps must not silently wrap; overflow-checks catch this.
    let (env, admin, fee_recipient, from, to, token_addr) = setup();
    let contract = deploy(&env);
    init(&env, &contract, &admin, 500, &fee_recipient);

    let client = MarketContractClient::new(&env, &contract);
    let id = Symbol::new(&env, "esc_overflow");
    // from only holds 10_000 in setup(), so this also exercises the
    // insufficient-balance path; either panic is an acceptable rejection,
    // but it must never silently wrap and lock a bogus amount.
    client.create_escrow(&id, &from, &to, &token_addr, &i128::MAX, &9999);
}

#[test]
fn test_release_escrow_min_amount_one() {
    let (env, admin, fee_recipient, from, to, token_addr) = setup();
    let contract = deploy(&env);
    init(&env, &contract, &admin, 500, &fee_recipient); // 5% fee

    let client = MarketContractClient::new(&env, &contract);
    let id = Symbol::new(&env, "esc_min");
    client.create_escrow(&id, &from, &to, &token_addr, &1, &9999);
    client.release_escrow(&id, &from);

    let token = TokenClient::new(&env, &token_addr);
    // fee = (1 * 500) / 10_000 = 0 (integer division rounds down)
    assert_eq!(token.balance(&to), 1);
    assert_eq!(token.balance(&fee_recipient), 0);
}

#[test]
#[should_panic(expected = "Amount must be positive")]
fn test_create_escrow_negative_amount_rejected() {
    let (env, admin, fee_recipient, from, to, token_addr) = setup();
    let contract = deploy(&env);
    init(&env, &contract, &admin, 100, &fee_recipient);

    let client = MarketContractClient::new(&env, &contract);
    let id = Symbol::new(&env, "esc_neg");
    client.create_escrow(&id, &from, &to, &token_addr, &-1, &9999);
}

// ---------------------------------------------------------------------------
// upgrade: access control
// ---------------------------------------------------------------------------

#[test]
#[should_panic(expected = "Unauthorized")]
fn test_upgrade_non_admin_rejected() {
    // Regression test for a missing auth check: `upgrade` used to only
    // require that *some* address sign the call, without verifying that
    // address was actually the configured admin — so any caller could
    // authorize as themselves and replace the contract's WASM.
    let (env, admin, fee_recipient, from, _to, _token) = setup();
    let contract = deploy(&env);
    init(&env, &contract, &admin, 100, &fee_recipient);

    let client = MarketContractClient::new(&env, &contract);
    let fake_hash = soroban_sdk::BytesN::from_array(&env, &[0u8; 32]);
    client.upgrade(&from, &fake_hash); // `from` is not the admin
}

// ---------------------------------------------------------------------------
// reentrancy: checks-effects-interactions ordering
// ---------------------------------------------------------------------------
//
// `ReentrantToken` is a minimal token double whose `transfer` calls back
// into the market contract before returning, simulating a malicious or
// non-standard token contract supplied as `token_addr`. This is realistic
// because `token_addr` is caller-supplied at `create_escrow` time — the
// market contract has no way to guarantee it is a well-behaved token.

#[contract]
struct ReentrantToken;

#[contractimpl]
impl TokenInterface for ReentrantToken {
    fn allowance(_env: Env, _from: Address, _spender: Address) -> i128 {
        0
    }

    fn approve(
        _env: Env,
        _from: Address,
        _spender: Address,
        _amount: i128,
        _expiration_ledger: u32,
    ) {
    }

    fn balance(env: Env, id: Address) -> i128 {
        env.storage().persistent().get(&id).unwrap_or(0)
    }

    fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        let from_balance: i128 = env.storage().persistent().get(&from).unwrap_or(0);
        env.storage()
            .persistent()
            .set(&from, &(from_balance - amount));
        let to_balance: i128 = env.storage().persistent().get(&to).unwrap_or(0);
        env.storage().persistent().set(&to, &(to_balance + amount));

        // Re-enter release_escrow for the same id, once, mid-transfer.
        let reentered_key = Symbol::new(&env, "reentered");
        let already_reentered: bool = env.storage().instance().get(&reentered_key).unwrap_or(false);
        if !already_reentered {
            env.storage().instance().set(&reentered_key, &true);
            let market: Address = env
                .storage()
                .instance()
                .get(&Symbol::new(&env, "market"))
                .unwrap();
            let escrow_id: Symbol = env
                .storage()
                .instance()
                .get(&Symbol::new(&env, "escrow_id"))
                .unwrap();
            let caller: Address = env
                .storage()
                .instance()
                .get(&Symbol::new(&env, "caller"))
                .unwrap();
            let client = MarketContractClient::new(&env, &market);
            client.release_escrow(&escrow_id, &caller);
        }
    }

    fn transfer_from(_env: Env, _spender: Address, _from: Address, _to: Address, _amount: i128) {}

    fn burn(_env: Env, _from: Address, _amount: i128) {}

    fn burn_from(_env: Env, _spender: Address, _from: Address, _amount: i128) {}

    fn decimals(_env: Env) -> u32 {
        7
    }

    fn name(env: Env) -> String {
        String::from_str(&env, "Reentrant")
    }

    fn symbol(env: Env) -> String {
        String::from_str(&env, "RENT")
    }
}

#[test]
#[should_panic(expected = "Contract re-entry is not allowed")]
fn test_release_escrow_blocks_reentrant_token() {
    // Soroban's host itself refuses to re-enter a contract that is already
    // on the active call stack (`ContractReentryMode::Prohibited` — see
    // soroban-env-host's `call`/`try_call`), so a malicious token that
    // tries to call back into the market contract mid-`transfer` is
    // rejected by the platform before it ever reaches our own status
    // check. This test pins that platform guarantee.
    //
    // The CEI reordering in create_escrow/release_escrow/cancel_escrow
    // (status written before any external call) is kept anyway as
    // defense-in-depth: it costs nothing, matches the audit's explicit
    // ask to verify checks-effects-interactions ordering, and keeps this
    // contract correct even if the platform's reentry policy ever loosens
    // (soroban-env-host has a standing TODO to wire a permissive `reentry`
    // flag through `try_call`).
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let fee_recipient = Address::generate(&env);
    let from = Address::generate(&env);
    let to = Address::generate(&env);

    let market = env.register(MarketContract, ());
    init(&env, &market, &admin, 0, &fee_recipient);

    let token_addr = env.register(ReentrantToken, ());
    env.as_contract(&token_addr, || {
        env.storage().persistent().set(&from, &1000i128);
        env.storage()
            .instance()
            .set(&Symbol::new(&env, "market"), &market);
        env.storage()
            .instance()
            .set(&Symbol::new(&env, "escrow_id"), &Symbol::new(&env, "esc1"));
        env.storage()
            .instance()
            .set(&Symbol::new(&env, "caller"), &from);
    });

    let client = MarketContractClient::new(&env, &market);
    let id = Symbol::new(&env, "esc1");
    client.create_escrow(&id, &from, &to, &token_addr, &500, &9999);
    client.release_escrow(&id, &from);
}
