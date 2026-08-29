"use client";

/**
 * TransactionConfirmDialog — shows users a human-readable summary of what
 * they are about to sign before the Freighter prompt appears.
 *
 * Closes #823
 * Accessibility pass: #972
 */

import * as Dialog from "@radix-ui/react-dialog";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TransactionSummary } from "@/lib/transactions";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900";

interface TransactionConfirmDialogProps {
  open: boolean;
  summary: TransactionSummary | null;
  onConfirm: () => void;
  onCancel: () => void;
  /** Optional: show a warning when the network is unexpected */
  networkWarning?: boolean;
}

export default function TransactionConfirmDialog({
  open,
  summary,
  onConfirm,
  onCancel,
  networkWarning = false,
}: TransactionConfirmDialogProps) {
  const blocked = !summary || networkWarning;

  // Point the (disabled) confirm button at whichever element explains why it
  // cannot be used, so the reason is not conveyed by visual state alone.
  const confirmDescribedBy = networkWarning
    ? "tx-network-warning"
    : !summary
      ? "tx-loading-status"
      : undefined;

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby="tx-confirm-desc"
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white dark:bg-gray-900 p-6 shadow-2xl"
        >
          <div className="flex items-start justify-between mb-4">
            <Dialog.Title className="text-lg font-bold text-gray-900 dark:text-white">
              Confirm Transaction
            </Dialog.Title>
            <Dialog.Close
              aria-label="Close transaction details"
              onClick={onCancel}
              className={cn(
                "rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors",
                FOCUS_RING,
              )}
            >
              <X size={18} aria-hidden="true" />
            </Dialog.Close>
          </div>

          <Dialog.Description id="tx-confirm-desc" className="sr-only">
            Review the transaction details below before signing with your wallet.
          </Dialog.Description>

          {networkWarning && (
            <div
              id="tx-network-warning"
              role="alert"
              className="mb-4 flex items-start gap-2 rounded-lg bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-300 dark:border-yellow-700 p-3 text-sm text-yellow-800 dark:text-yellow-300"
            >
              <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>
                Your wallet is connected to a <strong>different network</strong> than
                this app expects. Signing may fail or funds may be lost.
              </span>
            </div>
          )}

          {summary ? (
            <>
              <dl className="grid grid-cols-[auto_1fr] items-start gap-x-4 gap-y-3 text-sm">
                {/* Network badge */}
                <dt className="text-gray-600 dark:text-gray-400">Network</dt>
                <dd className="text-right">
                  <span
                    className={cn(
                      "inline-block rounded px-2 py-0.5 text-xs font-semibold",
                      summary.networkName === "MAINNET"
                        ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400"
                        : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
                    )}
                  >
                    {summary.networkName}
                  </span>
                </dd>

                {summary.type === "payment" && (
                  <>
                    <dt className="text-gray-600 dark:text-gray-400">To</dt>
                    <dd className="text-right">
                      <span
                        className="font-mono text-xs break-all text-gray-700 dark:text-gray-300"
                        data-testid="tx-destination"
                      >
                        {summary.to}
                      </span>
                    </dd>

                    <dt className="text-gray-600 dark:text-gray-400">Amount</dt>
                    <dd className="text-right">
                      <span
                        className="font-semibold text-gray-900 dark:text-white"
                        data-testid="tx-amount"
                      >
                        {summary.amountDisplay}
                      </span>
                    </dd>
                  </>
                )}

                {summary.type === "contract_call" && (
                  <>
                    <dt className="text-gray-600 dark:text-gray-400">Action</dt>
                    <dd className="text-right text-gray-700 dark:text-gray-300">
                      Smart contract invocation
                    </dd>
                  </>
                )}

                <dt className="text-gray-600 dark:text-gray-400">Network fee</dt>
                <dd className="text-right text-gray-700 dark:text-gray-300">{summary.fee}</dd>
              </dl>

              {/* Full operation list */}
              <div className="mt-3 rounded-lg bg-gray-50 dark:bg-gray-800 p-3">
                <h3
                  id="tx-operations-heading"
                  className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400 mb-2"
                >
                  Operations ({summary.operations.length})
                </h3>
                <ol
                  aria-labelledby="tx-operations-heading"
                  className="list-inside list-decimal space-y-1"
                >
                  {summary.operations.map((op, i) => (
                    <li key={i} className="text-xs text-gray-700 dark:text-gray-300">
                      {op.description}
                    </li>
                  ))}
                </ol>
              </div>
            </>
          ) : (
            <p
              id="tx-loading-status"
              role="status"
              aria-live="polite"
              className="text-sm text-gray-600 dark:text-gray-400"
            >
              Loading transaction details…
            </p>
          )}

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              data-testid="cancel-btn"
              className={cn(
                "flex-1 rounded-lg border border-gray-300 dark:border-gray-700 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors",
                FOCUS_RING,
              )}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={blocked}
              aria-describedby={confirmDescribedBy}
              data-testid="confirm-sign-btn"
              className={cn(
                "flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-colors",
                FOCUS_RING,
                blocked
                  ? "bg-gray-300 dark:bg-gray-700 text-gray-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 text-white",
              )}
            >
              <CheckCircle2 size={15} aria-hidden="true" />
              Sign &amp; Submit
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
