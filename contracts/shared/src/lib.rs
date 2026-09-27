//! Shared utilities for all contracts
//! 
//! This crate provides shared functionality including optimized storage keys,
//! validation helpers, and common types.

pub mod storage_keys;
pub mod validation;
pub mod types;

// Re-export commonly used items
pub use storage_keys::{CompactKey, StorageKeyBuilder, keys};
