//! Versioning and upgrade verification tests.
//!
//! Ensures contract version metadata is properly exposed and maintained
//! across upgrades and deployments.
// `Env::register_contract` is deprecated in favour of `Env::register`; the test
// helpers here are migrated alongside the contracts, not ahead of them.
#![allow(deprecated)]

use soroban_sdk::{testutils::Address as _, Address, Env};

use bluecollar_dispute::DisputeContractClient;
use bluecollar_market::MarketContractClient;
use bluecollar_registry::RegistryContractClient;

/// Test that all major contracts expose version() function
#[test]
fn test_contract_version_functions_exposed() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);

    // Test Registry version()
    let registry_id = env.register_contract(None, bluecollar_registry::RegistryContract);
    let registry_client = RegistryContractClient::new(&env, &registry_id);
    registry_client.initialize(&admin);
    let registry_version = registry_client.version();
    assert_eq!(
        registry_version, 1u32,
        "Registry event schema version should be 1"
    );

    // Test Market version()
    let market_id = env.register_contract(None, bluecollar_market::MarketContract);
    let market_client = MarketContractClient::new(&env, &market_id);
    market_client.initialize(&admin, &0, &admin);
    let market_version = market_client.version();
    assert_eq!(
        market_version, 1u32,
        "Market event schema version should be 1"
    );

    // Test Dispute version()
    let dispute_id = env.register_contract(None, bluecollar_dispute::DisputeContract);
    let dispute_client = DisputeContractClient::new(&env, &dispute_id);
    dispute_client.initialize(&admin);
    let dispute_version = dispute_client.version();
    assert_eq!(
        dispute_version, 1u32,
        "Dispute event schema version should be 1"
    );
}

/// Test that version numbers are consistent baseline (v1)
#[test]
fn test_version_baseline_consistency() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);

    // All contracts should start at event schema v1
    let registry_id = env.register_contract(None, bluecollar_registry::RegistryContract);
    let registry_client = RegistryContractClient::new(&env, &registry_id);
    registry_client.initialize(&admin);
    assert_eq!(registry_client.version(), 1u32);

    let market_id = env.register_contract(None, bluecollar_market::MarketContract);
    let market_client = MarketContractClient::new(&env, &market_id);
    market_client.initialize(&admin, &0, &admin);
    assert_eq!(market_client.version(), 1u32);

    let dispute_id = env.register_contract(None, bluecollar_dispute::DisputeContract);
    let dispute_client = DisputeContractClient::new(&env, &dispute_id);
    dispute_client.initialize(&admin);
    assert_eq!(dispute_client.version(), 1u32);
}

/// Test that version() is idempotent (always returns same value)
#[test]
fn test_version_idempotent() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);

    let registry_id = env.register_contract(None, bluecollar_registry::RegistryContract);
    let registry_client = RegistryContractClient::new(&env, &registry_id);
    registry_client.initialize(&admin);

    let v1 = registry_client.version();
    let v2 = registry_client.version();
    let v3 = registry_client.version();

    assert_eq!(v1, v2, "version() should be idempotent");
    assert_eq!(v2, v3, "version() should be idempotent");
}
