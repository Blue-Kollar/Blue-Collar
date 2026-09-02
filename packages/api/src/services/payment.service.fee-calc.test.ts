/**
 * Mutation-targeting unit tests for the critical fee / balance calculation
 * logic in payment.service.ts.
 *
 * These tests exist to kill mutants produced by Stryker around:
 *  - calculateFee (floor rounding, basis-point bounds, 100% fee edge)
 *  - tip / createEscrow / createMultiSigEscrow (validation guards + breakdown)
 *  - the PaymentService class instance API (independent fee state)
 *  - balance conservation (gross === fee + netAmount)
 *
 * Run with: pnpm --filter @bluecollar/api test:mutation
 */
import { afterEach,describe, expect, it } from 'vitest';

import { AppError } from '../utils/AppError.js';
import {
  calculateFee,
  createEscrow,
  createMultiSigEscrow,
  getFeeBps,
  type MultiSigEscrowParams,
  PaymentService,
  tip,
  updateFeeBps,
} from './payment.service.js';

const FUTURE = () => new Date(Date.now() + 60 * 60 * 1000);
const PAST = () => new Date(Date.now() - 60_000);

// Keep the module-level singleton fee state isolated from other suites.
afterEach(() => {
  updateFeeBps('admin', 250);
});

// ── calculateFee: rounding / boundary mutants ─────────────────────────────────

describe('calculateFee – rounding behaviour', () => {
  it('charges a 100% fee at fee_bps = 10000 (netAmount becomes 0)', () => {
    expect(calculateFee(10_000, 10_000)).toBe(10_000);
    expect(calculateFee(1, 10_000)).toBe(1);
  });

  it('floors a .5 stroop boundary (3 * 500 / 10000 = 0.15 → 0)', () => {
    expect(calculateFee(3, 500)).toBe(0);
  });

  it('floors an uneven division (7 * 250 / 10000 = 0.175 → 0)', () => {
    expect(calculateFee(7, 250)).toBe(0);
  });

  it('floors a larger uneven division (7 * 250 / 10000 for fee=1)', () => {
    // 2700 * 250 / 10000 = 67.5 → floors to 67
    expect(calculateFee(2_700, 250)).toBe(67);
  });

  it('returns 0 fee when fee_bps is 0', () => {
    expect(calculateFee(10_000, 0)).toBe(0);
    expect(calculateFee(1, 0)).toBe(0);
  });

  it('handles the smallest non-zero amount without NaN', () => {
    expect(Number.isFinite(calculateFee(1, 250))).toBe(true);
    expect(calculateFee(1, 250)).toBe(0);
  });

  it('handles a zero amount (0 * bps = 0)', () => {
    expect(calculateFee(0, 500)).toBe(0);
  });

  it('handles very large amounts without producing NaN', () => {
    const large = 1_000_000_000_000;
    expect(Number.isFinite(calculateFee(large, 250))).toBe(true);
    expect(calculateFee(large, 250)).toBe(25_000_000_000);
  });

  it('throws on fee_bps above 10000', () => {
    expect(() => calculateFee(10_000, 10_001)).toThrow(AppError);
  });

  it('throws on negative fee_bps', () => {
    expect(() => calculateFee(10_000, -1)).toThrow(AppError);
  });

  it('accepts the maximum valid fee_bps of exactly 10000', () => {
    expect(() => calculateFee(10_000, 10_000)).not.toThrow();
  });

  it('accepts the minimum valid fee_bps of exactly 0', () => {
    expect(() => calculateFee(10_000, 0)).not.toThrow();
  });
});

// ── tip: balance conservation ─────────────────────────────────────────────────

describe('tip – balance conservation', () => {
  const cases: Array<[number, number]> = [
    [10_000, 250],
    [10_000, 500],
    [1, 0],
    [1234, 100],
    [99_999, 333],
  ];

  it.each(cases)('conserves gross === fee + netAmount for amount=%i bps=%i', (amount, bps) => {
    updateFeeBps('admin', bps);
    const result = tip({ from: 'wallet-a', to: 'wallet-b', amount });
    expect(result.grossAmount).toBe(amount);
    expect(result.fee + result.netAmount).toBe(amount);
  });

  it('charges the full amount as fee at 10000 bps (netAmount = 0)', () => {
    updateFeeBps('admin', 10_000);
    const result = tip({ from: 'wallet-a', to: 'wallet-b', amount: 5_000 });
    expect(result.fee).toBe(5_000);
    expect(result.netAmount).toBe(0);
  });

  it('deducts nothing at 0 bps (netAmount = gross)', () => {
    updateFeeBps('admin', 0);
    const result = tip({ from: 'wallet-a', to: 'wallet-b', amount: 5_000 });
    expect(result.fee).toBe(0);
    expect(result.netAmount).toBe(5_000);
  });
});

// ── createEscrow: validation guards ───────────────────────────────────────────

describe('createEscrow – validation', () => {
  it('succeeds with a future expiry and positive amount', () => {
    const result = createEscrow({ from: 'a', to: 'b', amount: 100, expiryDate: FUTURE() });
    expect(result.status).toBe('pending');
    expect(result.amount).toBe(100);
  });

  it('throws when the amount is 0', () => {
    expect(() => createEscrow({ from: 'a', to: 'b', amount: 0, expiryDate: FUTURE() })).toThrow(
      AppError,
    );
  });

  it('throws when the amount is negative', () => {
    expect(() => createEscrow({ from: 'a', to: 'b', amount: -5, expiryDate: FUTURE() })).toThrow(
      AppError,
    );
  });

  it('throws when the expiry is in the past', () => {
    expect(() => createEscrow({ from: 'a', to: 'b', amount: 100, expiryDate: PAST() })).toThrow(
      AppError,
    );
  });
});

// ── createMultiSigEscrow: previously untested ─────────────────────────────────

describe('createMultiSigEscrow', () => {
  const base: MultiSigEscrowParams = {
    from: 'wallet-a',
    to: 'wallet-b',
    amount: 1_000,
    expiryDate: FUTURE(),
    signers: ['signer-1', 'signer-2'],
    threshold: 2,
  };

  it('succeeds and initialises an empty approvals list with pending status', () => {
    const result = createMultiSigEscrow(base);
    expect(result.status).toBe('pending');
    expect(result.approvals).toEqual([]);
    expect(result.threshold).toBe(2);
    expect(result.signers).toEqual(['signer-1', 'signer-2']);
    expect(result.amount).toBe(1_000);
  });

  it('throws when there are no signers', () => {
    expect(() => createMultiSigEscrow({ ...base, signers: [] })).toThrow(AppError);
  });

  it('throws when threshold is below 1', () => {
    expect(() => createMultiSigEscrow({ ...base, threshold: 0 })).toThrow(AppError);
  });

  it('throws when threshold exceeds the signer count', () => {
    expect(() => createMultiSigEscrow({ ...base, threshold: 3 })).toThrow(AppError);
  });

  it('throws when the amount is not positive', () => {
    expect(() => createMultiSigEscrow({ ...base, amount: 0 })).toThrow(AppError);
    expect(() => createMultiSigEscrow({ ...base, amount: -1 })).toThrow(AppError);
  });

  it('throws when the expiry is in the past', () => {
    expect(() => createMultiSigEscrow({ ...base, expiryDate: PAST() })).toThrow(AppError);
  });
});

// ── PaymentService class: independent instance fee state ─────────────────────

describe('PaymentService (class instance)', () => {
  it('defaults to 250 bps', () => {
    expect(new PaymentService().getFeeBps()).toBe(250);
  });

  it('honours a custom initial fee bps', () => {
    expect(new PaymentService(500).getFeeBps()).toBe(500);
  });

  it('setFeeBps enforces the admin role guard', () => {
    const svc = new PaymentService();
    expect(() => svc.setFeeBps('user', 100)).toThrow(AppError);
    expect(() => svc.setFeeBps('admin', 100)).not.toThrow();
    expect(svc.getFeeBps()).toBe(100);
  });

  it('setFeeBps rejects out-of-range bps', () => {
    const svc = new PaymentService();
    expect(() => svc.setFeeBps('admin', -1)).toThrow(AppError);
    expect(() => svc.setFeeBps('admin', 10_001)).toThrow(AppError);
    expect(() => svc.setFeeBps('admin', 10_000)).not.toThrow();
  });

  it('instance.calculateFee uses instance fee state, not the module singleton', () => {
    const svc = new PaymentService(500);
    expect(svc.calculateFee(10_000)).toBe(500);
    // Module singleton remains at its own value
    expect(getFeeBps()).toBe(250);
  });

  it('instance.tip conserves gross === fee + netAmount', () => {
    const svc = new PaymentService(250);
    const result = svc.tip({ from: 'a', to: 'b', amount: 8_000 });
    expect(result.fee + result.netAmount).toBe(8_000);
  });

  it('instance.tip rejects zero and self transfers', () => {
    const svc = new PaymentService();
    expect(() => svc.tip({ from: 'a', to: 'b', amount: 0 })).toThrow(AppError);
    expect(() => svc.tip({ from: 'a', to: 'a', amount: 10 })).toThrow(AppError);
  });

  it('instance.createEscrow validates expiry and amount', () => {
    const svc = new PaymentService();
    expect(() => svc.createEscrow({ from: 'a', to: 'b', amount: 0, expiryDate: FUTURE() })).toThrow(
      AppError,
    );
    expect(() => svc.createEscrow({ from: 'a', to: 'b', amount: 10, expiryDate: PAST() })).toThrow(
      AppError,
    );
    expect(svc.createEscrow({ from: 'a', to: 'b', amount: 10, expiryDate: FUTURE() }).status).toBe(
      'pending',
    );
  });

  it('instance.createMultiSigEscrow delegates correctly', () => {
    const svc = new PaymentService();
    const result = svc.createMultiSigEscrow({
      from: 'a',
      to: 'b',
      amount: 10,
      expiryDate: FUTURE(),
      signers: ['s1'],
      threshold: 1,
    });
    expect(result.approvals).toEqual([]);
    expect(() =>
      svc.createMultiSigEscrow({
        from: 'a',
        to: 'b',
        amount: 10,
        expiryDate: FUTURE(),
        signers: [],
        threshold: 1,
      }),
    ).toThrow(AppError);
  });
});
