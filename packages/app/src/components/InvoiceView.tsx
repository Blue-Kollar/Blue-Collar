"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { Download, ExternalLink, FileText } from "lucide-react";
import { getInvoice } from "@/lib/api/payments";
import { formatErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";
import ErrorState from "@/components/ErrorState";
import type { Invoice, InvoiceStatus } from "@/types";

const STELLAR_EXPLORER = "https://stellar.expert/explorer/testnet/tx";

const STATUS_STYLES: Record<InvoiceStatus, string> = {
  draft: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
  issued: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  paid: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  overdue: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  void: "bg-gray-100 text-gray-400 line-through dark:bg-gray-800 dark:text-gray-500",
};

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Draft",
  issued: "Issued",
  paid: "Paid",
  overdue: "Overdue",
  void: "Void",
};

export interface InvoiceViewProps {
  /** Invoice to display. Fetched on mount unless `invoice` is supplied. */
  invoiceId: string;
  /** Pre-fetched invoice — skips the request entirely (server-rendered pages). */
  invoice?: Invoice;
  /** Shows the download action when provided. */
  onDownload?: (invoice: Invoice) => void;
  className?: string;
}

/** Sum of every line item, before the platform fee. */
export function calculateSubtotal(lineItems: Invoice["lineItems"]): number {
  return lineItems.reduce((sum, item) => sum + item.quantity * item.unitAmount, 0);
}

/**
 * Format an amount for display. Stellar amounts carry up to 7 decimal places,
 * but trailing zeros beyond 2 are noise, so we show at least 2 and at most 7.
 */
export function formatAmount(amount: number, currency: string): string {
  const formatted = amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 7,
  });
  return `${formatted} ${currency}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Renders a single invoice: parties, line items, totals and payment status.
 *
 * Fetches by `invoiceId` on mount, unless a pre-fetched `invoice` is passed.
 */
export default function InvoiceView({
  invoiceId,
  invoice: initialInvoice,
  onDownload,
  className,
}: InvoiceViewProps) {
  const [invoice, setInvoice] = useState<Invoice | null>(initialInvoice ?? null);
  const [loading, setLoading] = useState(!initialInvoice);
  const [error, setError] = useState<string | null>(null);

  const headingId = useId();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getInvoice(invoiceId);
      setInvoice(res.data);
    } catch (err) {
      setError(formatErrorMessage(err, "We couldn't load this invoice."));
      setInvoice(null);
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => {
    // A caller-supplied invoice is authoritative; don't refetch over it.
    if (initialInvoice) {
      setInvoice(initialInvoice);
      setLoading(false);
      return;
    }
    void load();
  }, [initialInvoice, load]);

  if (loading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className={cn("rounded-xl border p-6 dark:border-gray-800", className)}
      >
        <span className="sr-only">Loading invoice…</span>
        <div aria-hidden="true" className="animate-pulse space-y-3">
          <div className="h-5 w-40 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-3 w-28 rounded bg-gray-100 dark:bg-gray-800" />
          <div className="h-24 rounded bg-gray-100 dark:bg-gray-800" />
        </div>
      </div>
    );
  }

  if (error) {
    return <ErrorState message={error} onRetry={() => void load()} className={className} />;
  }

  // Nothing to render and nothing failed — treat as not found rather than
  // rendering an empty shell.
  if (!invoice) {
    return (
      <div
        className={cn(
          "flex flex-col items-center gap-2 rounded-xl border p-8 text-center dark:border-gray-800",
          className,
        )}
      >
        <FileText size={32} className="text-gray-300" aria-hidden="true" />
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Invoice not found</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          This invoice may have been removed or you may not have access to it.
        </p>
      </div>
    );
  }

  const { lineItems, currency, platformFee, status } = invoice;
  const subtotal = calculateSubtotal(lineItems);
  const total = subtotal + platformFee;
  const hasLineItems = lineItems.length > 0;

  return (
    <section
      aria-labelledby={headingId}
      className={cn("rounded-xl border p-6 dark:border-gray-800", className)}
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b pb-4 dark:border-gray-800">
        <div>
          <h2 id={headingId} className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Invoice {invoice.number}
          </h2>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Issued <time dateTime={invoice.issuedAt}>{formatDate(invoice.issuedAt)}</time>
            {invoice.dueAt && (
              <>
                {" · Due "}
                <time dateTime={invoice.dueAt}>{formatDate(invoice.dueAt)}</time>
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide",
              STATUS_STYLES[status],
            )}
          >
            {STATUS_LABELS[status]}
          </span>
          {onDownload && (
            <button
              type="button"
              onClick={() => onDownload(invoice)}
              className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <Download size={13} aria-hidden="true" />
              Download
            </button>
          )}
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-4 py-4 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-wide text-gray-400">From</dt>
          <dd className="mt-0.5 font-medium text-gray-800 dark:text-gray-200">
            {invoice.worker.name}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-gray-400">Billed to</dt>
          <dd className="mt-0.5 font-medium text-gray-800 dark:text-gray-200">
            {invoice.client.name}
          </dd>
        </div>
      </dl>

      {hasLineItems ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Line items for invoice {invoice.number}</caption>
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-gray-400 dark:border-gray-800">
                <th scope="col" className="py-2 font-medium">
                  Description
                </th>
                <th scope="col" className="py-2 text-right font-medium">
                  Qty
                </th>
                <th scope="col" className="py-2 text-right font-medium">
                  Unit price
                </th>
                <th scope="col" className="py-2 text-right font-medium">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item) => (
                <tr key={item.id} className="border-b last:border-0 dark:border-gray-800">
                  <td className="py-2.5 text-gray-700 dark:text-gray-300">{item.description}</td>
                  <td className="py-2.5 text-right tabular-nums text-gray-500">{item.quantity}</td>
                  <td className="py-2.5 text-right tabular-nums text-gray-500">
                    {formatAmount(item.unitAmount, currency)}
                  </td>
                  <td className="py-2.5 text-right tabular-nums font-medium text-gray-800 dark:text-gray-200">
                    {formatAmount(item.quantity * item.unitAmount, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-lg bg-gray-50 py-6 text-center text-sm text-gray-500 dark:bg-gray-900 dark:text-gray-400">
          This invoice has no line items yet.
        </p>
      )}

      <dl className="mt-4 space-y-1.5 border-t pt-4 text-sm dark:border-gray-800">
        <div className="flex justify-between">
          <dt className="text-gray-500 dark:text-gray-400">Subtotal</dt>
          <dd className="tabular-nums text-gray-700 dark:text-gray-300">
            {formatAmount(subtotal, currency)}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-500 dark:text-gray-400">Platform fee</dt>
          <dd className="tabular-nums text-gray-700 dark:text-gray-300">
            {formatAmount(platformFee, currency)}
          </dd>
        </div>
        <div className="flex justify-between border-t pt-2 text-base font-semibold dark:border-gray-800">
          <dt className="text-gray-900 dark:text-gray-100">Total</dt>
          <dd className="tabular-nums text-gray-900 dark:text-gray-100">
            {formatAmount(total, currency)}
          </dd>
        </div>
      </dl>

      {invoice.notes && (
        <p className="mt-4 rounded-lg bg-gray-50 p-3 text-sm text-gray-600 dark:bg-gray-900 dark:text-gray-400">
          {invoice.notes}
        </p>
      )}

      {invoice.transactionHash && (
        <a
          href={`${STELLAR_EXPLORER}/${invoice.transactionHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-1.5 rounded text-xs font-medium text-blue-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-blue-400"
        >
          View transaction on Stellar
          <ExternalLink size={12} aria-hidden="true" />
        </a>
      )}
    </section>
  );
}
