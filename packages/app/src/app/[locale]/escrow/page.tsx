"use client";

import { useState } from "react";
import { useWallet } from "@/hooks/useWallet";
import EscrowForm from "@/features/payments/components/EscrowForm";
import { Escrow } from "@/features/payments/components/EscrowStatus";
import { createEscrow, updateEscrowStatus } from "@/lib/apiClient";
import EscrowConnectPrompt from "@/components/escrow/EscrowConnectPrompt";
import EscrowList from "@/components/escrow/EscrowList";

export default function EscrowPage() {
  const { isConnected, isConnecting, connect } = useWallet();
  const [escrows, setEscrows] = useState<Escrow[]>([]);
  const [creating, setCreating] = useState(false);

  async function handleCreate(data: { amount: string; token: string; counterparty: string; terms: string }) {
    setCreating(true);
    try {
      const escrow = await createEscrow(data);
      setEscrows((prev) => [escrow, ...prev]);
    } finally {
      setCreating(false);
    }
  }

  async function updateStatus(id: string, status: Escrow["status"]) {
    const updated = await updateEscrowStatus(id, status);
    setEscrows((prev) => prev.map((e) => (e.id === id ? { ...e, ...updated } : e)));
  }

  if (!isConnected) {
    return <EscrowConnectPrompt isConnecting={isConnecting} onConnect={connect} />;
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

      <EscrowList
        escrows={escrows}
        onRelease={(id) => updateStatus(id, "released")}
        onDispute={(id) => updateStatus(id, "disputed")}
      />
    </div>
  );
}
