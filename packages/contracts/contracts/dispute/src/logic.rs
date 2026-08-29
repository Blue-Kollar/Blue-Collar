//! Business logic for the dispute contract — validation, state transitions,
//! and token movement. Storage access goes through `storage.rs`; entrypoints
//! in `lib.rs` are thin wrappers around these functions.

use bluecollar_types::{helpers, ContractError};
use soroban_sdk::{symbol_short, token, Address, Env, String, Symbol, Vec};

use crate::storage::{self, Dispute, DisputeOutcome, DisputeStatus};

// =============================================================================
// Init
// =============================================================================

pub fn initialize(env: &Env, admin: &Address) -> Result<(), ContractError> {
    if storage::has_admin(env) {
        return Err(ContractError::AlreadyInitialized);
    }
    storage::set_admin(env, admin);
    storage::set_paused(env, false);
    storage::set_arbitrators(env, &Vec::<Address>::new(env));
    env.events()
        .publish((symbol_short!("Init"),), admin.clone());
    Ok(())
}

// =============================================================================
// Access control helpers
// =============================================================================

pub fn require_admin(env: &Env, caller: &Address) -> Result<(), ContractError> {
    let admin = storage::get_admin(env)?;
    helpers::require_admin(caller, &admin)
}

pub fn require_not_paused(env: &Env) -> Result<(), ContractError> {
    helpers::require_not_paused(storage::is_paused(env))
}

// =============================================================================
// Pause / Unpause
// =============================================================================

pub fn pause(env: &Env, admin: &Address) -> Result<(), ContractError> {
    require_admin(env, admin)?;
    storage::set_paused(env, true);
    env.events()
        .publish((symbol_short!("Paused"), admin.clone()), ());
    Ok(())
}

pub fn unpause(env: &Env, admin: &Address) -> Result<(), ContractError> {
    require_admin(env, admin)?;
    storage::set_paused(env, false);
    env.events()
        .publish((symbol_short!("Unpaused"), admin.clone()), ());
    Ok(())
}

// =============================================================================
// Arbitrator management
// =============================================================================

pub fn add_arbitrator(
    env: &Env,
    admin: &Address,
    arbitrator: &Address,
) -> Result<(), ContractError> {
    require_admin(env, admin)?;
    let mut arbs = storage::get_arbitrators(env);
    if arbs.iter().all(|a| a != *arbitrator) {
        arbs.push_back(arbitrator.clone());
        storage::set_arbitrators(env, &arbs);
    }
    env.events()
        .publish((symbol_short!("ArbAdd"),), arbitrator.clone());
    Ok(())
}

pub fn remove_arbitrator(
    env: &Env,
    admin: &Address,
    arbitrator: &Address,
) -> Result<(), ContractError> {
    require_admin(env, admin)?;
    let arbs = storage::get_arbitrators(env);
    let mut updated: Vec<Address> = Vec::new(env);
    for a in arbs.iter() {
        if a != *arbitrator {
            updated.push_back(a);
        }
    }
    storage::set_arbitrators(env, &updated);
    env.events()
        .publish((symbol_short!("ArbRem"),), arbitrator.clone());
    Ok(())
}

// =============================================================================
// Dispute lifecycle — Step 1: Open
// =============================================================================

pub fn file_dispute(
    env: &Env,
    id: Symbol,
    disputer: Address,
    respondent: Address,
    token: Address,
    amount: i128,
    evidence_hash: String,
) -> Result<(), ContractError> {
    disputer.require_auth();
    require_not_paused(env)?;
    if amount <= 0 {
        return Err(ContractError::AmountMustBePositive);
    }
    if storage::has_dispute(env, &id) {
        return Err(ContractError::DisputeIdAlreadyExists);
    }

    let dispute = Dispute {
        id: id.clone(),
        disputer: disputer.clone(),
        respondent: respondent.clone(),
        token: token.clone(),
        amount,
        status: DisputeStatus::Open,
        outcome: DisputeOutcome::RefundDisputer, // placeholder until decided
        split_bps: 0,
        arbitrator: None,
        filed_at: env.ledger().timestamp(),
        settled_at: 0,
        disputer_evidence: Some(evidence_hash),
        respondent_evidence: None,
    };

    // Effects before interaction: persist and index the dispute *before*
    // calling out to the token contract. `token` is caller-supplied, so a
    // malicious implementation could otherwise re-enter `file_dispute` with
    // the same id while the duplicate-id check above hadn't been recorded
    // yet.
    storage::set_dispute(env, &id, &dispute);
    storage::push_dispute_id(env, &id);

    let client = token::Client::new(env, &token);
    client.transfer(&disputer, &env.current_contract_address(), &amount);

    env.events().publish(
        (symbol_short!("DspOpen"), id, disputer),
        (respondent, amount),
    );
    Ok(())
}

// =============================================================================
// Dispute lifecycle — Step 2: Evidence
// =============================================================================

pub fn submit_evidence(
    env: &Env,
    dispute_id: Symbol,
    caller: Address,
    evidence_hash: String,
) -> Result<(), ContractError> {
    caller.require_auth();
    require_not_paused(env)?;

    let mut dispute =
        storage::get_dispute(env, &dispute_id).ok_or(ContractError::DisputeNotFound)?;

    if dispute.disputer != caller && dispute.respondent != caller {
        return Err(ContractError::NotAParty);
    }
    if dispute.status != DisputeStatus::Open && dispute.status != DisputeStatus::Evidence {
        return Err(ContractError::DisputeNotOpenOrInEvidence);
    }

    if dispute.disputer == caller {
        dispute.disputer_evidence = Some(evidence_hash);
    } else {
        dispute.respondent_evidence = Some(evidence_hash);
    }

    if dispute.status == DisputeStatus::Open {
        dispute.status = DisputeStatus::Evidence;
    }

    storage::set_dispute(env, &dispute_id, &dispute);

    env.events()
        .publish((symbol_short!("DspEvid"), dispute_id, caller), ());
    Ok(())
}

// =============================================================================
// Dispute lifecycle — Step 3: Decision
// =============================================================================

pub fn decide(
    env: &Env,
    dispute_id: Symbol,
    arbitrator: Address,
    outcome: DisputeOutcome,
    split_bps: u32,
) -> Result<(), ContractError> {
    arbitrator.require_auth();
    require_not_paused(env)?;

    if !storage::get_arbitrators(env)
        .iter()
        .any(|a| a == arbitrator)
    {
        return Err(ContractError::NotAnArbitrator);
    }
    if let DisputeOutcome::Split = outcome {
        if split_bps > 10_000 {
            return Err(ContractError::SplitBpsOutOfRange);
        }
    }

    let mut dispute =
        storage::get_dispute(env, &dispute_id).ok_or(ContractError::DisputeNotFound)?;

    if dispute.status != DisputeStatus::Open && dispute.status != DisputeStatus::Evidence {
        return Err(ContractError::NotDecidable);
    }

    dispute.status = DisputeStatus::Decided;
    dispute.outcome = outcome;
    dispute.split_bps = split_bps;
    dispute.arbitrator = Some(arbitrator.clone());

    storage::set_dispute(env, &dispute_id, &dispute);

    env.events().publish(
        (symbol_short!("DspDcide"), dispute_id, arbitrator),
        (outcome as u32, split_bps),
    );
    Ok(())
}

// =============================================================================
// Dispute lifecycle — Step 4: Settle
// =============================================================================

pub fn settle(env: &Env, dispute_id: Symbol) -> Result<(), ContractError> {
    require_not_paused(env)?;

    let mut dispute =
        storage::get_dispute(env, &dispute_id).ok_or(ContractError::DisputeNotFound)?;
    if dispute.status != DisputeStatus::Decided {
        return Err(ContractError::NotDecidedYet);
    }

    // Effects before interaction: commit `Settled` *before* moving tokens.
    // `dispute.token` is the caller-supplied token from `file_dispute`, so a
    // malicious token contract's `transfer` could otherwise re-enter
    // `settle` while status was still `Decided` and drain the locked amount
    // more than once.
    dispute.status = DisputeStatus::Settled;
    dispute.settled_at = env.ledger().timestamp();
    storage::set_dispute(env, &dispute_id, &dispute);

    let contract = env.current_contract_address();
    let client = token::Client::new(env, &dispute.token);

    match dispute.outcome {
        DisputeOutcome::RefundDisputer => {
            client.transfer(&contract, &dispute.disputer, &dispute.amount);
        }
        DisputeOutcome::ReleaseRespondent => {
            client.transfer(&contract, &dispute.respondent, &dispute.amount);
        }
        DisputeOutcome::Split => {
            let respondent_share = dispute
                .amount
                .checked_mul(dispute.split_bps as i128)
                .and_then(|v| v.checked_div(10_000))
                .expect("Split overflow");
            let disputer_share = dispute.amount - respondent_share;
            if respondent_share > 0 {
                client.transfer(&contract, &dispute.respondent, &respondent_share);
            }
            if disputer_share > 0 {
                client.transfer(&contract, &dispute.disputer, &disputer_share);
            }
        }
    }

    env.events().publish(
        (symbol_short!("DspSettle"), dispute_id),
        (dispute.outcome as u32, dispute.amount),
    );
    Ok(())
}

// =============================================================================
// Upgrade
// =============================================================================

pub fn upgrade(
    env: &Env,
    admin: &Address,
    new_wasm_hash: soroban_sdk::BytesN<32>,
) -> Result<(), ContractError> {
    require_admin(env, admin)?;
    env.deployer().update_current_contract_wasm(new_wasm_hash);
    Ok(())
}
