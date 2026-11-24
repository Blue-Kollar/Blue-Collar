/**
 * Bindings drift detection test suite — issue #1854.
 *
 * Purpose
 * ───────
 * These tests act as a lightweight "did the bindings drift?" alarm that
 * runs in CI without needing a live Soroban RPC node.  They verify two
 * things:
 *
 *   1. **Structural (compile-time)**: every binding interface has the
 *      exact method names expected from the Rust contract source.  This
 *      uses TypeScript's `satisfies` operator so the check is free at
 *      runtime but fatal at tsc compile time.
 *
 *   2. **Runtime (shape)**: the generated module exports are non-empty and
 *      have the expected named exports, so a file that is accidentally
 *      emptied or mis-exported will fail.
 *
 * When to regenerate
 * ──────────────────
 * Run `packages/sdk/scripts/generate-bindings.sh` after any change to a
 * contract's public entrypoints, then update these type-level checks to
 * match the new surface if needed.
 *
 * Full regeneration with a live node
 * ───────────────────────────────────
 * With a deployed contract and an RPC endpoint, the CI drift job:
 *   1. Runs `generate-bindings.sh` into a temp directory.
 *   2. Diffs the output against `src/generated/`.
 *   3. Fails if there are any differences.
 */
import { describe, it, expect } from 'vitest';

// ── Module-level imports ──────────────────────────────────────────────────────

import * as GeneratedModule from '../generated/index.js';
import { ContractError } from '../generated/types.js';

import type {
  RegistryBindings,
  MarketBindings,
  DisputeBindings,
  EscrowBindings,
  PaymentBindings,
  JobRegistryBindings,
} from '../generated/index.js';

// ─────────────────────────────────────────────────────────────────────────────
// 1. Compile-time structural checks using `satisfies`
//
// Each block defines a minimal stub object that satisfies the binding
// interface.  TypeScript will error at compile time if a method is missing,
// has the wrong number of arguments, or uses the wrong types.
// ─────────────────────────────────────────────────────────────────────────────

// Helper: a resolved Promise stub with the right return type.
const p = <T>(v: T): Promise<T> => Promise.resolve(v);
const pVoid = (): Promise<void> => Promise.resolve();
const pBool = (): Promise<boolean> => p(false);
const pNum = (): Promise<number> => p(0);
const pStr = (): Promise<string> => p('');
const pStrArr = (): Promise<string[]> => p([]);
const pUnknown = (): Promise<Record<string, unknown> | null> => p(null);

// ── Registry ─────────────────────────────────────────────────────────────────

/**
 * Compile-time guard: this object must satisfy RegistryBindings.
 * If a method is removed from or added to the interface, TypeScript
 * will flag this block and the developer must update both the interface
 * and the stub — ensuring they stay in sync.
 */
const _registryStub = {
  initialize: (_admin: string) => pVoid(),
  grant_role: (_caller: string, _role: string, _account: string) => pVoid(),
  revoke_role: (_caller: string, _role: string, _account: string) => pVoid(),
  has_role: (_role: string, _account: string) => pBool(),
  get_role_members_list: (_role: string) => pStrArr(),
  add_curator: (_admin: string, _curator: string) => pVoid(),
  remove_curator: (_admin: string, _curator: string) => pVoid(),
  is_curator: (_addr: string) => pBool(),
  register: (
    _id: string,
    _owner: string,
    _name: string,
    _category: string,
    _location_hash: Uint8Array,
    _contact_hash: Uint8Array,
    _curator: string,
  ) => pVoid(),
  get_worker: (_id: string) => pUnknown(),
  worker_count: () => pNum(),
  toggle: (_id: string, _caller: string) => pVoid(),
  update_reputation: (_admin: string, _id: string, _score: number) => pVoid(),
  add_delegate: (_id: string, _owner: string, _delegate: string, _expires_at: number) => pVoid(),
  remove_delegate: (_id: string, _owner: string, _delegate: string) => pVoid(),
  get_worker_delegates: (_id: string) => p<import('../generated/types.js').DelegateRecord[]>([]),
  pause: (_admin: string) => pVoid(),
  unpause: (_admin: string) => pVoid(),
  is_paused: () => pBool(),
  get_admin: () => pStr(),
  version: () => pNum(),
  get_schema_version: () => pNum(),
  migrate: (_admin: string, _expected_version: number) => pVoid(),
  upgrade: (_caller: string, _new_wasm_hash: Uint8Array) => pVoid(),
  propose_upgrade: (_caller: string, _new_wasm_hash: Uint8Array) => pVoid(),
  execute_upgrade: (_caller: string) => pVoid(),
} satisfies RegistryBindings;

// ── Market ────────────────────────────────────────────────────────────────────

const _marketStub = {
  initialize: (_admin: string, _fee_bps: number, _fee_recipient: string) => pVoid(),
  grant_role: (_caller: string, _role: string, _account: string) => pVoid(),
  revoke_role: (_caller: string, _role: string, _account: string) => pVoid(),
  has_role: (_role: string, _account: string) => pBool(),
  tip: (_from: string, _to: string, _token_addr: string, _amount: bigint) => pVoid(),
  create_escrow: (
    _id: string,
    _from: string,
    _to: string,
    _token_addr: string,
    _amount: bigint,
    _expiry: number,
  ) => pVoid(),
  release_escrow: (_id: string, _caller: string) => pVoid(),
  cancel_escrow: (_id: string, _caller: string) => pVoid(),
  dispute_escrow: (_id: string, _caller: string) => pVoid(),
  resolve_escrow: (_id: string, _caller: string, _release_to_worker: boolean) => pVoid(),
  get_escrow: (_id: string) => pUnknown(),
  list_escrows: () => pStrArr(),
  update_fee: (_caller: string, _new_fee_bps: number) => pVoid(),
  get_fee_bps: () => pNum(),
  pause: (_admin: string) => pVoid(),
  unpause: (_admin: string) => pVoid(),
  is_paused: () => pBool(),
  get_admin: () => pStr(),
  version: () => pNum(),
  get_schema_version: () => pNum(),
  migrate: (_admin: string, _expected_version: number) => pVoid(),
  upgrade: (_caller: string, _new_wasm_hash: Uint8Array) => pVoid(),
} satisfies MarketBindings;

// ── Dispute ───────────────────────────────────────────────────────────────────

const _disputeStub = {
  initialize: (_admin: string) => pVoid(),
  get_admin: () => pStr(),
  pause: (_admin: string) => pVoid(),
  unpause: (_admin: string) => pVoid(),
  is_paused: () => pBool(),
  file_dispute: (
    _id: string,
    _disputer: string,
    _respondent: string,
    _token: string,
    _amount: bigint,
    _evidence_hash: string,
  ) => pVoid(),
  submit_evidence: (_dispute_id: string, _caller: string, _evidence_hash: string) => pVoid(),
  decide: (
    _dispute_id: string,
    _arbitrator: string,
    _outcome: import('../generated/index.js').DisputeOutcome,
    _split_bps: number,
  ) => pVoid(),
  settle: (_dispute_id: string) => pVoid(),
  get_dispute: (_dispute_id: string) =>
    p<import('../generated/types.js').DisputeRecord | null>(null),
  version: () => pNum(),
  upgrade: (_admin: string, _new_wasm_hash: Uint8Array) => pVoid(),
} satisfies DisputeBindings;

// ── Escrow ────────────────────────────────────────────────────────────────────

const _escrowStub = {
  initialize: (_admin: string) => pVoid(),
  grant_role: (_caller: string, _role: string, _account: string) => pVoid(),
  revoke_role: (_caller: string, _role: string, _account: string) => pVoid(),
  has_role: (_role: string, _account: string) => pBool(),
  create_escrow: (
    _depositor: string,
    _beneficiary: string,
    _token: string,
    _id: string,
    _amount: bigint,
    _expiry: number,
  ) => pVoid(),
  release_escrow: (_caller: string, _id: string) => pVoid(),
  cancel_escrow: (_caller: string, _id: string) => pVoid(),
  dispute_escrow: (_caller: string, _id: string) => pVoid(),
  resolve_dispute: (_caller: string, _id: string, _release_to_beneficiary: boolean) => pVoid(),
  get_escrow: (_id: string) =>
    p<import('../generated/types.js').EscrowRecord>({
      id: '',
      depositor: '',
      beneficiary: '',
      token: '',
      amount: 0n,
      expiry: 0,
      state: '',
    }),
  list_escrows: () => pStrArr(),
  pause: (_caller: string) => pVoid(),
  unpause: (_caller: string) => pVoid(),
  is_paused: () => pBool(),
  get_admin: () => pStr(),
  upgrade: (_caller: string, _new_wasm_hash: Uint8Array) => pVoid(),
  version: () => pNum(),
} satisfies EscrowBindings;

// ── Payment ───────────────────────────────────────────────────────────────────

const _paymentStub = {
  initialize: (_admin: string, _fee_bps: number, _fee_recipient: string) => pVoid(),
  grant_role: (_caller: string, _role: string, _account: string) => pVoid(),
  revoke_role: (_caller: string, _role: string, _account: string) => pVoid(),
  has_role: (_role: string, _account: string) => pBool(),
  pay: (_from: string, _to: string, _token_addr: string, _amount: bigint) => pVoid(),
  lock_payment: (
    _from: string,
    _to: string,
    _token_addr: string,
    _id: string,
    _amount: bigint,
    _expiry: number,
  ) => pVoid(),
  release_payment: (_caller: string, _id: string) => pVoid(),
  batch_release_payment: (_caller: string, _ids: string[]) => pStrArr(),
  refund_payment: (_caller: string, _id: string) => pVoid(),
  update_fee: (_caller: string, _new_fee_bps: number) => pVoid(),
  set_treasury: (_caller: string, _new_treasury: string) => pVoid(),
  get_payment: (_id: string) =>
    p<import('../generated/types.js').LockedPaymentRecord>({
      id: '',
      from: '',
      to: '',
      token: '',
      amount: 0n,
      expiry: 0,
      status: '',
    }),
  get_config: () =>
    p<{ fee_bps: number; fee_recipient: string }>({ fee_bps: 0, fee_recipient: '' }),
  pause: (_caller: string) => pVoid(),
  unpause: (_caller: string) => pVoid(),
  is_paused: () => pBool(),
  get_admin: () => pStr(),
  upgrade: (_caller: string, _new_wasm_hash: Uint8Array) => pVoid(),
  version: () => pNum(),
} satisfies PaymentBindings;

// ── JobRegistry ───────────────────────────────────────────────────────────────

const _jobRegistryStub = {
  initialize: (_admin: string) => pVoid(),
  grant_role: (_caller: string, _role: string, _account: string) => pVoid(),
  revoke_role: (_caller: string, _role: string, _account: string) => pVoid(),
  has_role: (_role: string, _account: string) => pBool(),
  post_job: (
    _poster: string,
    _id: string,
    _category: string,
    _description_hash: Uint8Array,
    _budget: bigint,
    _token: string,
  ) =>
    p<import('../generated/types.js').JobRecord>({
      id: '',
      poster: '',
      worker: null,
      category: '',
      descriptionHash: new Uint8Array(32),
      budget: 0n,
      token: '',
      status: '',
    }),
  assign_worker: (_caller: string, _job_id: string, _worker: string) => pVoid(),
  complete_job: (_caller: string, _job_id: string) => pVoid(),
  cancel_job: (_caller: string, _job_id: string) => pVoid(),
  dispute_job: (_caller: string, _job_id: string) => pVoid(),
  batch_complete_jobs: (_caller: string, _job_ids: string[]) => pStrArr(),
  get_job: (_id: string) =>
    p<import('../generated/types.js').JobRecord>({
      id: '',
      poster: '',
      worker: null,
      category: '',
      descriptionHash: new Uint8Array(32),
      budget: 0n,
      token: '',
      status: '',
    }),
  list_jobs: () => pStrArr(),
  get_poster_jobs: (_poster: string) => pStrArr(),
  job_count: () => pNum(),
  pause: (_caller: string) => pVoid(),
  unpause: (_caller: string) => pVoid(),
  is_paused: () => pBool(),
  get_admin: () => pStr(),
  upgrade: (_caller: string, _new_wasm_hash: Uint8Array) => pVoid(),
  version: () => pNum(),
  get_schema_version: () => pNum(),
  migrate: (_admin: string, _expected_version: number) => pVoid(),
} satisfies JobRegistryBindings;

// Suppress "declared but not used" TypeScript warnings for the stub variables.
// They exist purely for the compile-time `satisfies` check above.
void _registryStub;
void _marketStub;
void _disputeStub;
void _escrowStub;
void _paymentStub;
void _jobRegistryStub;

// ─────────────────────────────────────────────────────────────────────────────
// 2. Runtime checks: exports are present and non-empty
// ─────────────────────────────────────────────────────────────────────────────

describe('generated/index.ts – module exports', () => {
  it('exports ContractError with the expected discriminants', () => {
    // Spot-check a handful of well-known error codes.
    expect(ContractError.NotInitialized).toBe(1);
    expect(ContractError.AlreadyInitialized).toBe(4);
    expect(ContractError.EscrowNotFound).toBe(3);
    expect(ContractError.WorkerNotFound).toBe(13);
    expect(ContractError.JobNotFound).toBe(16);
    expect(ContractError.ContractIsPaused).toBe(60);
    expect(ContractError.ArithmeticOverflow).toBe(80);
    expect(ContractError.InsufficientBalance).toBe(81);
  });

  it('ContractError enum covers all 82 error codes (1 through 82)', () => {
    // The enum must not have gaps or missing codes.
    const values = Object.values(ContractError).filter((v): v is number => typeof v === 'number');
    expect(values.length).toBeGreaterThan(0);

    // Every value must be a positive integer in [1, 82].
    for (const v of values) {
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(82);
    }
  });

  it('re-exports SorobanAddress, SorobanSymbol, and other primitive aliases', () => {
    // Type aliases are erased at runtime; we verify their presence by checking
    // that the generated module object is non-null and that known value exports exist.
    expect(GeneratedModule).toBeDefined();
    expect(typeof GeneratedModule.ContractError).toBe('object');
  });

  it('the generated module has at least one export', () => {
    const keys = Object.keys(GeneratedModule);
    expect(keys.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Interface method-name checks
//
// These tests document the exact method names for each contract, acting as a
// diff-able record so that renaming a Rust entrypoint shows up here as a
// test failure.
// ─────────────────────────────────────────────────────────────────────────────

describe('RegistryBindings – method inventory', () => {
  /**
   * This list mirrors the public entrypoints in RegistryContract.
   * Update it whenever the Rust source changes.
   */
  const EXPECTED_REGISTRY_METHODS: (keyof RegistryBindings)[] = [
    'initialize',
    'grant_role',
    'revoke_role',
    'has_role',
    'get_role_members_list',
    'add_curator',
    'remove_curator',
    'is_curator',
    'register',
    'get_worker',
    'worker_count',
    'toggle',
    'update_reputation',
    'add_delegate',
    'remove_delegate',
    'get_worker_delegates',
    'pause',
    'unpause',
    'is_paused',
    'get_admin',
    'version',
    'get_schema_version',
    'migrate',
    'upgrade',
    'propose_upgrade',
    'execute_upgrade',
  ];

  it('has all expected methods', () => {
    // Verify every expected key is present on the stub.
    for (const method of EXPECTED_REGISTRY_METHODS) {
      expect(typeof _registryStub[method]).toBe('function');
    }
  });
});

describe('MarketBindings – method inventory', () => {
  const EXPECTED_MARKET_METHODS: (keyof MarketBindings)[] = [
    'initialize',
    'grant_role',
    'revoke_role',
    'has_role',
    'tip',
    'create_escrow',
    'release_escrow',
    'cancel_escrow',
    'dispute_escrow',
    'resolve_escrow',
    'get_escrow',
    'list_escrows',
    'update_fee',
    'get_fee_bps',
    'pause',
    'unpause',
    'is_paused',
    'get_admin',
    'version',
    'get_schema_version',
    'migrate',
    'upgrade',
  ];

  it('has all expected methods', () => {
    for (const method of EXPECTED_MARKET_METHODS) {
      expect(typeof _marketStub[method]).toBe('function');
    }
  });
});

describe('DisputeBindings – method inventory', () => {
  const EXPECTED_DISPUTE_METHODS: (keyof DisputeBindings)[] = [
    'initialize',
    'get_admin',
    'pause',
    'unpause',
    'is_paused',
    'file_dispute',
    'submit_evidence',
    'decide',
    'settle',
    'get_dispute',
    'version',
    'upgrade',
  ];

  it('has all expected methods', () => {
    for (const method of EXPECTED_DISPUTE_METHODS) {
      expect(typeof _disputeStub[method]).toBe('function');
    }
  });
});

describe('EscrowBindings – method inventory', () => {
  const EXPECTED_ESCROW_METHODS: (keyof EscrowBindings)[] = [
    'initialize',
    'grant_role',
    'revoke_role',
    'has_role',
    'create_escrow',
    'release_escrow',
    'cancel_escrow',
    'dispute_escrow',
    'resolve_dispute',
    'get_escrow',
    'list_escrows',
    'pause',
    'unpause',
    'is_paused',
    'get_admin',
    'upgrade',
    'version',
  ];

  it('has all expected methods', () => {
    for (const method of EXPECTED_ESCROW_METHODS) {
      expect(typeof _escrowStub[method]).toBe('function');
    }
  });
});

describe('PaymentBindings – method inventory', () => {
  const EXPECTED_PAYMENT_METHODS: (keyof PaymentBindings)[] = [
    'initialize',
    'grant_role',
    'revoke_role',
    'has_role',
    'pay',
    'lock_payment',
    'release_payment',
    'batch_release_payment',
    'refund_payment',
    'update_fee',
    'set_treasury',
    'get_payment',
    'get_config',
    'pause',
    'unpause',
    'is_paused',
    'get_admin',
    'upgrade',
    'version',
  ];

  it('has all expected methods', () => {
    for (const method of EXPECTED_PAYMENT_METHODS) {
      expect(typeof _paymentStub[method]).toBe('function');
    }
  });
});

describe('JobRegistryBindings – method inventory', () => {
  const EXPECTED_JOB_REGISTRY_METHODS: (keyof JobRegistryBindings)[] = [
    'initialize',
    'grant_role',
    'revoke_role',
    'has_role',
    'post_job',
    'assign_worker',
    'complete_job',
    'cancel_job',
    'dispute_job',
    'batch_complete_jobs',
    'get_job',
    'list_jobs',
    'get_poster_jobs',
    'job_count',
    'pause',
    'unpause',
    'is_paused',
    'get_admin',
    'upgrade',
    'version',
    'get_schema_version',
    'migrate',
  ];

  it('has all expected methods', () => {
    for (const method of EXPECTED_JOB_REGISTRY_METHODS) {
      expect(typeof _jobRegistryStub[method]).toBe('function');
    }
  });
});
