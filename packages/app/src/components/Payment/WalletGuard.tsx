"use client";

import { ReactNode } from "react";

import { useWallet } from "@/context/WalletContext";

interface WalletGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export default function WalletGuard({ children, fallback }: WalletGuardProps) {
  const wallet = useWallet();

  if (wallet.isConnecting) {
    return (
      <div className="flex items-center justify-center p-4">
        <span className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!wallet.isConnected) {
    return (
      <>
        {fallback ?? (
          <div className="flex flex-col items-center gap-3 p-6 text-center">
            <p className="text-sm text-gray-600">Connect your wallet to continue.</p>
            <button
              onClick={() => wallet.connect()}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
            >
              Connect Wallet
            </button>
          </div>
        )}
      </>
    );
  }

  return <>{children}</>;
}
