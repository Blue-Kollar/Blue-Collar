"use client";

import { useState } from "react";
import { X, Zap } from "lucide-react";
import { useTranslations } from "next-intl";

interface FriendbotBannerProps {
  walletAddress: string;
  xlmBalance: number;
}

import { IS_TESTNET } from "@/config/stellar";
import { useFriendbotFunding } from "@/hooks/useFriendbotFunding";

export default function FriendbotBanner({ walletAddress, xlmBalance }: FriendbotBannerProps) {
  const t = useTranslations("componentText");
  const [dismissed, setDismissed] = useState(false);
  const [toast, setToast] = useState("");
  const funding = useFriendbotFunding();

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(""), 4000);
  };

  if (!IS_TESTNET || xlmBalance > 0) return null;

  const handleFund = async () => {
    if (!walletAddress) return;

    try {
      await funding.mutateAsync(walletAddress);

      showToast(t("friendbotFunded"));
      setDismissed(true);
    } catch {
      showToast("Friendbot funding failed. Please try again.");
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
              <p className="font-semibold">{t("friendbotNoBalance")}</p>
              <p className="text-yellow-700">
                {t("friendbotDescription")}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={handleFund}
              disabled={funding.isPending}
              className="rounded-lg bg-yellow-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-yellow-600 disabled:opacity-50"
            >
              {funding.isPending ? "Funding..." : "Fund with Friendbot"}
            </button>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              aria-label={t("dismissBanner")}
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
