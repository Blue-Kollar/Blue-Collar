/**
 * transactions.ts — wallet & transaction signing safety helpers
 * Closes #823
 *
 * Responsibilities:
 *  - Validate the target network matches the expected passphrase
 *  - Validate the destination contract/wallet before signing
 *  - Guard against decimal/amount mistakes (7 decimal places max for Stellar)
 *  - Build human-readable transaction summaries shown to users before signing
 *  - Detect tampered XDR (re-parse and compare) before submitting
 */

import * as StellarSdk from "@stellar/stellar-sdk";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const NETWORKS = {
  TESTNET: {
    passphrase: "Test SDF Network ; September 2015",
    horizonUrl: "https://horizon-testnet.stellar.org",
    sorobanRpc: "https://soroban-testnet.stellar.org",
    explorer: "https://stellar.expert/explorer/testnet/tx",
  },
  MAINNET: {
    passphrase: "Public Global Stellar Network ; September 2015",
    horizonUrl: "https://horizon.stellar.org",
    sorobanRpc: "https://soroban-mainnet.stellar.org",
    explorer: "https://stellar.expert/explorer/public/tx",
  },
} as const;

export type NetworkName = keyof typeof NETWORKS;

/** Stroops per XLM */
export const STROOPS_PER_XLM = 10_000_000n;
/** Maximum XLM decimal precision */
export const MAX_DECIMAL_PLACES = 7;
/** Minimum non-dust amount in XLM */
export const MIN_AMOUNT_XLM = 0.0000001;

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class TransactionValidationError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "WRONG_NETWORK"
      | "INVALID_DESTINATION"
      | "INVALID_AMOUNT"
      | "TAMPERED_XDR"
      | "INVALID_CONTRACT"
  ) {
    super(message);
    this.name = "TransactionValidationError";
  }
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/**
 * Validate that the supplied Freighter network string matches the expected
 * network for this deployment.  Throws if mismatched.
 */
export function validateNetwork(
  freighterNetwork: string | null | undefined,
  expected: NetworkName
): void {
  const normalised = freighterNetwork?.toUpperCase().trim();
  if (normalised !== expected) {
    throw new TransactionValidationError(
      `Wrong network. Wallet is on "${freighterNetwork ?? "unknown"}" but this app requires "${expected}". Switch your Freighter wallet to ${expected} and try again.`,
      "WRONG_NETWORK"
    );
  }
}

/**
 * Validate a Stellar public key (G…) or contract address.
 * Throws for invalid or obviously spoofed addresses.
 */
export function validateDestination(address: string): void {
  if (!address || typeof address !== "string") {
    throw new TransactionValidationError(
      "Destination address is missing.",
      "INVALID_DESTINATION"
    );
  }
  try {
    StellarSdk.StrKey.decodeEd25519PublicKey(address);
  } catch {
    // Also accept Soroban contract IDs (C…)
    try {
      StellarSdk.StrKey.decodeContract(address);
    } catch {
      throw new TransactionValidationError(
        `Invalid destination address: "${address.slice(0, 10)}…"`,
        "INVALID_DESTINATION"
      );
    }
  }
}

/**
 * Validate a contract address against an allowlist of known contracts.
 * Throws if the address is not in the list.
 */
export function validateContractId(
  contractId: string,
  allowedContractIds: string[]
): void {
  if (!allowedContractIds.includes(contractId)) {
    throw new TransactionValidationError(
      `Contract "${contractId.slice(0, 10)}…" is not a recognised BlueCollar contract. Refusing to sign.`,
      "INVALID_CONTRACT"
    );
  }
}

/**
 * Validate a payment amount:
 *  - Must be a finite positive number
 *  - Must not exceed 7 decimal places (Stellar precision)
 *  - Must be at least MIN_AMOUNT_XLM
 */
export function validateAmount(amount: string | number): number {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;

  if (!isFinite(n) || isNaN(n)) {
    throw new TransactionValidationError(
      "Amount must be a valid number.",
      "INVALID_AMOUNT"
    );
  }
  if (n < MIN_AMOUNT_XLM) {
    throw new TransactionValidationError(
      `Amount must be at least ${MIN_AMOUNT_XLM} XLM.`,
      "INVALID_AMOUNT"
    );
  }

  // Enforce 7-decimal precision by checking the string representation
  const str = typeof amount === "string" ? amount : amount.toString();
  const decimalPart = str.split(".")[1] ?? "";
  if (decimalPart.length > MAX_DECIMAL_PLACES) {
    throw new TransactionValidationError(
      `Amount has more than ${MAX_DECIMAL_PLACES} decimal places. Stellar supports a maximum of ${MAX_DECIMAL_PLACES} decimal places.`,
      "INVALID_AMOUNT"
    );
  }

  return n;
}

// ---------------------------------------------------------------------------
// Transaction summary (human-readable)
// ---------------------------------------------------------------------------

export interface TransactionSummary {
  type: "payment" | "contract_call" | "unknown";
  from: string;
  to: string;
  /** Display amount (e.g. "5.0000000 XLM") */
  amountDisplay: string;
  networkName: string;
  networkPassphrase: string;
  fee: string;
  /** Full list of operations for display */
  operations: OperationSummary[];
}

export interface OperationSummary {
  type: string;
  description: string;
}

/**
 * Parse an XDR envelope and return a human-readable summary.
 * Used to display "what you're signing" before calling signTransaction.
 */
export function buildTransactionSummary(
  xdr: string,
  networkPassphrase: string
): TransactionSummary {
  const tx = StellarSdk.TransactionBuilder.fromXDR(xdr, networkPassphrase);
  const ops = tx.operations;

  const networkName =
    networkPassphrase === NETWORKS.TESTNET.passphrase
      ? "TESTNET"
      : networkPassphrase === NETWORKS.MAINNET.passphrase
        ? "MAINNET"
        : "UNKNOWN";

  const operationSummaries: OperationSummary[] = ops.map((op) => {
    switch (op.type) {
      case "payment": {
        const p = op as StellarSdk.Operation.Payment;
        return {
          type: "payment",
          description: `Pay ${p.amount} ${p.asset.code ?? "XLM"} to ${p.destination}`,
        };
      }
      case "invokeHostFunction":
        return {
          type: "contract_call",
          description: "Invoke smart contract function",
        };
      default:
        return { type: op.type, description: `Operation: ${op.type}` };
    }
  });

  // Extract primary payment details for the summary card
  const primaryOp = ops[0];
  let type: TransactionSummary["type"] = "unknown";
  let to = "";
  let amountDisplay = "";

  if (primaryOp?.type === "payment") {
    const p = primaryOp as StellarSdk.Operation.Payment;
    type = "payment";
    to = p.destination;
    amountDisplay = `${p.amount} ${p.asset.code ?? "XLM"}`;
  } else if (primaryOp?.type === "invokeHostFunction") {
    type = "contract_call";
  }

  const fee = `${(Number(tx.fee) / 1e7).toFixed(7)} XLM`;

  return {
    type,
    from: (tx as StellarSdk.Transaction).source,
    to,
    amountDisplay,
    networkName,
    networkPassphrase,
    fee,
    operations: operationSummaries,
  };
}

// ---------------------------------------------------------------------------
// Tamper detection
// ---------------------------------------------------------------------------

/**
 * Verify that a signed XDR has not been tampered with between building and
 * signing: re-parse the signed envelope and compare the inner transaction
 * against the original XDR's inner transaction.
 *
 * Throws TransactionValidationError("TAMPERED_XDR") if the payloads differ.
 */
export function assertXdrNotTampered(
  originalXdr: string,
  signedXdr: string,
  networkPassphrase: string
): void {
  let original: StellarSdk.Transaction | StellarSdk.FeeBumpTransaction;
  let signed: StellarSdk.Transaction | StellarSdk.FeeBumpTransaction;

  try {
    original = StellarSdk.TransactionBuilder.fromXDR(
      originalXdr,
      networkPassphrase
    );
    signed = StellarSdk.TransactionBuilder.fromXDR(
      signedXdr,
      networkPassphrase
    );
  } catch {
    throw new TransactionValidationError(
      "Could not parse transaction XDR for tamper check.",
      "TAMPERED_XDR"
    );
  }

  // Compare serialised forms of the inner (unsigned) transaction.
  // A tampered wallet would modify operations, amounts, or destination.
  const originalUnsigned = stripSignatures(original);
  const signedUnsigned = stripSignatures(signed);

  if (originalUnsigned !== signedUnsigned) {
    throw new TransactionValidationError(
      "Transaction was modified after it was built. The signed XDR does not match the original. Refusing to submit.",
      "TAMPERED_XDR"
    );
  }
}

/** Return the XDR of a transaction without its signature decorators for comparison. */
function stripSignatures(
  tx: StellarSdk.Transaction | StellarSdk.FeeBumpTransaction
): string {
  // Clone via XDR round-trip, clear signatures, re-serialise
  const cloned = StellarSdk.TransactionBuilder.fromXDR(
    tx.toXDR(),
    tx instanceof StellarSdk.Transaction
      ? tx.networkPassphrase
      : NETWORKS.TESTNET.passphrase
  ) as StellarSdk.Transaction;
  cloned.signatures = [];
  return cloned.toXDR();
}
