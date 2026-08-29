#![no_main]
use arbitrary::Arbitrary;
use bluecollar_market::{MarketContract, MarketContractClient};
use libfuzzer_sys::fuzz_target;
use soroban_sdk::{testutils::Address as _, token::StellarAssetClient, Address, Env, Symbol};

#[derive(Arbitrary, Debug)]
struct TipInput {
    amount: u64,
    fee_bps: u16,
}

fuzz_target!(|input: TipInput| {
    // Clamp amount to reasonable range (1 to 1_000_000)
    let amount = std::cmp::max(1, std::cmp::min(input.amount as i128, 1_000_000));

    // Clamp fee_bps to valid range (0-500)
    let fee_bps = std::cmp::min(input.fee_bps as u32, 500);

    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let payer = Address::generate(&env);
    let worker = Address::generate(&env);

    let token_id = env.register_stellar_asset_contract_v2(admin.clone());
    let token_addr = token_id.address();
    StellarAssetClient::new(&env, &token_addr).mint(&payer, &1_000_000);

    let contract_id = env.register_contract(None, MarketContract);
    let client = MarketContractClient::new(&env, &contract_id);
    client.initialize(&admin, &fee_bps, &admin);

    // This should never panic with arbitrary amounts and fees
    let _ = client.tip(&payer, &worker, &token_addr, &amount);
});
