//! Standardized versioning and upgrade pattern for BlueCollar contracts.
//!
//! Defines the contract versioning strategy and provides common utilities for
//! version management, schema migrations, and upgrade verification.
//!
//! ## Versioning Strategy
//!
//! Each contract maintains TWO independent version numbers:
//!
//! 1. **Event Schema Version** (`VERSION` constant)
//!    - Incremented when events are added, removed, or renamed
//!    - Consumers subscribe to `version()` for event structure
//!    - Current: 1 (baseline event structure)
//!
//! 2. **Storage Schema Version** (stored in persistent storage)
//!    - Incremented when persistent storage layout changes
//!    - Checked during initialization and migrations
//!    - Enables safe schema upgrades via `migrate()`
//!    - Current: typically 1, incremented on breaking storage changes

/// Contract event schema version (public API)
/// Tracks the structure and content of emitted events
pub trait EventSchema {
    /// Return the current event schema version
    /// Events emitted by this contract conform to this schema version
    fn event_version() -> u32;
}

/// Contract storage schema version (internal)
/// Tracks the persistent storage layout and types
pub trait StorageSchema {
    /// Return the current storage schema version
    /// Persisted data in this contract uses this schema version
    fn storage_version() -> u32;
}

/// Standard version metadata exposed on all contracts
#[derive(Debug, Clone, Copy)]
pub struct ContractVersion {
    /// Event schema version (public API versioning)
    pub event_schema: u32,
    /// Storage schema version (internal layout versioning)
    pub storage_schema: u32,
    /// WASM binary version (deployment tracking)
    pub wasm_version: u32,
}

impl ContractVersion {
    /// Create a new version triplet
    pub fn new(event_schema: u32, storage_schema: u32, wasm_version: u32) -> Self {
        Self {
            event_schema,
            storage_schema,
            wasm_version,
        }
    }

    /// Default v1 with matching schemas
    pub fn v1() -> Self {
        Self {
            event_schema: 1,
            storage_schema: 1,
            wasm_version: 1,
        }
    }
}

/// Migration result type
pub type MigrationResult<T> = Result<T, &'static str>;

/// Contract upgrade verification checks
pub mod upgrade_verification {
    use super::*;

    /// Verify version metadata is accessible after upgrade
    pub fn verify_version_accessible(
        current_event_version: u32,
        current_storage_version: u32,
    ) -> MigrationResult<()> {
        if current_event_version == 0 {
            return Err("Event version must be >= 1");
        }
        if current_storage_version == 0 {
            return Err("Storage version must be >= 1");
        }
        Ok(())
    }

    /// Verify backward compatibility during schema upgrade
    pub fn verify_schema_compatibility(from_version: u32, to_version: u32) -> MigrationResult<()> {
        // Schema migrations must be sequential and monotonic
        if to_version <= from_version {
            return Err("New schema version must be greater than old version");
        }
        Ok(())
    }

    /// Verify admin is authorized for version upgrade
    pub fn verify_upgrade_authority(caller_is_admin: bool) -> MigrationResult<()> {
        if !caller_is_admin {
            return Err("Only admin can upgrade contract");
        }
        Ok(())
    }
}

/// Common version constant names for consistency across contracts
pub mod constants {
    /// Baseline event schema version for all new contracts
    pub const BASELINE_EVENT_SCHEMA: u32 = 1;
    /// Baseline storage schema version for all new contracts
    pub const BASELINE_STORAGE_SCHEMA: u32 = 1;
    /// Baseline WASM version for all new contracts
    pub const BASELINE_WASM_VERSION: u32 = 1;
}
