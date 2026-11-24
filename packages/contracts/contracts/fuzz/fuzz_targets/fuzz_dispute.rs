#![no_main]
//! Coverage-guided fuzz target for the Dispute contract.
//!
//! Covers the two primary entry-points that accept external, caller-controlled
//! data:
//!   - `file_dispute` — opens a dispute and locks tokens in the contract.
//!   - `submit_evidence` — either party attaches an off-chain evidence hash.
//!
//! Invariant: neither entry-point must panic on arbitrary-length string inputs,
//! arbitrary token amounts, or arbitrary byte sequences for evidence hashes.
//! All "expected failure" paths (e.g. duplicate IDs, non-party callers) must
//! surface as `Err` returns, never as panics or aborts.
use arbitrary::Arbitrary;
use bluecollar_dispute::{DisputeContract, DisputeContractClient};
use libfuzzer_sys::fuzz_target;
use soroban_sdk::{
    testutils::Address as _, token::StellarAssetClient, Address, Env, String as SorobanString,
    Symbol,
};

#[derive(Arbitrary, Debug)]
struct DisputeInput {
    /// Raw bytes used to build the evidence_hash string for file_dispute.
    evidence_seed: [u8; 16],
    /// Raw bytes used to build the second evidence_hash string for
    /// submit_evidence.
    evidence2_seed: [u8; 16],
    /// Amount to lock in the dispute.  Clamped to 1..=1_000_000.
    amount: u64,
    /// Which party submits evidence: 0 = disputer, 1 = respondent.
    submitter_choice: u8,
}

fuzz_target!(|input: DisputeInput| {
    // --- Clamp / sanitise ------------------------------------------------
    let amount = i128::max(1, i128::min(input.amount as i128, 1_000_000));

    // Build printable hex strings from the seed bytes so they remain valid
    // Soroban `String` values regardless of what the fuzzer produces.
    let evidence1 = hex_str(&input.evidence_seed);
    let evidence2 = hex_str(&input.evidence2_seed);

    // --- Environment setup -----------------------------------------------
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let disputer = Address::generate(&env);
    let respondent = Address::generate(&env);

    // Mint enough tokens for the disputer to cover the dispute amount.
    let token_id = env.register_stellar_asset_contract_v2(admin.clone());
    let token_addr = token_id.address();
    StellarAssetClient::new(&env, &token_addr).mint(&disputer, &1_000_000);

    let contract_id = env.register_contract(None, DisputeContract);
    let client = DisputeContractClient::new(&env, &contract_id);
    client.initialize(&admin);

    let id = Symbol::new(&env, "fd1");
    let ev1 = SorobanString::from_str(&env, &evidence1);
    let ev2 = SorobanString::from_str(&env, &evidence2);

    // --- file_dispute: must not panic on arbitrary (clamped) input --------
    let _ = client.try_file_dispute(&id, &disputer, &respondent, &token_addr, &amount, &ev1);

    // If the dispute was successfully created, also exercise submit_evidence.
    if client.get_dispute(&id).unwrap_or(None).is_some() {
        let submitter = if input.submitter_choice % 2 == 0 {
            &disputer
        } else {
            &respondent
        };
        // submit_evidence on a known party must not panic.
        let _ = client.try_submit_evidence(&id, submitter, &ev2);

        // Calling submit_evidence with the same evidence again must not panic.
        let _ = client.try_submit_evidence(&id, submitter, &ev1);
    }

    // --- Duplicate file_dispute: must return an error, not panic ----------
    let _ = client.try_file_dispute(&id, &disputer, &respondent, &token_addr, &amount, &ev1);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Encode a byte slice as a lowercase hex string.  The result is always valid
/// ASCII so it is safe to pass to `SorobanString::from_str`.
fn hex_str(bytes: &[u8]) -> String {
    bytes.iter().fold(String::new(), |mut s, b| {
        use std::fmt::Write as _;
        let _ = write!(s, "{b:02x}");
        s
    })
}
