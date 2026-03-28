"use client";

import { useEffect, useState, useCallback } from "react";
import { ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";

const HORIZON = "https://horizon-testnet.stellar.org";
const PAGE_SIZE = 10;

interface Payment {
  id: string;
  created_at: string;
  from: string;
  amount: string;
  transaction_hash: string;
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

function truncate(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function TransactionHistory({
  walletAddress,
  marketContractId,
}: {
  walletAddress: string;
  marketContractId?: string;
}) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = new URL(`${HORIZON}/accounts/${walletAddress}/payments`);
      url.searchParams.set("limit", "200");
      url.searchParams.set("order", "desc");

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Failed to fetch transactions");

      const json = await res.json();
      const records: HorizonPayment[] = json._embedded?.records ?? [];

      const filtered = records.filter(
        (r) =>
          r.type === "payment" &&
          r.asset_type === "native" &&
          r.from !== walletAddress &&
          (marketContractId ? r.from === marketContractId : true)
      );

      setTotal(filtered.length);
      const start = (page - 1) * PAGE_SIZE;
      setPayments(filtered.slice(start, start + PAGE_SIZE));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [walletAddress, marketContractId, page]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mt-8 border-t pt-6">
      <h2 className="text-sm font-semibold text-gray-700 mb-4">Tip History</h2>

      {loading && (
        <p className="text-sm text-gray-400 animate-pulse">Loading transactions…</p>
      )}

      {error && (
        <p className="text-sm text-red-500">Error: {error}</p>
      )}

      {!loading && !error && payments.length === 0 && (
        <p className="text-sm text-gray-400 italic">No transactions yet.</p>
      )}

      {!loading && !error && payments.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="text-xs text-gray-400 border-b">
                  <th className="pb-2 pr-4 font-medium">Date</th>
                  <th className="pb-2 pr-4 font-medium">From</th>
                  <th className="pb-2 pr-4 font-medium">Amount</th>
                  <th className="pb-2 font-medium">Tx</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="py-2 pr-4 text-gray-500 whitespace-nowrap">
                      {new Date(p.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-2 pr-4 font-mono text-gray-600">
                      {truncate(p.from)}
                    </td>
                    <td className="py-2 pr-4 text-gray-800 font-medium">
                      {parseFloat(p.amount).toFixed(2)} XLM
                    </td>
                    <td className="py-2">
                      <a
                        href={`https://stellar.expert/explorer/testnet/tx/${p.transaction_hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-blue-500 hover:text-blue-700 transition-colors"
                        aria-label="View on Stellar Expert"
                      >
                        <ExternalLink size={13} />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
              <span>
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Previous page"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Next page"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
