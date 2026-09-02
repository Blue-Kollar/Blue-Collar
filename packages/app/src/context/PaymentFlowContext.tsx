"use client";

/**
 * Scoped context for the worker tip/payment flow.
 *
 * Prior chain: page.tsx -> WorkerTipSection -> { TipModal, PaymentButton },
 * each re-passing `workerName` / `walletAddress` explicitly. WorkerTipSection
 * now provides those values once via PaymentFlowProvider; TipModal and
 * PaymentButton read them from context when not passed directly, so callers
 * that already use them standalone (outside a provider, e.g. in tests) keep
 * working unchanged.
 */

import { createContext, type ReactNode,useContext } from "react";

export interface PaymentFlowContextValue {
  workerName: string;
  walletAddress: string;
}

const PaymentFlowContext = createContext<PaymentFlowContextValue | null>(null);

interface PaymentFlowProviderProps extends PaymentFlowContextValue {
  children: ReactNode;
}

export function PaymentFlowProvider({
  workerName,
  walletAddress,
  children,
}: PaymentFlowProviderProps) {
  return (
    <PaymentFlowContext.Provider value={{ workerName, walletAddress }}>
      {children}
    </PaymentFlowContext.Provider>
  );
}

export function usePaymentFlow(): PaymentFlowContextValue | null {
  return useContext(PaymentFlowContext);
}
