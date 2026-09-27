"use client";

/**
 * WalletBalanceWidget
 *
 * Renders the wallet XLM balance in the navbar / header.
 *
 * Uses the `useWalletBalance` selector hook instead of the full `useWallet()`
 * context so this component only re-renders when the balance value changes.
 * Previously the widget subscribed to the entire WalletContext value object,
 * which caused extra renders on every connect/disconnect, network change, or
 * any other unrelated state update.
 *
 * Closes #1206
 */

import { memo } from "react";
import { Wallet } from "lucide-react";
import { useWalletBalance } from "@/hooks/useWallet";
import { cn } from "@/lib/utils";

interface WalletBalanceWidgetProps {
  className?: string;
}

/**
 * Displays the connected wallet's XLM balance.
 * Renders nothing when no wallet is connected (balance is null).
 */
export const WalletBalanceWidget = memo(function WalletBalanceWidget({
  className,
}: WalletBalanceWidgetProps) {
  const balance = useWalletBalance();

  if (balance === null) return null;

  const formatted = Number(balance).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });

  return (
    <span
      aria-label={`Wallet balance: ${formatted} XLM`}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300",
        className,
      )}
    >
      <Wallet size={11} aria-hidden="true" className="shrink-0" />
      {formatted} XLM
    </span>
  );
});
