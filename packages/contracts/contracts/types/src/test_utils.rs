//! Shared test utilities for BlueCollar contract tests.
//!
//! Extracted from duplicate helpers in individual contract test modules
//! (issue #1252). Import via `bluecollar_types::test_utils`.

use soroban_sdk::{
    testutils::Ledger as _,
    token::StellarAssetClient,
    Address, BytesN, Env,
};

/// Create a test `Env` with all authorisations mocked.
pub fn mocked_env() -> Env {
    let env = Env::default();
    env.mock_all_auths();
    env
}

/// Register a Stellar asset contract administered by `admin` and mint each
/// `(recipient, amount)` pair in `balances`. Returns the token address.
pub fn deploy_token(env: &Env, admin: &Address, balances: &[(&Address, i128)]) -> Address {
    let token_id = env.register_stellar_asset_contract_v2(admin.clone());
    let token_addr = token_id.address();
    let asset = StellarAssetClient::new(env, &token_addr);
    for (to, amount) in balances {
        asset.mint(to, amount);
    }
    token_addr
}

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
