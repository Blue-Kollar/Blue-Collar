//! Shared persistent-storage helpers for BlueCollar contracts.
//!
//! Every contract extends the TTL of its persistent entries with the same
//! threshold/target pair, so both the constants and the extension helper live
//! here rather than being redeclared per contract.

use soroban_sdk::{Env, IntoVal, Val};

/// Approximate TTL extension target (~1 year at 5 s/ledger).
pub const TTL_EXTEND_TO: u32 = 535_000;
/// Extend TTL only when it drops below this threshold (~6 months).
pub const TTL_THRESHOLD: u32 = 267_500;

/// Extend the TTL of a persistent storage entry to [`TTL_EXTEND_TO`] ledgers
/// when it has dropped below [`TTL_THRESHOLD`].
///
/// Missing entries are ignored, so this is safe to call for a key that may
/// never have been written.
pub fn extend_ttl<K>(env: &Env, key: &K)
where
    K: IntoVal<Env, Val>,
{
    let storage = env.storage().persistent();
    if storage.has(key) {
        storage.extend_ttl(key, TTL_THRESHOLD, TTL_EXTEND_TO);
    }
}
