/**
 * @file generated/types.ts
 *
 * Shared Soroban-to-TypeScript type aliases and the ContractError enum.
 *
 * These types are the TypeScript surface of the Rust/Soroban primitive types
 * used across all BlueCollar contracts.  Every generated binding interface
 * imports from this file, so updating a mapping here propagates everywhere.
 *
 * ## Mapping rationale
 *
 * | Soroban / Rust  | TypeScript              | Reason                                        |
 * |-----------------|-------------------------|-----------------------------------------------|
 * | `Address`       | `string`                | Stellar account IDs are base32 strings        |
 * | `Symbol`        | `string`                | Short identifiers, max 32 chars in Soroban    |
 * | `BytesN<32>`    | `Uint8Array`            | Fixed-length byte buffers                     |
 * | `i128`          | `bigint`                | 128-bit signed integer exceeds Number range   |
 * | `u32`           | `number`                | Fits in JS safe integer range                 |
 * | `u64`           | `number`                | Fits in JS safe integer range for timestamps  |
 * | `bool`          | `boolean`               | Direct mapping                                |
 * | `Option<T>`     | `T | null`              | Rust absence ↔ JS null                       |
 * | `String`        | `string`                | Soroban String is UTF-8                       |
 * | `Vec<T>`        | `T[]`                   | Ordered collection                            |
 *
 * @packageDocumentation
 */

// ─── Primitive type aliases ──────────────────────────────────────────────────

/** A Stellar account ID (G...) or contract ID (C...) encoded as base32 string. */
export type SorobanAddress = string;

/**
 * A Soroban Symbol: a short UTF-8 string identifier (max 32 characters).
 * Used as keys, role names, worker IDs, escrow IDs, and job IDs on-chain.
 */
export type SorobanSymbol = string;

/** A fixed-length 32-byte buffer — maps to Soroban's `BytesN<32>`. */
export type SorobanBytesN32 = Uint8Array;

/**
 * A 128-bit signed integer — maps to Soroban's `i128`.
 * Used for token amounts (the smallest token unit, analogous to stroops).
 * Always use `BigInt` literals: `1_000_000n`.
 */
export type SorobanI128 = bigint;

/** A 32-bit unsigned integer — maps to Soroban's `u32`. */
export type SorobanU32 = number;

/**
 * A 64-bit unsigned integer — maps to Soroban's `u64`.
 * Used for Unix timestamps and sequence numbers.
 */
export type SorobanU64 = number;

// ─── ContractError ───────────────────────────────────────────────────────────

/**
 * Numeric error codes emitted by all BlueCollar Soroban contracts.
 *
 * These values are the canonical discriminants declared in
 * `packages/contracts/contracts/types/src/errors.rs`.  They are part of the
 * deployed contract ABI: **never renumber or remove a variant**.  New codes
 * may be appended.
 *
 * The enum is numeric so SDK consumers can branch on `error.code` values
 * returned from Soroban simulation or transaction result XDR.
 */
export enum ContractError {
  // Initialization
  NotInitialized = 1,
  AlreadyInitialized = 4,

  // Authorization
  MissingRole = 2,
  NotAuthorized = 5,
  Unauthorized = 6,
  UnauthorizedCaller = 7,
  NotAdmin = 8,
  NotAParty = 9,
  NotASigner = 10,
  NotAnArbitrator = 11,

  // Resource not found
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

  // Existence / duplication
  AlreadyExists = 22,
  EscrowAlreadyExists = 23,
  JobAlreadyExists = 24,
  DisputeIdAlreadyExists = 25,
  MultiSigEscrowAlreadyExists = 26,
  CertificationAlreadyExists = 27,
  AlreadyApproved = 28,

  // State / status
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

  // Expiry / time-based
  EscrowNotYetExpired = 44,
  ExpiryMustBeInFuture = 45,
  CertificationExpired = 46,
  InvalidExpiry = 47,

  // Validation
  AmountMustBePositive = 48,
  AmountMustBePositiveAlt = 49,
  NoActiveStake = 50,
  NoFeesToDistribute = 51,
  RatingOutOfRange = 52,
  ScoreOutOfRange = 53,
  InvalidSubscriptionTier = 54,
  BatchTooLarge = 55,
  NoFeeRecipientsConfigured = 56,

  // Fee-related
  FeeBpsExceedsMaximum = 57,
  PremiumExceedsMaximum = 58,
  InvalidFeeSplit = 59,

  // Contract state
  ContractIsPaused = 60,
  UnstakeAlreadyRequested = 61,
  UnstakeNotRequested = 62,

  // Data integrity
  WrongSchemaVersion = 63,

  // Additional market, dispute & insurance pool
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

  // Checked arithmetic
  ArithmeticOverflow = 80,

  // Token / balance
  InsufficientBalance = 81,
  InvalidAddress = 82,
}

// ─── On-chain data shapes ────────────────────────────────────────────────────

/**
 * A delegation record stored on-chain for a worker profile.
 * Maps to the `Delegate` struct in `contracts/registry/src/storage.rs`.
 */
export interface DelegateRecord {
  /** The address being delegated authority. */
  address: SorobanAddress;
  /** Unix timestamp (seconds) at which the delegation expires. */
  expiresAt: SorobanU64;
}

/**
 * Escrow state returned by the Escrow contract.
 * Maps to `EscrowRecord` in `contracts/escrow/src/storage.rs`.
 */
export interface EscrowRecord {
  id: SorobanSymbol;
  depositor: SorobanAddress;
  beneficiary: SorobanAddress;
  token: SorobanAddress;
  amount: SorobanI128;
  expiry: SorobanU64;
  /** Current escrow state: open | disputed | released | cancelled */
  state: string;
}

/**
 * A dispute record as returned by the Dispute contract.
 * Maps to `Dispute` in `contracts/dispute/src/storage.rs`.
 */
export interface DisputeRecord {
  id: SorobanSymbol;
  disputer: SorobanAddress;
  respondent: SorobanAddress;
  token: SorobanAddress;
  amount: SorobanI128;
  status: string;
  outcome: string;
  arbitrator: SorobanAddress | null;
  disputerEvidence: string | null;
  respondentEvidence: string | null;
}

/**
 * A locked payment record as returned by the Payment contract.
 * Maps to `LockedPayment` in `contracts/payment/src/storage.rs`.
 */
export interface LockedPaymentRecord {
  id: SorobanSymbol;
  from: SorobanAddress;
  to: SorobanAddress;
  token: SorobanAddress;
  amount: SorobanI128;
  expiry: SorobanU64;
  status: string;
}

/**
 * A job record as returned by the JobRegistry contract.
 * Maps to `Job` in `contracts/job_registry/src/storage.rs`.
 */
export interface JobRecord {
  id: SorobanSymbol;
  poster: SorobanAddress;
  worker: SorobanAddress | null;
  category: SorobanSymbol;
  descriptionHash: SorobanBytesN32;
  budget: SorobanI128;
  token: SorobanAddress;
  status: string;
}
