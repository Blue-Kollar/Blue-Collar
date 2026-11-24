/**
 * @file generated/index.ts
 *
 * Typed binding interfaces for all six BlueCollar Soroban contracts.
 *
 * ## How bindings are generated
 *
 * In a live environment, run `scripts/generate-bindings.sh` to invoke
 * `stellar contract bindings typescript` for each contract and overwrite
 * this directory with the generated output.  Because the CLI requires a live
 * Soroban RPC node and a deployed contract ID, these interfaces are produced
 * manually from the Rust source here and kept in sync by the
 * `bindings-drift.test.ts` suite.
 *
 * ## Drift detection (CI)
 *
 * When regeneration is possible (i.e. contract IDs and an RPC node are
 * available) the CI job:
 *   1. Runs `generate-bindings.sh` into a temp directory.
 *   2. Diffs the output against `src/generated/`.
 *   3. Fails if there are any differences.
 *
 * Without a live node, `bindings-drift.test.ts` performs compile-time
 * structural checks using TypeScript's `satisfies` operator to ensure the
 * interfaces match the entrypoints catalogued in the Rust source.
 *
 * @packageDocumentation
 */

export type {
  SorobanAddress,
  SorobanSymbol,
  SorobanBytesN32,
  SorobanI128,
  SorobanU32,
  SorobanU64,
  DelegateRecord,
  EscrowRecord,
  DisputeRecord,
  LockedPaymentRecord,
  JobRecord,
} from './types.js';
export { ContractError } from './types.js';

// ─────────────────────────────────────────────────────────────────────────────
// Registry contract — packages/contracts/contracts/registry/src/lib.rs
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Typed bindings for the BlueCollar Registry contract.
 *
 * The Registry stores worker profiles on-chain.  It is curator-gated: only
 * approved curator addresses may register new workers.  The admin controls
 * the curator list via `add_curator` / `remove_curator`.
 *
 * Full entrypoint list sourced from `RegistryContract` `#[contractimpl]` in
 * `contracts/registry/src/lib.rs`.
 */
export interface RegistryBindings {
  // ── Initialisation ──────────────────────────────────────────────────────

  /** Initialise the contract and set the admin. May only be called once. */
  initialize(admin: string): Promise<void>;

  // ── Role management ─────────────────────────────────────────────────────

  /** Grant `role` to `account`. Caller must hold `ROLE_ADMIN`. */
  grant_role(caller: string, role: string, account: string): Promise<void>;

  /** Revoke `role` from `account`. Caller must hold `ROLE_ADMIN`. */
  revoke_role(caller: string, role: string, account: string): Promise<void>;

  /** Return `true` if `account` holds `role`. */
  has_role(role: string, account: string): Promise<boolean>;

  /** Return all members of `role`. */
  get_role_members_list(role: string): Promise<string[]>;

  // ── Curator management ───────────────────────────────────────────────────

  /** Add `curator` to the approved list. Caller must hold `ROLE_CURATOR_MGR`. */
  add_curator(admin: string, curator: string): Promise<void>;

  /** Remove `curator` from the approved list. Caller must hold `ROLE_CURATOR_MGR`. */
  remove_curator(admin: string, curator: string): Promise<void>;

  /** Return `true` if `addr` is an approved curator. */
  is_curator(addr: string): Promise<boolean>;

  // ── Worker registration ──────────────────────────────────────────────────

  /**
   * Register a new worker. Caller must be an approved curator.
   *
   * @param id              Worker identifier (short symbol string).
   * @param owner           Stellar address that owns the worker profile.
   * @param name            Human-readable name (Soroban String, max 32 chars).
   * @param category        Skill-category symbol.
   * @param location_hash   SHA-256 hash of location PII (never stored raw).
   * @param contact_hash    SHA-256 hash of contact PII.
   * @param curator         Approving curator's address.
   */
  register(
    id: string,
    owner: string,
    name: string,
    category: string,
    location_hash: Uint8Array,
    contact_hash: Uint8Array,
    curator: string,
  ): Promise<void>;

  /** Return the worker record for `id`, or `null` if not found. */
  get_worker(id: string): Promise<Record<string, unknown> | null>;

  /** Return the total number of registered workers. */
  worker_count(): Promise<number>;

  // ── Worker owner functions ───────────────────────────────────────────────

  /** Toggle a worker's `is_active` flag. Only the worker's owner may call. */
  toggle(id: string, caller: string): Promise<void>;

  /** Update a worker's reputation score. Caller must hold `ROLE_REP_MGR`. */
  update_reputation(admin: string, id: string, score: number): Promise<void>;

  // ── Delegation management ────────────────────────────────────────────────

  /**
   * Add a delegate for a worker profile. Owner only.
   *
   * @param id          Worker identifier.
   * @param owner       The worker owner's address.
   * @param delegate    Address to grant delegation to.
   * @param expires_at  Unix timestamp (seconds) when the delegation expires.
   */
  add_delegate(id: string, owner: string, delegate: string, expires_at: number): Promise<void>;

  /** Remove a delegate from a worker profile. Owner only. */
  remove_delegate(id: string, owner: string, delegate: string): Promise<void>;

  /** Return all current delegates for `id`. */
  get_worker_delegates(id: string): Promise<import('./types.js').DelegateRecord[]>;

  // ── Pause / Unpause ───────────────────────────────────────────────────────

  /** Pause all state-mutating operations. Caller must hold `ROLE_PAUSER`. */
  pause(admin: string): Promise<void>;

  /** Resume operations. Caller must hold `ROLE_PAUSER`. */
  unpause(admin: string): Promise<void>;

  /** Return `true` if the contract is paused. */
  is_paused(): Promise<boolean>;

  // ── Admin & versioning ────────────────────────────────────────────────────

  /** Return the current admin address. */
  get_admin(): Promise<string>;

  /** Return the event schema version. */
  version(): Promise<number>;

  /** Return the storage schema version. */
  get_schema_version(): Promise<number>;

  /**
   * Migrate stored state from `expected_version` to `expected_version + 1`.
   * Caller must hold `ROLE_ADMIN`.
   */
  migrate(admin: string, expected_version: number): Promise<void>;

  /**
   * Upgrade the contract WASM. Caller must hold `ROLE_UPGRADER`.
   *
   * @param caller       Upgrader's address.
   * @param new_wasm_hash SHA-256 hash of the new WASM binary (32 bytes).
   */
  upgrade(caller: string, new_wasm_hash: Uint8Array): Promise<void>;

  /**
   * Propose a time-locked WASM upgrade. Caller must hold `ROLE_UPGRADER`.
   * The upgrade becomes executable after the timelock delay.
   */
  propose_upgrade(caller: string, new_wasm_hash: Uint8Array): Promise<void>;

  /**
   * Execute a previously proposed upgrade after the timelock has elapsed.
   * Caller must hold `ROLE_UPGRADER`.
   */
  execute_upgrade(caller: string): Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Market contract — packages/contracts/contracts/market/src/lib.rs
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Typed bindings for the BlueCollar Market contract.
 *
 * The Market contract handles direct tips and escrow-based payments between
 * clients and workers.  A protocol fee (in basis points) is deducted from
 * each transfer and forwarded to the configured `fee_recipient`.
 *
 * Full entrypoint list sourced from `MarketContract` `#[contractimpl]` in
 * `contracts/market/src/lib.rs`.
 */
export interface MarketBindings {
  // ── Initialisation ──────────────────────────────────────────────────────

  /**
   * Initialise the contract.
   *
   * @param admin         Admin address.
   * @param fee_bps       Protocol fee in basis points (capped at 500 = 5%).
   * @param fee_recipient Address that receives collected fees.
   */
  initialize(admin: string, fee_bps: number, fee_recipient: string): Promise<void>;

  // ── Role management ─────────────────────────────────────────────────────

  /** Grant `role` to `account`. Caller must hold `ROLE_ADMIN`. */
  grant_role(caller: string, role: string, account: string): Promise<void>;

  /** Revoke `role` from `account`. Caller must hold `ROLE_ADMIN`. */
  revoke_role(caller: string, role: string, account: string): Promise<void>;

  /** Return `true` if `account` holds `role`. */
  has_role(role: string, account: string): Promise<boolean>;

  // ── Payments ─────────────────────────────────────────────────────────────

  /**
   * Send a direct tip to a worker, deducting the protocol fee.
   *
   * @param from        Payer's address.
   * @param to          Worker's address.
   * @param token_addr  Token contract address.
   * @param amount      Token amount in smallest units.
   */
  tip(from: string, to: string, token_addr: string, amount: bigint): Promise<void>;

  // ── Escrow lifecycle ──────────────────────────────────────────────────────

  /**
   * Create a new escrow and lock `amount` tokens.
   *
   * @param id          Caller-supplied identifier (unique per payer).
   * @param from        Payer's address.
   * @param to          Worker's address.
   * @param token_addr  Token contract address.
   * @param amount      Token amount in smallest units.
   * @param expiry      Unix timestamp (seconds) after which the payer may cancel.
   */
  create_escrow(
    id: string,
    from: string,
    to: string,
    token_addr: string,
    amount: bigint,
    expiry: number,
  ): Promise<void>;

  /** Release escrow funds to the worker. Payer or worker may call. */
  release_escrow(id: string, caller: string): Promise<void>;

  /** Cancel escrow and refund the payer (only after expiry). */
  cancel_escrow(id: string, caller: string): Promise<void>;

  /**
   * Request arbitration on a disputed escrow.
   * Caller must be the payer or worker.
   */
  dispute_escrow(id: string, caller: string): Promise<void>;

  /**
   * Resolve a disputed escrow. Caller must hold `ROLE_DISPUTE_MGR`.
   *
   * @param id                   Escrow identifier.
   * @param caller               Dispute manager's address.
   * @param release_to_worker    If `true`, release to worker; else refund payer.
   */
  resolve_escrow(id: string, caller: string, release_to_worker: boolean): Promise<void>;

  /** Return the escrow record for `id`, or `null` if not found. */
  get_escrow(id: string): Promise<Record<string, unknown> | null>;

  /** Return all escrow ids in creation order. */
  list_escrows(): Promise<string[]>;

  // ── Admin / Config ────────────────────────────────────────────────────────

  /** Update the protocol fee. Caller must hold `ROLE_FEE_MANAGER`. */
  update_fee(caller: string, new_fee_bps: number): Promise<void>;

  /** Return the current fee in basis points. */
  get_fee_bps(): Promise<number>;

  // ── Pause / Unpause ───────────────────────────────────────────────────────

  /** Pause all state-mutating operations. Caller must hold `ROLE_PAUSER`. */
  pause(admin: string): Promise<void>;

  /** Resume operations. Caller must hold `ROLE_PAUSER`. */
  unpause(admin: string): Promise<void>;

  /** Return `true` if the contract is paused. */
  is_paused(): Promise<boolean>;

  // ── Admin & versioning ────────────────────────────────────────────────────

  /** Return the current admin address. */
  get_admin(): Promise<string>;

  /** Return the event schema version. */
  version(): Promise<number>;

  /** Return the storage schema version. */
  get_schema_version(): Promise<number>;

  /**
   * Migrate stored state from `expected_version` to `expected_version + 1`.
   * Caller must hold `ROLE_ADMIN`.
   */
  migrate(admin: string, expected_version: number): Promise<void>;

  /**
   * Upgrade the contract WASM. Caller must hold `ROLE_UPGRADER`.
   *
   * @param caller       Upgrader's address.
   * @param new_wasm_hash SHA-256 hash of the new WASM binary (32 bytes).
   */
  upgrade(caller: string, new_wasm_hash: Uint8Array): Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Dispute contract — packages/contracts/contracts/dispute/src/lib.rs
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Possible outcomes recorded by the Dispute contract arbitrator.
 * Mirrors the `DisputeOutcome` enum in `contracts/dispute/src/storage.rs`.
 */
export type DisputeOutcome = 'RefundDisputer' | 'ReleaseRespondent' | 'Split';

/**
 * Typed bindings for the BlueCollar Dispute contract.
 *
 * Manages the four-step dispute lifecycle:
 *   file → evidence → decide → settle
 *
 * Full entrypoint list sourced from `DisputeContract` `#[contractimpl]` in
 * `contracts/dispute/src/lib.rs`.
 */
export interface DisputeBindings {
  // ── Initialisation ──────────────────────────────────────────────────────

  /** Initialise the contract. May only be called once. */
  initialize(admin: string): Promise<void>;

  /** Return the admin address. */
  get_admin(): Promise<string>;

  // ── Pause / Unpause ───────────────────────────────────────────────────────

  /** Pause the contract. Admin only. */
  pause(admin: string): Promise<void>;

  /** Unpause the contract. Admin only. */
  unpause(admin: string): Promise<void>;

  /** Return `true` if the contract is currently paused. */
  is_paused(): Promise<boolean>;

  // ── Dispute lifecycle ─────────────────────────────────────────────────────

  /**
   * File a dispute and lock `amount` tokens in this contract.
   * Tokens transfer from `disputer` immediately.
   *
   * @param id             Caller-supplied unique dispute identifier.
   * @param disputer       Address of the party opening the dispute.
   * @param respondent     Address of the party being disputed against.
   * @param token          Token contract address.
   * @param amount         Amount to lock (in smallest token units).
   * @param evidence_hash  IPFS hash or other off-chain evidence pointer.
   */
  file_dispute(
    id: string,
    disputer: string,
    respondent: string,
    token: string,
    amount: bigint,
    evidence_hash: string,
  ): Promise<void>;

  /**
   * Submit evidence for an open dispute.
   * Caller must be the disputer or respondent.
   *
   * @param dispute_id    Dispute identifier.
   * @param caller        The party submitting evidence.
   * @param evidence_hash IPFS hash or off-chain evidence pointer.
   */
  submit_evidence(dispute_id: string, caller: string, evidence_hash: string): Promise<void>;

  /**
   * Record the arbitrator's decision. Does NOT transfer tokens.
   * Caller must be an approved arbitrator.
   *
   * @param dispute_id  Dispute identifier.
   * @param arbitrator  Arbitrator's address.
   * @param outcome     Decision: `RefundDisputer`, `ReleaseRespondent`, or `Split`.
   * @param split_bps   Basis points awarded to respondent when `outcome` is `Split`
   *                    (0–10 000). Ignored for non-split outcomes.
   */
  decide(
    dispute_id: string,
    arbitrator: string,
    outcome: DisputeOutcome,
    split_bps: number,
  ): Promise<void>;

  /**
   * Execute token settlement according to the arbitrator's decision.
   * Callable by anyone once a decision is recorded.
   */
  settle(dispute_id: string): Promise<void>;

  // ── Views ─────────────────────────────────────────────────────────────────

  /**
   * Return the dispute record for `dispute_id`, or `null` if not found.
   */
  get_dispute(dispute_id: string): Promise<import('./types.js').DisputeRecord | null>;

  // ── Versioning ────────────────────────────────────────────────────────────

  /** Return the event schema version. */
  version(): Promise<number>;

  // ── Upgrade ───────────────────────────────────────────────────────────────

  /**
   * Upgrade the contract WASM. Admin only.
   *
   * @param admin         Admin's address.
   * @param new_wasm_hash SHA-256 hash of the new WASM binary (32 bytes).
   */
  upgrade(admin: string, new_wasm_hash: Uint8Array): Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Escrow contract — packages/contracts/contracts/escrow/src/lib.rs
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Typed bindings for the BlueCollar Escrow contract.
 *
 * Manages a standard create/release/cancel/dispute/resolve lifecycle for
 * token escrows.  Unlike the Market contract's escrow, this contract is
 * purpose-built for the escrow primitive with explicit arbitration roles.
 *
 * Full entrypoint list sourced from `EscrowContract` `#[contractimpl]` in
 * `contracts/escrow/src/lib.rs`.
 */
export interface EscrowBindings {
  // ── Initialisation ──────────────────────────────────────────────────────

  /** Initialise the contract with an admin. May only be called once. */
  initialize(admin: string): Promise<void>;

  // ── Role management ─────────────────────────────────────────────────────

  /** Grant `role` to `account`. Caller must hold `ROLE_ADMIN`. */
  grant_role(caller: string, role: string, account: string): Promise<void>;

  /** Revoke `role` from `account`. Caller must hold `ROLE_ADMIN`. */
  revoke_role(caller: string, role: string, account: string): Promise<void>;

  /** Return `true` if `account` holds `role`. */
  has_role(role: string, account: string): Promise<boolean>;

  // ── Escrow lifecycle ──────────────────────────────────────────────────────

  /**
   * Create a new escrow and lock `amount` tokens from `depositor`.
   *
   * @param depositor    Payer's address (tokens deducted here).
   * @param beneficiary  Recipient's address.
   * @param token        Token contract address.
   * @param id           Caller-supplied unique identifier.
   * @param amount       Token amount in smallest units.
   * @param expiry       Unix timestamp (seconds) after which depositor may cancel.
   */
  create_escrow(
    depositor: string,
    beneficiary: string,
    token: string,
    id: string,
    amount: bigint,
    expiry: number,
  ): Promise<void>;

  /** Release escrow funds to the beneficiary. Depositor or admin only. */
  release_escrow(caller: string, id: string): Promise<void>;

  /**
   * Cancel escrow and refund depositor.
   * Admin may cancel at any time; depositor only after expiry.
   */
  cancel_escrow(caller: string, id: string): Promise<void>;

  /** File a dispute on an active escrow. Either party may call. */
  dispute_escrow(caller: string, id: string): Promise<void>;

  /**
   * Resolve a disputed escrow. Caller must hold `ROLE_ARBITRATOR`.
   *
   * @param caller                Arbitrator's address.
   * @param id                    Escrow identifier.
   * @param release_to_beneficiary  If `true`, release to beneficiary; else refund depositor.
   */
  resolve_dispute(caller: string, id: string, release_to_beneficiary: boolean): Promise<void>;

  // ── Queries ───────────────────────────────────────────────────────────────

  /** Return the escrow record for `id`. Throws `EscrowNotFound` if absent. */
  get_escrow(id: string): Promise<import('./types.js').EscrowRecord>;

  /** Return all escrow ids in creation order. */
  list_escrows(): Promise<string[]>;

  // ── Pause / Unpause ───────────────────────────────────────────────────────

  /** Pause the contract. Caller must hold `ROLE_PAUSER`. */
  pause(caller: string): Promise<void>;

  /** Unpause the contract. Caller must hold `ROLE_PAUSER`. */
  unpause(caller: string): Promise<void>;

  /** Return `true` if the contract is paused. */
  is_paused(): Promise<boolean>;

  // ── Admin & versioning ────────────────────────────────────────────────────

  /** Return the admin address. */
  get_admin(): Promise<string>;

  /**
   * Upgrade the contract WASM. Caller must hold `ROLE_UPGRADER`.
   *
   * @param caller       Upgrader's address.
   * @param new_wasm_hash SHA-256 hash of the new WASM binary (32 bytes).
   */
  upgrade(caller: string, new_wasm_hash: Uint8Array): Promise<void>;

  /** Return the event schema version. */
  version(): Promise<number>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Payment contract — packages/contracts/contracts/payment/src/lib.rs
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Typed bindings for the BlueCollar Payment contract.
 *
 * Handles both direct single-shot payments and milestone-based locked
 * payments between clients and workers.
 *
 * Full entrypoint list sourced from `PaymentContract` `#[contractimpl]` in
 * `contracts/payment/src/lib.rs`.
 */
export interface PaymentBindings {
  // ── Initialisation ──────────────────────────────────────────────────────

  /**
   * Initialise the contract.
   *
   * @param admin         Admin address.
   * @param fee_bps       Protocol fee in basis points (capped at 500 = 5%).
   * @param fee_recipient Address that receives collected fees.
   */
  initialize(admin: string, fee_bps: number, fee_recipient: string): Promise<void>;

  // ── Role management ─────────────────────────────────────────────────────

  /** Grant `role` to `account`. Caller must hold `ROLE_ADMIN`. */
  grant_role(caller: string, role: string, account: string): Promise<void>;

  /** Revoke `role` from `account`. Caller must hold `ROLE_ADMIN`. */
  revoke_role(caller: string, role: string, account: string): Promise<void>;

  /** Return `true` if `account` holds `role`. */
  has_role(role: string, account: string): Promise<boolean>;

  // ── Direct payment ────────────────────────────────────────────────────────

  /**
   * Send a direct payment to a worker, deducting the protocol fee.
   *
   * @param from        Payer's address.
   * @param to          Worker's address.
   * @param token_addr  Token contract address.
   * @param amount      Token amount in smallest units.
   */
  pay(from: string, to: string, token_addr: string, amount: bigint): Promise<void>;

  // ── Locked payments ───────────────────────────────────────────────────────

  /**
   * Lock funds for a job milestone.
   *
   * @param from        Payer's address (funds deducted immediately).
   * @param to          Worker's address (receives on release).
   * @param token_addr  Token contract address.
   * @param id          Caller-supplied unique payment identifier.
   * @param amount      Token amount in smallest units.
   * @param expiry      Unix timestamp after which a refund may be requested.
   */
  lock_payment(
    from: string,
    to: string,
    token_addr: string,
    id: string,
    amount: bigint,
    expiry: number,
  ): Promise<void>;

  /**
   * Release a locked payment to the worker.
   * Client or admin may call.
   */
  release_payment(caller: string, id: string): Promise<void>;

  /**
   * Release multiple locked payments in one transaction.
   * Returns the ids of payments that were successfully released.
   * Capped at 20 per call.
   */
  batch_release_payment(caller: string, ids: string[]): Promise<string[]>;

  /** Refund a locked payment to the client. Admin may always call; client after expiry. */
  refund_payment(caller: string, id: string): Promise<void>;

  // ── Admin / Config ────────────────────────────────────────────────────────

  /** Update the protocol fee. Caller must hold `ROLE_FEE_MGR`. */
  update_fee(caller: string, new_fee_bps: number): Promise<void>;

  /**
   * Update the treasury (fee recipient) address.
   * Caller must hold `ROLE_ADMIN`.
   */
  set_treasury(caller: string, new_treasury: string): Promise<void>;

  // ── Queries ───────────────────────────────────────────────────────────────

  /**
   * Return the locked payment record for `id`.
   * Throws `PaymentNotFound` if absent.
   */
  get_payment(id: string): Promise<import('./types.js').LockedPaymentRecord>;

  /** Return the current protocol configuration (fee_bps and fee_recipient). */
  get_config(): Promise<{ fee_bps: number; fee_recipient: string }>;

  // ── Pause / Unpause ───────────────────────────────────────────────────────

  /** Pause the contract. Caller must hold `ROLE_PAUSER`. */
  pause(caller: string): Promise<void>;

  /** Unpause the contract. Caller must hold `ROLE_PAUSER`. */
  unpause(caller: string): Promise<void>;

  /** Return `true` if the contract is paused. */
  is_paused(): Promise<boolean>;

  // ── Admin & versioning ────────────────────────────────────────────────────

  /** Return the admin address. */
  get_admin(): Promise<string>;

  /**
   * Upgrade the contract WASM. Caller must hold `ROLE_UPGRADER`.
   *
   * @param caller       Upgrader's address.
   * @param new_wasm_hash SHA-256 hash of the new WASM binary (32 bytes).
   */
  upgrade(caller: string, new_wasm_hash: Uint8Array): Promise<void>;

  /** Return the event schema version. */
  version(): Promise<number>;
}

// ─────────────────────────────────────────────────────────────────────────────
// JobRegistry contract — packages/contracts/contracts/job_registry/src/lib.rs
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Typed bindings for the BlueCollar JobRegistry contract.
 *
 * Manages the full job lifecycle: post → assign → complete/cancel/dispute.
 *
 * Full entrypoint list sourced from `JobRegistryContract` `#[contractimpl]` in
 * `contracts/job_registry/src/lib.rs`.
 */
export interface JobRegistryBindings {
  // ── Initialisation ──────────────────────────────────────────────────────

  /** Initialise the contract with an admin. May only be called once. */
  initialize(admin: string): Promise<void>;

  // ── Role management ─────────────────────────────────────────────────────

  /** Grant `role` to `account`. Caller must hold `ROLE_ADMIN`. */
  grant_role(caller: string, role: string, account: string): Promise<void>;

  /** Revoke `role` from `account`. Caller must hold `ROLE_ADMIN`. */
  revoke_role(caller: string, role: string, account: string): Promise<void>;

  /** Return `true` if `account` holds `role`. */
  has_role(role: string, account: string): Promise<boolean>;

  // ── Job lifecycle ─────────────────────────────────────────────────────────

  /**
   * Post a new job listing.
   *
   * @param poster            Poster's address.
   * @param id                Caller-supplied unique job identifier.
   * @param category          Skill-category symbol.
   * @param description_hash  SHA-256 hash of the job description (32 bytes).
   * @param budget            Budget in smallest token units.
   * @param token             Token contract address.
   * @returns                 The newly created `Job` record.
   */
  post_job(
    poster: string,
    id: string,
    category: string,
    description_hash: Uint8Array,
    budget: bigint,
    token: string,
  ): Promise<import('./types.js').JobRecord>;

  /**
   * Assign a worker to an open job. Only the job poster may call.
   *
   * @param caller  Job poster's address.
   * @param job_id  Job identifier.
   * @param worker  Worker's address.
   */
  assign_worker(caller: string, job_id: string, worker: string): Promise<void>;

  /**
   * Mark an assigned job as completed.
   * Only the assigned worker may call.
   */
  complete_job(caller: string, job_id: string): Promise<void>;

  /**
   * Cancel a job. Only the poster may call.
   * Cancellation is only valid before a worker is assigned.
   */
  cancel_job(caller: string, job_id: string): Promise<void>;

  /**
   * File a dispute on an assigned job.
   * Either the poster or the assigned worker may call.
   */
  dispute_job(caller: string, job_id: string): Promise<void>;

  /**
   * Complete multiple assigned jobs in one transaction.
   * Only the assigned worker of each job may complete it.
   * Returns ids of jobs successfully completed. Capped at 20 per call.
   */
  batch_complete_jobs(caller: string, job_ids: string[]): Promise<string[]>;

  // ── Queries ───────────────────────────────────────────────────────────────

  /**
   * Return the job record for `id`.
   * Throws `JobNotFound` if absent.
   */
  get_job(id: string): Promise<import('./types.js').JobRecord>;

  /** Return all job ids in registration order. */
  list_jobs(): Promise<string[]>;

  /**
   * Return all job ids posted by `poster`.
   * Note: the Rust entrypoint is named `poster_jobs` in `job_registry/src/lib.rs`.
   */
  get_poster_jobs(poster: string): Promise<string[]>;

  /**
   * Return the total number of registered jobs.
   * Derived from `list_jobs().length`; some versions expose a dedicated view.
   */
  job_count(): Promise<number>;

  // ── Pause / Unpause ───────────────────────────────────────────────────────

  /** Pause the contract. Caller must hold `ROLE_PAUSER`. */
  pause(caller: string): Promise<void>;

  /** Unpause the contract. Caller must hold `ROLE_PAUSER`. */
  unpause(caller: string): Promise<void>;

  /** Return `true` if the contract is paused. */
  is_paused(): Promise<boolean>;

  // ── Admin & versioning ────────────────────────────────────────────────────

  /** Return the admin address. */
  get_admin(): Promise<string>;

  /**
   * Upgrade the contract WASM. Caller must hold `ROLE_UPGRADER`.
   *
   * @param caller       Upgrader's address.
   * @param new_wasm_hash SHA-256 hash of the new WASM binary (32 bytes).
   */
  upgrade(caller: string, new_wasm_hash: Uint8Array): Promise<void>;

  /** Return the event schema version. */
  version(): Promise<number>;

  /** Return the storage schema version. */
  get_schema_version(): Promise<number>;

  /**
   * Migrate stored state from `expected_version` to `expected_version + 1`.
   * Caller must hold `ROLE_ADMIN`.
   */
  migrate(admin: string, expected_version: number): Promise<void>;
}
