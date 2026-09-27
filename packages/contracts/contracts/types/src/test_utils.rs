//! Shared test utilities for BlueCollar contract tests.
//!
//! Extracted from duplicate helpers in individual contract test modules
//! (issue #1252). Import via `bluecollar_types::test_utils`.

use soroban_sdk::{Address, BytesN, Env};

/// Advance the ledger timestamp to `ts`.
pub fn set_time(env: &Env, ts: u64) {
    let mut info = env.ledger().get();
    info.timestamp = ts;
    env.ledger().set(info);
}

/// Return a 32-byte all-zeros hash, useful as a placeholder in tests.
pub fn zero_hash(env: &Env) -> BytesN<32> {
    BytesN::from_array(env, &[0u8; 32])
}

/// Register a Stellar asset contract, mint `amount` to `to`, and return the token address.
pub fn mint_token(env: &Env, admin: &Address, to: &Address, amount: i128) -> Address {
    let token_id = env.register_stellar_asset_contract_v2(admin.clone());
    let token_addr = token_id.address();
    soroban_sdk::token::StellarAssetClient::new(env, &token_addr).mint(to, &amount);
    token_addr
}
