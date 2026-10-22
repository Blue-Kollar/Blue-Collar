//! Shared contract event schemas for all BlueCollar contracts.
//!
//! All events emitted by BlueCollar contracts are defined here so that every
//! consumer — indexers, off-chain listeners, SDK — can rely on a single,
//! versioned layout for each event kind.
//!
//! Fields annotated with `#[topic]` are indexed by the network and appear in
//! the Horizon/RPC topic filter.  All other fields are packed into the event's
//! data payload and are accessible but not independently filterable.
//!
//! ## Schema Version
//! This is event schema **v1**.  Increment the `VERSION` constant in each
//! emitting contract whenever any field is added, removed, or renamed.
//!
//! ## Usage in contracts
//! ```rust,ignore
//! use bluecollar_types::events::WorkerRegistered;
//! WorkerRegistered { id: id.clone(), owner: owner.clone(), category: category.clone() }
//!     .publish(&env);
//! ```

use soroban_sdk::{contractevent, Address, BytesN, Symbol};

// ─── Registry events ─────────────────────────────────────────────────────────

/// A worker was registered on-chain by a curator.
///
/// Fixed topic: `"worker_registered"` | Indexed: `id`
/// Data: `owner`, `category`
#[contractevent]
pub struct WorkerRegistered {
    /// On-chain worker identifier.
    #[topic]
    pub id: Symbol,
    /// Wallet address that owns this worker.
    pub owner: Address,
    /// Worker category symbol.
    pub category: Symbol,
}

/// A worker's active status was toggled.
///
/// Fixed topic: `"worker_toggled"` | Indexed: `id`
/// Data: `is_active`
#[contractevent]
pub struct WorkerToggled {
    /// On-chain worker identifier.
    #[topic]
    pub id: Symbol,
    /// New active status (`true` = active).
    pub is_active: bool,
}

/// A worker's mutable fields were updated.
///
/// Fixed topic: `"worker_updated"` | Indexed: `id`, `caller`
/// Data: `wallet`
#[contractevent]
pub struct WorkerUpdated {
    /// On-chain worker identifier.
    #[topic]
    pub id: Symbol,
    /// Address that authorised the update.
    #[topic]
    pub caller: Address,
    /// New wallet address.
    pub wallet: Address,
}

/// A worker was permanently removed from the registry.
///
/// Fixed topic: `"worker_deregistered"` | Indexed: `id`, `caller`
/// Data: none
#[contractevent]
pub struct WorkerDeregistered {
    /// On-chain worker identifier.
    #[topic]
    pub id: Symbol,
    /// Address that authorised the removal.
    #[topic]
    pub caller: Address,
}

/// A curator was added.
///
/// Fixed topic: `"curator_added"` | Indexed: `admin`, `curator`
/// Data: none
#[contractevent]
pub struct CuratorAdded {
    /// Admin address that performed the grant.
    #[topic]
    pub admin: Address,
    /// Newly added curator address.
    #[topic]
    pub curator: Address,
}

/// A curator was removed.
///
/// Fixed topic: `"curator_removed"` | Indexed: `admin`, `curator`
/// Data: none
#[contractevent]
pub struct CuratorRemoved {
    /// Admin address that performed the removal.
    #[topic]
    pub admin: Address,
    /// Curator address that was removed.
    #[topic]
    pub curator: Address,
}

/// Reputation score updated.
///
/// Fixed topic: `"reputation_updated"` | Indexed: `worker_id`
/// Data: `score`
#[contractevent]
pub struct ReputationUpdated {
    /// On-chain worker identifier.
    #[topic]
    pub worker_id: Symbol,
    /// New reputation score.
    pub score: i128,
}

/// A review was submitted for a worker.
///
/// Fixed topic: `"review_submitted"` | Indexed: `worker_id`, `reviewer`
/// Data: `rating`, `new_reputation`
#[contractevent]
pub struct ReviewSubmitted {
    /// On-chain worker identifier.
    #[topic]
    pub worker_id: Symbol,
    /// Reviewer address.
    #[topic]
    pub reviewer: Address,
    /// Rating score submitted.
    pub rating: u32,
    /// Post-review reputation score.
    pub new_reputation: i128,
}

/// Reputation was slashed due to poor ratings.
///
/// Fixed topic: `"reputation_slashed"` | Indexed: `worker_id`
/// Data: `avg_rating`, `new_reputation`
#[contractevent]
pub struct ReputationSlashed {
    /// On-chain worker identifier.
    #[topic]
    pub worker_id: Symbol,
    /// Average rating that triggered the slash.
    pub avg_rating: u32,
    /// Post-slash reputation score.
    pub new_reputation: i128,
}

/// A skill certification was recorded.
///
/// Fixed topic: `"skill_certified"` | Indexed: `worker_id`, `skill`
/// Data: `certified_by`, `expires_at`
#[contractevent]
pub struct SkillCertified {
    /// On-chain worker identifier.
    #[topic]
    pub worker_id: Symbol,
    /// Skill symbol.
    #[topic]
    pub skill: Symbol,
    /// Certifier address.
    pub certified_by: Address,
    /// Expiry timestamp in seconds; `0` means never-expires.
    pub expires_at: u64,
}

/// A skill certification was revoked.
///
/// Fixed topic: `"skill_revoked"` | Indexed: `worker_id`, `skill`
/// Data: `caller`
#[contractevent]
pub struct SkillRevoked {
    /// On-chain worker identifier.
    #[topic]
    pub worker_id: Symbol,
    /// Skill symbol.
    #[topic]
    pub skill: Symbol,
    /// Address that triggered the revocation.
    pub caller: Address,
}

// ─── Access-control events ───────────────────────────────────────────────────

/// A role was granted to an address.
///
/// Fixed topic: `"role_granted"` | Indexed: `role`, `admin`
/// Data: none
#[contractevent]
pub struct RoleGranted {
    /// Role symbol.
    #[topic]
    pub role: Symbol,
    /// Admin address that performed the grant.
    #[topic]
    pub admin: Address,
}

/// A role was revoked from an address.
///
/// Fixed topic: `"role_revoked"` | Indexed: `role`, `account`
/// Data: none
#[contractevent]
pub struct RoleRevoked {
    /// Role symbol.
    #[topic]
    pub role: Symbol,
    /// Account whose role was revoked.
    #[topic]
    pub account: Address,
}

// ─── Pause / Unpause events ───────────────────────────────────────────────────

/// The contract was paused.
///
/// Fixed topic: `"contract_paused"` | Indexed: `admin`
/// Data: none
#[contractevent]
pub struct ContractPaused {
    /// Address that triggered the pause.
    #[topic]
    pub admin: Address,
}

/// The contract was unpaused.
///
/// Fixed topic: `"contract_unpaused"` | Indexed: `admin`
/// Data: none
#[contractevent]
pub struct ContractUnpaused {
    /// Address that triggered the unpause.
    #[topic]
    pub admin: Address,
}

// ─── Market / tip / escrow events ────────────────────────────────────────────

/// A new treasury address was set.
///
/// Fixed topic: `"treasury_set"` | Indexed: `caller`
/// Data: `new_treasury`
#[contractevent]
pub struct TreasurySet {
    /// Address that performed the update.
    #[topic]
    pub caller: Address,
    /// New treasury address.
    pub new_treasury: Address,
}

/// A protocol fee was collected and sent to the fee recipient.
///
/// Fixed topic: `"fee_taken"` | Indexed: `recipient`
/// Data: `amount`
#[contractevent]
pub struct FeeTaken {
    /// Address that received the fee.
    #[topic]
    pub recipient: Address,
    /// Fee amount in token base units.
    pub amount: i128,
}

/// A direct tip was sent from one address to another.
///
/// Fixed topic: `"tip_sent"` | Indexed: `from`, `to`
/// Data: `token`, `amount`
#[contractevent]
pub struct TipSent {
    /// Sender address.
    #[topic]
    pub from: Address,
    /// Recipient address.
    #[topic]
    pub to: Address,
    /// Token contract address.
    pub token: Address,
    /// Gross amount (before fee) in token base units.
    pub amount: i128,
}

/// An escrow was created.
///
/// Fixed topic: `"escrow_created"` | Indexed: `id`, `from`
/// Data: `to`, `token`, `amount`, `expiry_ledger`
#[contractevent]
pub struct EscrowCreated {
    /// Escrow identifier.
    #[topic]
    pub id: Symbol,
    /// Address that funded the escrow.
    #[topic]
    pub from: Address,
    /// Intended recipient.
    pub to: Address,
    /// Token contract address.
    pub token: Address,
    /// Locked amount in token base units.
    pub amount: i128,
    /// Ledger sequence number after which the escrow may be cancelled.
    pub expiry_ledger: u32,
}

/// Escrowed funds were released to the worker.
///
/// Fixed topic: `"escrow_released"` | Indexed: `id`, `to`
/// Data: `amount`
#[contractevent]
pub struct EscrowReleased {
    /// Escrow identifier.
    #[topic]
    pub id: Symbol,
    /// Address that received the funds.
    #[topic]
    pub to: Address,
    /// Net amount released in token base units.
    pub amount: i128,
}

/// An escrow was cancelled and funds returned to the payer.
///
/// Fixed topic: `"escrow_cancelled"` | Indexed: `id`, `from`
/// Data: `amount`
#[contractevent]
pub struct EscrowCancelled {
    /// Escrow identifier.
    #[topic]
    pub id: Symbol,
    /// Payer address that received the refund.
    #[topic]
    pub from: Address,
    /// Refunded amount in token base units.
    pub amount: i128,
}

/// An escrow expired without being released.
///
/// Fixed topic: `"escrow_expired"` | Indexed: `id`, `from`
/// Data: `amount`
#[contractevent]
pub struct EscrowExpired {
    /// Escrow identifier.
    #[topic]
    pub id: Symbol,
    /// Payer address.
    #[topic]
    pub from: Address,
    /// Amount returned in token base units.
    pub amount: i128,
}

/// A multi-sig escrow was created.
///
/// Fixed topic: `"multi_sig_escrow_created"` | Indexed: `id`, `from`
/// Data: `to`, `token`, `amount`, `expiry_ledger`, `threshold`
#[contractevent]
pub struct MultiSigEscrowCreated {
    /// Escrow identifier.
    #[topic]
    pub id: Symbol,
    /// Address that funded the escrow.
    #[topic]
    pub from: Address,
    /// Intended recipient.
    pub to: Address,
    /// Token contract address.
    pub token: Address,
    /// Locked amount in token base units.
    pub amount: i128,
    /// Ledger sequence after which the escrow may be cancelled.
    pub expiry_ledger: u32,
    /// Minimum number of approvals required to release.
    pub threshold: u32,
}

/// An approval was recorded for a multi-sig escrow.
///
/// Fixed topic: `"multi_sig_escrow_approval"` | Indexed: `id`, `caller`
/// Data: `approval_count`
#[contractevent]
pub struct MultiSigEscrowApproval {
    /// Escrow identifier.
    #[topic]
    pub id: Symbol,
    /// Address that submitted the approval.
    #[topic]
    pub caller: Address,
    /// Running total of approvals so far.
    pub approval_count: u32,
}

/// A multi-sig escrow was released.
///
/// Fixed topic: `"multi_sig_escrow_released"` | Indexed: `id`, `to`
/// Data: `amount`
#[contractevent]
pub struct MultiSigEscrowReleased {
    /// Escrow identifier.
    #[topic]
    pub id: Symbol,
    /// Recipient address.
    #[topic]
    pub to: Address,
    /// Net amount released in token base units.
    pub amount: i128,
}

/// A multi-sig escrow was cancelled.
///
/// Fixed topic: `"multi_sig_escrow_cancelled"` | Indexed: `id`, `from`
/// Data: `amount`
#[contractevent]
pub struct MultiSigEscrowCancelled {
    /// Escrow identifier.
    #[topic]
    pub id: Symbol,
    /// Payer address.
    #[topic]
    pub from: Address,
    /// Refunded amount in token base units.
    pub amount: i128,
}

// ─── Arbitration events ───────────────────────────────────────────────────────

/// Arbitration was requested on an escrow.
///
/// Fixed topic: `"arbitration_requested"` | Indexed: `escrow_id`, `requester`
/// Data: `arbitrator`, `fee`
#[contractevent]
pub struct ArbitrationRequested {
    /// Escrow identifier.
    #[topic]
    pub escrow_id: Symbol,
    /// Address that requested arbitration.
    #[topic]
    pub requester: Address,
    /// Assigned arbitrator.
    pub arbitrator: Address,
    /// Arbitration fee held in escrow.
    pub fee: i128,
}

/// Arbitration was requested on a multi-sig escrow.
///
/// Fixed topic: `"multisig_arbitration_requested"` | Indexed: `escrow_id`, `requester`
/// Data: `arbitrator`, `fee`
#[contractevent]
pub struct MultisigArbitrationRequested {
    /// Escrow identifier.
    #[topic]
    pub escrow_id: Symbol,
    /// Address that requested arbitration.
    #[topic]
    pub requester: Address,
    /// Assigned arbitrator.
    pub arbitrator: Address,
    /// Arbitration fee held in escrow.
    pub fee: i128,
}

/// An arbitrator was added to the approved list.
///
/// Fixed topic: `"arbitrator_added"` | Indexed: `admin`, `arbitrator`
/// Data: none
#[contractevent]
pub struct ArbitratorAdded {
    /// Admin that performed the action.
    #[topic]
    pub admin: Address,
    /// Newly approved arbitrator.
    #[topic]
    pub arbitrator: Address,
}

/// An arbitrator was removed from the approved list.
///
/// Fixed topic: `"arbitrator_removed"` | Indexed: `admin`, `arbitrator`
/// Data: none
#[contractevent]
pub struct ArbitratorRemoved {
    /// Admin that performed the action.
    #[topic]
    pub admin: Address,
    /// Removed arbitrator.
    #[topic]
    pub arbitrator: Address,
}

/// An arbitrated escrow dispute was resolved.
///
/// Fixed topic: `"arbitration_resolved"` | Indexed: `id`, `arbitrator`
/// Data: `winner`, `amount`
#[contractevent]
pub struct ArbitrationResolved {
    /// Escrow identifier.
    #[topic]
    pub id: Symbol,
    /// Arbitrator that ruled.
    #[topic]
    pub arbitrator: Address,
    /// Address awarded the funds.
    pub winner: Address,
    /// Amount awarded.
    pub amount: i128,
}

/// A multi-sig arbitrated dispute was resolved.
///
/// Fixed topic: `"multisig_arbitration_resolved"` | Indexed: `id`, `arbitrator`
/// Data: `winner`, `amount`
#[contractevent]
pub struct MultisigArbitrationResolved {
    /// Escrow identifier.
    #[topic]
    pub id: Symbol,
    /// Arbitrator that ruled.
    #[topic]
    pub arbitrator: Address,
    /// Address awarded the funds.
    pub winner: Address,
    /// Amount awarded.
    pub amount: i128,
}

// ─── Dispute events ───────────────────────────────────────────────────────────

/// A dispute was opened.
///
/// Fixed topic: `"dispute_opened"` | Indexed: `id`, `disputer`
/// Data: `respondent`, `amount`
#[contractevent]
pub struct DisputeOpened {
    /// Dispute identifier.
    #[topic]
    pub id: Symbol,
    /// Address that opened the dispute.
    #[topic]
    pub disputer: Address,
    /// Address being disputed.
    pub respondent: Address,
    /// Amount locked in dispute escrow.
    pub amount: i128,
}

/// An arbitrator decided the outcome of a dispute.
///
/// Fixed topic: `"dispute_decided"` | Indexed: `id`, `arbitrator`
/// Data: `outcome`, `split_bps`
#[contractevent]
pub struct DisputeDecided {
    /// Dispute identifier.
    #[topic]
    pub id: Symbol,
    /// Arbitrator that decided.
    #[topic]
    pub arbitrator: Address,
    /// Numeric outcome code.
    pub outcome: u32,
    /// Basis-point split awarded to the disputer.
    pub split_bps: u32,
}

/// A dispute was settled and funds disbursed.
///
/// Fixed topic: `"dispute_settled"` | Indexed: `id`
/// Data: `outcome`, `amount`
#[contractevent]
pub struct DisputeSettled {
    /// Dispute identifier.
    #[topic]
    pub id: Symbol,
    /// Numeric outcome code.
    pub outcome: u32,
    /// Total amount distributed.
    pub amount: i128,
}

// ─── Job-registry events ─────────────────────────────────────────────────────

/// A new job was posted.
///
/// Fixed topic: `"job_posted"` | Indexed: `id`, `poster`
/// Data: `category`, `budget`
#[contractevent]
pub struct JobPosted {
    /// Job identifier.
    #[topic]
    pub id: Symbol,
    /// Address that posted the job.
    #[topic]
    pub poster: Address,
    /// Job category.
    pub category: Symbol,
    /// Job budget in token base units.
    pub budget: i128,
}

/// A worker was assigned to a job.
///
/// Fixed topic: `"job_assigned"` | Indexed: `job_id`, `caller`
/// Data: `worker`
#[contractevent]
pub struct JobAssigned {
    /// Job identifier.
    #[topic]
    pub job_id: Symbol,
    /// Address that performed the assignment.
    #[topic]
    pub caller: Address,
    /// Worker address assigned.
    pub worker: Address,
}

/// A job was marked as completed.
///
/// Fixed topic: `"job_completed"` | Indexed: `job_id`, `caller`
/// Data: none
#[contractevent]
pub struct JobCompleted {
    /// Job identifier.
    #[topic]
    pub job_id: Symbol,
    /// Worker that completed the job.
    #[topic]
    pub caller: Address,
}

/// A job was cancelled.
///
/// Fixed topic: `"job_cancelled"` | Indexed: `job_id`, `caller`
/// Data: none
#[contractevent]
pub struct JobCancelled {
    /// Job identifier.
    #[topic]
    pub job_id: Symbol,
    /// Address that cancelled the job.
    #[topic]
    pub caller: Address,
}

// ─── Fee-distribution events ─────────────────────────────────────────────────

/// Protocol fees were distributed to a recipient.
///
/// Fixed topic: `"fee_distributed"` | Indexed: `recipient`
/// Data: `share`
#[contractevent]
pub struct FeeDistributed {
    /// Recipient address.
    #[topic]
    pub recipient: Address,
    /// Share amount distributed in token base units.
    pub share: i128,
}

// ─── Upgrade events ───────────────────────────────────────────────────────────

/// The contract WASM was upgraded.
///
/// Fixed topic: `"contract_upgraded"` | Indexed: `admin`
/// Data: `new_wasm_hash`, `version`
#[contractevent]
pub struct ContractUpgraded {
    /// Admin that performed the upgrade.
    #[topic]
    pub admin: Address,
    /// New WASM hash.
    pub new_wasm_hash: BytesN<32>,
    /// Post-upgrade version number.
    pub version: u32,
}
