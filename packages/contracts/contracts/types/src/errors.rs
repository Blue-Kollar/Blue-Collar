//! Shared error definitions for BlueCollar contracts.
//!
//! Consolidates common error codes across all contracts to ensure consistency
//! and maintainability.

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
}
