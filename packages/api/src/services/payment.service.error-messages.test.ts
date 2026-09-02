/**
 * Error-message assertions for payment.service.ts.
 *
 * Purpose: kill Stryker mutants that swap the *text* of thrown AppError
 * messages and the uncovered standalone `updateFeeBps` bounds guards. The
 * existing fee tests only assert that an AppError is thrown (class + status),
 * which leaves message-string mutants and the standalone `updateFeeBps` range
 * guard undetected. These tests pin the exact messages, raising the mutation
 * score for the critical fee-calculation logic.
 *
 * Run via: pnpm --filter @bluecollar/api test:mutation
 */
import { afterEach,describe, expect, it } from 'vitest';

import {
  calculateFee,
  createEscrow,
  createMultiSigEscrow,
  type MultiSigEscrowParams,
  PaymentService,
  tip,
  updateFeeBps,
} from './payment.service.js';

const FUTURE = () => new Date(Date.now() + 60 * 60 * 1000);
const PAST = () => new Date(Date.now() - 60_000);

afterEach(() => {
  updateFeeBps('admin', 250);
});

describe('calculateFee – error messages', () => {
  it('throws the canonical message for negative fee_bps', () => {
    expect(() => calculateFee(10_000, -1)).toThrow('fee_bps must be between 0 and 10000');
  });
  it('throws the canonical message for fee_bps above 10000', () => {
    expect(() => calculateFee(10_000, 10_001)).toThrow('fee_bps must be between 0 and 10000');
  });
});

describe('updateFeeBps (standalone) – bounds & role', () => {
  it('rejects a non-admin via the role message', () => {
    expect(() => updateFeeBps('user', 100)).toThrow('Only admins can update the fee');
    expect(() => updateFeeBps('curator', 100)).toThrow('Only admins can update the fee');
  });
  it('rejects negative fee_bps with the canonical message', () => {
    expect(() => updateFeeBps('admin', -1)).toThrow('fee_bps must be between 0 and 10000');
  });
  it('rejects fee_bps above 10000 with the canonical message', () => {
    expect(() => updateFeeBps('admin', 10_001)).toThrow('fee_bps must be between 0 and 10000');
  });
});

describe('tip – error messages', () => {
  it('rejects a zero/negative amount with the amount message', () => {
    expect(() => tip({ from: 'a', to: 'b', amount: 0 })).toThrow(
      'Tip amount must be greater than 0',
    );
    expect(() => tip({ from: 'a', to: 'b', amount: -1 })).toThrow(
      'Tip amount must be greater than 0',
    );
  });
  it('rejects a self-tip with the sender message', () => {
    expect(() => tip({ from: 'a', to: 'a', amount: 10 })).toThrow(
      'Sender and recipient must be different',
    );
  });
});

describe('createEscrow – error messages', () => {
  it('rejects a non-positive amount', () => {
    expect(() => createEscrow({ from: 'a', to: 'b', amount: 0, expiryDate: FUTURE() })).toThrow(
      'Escrow amount must be greater than 0',
    );
  });
  it('rejects a past expiry', () => {
    expect(() => createEscrow({ from: 'a', to: 'b', amount: 10, expiryDate: PAST() })).toThrow(
      'Escrow expiry must be in the future',
    );
  });
});

describe('createMultiSigEscrow – error messages', () => {
  const base: MultiSigEscrowParams = {
    from: 'a',
    to: 'b',
    amount: 1_000,
    expiryDate: FUTURE(),
    signers: ['s1', 's2'],
    threshold: 2,
  };
  it('rejects an empty signer list', () => {
    expect(() => createMultiSigEscrow({ ...base, signers: [] })).toThrow(
      'At least one signer is required',
    );
  });
  it('rejects a threshold below 1', () => {
    expect(() => createMultiSigEscrow({ ...base, threshold: 0 })).toThrow(
      'threshold must be between 1 and signers.length',
    );
  });
  it('rejects a threshold above the signer count', () => {
    expect(() => createMultiSigEscrow({ ...base, threshold: 3 })).toThrow(
      'threshold must be between 1 and signers.length',
    );
  });
  it('rejects a non-positive amount', () => {
    expect(() => createMultiSigEscrow({ ...base, amount: 0 })).toThrow(
      'Escrow amount must be greater than 0',
    );
  });
  it('rejects a past expiry', () => {
    expect(() => createMultiSigEscrow({ ...base, expiryDate: PAST() })).toThrow(
      'Escrow expiry must be in the future',
    );
  });
});

describe('PaymentService (class) – error messages', () => {
  it('setFeeBps rejects a non-admin', () => {
    const svc = new PaymentService();
    expect(() => svc.setFeeBps('user', 100)).toThrow('Only admins can update the fee');
  });
  it('setFeeBps rejects out-of-range bps', () => {
    const svc = new PaymentService();
    expect(() => svc.setFeeBps('admin', -1)).toThrow('fee_bps must be between 0 and 10000');
    expect(() => svc.setFeeBps('admin', 10_001)).toThrow('fee_bps must be between 0 and 10000');
  });
  it('tip rejects a zero amount and self-tip with canonical messages', () => {
    const svc = new PaymentService();
    expect(() => svc.tip({ from: 'a', to: 'b', amount: 0 })).toThrow(
      'Tip amount must be greater than 0',
    );
    expect(() => svc.tip({ from: 'a', to: 'a', amount: 10 })).toThrow(
      'Sender and recipient must be different',
    );
  });
  it('createEscrow rejects amount and expiry with canonical messages', () => {
    const svc = new PaymentService();
    expect(() => svc.createEscrow({ from: 'a', to: 'b', amount: 0, expiryDate: FUTURE() })).toThrow(
      'Escrow amount must be greater than 0',
    );
    expect(() => svc.createEscrow({ from: 'a', to: 'b', amount: 10, expiryDate: PAST() })).toThrow(
      'Escrow expiry must be in the future',
    );
  });
  it('createMultiSigEscrow delegates with canonical messages', () => {
    const svc = new PaymentService();
    expect(() =>
      svc.createMultiSigEscrow({
        from: 'a',
        to: 'b',
        amount: 10,
        expiryDate: FUTURE(),
        signers: [],
        threshold: 1,
      }),
    ).toThrow('At least one signer is required');
    expect(() =>
      svc.createMultiSigEscrow({
        from: 'a',
        to: 'b',
        amount: 10,
        expiryDate: FUTURE(),
        signers: ['s1'],
        threshold: 2,
      }),
    ).toThrow('threshold must be between 1 and signers.length');
  });
});
