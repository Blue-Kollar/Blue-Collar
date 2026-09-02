"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { HORIZON_URL } from "@/config/stellar";

import { useTransactionFilters } from "./useTransactionFilters";
import { useTransactionPolling } from "./useTransactionPolling";

const HORIZON = HORIZON_URL;
const DEFAULT_PAGE_SIZE = 10;

/** Horizon caps a payments page at 200 records. */
const FETCH_LIMIT = 200;

/** A single incoming payment, normalised out of Horizon's snake_case shape. */
export interface TransactionListItem {
  id: string;
  createdAt: string;
  from: string;
  amount: string;
  transactionHash: string;
  /** Raw asset type returned by Horizon (e.g. "native"). */
  assetType: string;
}

interface HorizonPayment {
  id: string;
  type: string;
  created_at: string;
  from: string;
  amount: string;
  transaction_hash: string;
  asset_type: string;
}

export interface UseTransactionListOptions {
  /** Account whose incoming payments to list. */
  walletAddress: string;
  /**
   * When set, only payments originating from this contract are kept.
   * @deprecated Prefer `filterOptions.fromAddress` via the returned
   *   `setFilterOptions` for runtime-adjustable filters.
   */
  marketContractId?: string;
  pageSize?: number;
  /** Poll for new transactions every N milliseconds. Defaults to 0 (no polling). */
  pollingIntervalMs?: number;
}

export interface UseTransactionListResult {
  /** The current page of (filtered) transactions. */
  transactions: TransactionListItem[];
  page: number;
  setPage: (page: number) => void;
  totalPages: number;
  /** Total matching transactions across all pages. */
  total: number;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

function toTransaction(record: HorizonPayment): TransactionListItem {
  return {
    id: record.id,
    createdAt: record.created_at,
    from: record.from,
    amount: record.amount,
    transactionHash: record.transaction_hash,
    assetType: record.asset_type,
  };
}

/**
 * Loads native incoming payments for an account from Horizon.
 *
 * Composes {@link useTransactionFilters} for client-side filtering and
 * {@link useTransactionPolling} for optional background refresh.
 *
 * Horizon is queried once per account (and per market contract); paging is
 * then applied to the cached result, so moving between pages no longer
 * re-downloads the whole record set.
 */
export function useTransactionList({
  walletAddress,
  marketContractId,
  pageSize = DEFAULT_PAGE_SIZE,
  pollingIntervalMs = 0,
}: UseTransactionListOptions): UseTransactionListResult {
  const [rawTransactions, setRawTransactions] = useState<TransactionListItem[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = new URL(`${HORIZON}/accounts/${walletAddress}/payments`);
      url.searchParams.set("limit", String(FETCH_LIMIT));
      url.searchParams.set("order", "desc");

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Failed to fetch transactions");

      const json = await res.json();
      const records: HorizonPayment[] = json._embedded?.records ?? [];

      // Keep only incoming payments; marketContractId is the legacy filter.
      const incoming = records.filter(
        (r) =>
          r.type === "payment" &&
          r.from !== walletAddress &&
          (marketContractId ? r.from === marketContractId : true),
      );

      setRawTransactions(incoming.map(toTransaction));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setRawTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [walletAddress, marketContractId]);

  // Initial load and re-fetch whenever the account changes.
  useEffect(() => {
    setPage(1);
    void fetchTransactions();
  }, [fetchTransactions]);

  // Optional background polling — delegated to useTransactionPolling.
  useTransactionPolling(fetchTransactions, {
    intervalMs: pollingIntervalMs,
    enabled: pollingIntervalMs > 0,
  });

  // Client-side asset-type filtering — delegated to useTransactionFilters.
  const getFrom = useCallback((item: TransactionListItem) => item.from, []);
  const getAssetType = useCallback((item: TransactionListItem) => item.assetType, []);
  const { filtered: allTransactions } = useTransactionFilters(
    rawTransactions,
    getFrom,
    getAssetType,
  );

  const total = allTransactions.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Guard against a stale page index if the result set shrank under us.
  const safePage = Math.min(page, totalPages);

  const transactions = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return allTransactions.slice(start, start + pageSize);
  }, [allTransactions, safePage, pageSize]);

  return {
    transactions,
    page: safePage,
    setPage,
    totalPages,
    total,
    loading,
    error,
    refetch: fetchTransactions,
  };
}
