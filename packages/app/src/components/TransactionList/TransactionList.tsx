"use client";

import EmptyState from "@/components/EmptyState";
import { useTransactionList } from "@/hooks/useTransactionList";
import TransactionListPagination from "./TransactionListPagination";
import TransactionListTable from "./TransactionListTable";

interface TransactionListProps {
  walletAddress: string;
  marketContractId?: string;
}

/**
 * Container: owns data-fetching (via useTransactionList) and picks which
 * presentational state to render. All markup lives in the child components.
 */
export default function TransactionList({
  walletAddress,
  marketContractId,
}: TransactionListProps) {
  const { transactions, page, setPage, totalPages, loading, error } = useTransactionList({
    walletAddress,
    marketContractId,
  });

  return (
    <div className="mt-8 border-t pt-6">
      <h2 className="text-sm font-semibold text-gray-700 mb-4">Tip History</h2>

      {loading && (
        <p className="text-sm text-gray-400 animate-pulse">Loading transactions…</p>
      )}

      {error && <p className="text-sm text-red-500">Error: {error}</p>}

      {!loading && !error && transactions.length === 0 && (
        <EmptyState variant="no-transactions" ctaHref="/workers" />
      )}

      {!loading && !error && transactions.length > 0 && (
        <>
          <TransactionListTable transactions={transactions} />
          <TransactionListPagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
