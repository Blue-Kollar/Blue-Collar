//! Shared test fixtures for all BlueCollar contract test suites.
//!
//! This module provides common helpers that eliminate duplicated setup code
//! across per-contract test files (issue #1446):
//!   - Environment creation and auth mocking
//!   - Stellar asset contract deployment and token minting
//!   - Ledger time manipulation
//!
//! [`deploy_token_and_mint`] and [`set_time`] are re-exports of
//! `bluecollar_types::test_utils` (issue #1252), so the implementations stay
//! single-sourced while this module provides the workspace-level path issue
//! #1446 asks for.

use soroban_sdk::Env;

pub use bluecollar_types::test_utils::{mint_token as deploy_token_and_mint, set_time};

/// Default funding amount used across contract test fixtures.
pub const DEFAULT_FUND_AMOUNT: i128 = 100_000;

/// Creates a default test environment with mocked auths.
pub fn setup_env() -> Env {
    let env = Env::default();
    env.mock_all_auths();
    env
}
