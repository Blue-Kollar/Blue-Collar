"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const HORIZON = "https://horizon-testnet.stellar.org";
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
  /** When set, only payments originating from this contract are kept. */
  marketContractId?: string;
  pageSize?: number;
}

export interface UseTransactionListResult {
  /** The current page of transactions. */
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
  };
}

/**
 * Loads native incoming payments for an account from Horizon.
 *
 * Horizon is queried once per account (and per market contract); paging is
 * then applied to the cached result, so moving between pages no longer
 * re-downloads the whole record set.
 */
export function useTransactionList({
  walletAddress,
  marketContractId,
  pageSize = DEFAULT_PAGE_SIZE,
}: UseTransactionListOptions): UseTransactionListResult {
  const [allTransactions, setAllTransactions] = useState<TransactionListItem[]>([]);
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

      const incoming = records.filter(
        (r) =>
          r.type === "payment" &&
          r.asset_type === "native" &&
          r.from !== walletAddress &&
          (marketContractId ? r.from === marketContractId : true)
      );

      setAllTransactions(incoming.map(toTransaction));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setAllTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [walletAddress, marketContractId]);

  useEffect(() => {
    // A different account is a different list; start from the first page.
    setPage(1);
    void fetchTransactions();
  }, [fetchTransactions]);

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
