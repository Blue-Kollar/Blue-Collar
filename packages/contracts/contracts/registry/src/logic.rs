//! # Registry Contract â€” Business Logic Layer
//!
//! Internal helpers: access-control checks, reputation computation,
//! performance scoring, and history bookkeeping.
//!
//! All functions are `pub(crate)` â€” they are only called from `lib.rs`.

use bluecollar_types::{helpers, ContractError};
use soroban_sdk::{Address, Env, Symbol, Vec};

use crate::storage::{
    get_delegates, get_role_members, DataKey, ReputationEvent, ReputationInputs, Worker,
    ROLE_ADMIN_CACHED, ROLE_ADMIN_ID, ROLE_CURATOR_MGR_CACHED, ROLE_CURATOR_MGR_ID,
    ROLE_PAUSER_CACHED, ROLE_PAUSER_ID, ROLE_REP_MGR_CACHED, ROLE_REP_MGR_ID,
    ROLE_UPGRADER_CACHED, ROLE_UPGRADER_ID,
};
use crate::storage::{PerformanceMetrics};

// =============================================================================
// Role helpers
// =============================================================================

/// Build a role `Symbol` from a string literal (gas-optimisation helper).
pub(crate) fn role_symbol(env: &Env, role_str: &str) -> Symbol {
    Symbol::new(env, role_str)
}

/// Convert a role `Symbol` to its compact `u64` storage ID.
///
/// Unknown roles map to `u64::MAX` so they get a distinct bucket without
/// colliding with the known role IDs.
pub(crate) fn role_to_id(env: &Env, role: &Symbol) -> u64 {
    if *role == Symbol::new(env, ROLE_ADMIN_CACHED) {
        ROLE_ADMIN_ID
    } else if *role == Symbol::new(env, ROLE_PAUSER_CACHED) {
        ROLE_PAUSER_ID
    } else if *role == Symbol::new(env, ROLE_CURATOR_MGR_CACHED) {
        ROLE_CURATOR_MGR_ID
    } else if *role == Symbol::new(env, ROLE_REP_MGR_CACHED) {
        ROLE_REP_MGR_ID
    } else if *role == Symbol::new(env, ROLE_UPGRADER_CACHED) {
        ROLE_UPGRADER_ID
    } else {
        u64::MAX
    }
}

/// Assert that `caller` holds `role` and has authorised this call.
pub(crate) fn require_role(
    env: &Env,
    role: &Symbol,
    caller: &Address,
) -> Result<(), ContractError> {
    let members = get_role_members(env, role_to_id(env, role));
    helpers::require_role(caller, &members)
}

/// Assert that the contract is not paused.
pub(crate) fn require_not_paused(env: &Env) -> Result<(), ContractError> {
    let paused: bool = env
        .storage()
        .instance()
        .get(&DataKey::Paused)
        .unwrap_or(false);
    helpers::require_not_paused(paused)
}

/// Assert that `caller` is either the worker's owner or an active (non-expired) delegate.
pub(crate) fn require_owner_or_delegate(
    env: &Env,
    worker: &Worker,
    caller: &Address,
) -> Result<(), ContractError> {
    if worker.owner == *caller {
        return Ok(());
    }
    let now = env.ledger().timestamp();
    let delegates = get_delegates(env, &worker.id);
    let is_valid_delegate = delegates
        .iter()
        .any(|d| d.address == *caller && (d.expires_at == 0 || d.expires_at > now));
    if !is_valid_delegate {
        return Err(ContractError::NotAuthorized);
    }
    Ok(())
}

// =============================================================================
// Reputation computation
// =============================================================================

/// Weights (out of 100) for the three reputation factors.
const REP_WEIGHT_QUALITY: u32 = 60;
const REP_WEIGHT_VOLUME: u32 = 25;
const REP_WEIGHT_RECENCY: u32 = 15;

/// Recency half-life in seconds (~90 days).
const RECENCY_HALF_LIFE_SECS: u64 = 7_776_000;

/// Maximum tip count considered for volume score (caps at 10_000 bps).
const MAX_TIP_VOLUME: u32 = 50;

/// Maximum history entries stored per worker.
pub(crate) const MAX_HISTORY_LEN: u32 = 100;

/// Minimum average rating that triggers automatic slashing.
pub(crate) const SLASH_THRESHOLD_RATING: u32 = 3_000;
/// Minimum number of reviews before slashing can trigger.
pub(crate) const SLASH_MIN_REVIEWS: u32 = 3;

/// Compute the weighted reputation score from [`ReputationInputs`].
///
/// Returns a score in basis points (0â€“10 000).
pub(crate) fn compute_weighted_reputation(inputs: &ReputationInputs, now: u64) -> u32 {
    // quality component
    let avg_rating = if inputs.rating_count == 0 {
        0u32
    } else {
        (inputs.rating_sum / inputs.rating_count as u64) as u32
    };
    let quality = avg_rating
        .checked_mul(REP_WEIGHT_QUALITY)
        .expect("overflow")
        / 100;

    // volume component (saturates at MAX_TIP_VOLUME)
    let volume_fraction = inputs.tip_count.min(MAX_TIP_VOLUME);
    let volume = (volume_fraction as u64)
        .checked_mul(10_000)
        .expect("overflow")
        / MAX_TIP_VOLUME as u64;
    let volume = (volume as u32)
        .checked_mul(REP_WEIGHT_VOLUME)
        .expect("overflow")
        / 100;

    // recency component (linear approximation of exponential decay)
    let recency = if inputs.last_review_at == 0 {
        0u32
    } else {
        let elapsed = now.saturating_sub(inputs.last_review_at);
        let decay_bps = if elapsed >= RECENCY_HALF_LIFE_SECS {
            0u32
        } else {
            10_000u32
                - ((elapsed as u64)
                    .checked_mul(10_000)
                    .expect("overflow")
                    / RECENCY_HALF_LIFE_SECS) as u32
        };
        decay_bps
            .checked_mul(REP_WEIGHT_RECENCY)
            .expect("overflow")
            / 100
    };

    quality
        .checked_add(volume)
        .expect("overflow")
        .checked_add(recency)
        .expect("overflow")
        .min(10_000)
}

/// Append an entry to the immutable reputation history (capped at `MAX_HISTORY_LEN`).
pub(crate) fn append_reputation_history(
    env: &Env,
    id: &Symbol,
    previous: u32,
    new_score: u32,
    reason: Symbol,
) {
    let mut history: Vec<ReputationEvent> = env
        .storage()
        .persistent()
        .get(&DataKey::ReputationHistory(id.clone()))
        .unwrap_or(Vec::new(env));

    // Drop oldest entry if at capacity.
    if history.len() >= MAX_HISTORY_LEN {
        let mut trimmed: Vec<ReputationEvent> = Vec::new(env);
        for i in 1..history.len() {
            trimmed.push_back(history.get(i).unwrap());
        }
        history = trimmed;
    }

    history.push_back(ReputationEvent {
        previous_score: previous,
        new_score,
        reason,
        timestamp: env.ledger().timestamp(),
    });

    env.storage()
        .persistent()
        .set(&DataKey::ReputationHistory(id.clone()), &history);
}

// =============================================================================
// Performance scoring
// =============================================================================

/// Derive a performance score from the given metrics struct.
pub(crate) fn calculate_performance_score(metrics: &PerformanceMetrics) -> u32 {
    if metrics.total_ratings == 0 {
        return 0;
    }
    let rating_weight = 70u32;
    let completion_weight = 30u32;

    let rating_score = metrics
        .avg_rating
        .checked_mul(rating_weight)
        .expect("overflow")
        / 100;

    let completion_score = metrics
        .jobs_completed
        .min(100)
        .checked_mul(completion_weight)
        .expect("overflow");

    rating_score
        .checked_add(completion_score)
        .expect("overflow")
}
