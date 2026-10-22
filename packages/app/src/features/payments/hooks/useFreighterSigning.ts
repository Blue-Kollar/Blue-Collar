"use client";

import { useWallet } from "@/context/WalletContext";

/**
 * Single entry point for Freighter signing inside the payments feature.
 *
 * Components in this feature sign through this hook rather than calling the
 * wallet directly. Connection and Freighter-availability checks stay in
 * WalletContext, so errors such as WalletNotConnectedError reach the caller.
 */
export function useFreighterSigning() {
  const { publicKey, networkPassphrase, signTransaction } = useWallet();

  return {
    publicKey,
    networkPassphrase,
    isConnected: Boolean(publicKey),
    signTransaction,
  };
}
