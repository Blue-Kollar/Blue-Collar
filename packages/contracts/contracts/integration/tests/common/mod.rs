//! Shared deployment helpers for the integration test crate.
//!
//! Every test file in `tests/` deploys fresh contract instances against the
//! in-process Soroban testnet, so helpers here only wrap `register` +
//! `initialize`; they hold no assertions of their own.

#![allow(dead_code)] // each test file uses a different subset of these helpers

use soroban_sdk::{token, Address, BytesN, Env, Symbol};

use bluecollar_dispute::{DisputeContract, DisputeContractClient};
use bluecollar_escrow::{EscrowContract, EscrowContractClient};
use bluecollar_insurance_pool::{InsurancePoolContract, InsurancePoolContractClient};
use bluecollar_market::{MarketContract, MarketContractClient};
use bluecollar_registry::{RegistryContract, RegistryContractClient};
use bluecollar_reputation::{ReputationContract, ReputationContractClient};

pub fn zero_hash(env: &Env) -> BytesN<32> {
    BytesN::from_array(env, &[0u8; 32])
}

/// Deploy a Stellar asset contract and mint `amount` to `to`.
pub fn deploy_token<'a>(env: &Env, admin: &Address, to: &Address, amount: i128) -> token::Client<'a> {
    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    token::StellarAssetClient::new(env, &sac.address()).mint(to, &amount);
    token::Client::new(env, &sac.address())
}

/// Mint `amount` of an existing token to `to`.
pub fn mint(env: &Env, token: &Address, to: &Address, amount: i128) {
    token::StellarAssetClient::new(env, token).mint(to, &amount);
}

pub fn deploy_registry<'a>(env: &Env, admin: &Address) -> RegistryContractClient<'a> {
    let id = env.register_contract(None, RegistryContract);
    let client = RegistryContractClient::new(env, &id);
    client.initialize(admin);
    // `initialize` only bootstraps ROLE_ADMIN; curator management is a separate role.
    client.grant_role(
        admin,
        &Symbol::new(env, bluecollar_registry::ROLE_CURATOR_MGR),
        admin,
    );
    client
}

pub fn deploy_market<'a>(
    env: &Env,
    admin: &Address,
    fee_bps: u32,
    fee_recipient: &Address,
) -> MarketContractClient<'a> {
    let id = env.register_contract(None, MarketContract);
    let client = MarketContractClient::new(env, &id);
    client.initialize(admin, &fee_bps, fee_recipient);
    client
}

pub fn deploy_escrow<'a>(env: &Env, admin: &Address) -> EscrowContractClient<'a> {
    let id = env.register_contract(None, EscrowContract);
    let client = EscrowContractClient::new(env, &id);
    client.initialize(admin);
    client
}

/// Deploy the dispute contract and approve `arbitrator` to decide cases.
pub fn deploy_dispute<'a>(
    env: &Env,
    admin: &Address,
    arbitrator: &Address,
) -> DisputeContractClient<'a> {
    let id = env.register_contract(None, DisputeContract);
    let client = DisputeContractClient::new(env, &id);
    client.initialize(admin);
    client.add_arbitrator(admin, arbitrator);
    client
}

/// Deploy the insurance pool and grant `claims_mgr` the claims-manager role.
pub fn deploy_insurance_pool<'a>(
    env: &Env,
    admin: &Address,
    token: &Address,
    premium_bps: u32,
    claims_mgr: &Address,
) -> InsurancePoolContractClient<'a> {
    let id = env.register_contract(None, InsurancePoolContract);
    let client = InsurancePoolContractClient::new(env, &id);
    client.initialize(admin, token, &premium_bps);
    client.grant_role(
        admin,
        &Symbol::new(env, bluecollar_insurance_pool::ROLE_CLAIMS_MGR),
        claims_mgr,
    );
    client
}

/// Deploy the reputation contract and grant `rep_mgr` the reputation-manager role.
pub fn deploy_reputation<'a>(
    env: &Env,
    admin: &Address,
    rep_mgr: &Address,
) -> ReputationContractClient<'a> {
    let id = env.register_contract(None, ReputationContract);
    let client = ReputationContractClient::new(env, &id);
    client.initialize(admin);
    client.grant_role(
        admin,
        &Symbol::new(env, bluecollar_reputation::ROLE_REP_MGR),
        rep_mgr,
    );
    client
}
