"use client";

import TransactionHistory from "@/components/wallet/TransactionHistory";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/hooks/useWallet";

export default function WalletHistoryPage() {
  const { publicKey, isConnecting, connect } = useWallet();

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Transaction History</h1>
        <p className="mt-1 text-sm text-gray-500">
          Tips and payments sent through the Market contract.
        </p>
      </div>

      {!publicKey ? (
        <div className="rounded-xl border bg-white p-8 text-center shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Connect your wallet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">
            Connect Freighter to view your on-chain tip and payment history.
          </p>
          <Button className="mt-5" onClick={connect} disabled={isConnecting}>
            {isConnecting ? "Connecting..." : "Connect Wallet"}
          </Button>
        </div>
      ) : (
        <TransactionHistory publicKey={publicKey} />
      )}
    </main>
  );
}
