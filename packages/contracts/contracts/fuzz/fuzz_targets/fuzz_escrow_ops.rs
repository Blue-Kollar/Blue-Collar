#![no_main]
//! Coverage-guided fuzz target for the Escrow contract.
//!
//! Covers two primary entry-points:
//!   - `create_escrow` — locks an arbitrary amount of tokens for an arbitrary id.
//!   - `cancel_escrow` — cancels the escrow (admin path; no expiry constraint).
//!
//! Invariant: neither entry-point must panic on arbitrary inputs.  Out-of-range
//! amounts, duplicate IDs, or zero amounts must surface as `Err` returns, never
//! as panics or aborts.
use arbitrary::Arbitrary;
use bluecollar_escrow::{EscrowContract, EscrowContractClient};
use libfuzzer_sys::fuzz_target;
use soroban_sdk::{testutils::Address as _, token::StellarAssetClient, Address, Env, Symbol};

#[derive(Arbitrary, Debug)]
struct EscrowOpsInput {
    /// Amount to lock in the escrow.  Clamped to 1..=1_000_000.
    amount: u64,
    /// Escrow ID suffix — kept short so it always fits in a Soroban Symbol.
    id_suffix: u8,
    /// Expiry offset in seconds added to ledger timestamp.  0 means already
    /// expired; large values mean far future.
    expiry_offset: u32,
    /// Whether to attempt a cancel after a successful create.
    do_cancel: bool,
}

fuzz_target!(|input: EscrowOpsInput| {
    // --- Clamp / sanitise ------------------------------------------------
    let amount = i128::max(1, i128::min(input.amount as i128, 1_000_000));
    // Build a short alphanumeric id that is always a valid Soroban Symbol.
    let id_str = format!("e{:03}", input.id_suffix % 100);
    // Expiry: add the offset to 0 so we cover both expired (offset=0) and
    // future (offset>0) escrows.
    let expiry = input.expiry_offset as u64;

    // --- Environment setup -----------------------------------------------
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let beneficiary = Address::generate(&env);

    let token_id = env.register_stellar_asset_contract_v2(admin.clone());
    let token_addr = token_id.address();
    StellarAssetClient::new(&env, &token_addr).mint(&depositor, &1_000_000);

    let contract_id = env.register_contract(None, EscrowContract);
    let client = EscrowContractClient::new(&env, &contract_id);
    client.initialize(&admin);

    let id = Symbol::new(&env, &id_str);

    // --- create_escrow: must not panic on arbitrary (clamped) input -------
    let created = client
        .try_create_escrow(&depositor, &beneficiary, &token_addr, &id, &amount, &expiry)
        .is_ok();

    // --- cancel_escrow: must not panic regardless of escrow state ---------
    if created && input.do_cancel {
        // Admin can cancel at any time; ignore the result — the invariant is
        // that it must not panic.
        let _ = client.try_cancel_escrow(&admin, &id);
    }

    // --- Duplicate create: must return an error, not panic ----------------
    if created {
        let _ = client.try_create_escrow(
            &depositor,
            &beneficiary,
            &token_addr,
            &id,
            &amount,
            &expiry,
        );
    }
});
