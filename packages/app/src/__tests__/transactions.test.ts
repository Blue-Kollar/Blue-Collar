/**
 * transactions.test.ts — unit tests for wallet signing safety helpers
 * Closes #823 acceptance criteria: wrong-network/contract blocks, tampering tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  validateNetwork,
  validateDestination,
  validateContractId,
  validateAmount,
  assertXdrNotTampered,
  buildTransactionSummary,
  TransactionValidationError,
  NETWORKS,
  MIN_AMOUNT_XLM,
} from "@/lib/transactions";

// ---------------------------------------------------------------------------
// Mock @stellar/stellar-sdk where XDR parsing is needed
// ---------------------------------------------------------------------------

const MOCK_PASSPHRASE = NETWORKS.TESTNET.passphrase;

// We mock the SDK only for tamper + summary tests (fromXDR path).
// StrKey is left real so validateDestination can test actual encoding.
const mockFromXDR = vi.fn();
const mockToXDR = vi.fn(() => "base-xdr");

vi.mock("@stellar/stellar-sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@stellar/stellar-sdk")>();
  return {
    ...actual,
    TransactionBuilder: {
      ...actual.TransactionBuilder,
      fromXDR: (...args: unknown[]) => mockFromXDR(...args),
    },
    // Keep StrKey real (not mocked)
    StrKey: actual.StrKey,
  };
});

// Helper to build a fake transaction object
function fakeTx(overrides: Partial<{
  fee: string;
  source: string;
  networkPassphrase: string;
  operations: unknown[];
  signatures: unknown[];
}> = {}) {
  const tx = {
    fee: "100",
    source: "GABC123",
    networkPassphrase: MOCK_PASSPHRASE,
    operations: [],
    signatures: [],
    toXDR: mockToXDR,
    ...overrides,
  };
  return tx;
}

// ---------------------------------------------------------------------------
// validateNetwork
// ---------------------------------------------------------------------------

describe("validateNetwork", () => {
  it("passes when network matches expected", () => {
    expect(() => validateNetwork("TESTNET", "TESTNET")).not.toThrow();
  });

  it("is case-insensitive", () => {
    expect(() => validateNetwork("testnet", "TESTNET")).not.toThrow();
  });

  it("throws WRONG_NETWORK when on mainnet but testnet expected", () => {
    expect(() => validateNetwork("MAINNET", "TESTNET")).toThrow(
      TransactionValidationError
    );
    try {
      validateNetwork("MAINNET", "TESTNET");
    } catch (e) {
      expect((e as TransactionValidationError).code).toBe("WRONG_NETWORK");
    }
  });

  it("throws WRONG_NETWORK for null network", () => {
    expect(() => validateNetwork(null, "TESTNET")).toThrow(
      TransactionValidationError
    );
  });
});

// ---------------------------------------------------------------------------
// validateDestination
// ---------------------------------------------------------------------------

describe("validateDestination", () => {
  it("accepts a valid G… public key", () => {
    // Generated via Keypair.random() — confirmed decodable by StrKey
    expect(() =>
      validateDestination("GDNWUUXJRNFQ2HF3EUKP3BXOUJTZIQZ4JCFDQ2AYKMNXDJWYON7VM3BL")
    ).not.toThrow();
  });

  it("throws INVALID_DESTINATION for empty string", () => {
    expect(() => validateDestination("")).toThrow(TransactionValidationError);
    try {
      validateDestination("");
    } catch (e) {
      expect((e as TransactionValidationError).code).toBe("INVALID_DESTINATION");
    }
  });

  it("throws INVALID_DESTINATION for a random string", () => {
    expect(() => validateDestination("not-an-address")).toThrow(
      TransactionValidationError
    );
  });
});

// ---------------------------------------------------------------------------
// validateContractId
// ---------------------------------------------------------------------------

describe("validateContractId", () => {
  const allowed = ["CAABC123", "CAXYZ789"];

  it("passes for an allowed contract", () => {
    expect(() => validateContractId("CAABC123", allowed)).not.toThrow();
  });

  it("throws INVALID_CONTRACT for an unknown contract", () => {
    expect(() => validateContractId("CMALICIOUS", allowed)).toThrow(
      TransactionValidationError
    );
    try {
      validateContractId("CMALICIOUS", allowed);
    } catch (e) {
      expect((e as TransactionValidationError).code).toBe("INVALID_CONTRACT");
    }
  });
});

// ---------------------------------------------------------------------------
// validateAmount
// ---------------------------------------------------------------------------

describe("validateAmount", () => {
  it("accepts a valid amount", () => {
    expect(validateAmount("5.5")).toBe(5.5);
    expect(validateAmount(1)).toBe(1);
  });

  it("accepts minimum valid amount", () => {
    expect(validateAmount(MIN_AMOUNT_XLM)).toBe(MIN_AMOUNT_XLM);
  });

  it("throws INVALID_AMOUNT for zero", () => {
    expect(() => validateAmount(0)).toThrow(TransactionValidationError);
  });

  it("throws INVALID_AMOUNT for negative", () => {
    expect(() => validateAmount(-1)).toThrow(TransactionValidationError);
  });

  it("throws INVALID_AMOUNT for NaN string", () => {
    expect(() => validateAmount("abc")).toThrow(TransactionValidationError);
  });

  it("throws INVALID_AMOUNT for more than 7 decimal places", () => {
    expect(() => validateAmount("0.00000001")).toThrow(TransactionValidationError);
    try {
      validateAmount("0.00000001");
    } catch (e) {
      expect((e as TransactionValidationError).code).toBe("INVALID_AMOUNT");
    }
  });

  it("accepts exactly 7 decimal places", () => {
    expect(() => validateAmount("0.0000001")).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// assertXdrNotTampered
// ---------------------------------------------------------------------------

describe("assertXdrNotTampered", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes when original and signed XDR have the same inner transaction", () => {
    const baseTx = fakeTx({ signatures: [] });
    // Both original and signed parse to the same unsigned form
    mockFromXDR.mockReturnValue(baseTx);
    mockToXDR.mockReturnValue("same-xdr");

    expect(() =>
      assertXdrNotTampered("original-xdr", "signed-xdr", MOCK_PASSPHRASE)
    ).not.toThrow();
  });

  it("throws TAMPERED_XDR when operation payload differs", () => {
    const toXdrOriginal = vi.fn(() => "xdr-original-raw");
    const toXdrTampered = vi.fn(() => "xdr-tampered-raw");
    const toXdrOriginalClone = vi.fn(() => "xdr-original-stripped");
    const toXdrTamperedClone = vi.fn(() => "xdr-tampered-stripped");

    // Parse calls (assertXdrNotTampered body)
    const originalTx = { ...fakeTx(), toXDR: toXdrOriginal };
    const tamperedTx = { ...fakeTx(), toXDR: toXdrTampered };
    // Clone calls (inside stripSignatures)
    const originalClone = { ...fakeTx(), signatures: [], toXDR: toXdrOriginalClone };
    const tamperedClone = { ...fakeTx(), signatures: [], toXDR: toXdrTamperedClone };

    mockFromXDR
      .mockReturnValueOnce(originalTx)      // fromXDR(originalXdr)
      .mockReturnValueOnce(tamperedTx)      // fromXDR(signedXdr)
      .mockReturnValueOnce(originalClone)   // stripSignatures: clone of original
      .mockReturnValueOnce(tamperedClone);  // stripSignatures: clone of tampered

    let thrown: unknown;
    try {
      assertXdrNotTampered("original-xdr", "signed-xdr", MOCK_PASSPHRASE);
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(TransactionValidationError);
    expect((thrown as TransactionValidationError).code).toBe("TAMPERED_XDR");
  });

  it("throws TAMPERED_XDR when XDR cannot be parsed", () => {
    mockFromXDR.mockImplementation(() => {
      throw new Error("invalid XDR");
    });

    let thrown: unknown;
    try {
      assertXdrNotTampered("bad-xdr", "bad-signed", MOCK_PASSPHRASE);
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(TransactionValidationError);
    expect((thrown as TransactionValidationError).code).toBe("TAMPERED_XDR");
  });
});

// ---------------------------------------------------------------------------
// buildTransactionSummary
// ---------------------------------------------------------------------------

describe("buildTransactionSummary", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns a payment summary for a payment transaction", () => {
    mockFromXDR.mockReturnValue(
      fakeTx({
        fee: "100",
        source: "GSOURCE",
        networkPassphrase: MOCK_PASSPHRASE,
        operations: [
          {
            type: "payment",
            destination: "GDEST",
            amount: "5.0000000",
            asset: { code: "XLM", isNative: () => true },
          },
        ],
      })
    );

    const summary = buildTransactionSummary("some-xdr", MOCK_PASSPHRASE);
    expect(summary.type).toBe("payment");
    expect(summary.networkName).toBe("TESTNET");
    expect(summary.operations).toHaveLength(1);
    expect(summary.operations[0].type).toBe("payment");
  });

  it("identifies TESTNET by passphrase", () => {
    mockFromXDR.mockReturnValue(
      fakeTx({ networkPassphrase: NETWORKS.TESTNET.passphrase, operations: [] })
    );
    const summary = buildTransactionSummary("xdr", NETWORKS.TESTNET.passphrase);
    expect(summary.networkName).toBe("TESTNET");
  });

  it("identifies MAINNET by passphrase", () => {
    mockFromXDR.mockReturnValue(
      fakeTx({ networkPassphrase: NETWORKS.MAINNET.passphrase, operations: [] })
    );
    const summary = buildTransactionSummary("xdr", NETWORKS.MAINNET.passphrase);
    expect(summary.networkName).toBe("MAINNET");
  });
});
