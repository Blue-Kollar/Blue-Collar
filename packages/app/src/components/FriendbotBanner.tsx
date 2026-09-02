"use client";

import { X, Zap } from "lucide-react";
import { useState } from "react";

interface FriendbotBannerProps {
  walletAddress: string;
  xlmBalance: number;
}

import { FRIENDBOT_URL, IS_TESTNET } from "@/config/stellar";

export default function FriendbotBanner({ walletAddress, xlmBalance }: FriendbotBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(""), 4000);
  };

  if (!IS_TESTNET || xlmBalance > 0) return null;

  const handleFund = async () => {
    if (!walletAddress) return;

    setLoading(true);
    try {
      const res = await fetch(`${FRIENDBOT_URL}?addr=${encodeURIComponent(walletAddress)}`);
      if (!res.ok) throw new Error("Friendbot funding failed.");

      showToast("Wallet funded with 10,000 XLM testnet tokens!");
      setDismissed(true);
    } catch {
      showToast("Friendbot funding failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {!dismissed && (
        <div
          role="alert"
          aria-live="polite"
          className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-yellow-300 bg-yellow-50 px-5 py-4 text-sm text-yellow-900 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-yellow-100">
              <Zap size={18} aria-hidden="true" />
            </div>
            <div>
              <p className="font-semibold">Your testnet wallet has no XLM</p>
              <p className="text-yellow-700">
                Fund it instantly with Stellar Friendbot to start testing.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={handleFund}
              disabled={loading}
              className="rounded-lg bg-yellow-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-yellow-600 disabled:opacity-50"
            >
              {loading ? "Funding..." : "Fund with Friendbot"}
            </button>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              aria-label="Dismiss banner"
              className="rounded-md p-1 text-yellow-700 hover:bg-yellow-100"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 z-50 rounded-lg bg-gray-900 px-4 py-2 text-sm text-white shadow-lg -translate-x-1/2"
        >
          {toast}
        </div>
      )}
    </>
  );
}
