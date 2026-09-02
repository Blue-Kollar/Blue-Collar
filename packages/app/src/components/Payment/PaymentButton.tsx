"use client";

import { Wallet } from "lucide-react";

import TipModal from "@/components/TipModal";
import { usePaymentFlow } from "@/context/PaymentFlowContext";

interface PaymentButtonProps {
  workerName?: string;
  walletAddress?: string | null | undefined;
  label?: string;
}

export default function PaymentButton({
  workerName: workerNameProp,
  walletAddress: walletAddressProp,
  label = "Pay / Tip",
}: PaymentButtonProps) {
  const paymentFlow = usePaymentFlow();
  const workerName = workerNameProp ?? paymentFlow?.workerName;
  const walletAddress = walletAddressProp ?? paymentFlow?.walletAddress;

  if (!walletAddress) {
    return (
      <div title="Worker has no wallet" className="inline-block">
        <button
          disabled
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-200 text-gray-400 cursor-not-allowed text-sm font-medium"
        >
          <Wallet className="w-4 h-4" />
          {label}
        </button>
      </div>
    );
  }

  return (
    <TipModal
      workerName={workerName}
      walletAddress={walletAddress}
      trigger={
        <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors">
          <Wallet className="w-4 h-4" />
          {label}
        </button>
      }
    />
  );
}
