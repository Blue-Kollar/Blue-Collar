import { ExternalLink } from "lucide-react";
import { memo } from "react";
import type { TransactionListItem } from "@/hooks/useTransactionList";
import { formatXlmAmount, stellarExplorerTxUrl, truncateStellarAddress } from "@/utils";

interface TransactionListTableProps {
  transactions: TransactionListItem[];
}

interface TransactionRowProps {
  tx: TransactionListItem;
}

const TransactionRow = memo(function TransactionRow({ tx }: TransactionRowProps) {
  return (
    <tr className="border-b last:border-0">
      <td className="py-2 pr-4 text-gray-500 whitespace-nowrap">
        {new Date(tx.createdAt).toLocaleDateString()}
      </td>
      <td className="py-2 pr-4 font-mono text-gray-600">
        {truncateStellarAddress(tx.from)}
      </td>
      <td className="py-2 pr-4 text-gray-800 font-medium">
        {formatXlmAmount(tx.amount)} XLM
      </td>
      <td className="py-2">
        <a
          href={stellarExplorerTxUrl(tx.transactionHash)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-blue-500 hover:text-blue-700 transition-colors"
          aria-label="View on Stellar Expert"
        >
          <ExternalLink size={13} />
        </a>
      </td>
    </tr>
  );
});

const TransactionListTable = memo(function TransactionListTable({ transactions }: TransactionListTableProps) {
  return (
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
          {transactions.map((tx) => (
            <TransactionRow key={tx.id} tx={tx} />
          ))}
        </tbody>
      </table>
    </div>
  );
});

export default TransactionListTable;
