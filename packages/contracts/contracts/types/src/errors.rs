//! Shared error definitions for BlueCollar contracts.
//!
//! Consolidates common error codes across all contracts to ensure consistency
//! and maintainability. This is the **single** error enum for the workspace —
//! no contract crate should declare its own `#[contracterror]` enum. An audit
//! of every crate under `packages/contracts/contracts` (issue #1354)
//! confirmed all contracts (registry, job_registry, escrow, payment, market,
//! reputation, dispute, insurance_pool, fee_distribution) already compose
//! errors from this module rather than defining local duplicates, so no
//! per-contract error enums exist to migrate away from.
//!
//! ## Known near-duplicate variants (pre-existing, kept for ABI stability)
//!
//! A handful of variants overlap in meaning because they were added by
//! different contracts before this module existed as the single source of
//! truth. Their discriminants are part of the deployed contract ABI, so they
//! are documented here rather than removed/renumbered:
//!
//! - [`ContractError::NotAuthorized`] is the **canonical** "caller is not
//!   permitted to perform this action" error. Prefer it in new code.
//! - [`ContractError::Unauthorized`] and [`ContractError::UnauthorizedCaller`]
//!   are legacy synonyms kept only because existing deployed contracts /
//!   client SDK bindings reference their numeric codes (6 and 7). Do not use
//!   them in new entrypoints.
//! - [`ContractError::AmountMustBePositive`] is canonical;
//!   [`ContractError::AmountMustBePositiveAlt`] is a legacy synonym kept for
//!   the same ABI-stability reason.
//!
//! New contracts/entrypoints must use the canonical variant. Do not add
//! further synonyms — if an existing variant does not fit, add a new,
//! precisely-named one instead.

use soroban_sdk::contracterror;

/// Common error codes for BlueCollar contracts.
#[contracterror]
#[derive(Copy, Clone, Eq, PartialEq, Debug)]
pub enum ContractError {
    // =========================================================================
    // Initialization errors
    // =========================================================================
    NotInitialized = 1,
    AlreadyInitialized = 4,

    // =========================================================================
    // Authorization errors
    // =========================================================================
    MissingRole = 2,
    NotAuthorized = 5,
    Unauthorized = 6,
    UnauthorizedCaller = 7,
    NotAdmin = 8,
    NotAParty = 9,
    NotASigner = 10,
    NotAnArbitrator = 11,

    // =========================================================================
    // Resource not found errors
    // =========================================================================
    EscrowNotFound = 3,
    PaymentNotFound = 12,
    WorkerNotFound = 13,
    DisputeNotFound = 14,
    ArbitrationNotFound = 15,
    JobNotFound = 16,
    BadgeNotFound = 17,
    CertificationNotFound = 18,
    ClaimNotFound = 19,
    DelegateNotFound = 20,
    SkillNotFound = 21,

    // =========================================================================
    // Existence/duplication errors
    // =========================================================================
    AlreadyExists = 22,
    EscrowAlreadyExists = 23,
    JobAlreadyExists = 24,
    DisputeIdAlreadyExists = 25,
    MultiSigEscrowAlreadyExists = 26,
    CertificationAlreadyExists = 27,
    AlreadyApproved = 28,

    // =========================================================================
    // State/Status errors
    // =========================================================================
    InvalidStatus = 29,
    AlreadyReleased = 30,
    AlreadyCancelled = 31,
    AlreadyResolved = 32,
    EscrowFinalized = 33,
    EscrowNotActive = 34,
    EscrowCancelled = 35,
    EscrowNotDisputed = 36,
    JobNotOpen = 37,
    JobNotAssigned = 38,
    PaymentNotLocked = 39,
    DisputeNotOpenOrInEvidence = 40,
    NotDecidedYet = 41,
    NotDecidable = 42,
    ArbitrationAlreadyRequested = 43,

    // =========================================================================
    // Expiry/Time-based errors
    // =========================================================================
    EscrowNotYetExpired = 44,
    ExpiryMustBeInFuture = 45,
    CertificationExpired = 46,
    InvalidExpiry = 47,

    // =========================================================================
    // Validation errors
    // =========================================================================
    AmountMustBePositive = 48,
    AmountMustBePositiveAlt = 49,
    NoActiveStake = 50,
    NoFeesToDistribute = 51,
    RatingOutOfRange = 52,
    ScoreOutOfRange = 53,
    InvalidSubscriptionTier = 54,
    BatchTooLarge = 55,
    NoFeeRecipientsConfigured = 56,

    // =========================================================================
    // Fee-related errors
    // =========================================================================
    FeeBpsExceedsMaximum = 57,
    PremiumExceedsMaximum = 58,
    InvalidFeeSplit = 59,

    // =========================================================================
    // Contract state errors
    // =========================================================================
    ContractIsPaused = 60,
    UnstakeAlreadyRequested = 61,
    UnstakeNotRequested = 62,

    // =========================================================================
    // Data integrity errors
    // =========================================================================
    WrongSchemaVersion = 63,

    // =========================================================================
    // Additional market, dispute & insurance pool errors
    // =========================================================================
    InvalidThreshold = 64,
    InvalidArbitrator = 65,
    AccountDoesNotHoldRole = 66,
    MultiSigEscrowNotFound = 67,
    SplitBpsOutOfRange = 68,
    ClaimNotPending = 69,
    ClaimNotApproved = 70,
    PoolStatsNotFound = 71,
    BadgeAlreadyAwarded = 72,
    UpgradeAlreadyPending = 73,
    NoPendingUpgrade = 74,
    TimelockNotExpired = 75,
    CallerIsNotCurator = 76,
    UnknownCategory = 77,
    MismatchedInputLengths = 78,
    CooldownNotElapsed = 79,

    // =========================================================================
    // Checked arithmetic errors
    // =========================================================================
    /// A checked arithmetic operation overflowed or underflowed.
    ///
    /// Raised by `fee_distribution` (issue #1434) wherever a `saturating_*`
    /// or raw operator previously clamped or panicked silently, so that fee
    /// bookkeeping failures surface as a typed error instead of losing value.
    ArithmeticOverflow = 80,
}

#[cfg(test)]
mod tests {
    extern crate std;

    use std::{fs, path::Path, string::{String, ToString}, vec::Vec};

    /// Recursively collect every `.rs` file under `dir`.
    fn rust_files(dir: &Path, out: &mut Vec<std::path::PathBuf>) {
        for entry in fs::read_dir(dir).expect("readable directory") {
            let path = entry.expect("readable entry").path();
            if path.is_dir() {
                rust_files(&path, out);
            } else if path.extension().is_some_and(|ext| ext == "rs") {
                out.push(path);
            }
        }
    }

    /// Guards issue #1588: `ContractError` in this crate is the only
    /// `#[contracterror]` enum. Any other contract crate that declares its own
    /// error enum fails this test, so error codes stay stable across contracts.
    #[test]
    fn no_contract_declares_its_own_contracterror_enum() {
        let contracts_dir = Path::new(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .expect("contracts directory");

        let mut files = Vec::new();
        for entry in fs::read_dir(contracts_dir).expect("contracts directory") {
            let crate_dir = entry.expect("crate entry").path();
            if !crate_dir.is_dir() || crate_dir.file_name().is_some_and(|n| n == "types") {
                continue;
            }
            let src = crate_dir.join("src");
            if src.is_dir() {
                rust_files(&src, &mut files);
            }
        }

        let offenders: Vec<String> = files
            .iter()
            .filter(|path| {
                fs::read_to_string(path)
                    .is_ok_and(|src| src.lines().any(|line| line.trim_start().starts_with("#[contracterror]")))
            })
            .map(|path| path.display().to_string())
            .collect();

        assert!(
            offenders.is_empty(),
            "contract crates must use bluecollar_types::ContractError, found local #[contracterror] enums in: {:?}",
            offenders
        );
    }
}
