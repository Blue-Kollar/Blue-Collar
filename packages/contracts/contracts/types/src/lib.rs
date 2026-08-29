//! Shared types for BlueCollar contracts.

#![no_std]
// Lint policy: clippy::pedantic enabled at workspace level (issue #1254).
// Blanket Soroban exceptions (needless_pass_by_value, must_use_candidate, etc.)
// are configured in the workspace Cargo.toml; per-function overrides go here.

pub mod errors;
pub mod helpers;
pub mod storage;
pub mod versioning;

#[cfg(any(test, feature = "testutils"))]
pub mod test_utils;

pub use errors::ContractError;
pub use helpers::{require_admin, require_not_paused, require_role};
pub use storage::{extend_ttl, TTL_EXTEND_TO, TTL_THRESHOLD};
pub use versioning::{ContractVersion, EventSchema, StorageSchema};
