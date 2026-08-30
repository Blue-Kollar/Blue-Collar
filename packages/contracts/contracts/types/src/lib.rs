//! Shared types for BlueCollar contracts.
//!
//! # Address Policy (#1255)
//!
//! No Stellar public key (`G…`) or other hardcoded network address may appear
//! in contract source files outside of test modules.  All admin, treasury, and
//! configurable addresses are passed as parameters at init-time and stored in
//! contract storage.
//!
//! The CI pipeline enforces this with a `grep` check:
//! ```bash
//! grep -rn --include="*.rs" 'G[A-Z2-7]\{55\}' contracts/*/src/
//! ```
//! The command should produce no output (exit code 1 = no match = CI pass).

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
pub use helpers::{require_admin, require_not_paused, require_role, split_fee};
pub use storage::{extend_ttl, TTL_EXTEND_TO, TTL_THRESHOLD};
pub use versioning::{ContractVersion, EventSchema, StorageSchema};
