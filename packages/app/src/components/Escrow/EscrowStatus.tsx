"use client";

import { useEffect, useId, useRef } from "react";
import { Clock, CheckCircle2, AlertCircle, XCircle, Loader2 } from "lucide-react";

export interface Escrow {
  id: string;
  amount: string;
  token: string;
  counterparty: string;
  terms: string;
  status: "pending" | "funded" | "released" | "disputed" | "cancelled";
  createdAt: string;
  expiresAt?: string | null;
  txHash?: string | null;
}

interface EscrowStatusProps {
  escrow: Escrow;
  onRelease: () => void;
  onDispute: () => void;
  isLoading?: boolean;
}

const STATUS_STEPS = ["pending", "funded", "released"] as const;

const STATUS_META: Record<Escrow["status"], { label: string; color: string; Icon: React.ElementType }> = {
  pending:   { label: "Pending",   color: "text-yellow-500", Icon: Clock },
  funded:    { label: "Funded",    color: "text-blue-500",   Icon: CheckCircle2 },
  released:  { label: "Released",  color: "text-green-600",  Icon: CheckCircle2 },
  disputed:  { label: "Disputed",  color: "text-orange-500", Icon: AlertCircle },
  cancelled: { label: "Cancelled", color: "text-gray-400",   Icon: XCircle },
};

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500";

export default function EscrowStatus({ escrow, onRelease, onDispute, isLoading }: EscrowStatusProps) {
  const { label, color, Icon } = STATUS_META[escrow.status];
  const headingId = useId();
  const statusRef = useRef<HTMLParagraphElement>(null);

  // Release/Dispute unmount the action row, which would drop focus to <body>.
  // Remember that the user activated one of them so we can place focus on the
  // status line instead, keeping keyboard users inside this card.
  const restoreFocus = useRef(false);

  useEffect(() => {
    if (restoreFocus.current && escrow.status !== "funded") {
      restoreFocus.current = false;
      statusRef.current?.focus();
    }
  }, [escrow.status]);

  const handleRelease = () => {
    restoreFocus.current = true;
    onRelease();
  };

  const handleDispute = () => {
    restoreFocus.current = true;
    onDispute();
  };

  const activeStepIndex = STATUS_STEPS.indexOf(escrow.status as (typeof STATUS_STEPS)[number]);
  const showTimeline = activeStepIndex !== -1;
  const amountLabel = `${escrow.amount} ${escrow.token}`;

  return (
    <article
      aria-labelledby={headingId}
      className="rounded-lg border border-gray-200 p-4 space-y-3"
    >
      <div className="flex items-center justify-between">
        <span
          className="text-sm font-mono text-gray-500 truncate max-w-[160px]"
          title={escrow.id}
        >
          <span className="sr-only">Escrow ID: </span>
          {escrow.id}
        </span>
        {/* role="status" announces release/dispute/expiry transitions. tabIndex
            -1 makes it a focus target without adding it to the tab order. */}
        <p
          ref={statusRef}
          tabIndex={-1}
          role="status"
          className={`flex items-center gap-1 text-sm font-medium ${color} ${FOCUS_RING} rounded`}
        >
          <Icon size={14} aria-hidden="true" />
          <span className="sr-only">Status: </span>
          {label}
        </p>
      </div>

      <h3 id={headingId} className="text-lg font-semibold">
        <span className="sr-only">Escrow for </span>
        {amountLabel}
      </h3>

      <div className="text-sm text-gray-600">
        <span className="font-medium">To: </span>
        <span className="font-mono break-all">{escrow.counterparty}</span>
      </div>

      {/* line-clamp hides the overflow visually, so expose the full terms on hover/focus. */}
      <p className="text-sm text-gray-600 line-clamp-2" title={escrow.terms}>
        <span className="sr-only">Terms: </span>
        {escrow.terms}
      </p>

      {/* Timeline */}
      {showTimeline && (
        <ol aria-label="Escrow progress" className="flex items-center gap-0">
          {STATUS_STEPS.map((step, i) => {
            const { Icon: StepIcon, color: stepColor } = STATUS_META[step];
            const active = activeStepIndex >= i;
            const isCurrent = activeStepIndex === i;
            return (
              <li
                key={step}
                className="flex items-center"
                aria-current={isCurrent ? "step" : undefined}
              >
                <StepIcon size={16} className={active ? stepColor : "text-gray-300"} aria-hidden="true" />
                <span className={`text-xs mx-1 ${active ? "text-gray-700" : "text-gray-300"}`}>
                  {STATUS_META[step].label}
                </span>
                <span className="sr-only">
                  {isCurrent ? " (current step)" : active ? " (completed)" : " (not started)"}
                </span>
                {i < STATUS_STEPS.length - 1 && (
                  <span aria-hidden="true" className="w-6 h-px bg-gray-200 mx-1" />
                )}
              </li>
            );
          })}
        </ol>
      )}

      {/* Expiry */}
      {escrow.expiresAt && (
        <p className="text-xs text-gray-500 flex items-center gap-1">
          <Clock size={12} aria-hidden="true" />
          Expires {new Date(escrow.expiresAt).toLocaleString()}
        </p>
      )}

      {/* Explorer link */}
      {escrow.txHash && (
        <a
          href={`https://stellar.expert/explorer/testnet/tx/${escrow.txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className={`text-xs text-blue-600 hover:underline rounded ${FOCUS_RING}`}
        >
          View on Explorer
          <span aria-hidden="true"> ↗</span>
          <span className="sr-only"> for {amountLabel} escrow (opens in a new tab)</span>
        </a>
      )}

      {/* Actions */}
      {escrow.status === "funded" && (
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={handleRelease}
            disabled={isLoading}
            aria-busy={isLoading || undefined}
            aria-label={`Release ${amountLabel} to ${escrow.counterparty}`}
            className={`flex-1 rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-1 ${FOCUS_RING}`}
          >
            {isLoading ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : null}
            Release
          </button>
          <button
            type="button"
            onClick={handleDispute}
            disabled={isLoading}
            aria-busy={isLoading || undefined}
            aria-label={`Dispute ${amountLabel} escrow with ${escrow.counterparty}`}
            className={`flex-1 rounded-md bg-orange-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50 ${FOCUS_RING}`}
          >
            Dispute
          </button>
        </div>
      )}

      {isLoading && (
        <p className="sr-only" role="status">
          Submitting escrow action, please wait.
        </p>
      )}
    </article>
  );
}
