"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import LoadingState from "@/components/LoadingState";
import ErrorState from "@/components/ErrorState";
import { formatStellarAddress, truncate } from "@/lib/utils";
import { formatNumber } from "@/lib/format";
import { useTransactionHistory } from "@/hooks/useTransactionHistory";
import type { HistoryItem } from "@/hooks/useTransactionHistory";

import { MARKET_CONTRACT_ID, EXPLORER_NETWORK_SLUG, EXPLORER_TX_BASE } from "@/config/stellar";

const EXPLORER_NETWORK = EXPLORER_NETWORK_SLUG;

function formatAmount(amount: string) {
  const parsed = Number(amount);
  return Number.isFinite(parsed) ? formatNumber(parsed, { maximumFractionDigits: 7 }) : amount;
}

const TransactionRow = memo(function TransactionRow({ item }: { item: HistoryItem }) {
  const t = useTranslations("componentText");
  return (
    <tr className="border-b last:border-0">
      <td className="whitespace-nowrap px-6 py-4 text-gray-600">
        {new Date(item.date).toLocaleString()}
      </td>
      <td className="px-6 py-4 font-mono text-gray-700">{truncate(item.recipient, 12)}</td>
      <td className="whitespace-nowrap px-6 py-4 font-medium text-gray-900">
        {formatAmount(item.amount)} XLM
      </td>
      <td className="px-6 py-4">
        <a
          href={`${EXPLORER_TX_BASE}/${item.hash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700"
        >
          {t("view")} <ExternalLink size={14} />
        </a>
      </td>
    </tr>
  );
});

export default function TransactionHistory({ publicKey }: { publicKey: string }) {
  const [cursor, setCursor] = useState<string | null>(null);
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([]);
  const history = useTransactionHistory(publicKey, cursor);
  const items = history.data?.items ?? [];
  const nextCursor = history.data?.nextCursor ?? null;
  const loading = history.isLoading;
  const error = history.error?.message ?? null;
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPage = useCallback(
    async (pageCursor: string | null) => {
      setLoading(true);
      setError(null);

      try {
        const url = new URL(`${HORIZON_URL}/accounts/${publicKey}/payments`);
        url.searchParams.set("order", "desc");
        url.searchParams.set("limit", String(DEFAULT_LIMIT + 1));
        if (pageCursor) url.searchParams.set("cursor", pageCursor);

        const res = await fetch(url.toString());
        if (!res.ok) throw new Error(t("unableToLoadTransactionHistory"));

        const json = await res.json();
        const records = (json._embedded?.records ?? []) as HorizonPayment[];
        const payments = records.filter((record) => isMarketPayment(record, publicKey));
        const visible = payments.slice(0, DEFAULT_LIMIT);

        setItems(
          visible.map((record) => ({
            id: record.id,
            cursor: record.paging_token,
            amount: record.amount ?? "0",
            recipient: record.to ?? "",
            date: record.created_at,
            hash: record.transaction_hash,
          }))
        );
        setNextCursor(payments.length > DEFAULT_LIMIT ? visible.at(-1)?.paging_token ?? null : null);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("genericError"));
      } finally {
        setLoading(false);
      }
    },
    [publicKey, t]
  );

  useEffect(() => {
    setCursor(null);
    setCursorStack([]);
  }, [publicKey]);

  const totalTipsSent = useMemo(
    () => items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0),
    [items]
  );

  const goNext = useCallback(() => {
    if (!nextCursor) return;
    setCursorStack((stack) => [...stack, cursor]);
    setCursor(nextCursor);
  }, [nextCursor, cursor]);

  const goPrevious = useCallback(() => {
    setCursorStack((stack) => {
      const previous = stack.at(-1) ?? null;
      setCursor(previous);
      return stack.slice(0, -1);
    });
  }, []);

  const refresh = useCallback(() => {
    void history.refetch();
  }, [history.refetch]);

  return (
    <section className="rounded-xl border bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{t("onChainActivity")}</h2>
          <p className="mt-1 font-mono text-xs text-gray-500">{formatStellarAddress(publicKey, { prefixLength: 6, suffixLength: 6 })}</p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
          {loading ? <Loader2 size={15} className="mr-2 animate-spin" /> : <RefreshCw size={15} className="mr-2" />}
          {t("refresh")}
        </Button>
      </div>

      <div className="grid gap-4 border-b p-6 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium uppercase text-gray-400">{t("totalTipsSentPage")}</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">
            {formatAmount(String(totalTipsSent))} XLM
          </p>
        </div>
        <div className="sm:text-right">
          <p className="text-xs font-medium uppercase text-gray-400">{t("marketContract")}</p>
          <p className="mt-1 font-mono text-sm text-gray-600">
            {MARKET_CONTRACT_ID ? formatStellarAddress(MARKET_CONTRACT_ID, { prefixLength: 6, suffixLength: 6 }) : t("notConfigured")}
          </p>
        </div>
      </div>

      {error && <ErrorState variant="inline" message={error} className="m-6" />}

      {loading && !error ? (
        <LoadingState variant="inline" message={t("loadingTransactions")} className="justify-center p-10" />
      ) : null}

      {!loading && !error && items.length === 0 ? (
        <div className="p-10 text-center">
          <p className="font-medium text-gray-700">{t("noMarketPayments")}</p>
          <p className="mt-1 text-sm text-gray-500">
            {t("settledPayments")}
          </p>
        </div>
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-xs font-semibold uppercase text-gray-500">
                <th className="px-6 py-3">{t("date")}</th>
                <th className="px-6 py-3">{t("recipientWorker")}</th>
                <th className="px-6 py-3">{t("amount")}</th>
                <th className="px-6 py-3">{t("explorer")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b last:border-0">
                  <td className="whitespace-nowrap px-6 py-4 text-gray-600">
                    {new Date(item.date).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 font-mono text-gray-700">{formatStellarAddress(item.recipient, { prefixLength: 6, suffixLength: 6 })}</td>
                  <td className="whitespace-nowrap px-6 py-4 font-medium text-gray-900">
                    {formatAmount(item.amount)} XLM
                  </td>
                  <td className="px-6 py-4">
                    <a
                      href={`${EXPLORER_TX_BASE}/${item.hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700"
                    >
                      {t("view")} <ExternalLink size={14} />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="flex items-center justify-between border-t p-4">
        <Button variant="outline" size="sm" onClick={goPrevious} disabled={loading || cursorStack.length === 0}>
          <ChevronLeft size={16} className="mr-1" />
          {t("previous")}
        </Button>
        <Button variant="outline" size="sm" onClick={goNext} disabled={loading || !nextCursor}>
          {t("next")}
          <ChevronRight size={16} className="ml-1" />
        </Button>
      </div>
    </section>
  );
}
