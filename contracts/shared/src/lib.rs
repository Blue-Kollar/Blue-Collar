//! Shared utilities for all contracts
//!
//! This crate provides shared functionality including optimized storage keys,
//! validation helpers, common types, and test fixtures.

pub mod errors;
pub mod storage_keys;
// Test fixtures need `soroban_sdk::testutils` (Address::generate, SAC
// registration, auth mocking). Only compiled when the `testutils`
// feature is enabled — issue #1446.
#[cfg(feature = "testutils")]
pub mod test_fixtures;

// Re-export commonly used items
pub use errors::CommonError;
pub use storage_keys::{keys, CompactKey, StorageKeyBuilder};
