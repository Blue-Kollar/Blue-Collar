"use client";

import { useState } from "react";

import EscrowForm from "@/components/Escrow/EscrowForm";
import EscrowStatus, { Escrow } from "@/components/Escrow/EscrowStatus";
import { useWallet } from "@/context/WalletContext";

let idCounter = 1;

function createMockEscrow(data: { amount: string; token: string; counterparty: string; terms: string }): Escrow {
  return {
    id: `escrow-${Date.now()}-${idCounter++}`,
    ...data,
    status: "pending",
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    txHash: null,
  };
}

export default function EscrowPage() {
  const { isConnected, isConnecting, connect } = useWallet();
  const [escrows, setEscrows] = useState<Escrow[]>([]);
  const [creating, setCreating] = useState(false);

  function handleCreate(data: { amount: string; token: string; counterparty: string; terms: string }) {
    setCreating(true);
    setTimeout(() => {
      setEscrows((prev) => [createMockEscrow(data), ...prev]);
      setCreating(false);
    }, 500);
  }

  function updateStatus(id: string, status: Escrow["status"]) {
    setEscrows((prev) => prev.map((e) => (e.id === id ? { ...e, status } : e)));
  }

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
        <h1 className="text-2xl font-bold text-gray-900">Escrow</h1>
        <p className="text-gray-500 max-w-sm">Connect your Stellar wallet to create and manage escrow agreements.</p>
        <button
          onClick={connect}
          disabled={isConnecting}
          className="rounded-md bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isConnecting ? "Connecting…" : "Connect Wallet"}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Escrow</h1>

      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">New Escrow</h2>
        <div className="rounded-lg border border-gray-200 p-4">
          <EscrowForm onSubmit={handleCreate} disabled={creating} />
        </div>
      </section>

      {escrows.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Your Escrows ({escrows.length})
          </h2>
          <div className="space-y-3">
            {escrows.map((escrow) => (
              <EscrowStatus
                key={escrow.id}
                escrow={escrow}
                onRelease={() => updateStatus(escrow.id, "released")}
                onDispute={() => updateStatus(escrow.id, "disputed")}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
