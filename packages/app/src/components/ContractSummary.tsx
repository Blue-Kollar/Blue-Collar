"use client";

import type { TipDTO } from "@/types";
import { TrendingUp, Calendar, DollarSign } from "lucide-react";

interface ContractSummaryProps {
  tip: TipDTO;
  isLoading?: boolean;
}

export default function ContractSummary({ tip, isLoading = false }: ContractSummaryProps) {
  if (isLoading) {
    return (
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <div className="space-y-3">
          <div className="h-4 w-24 rounded bg-gray-200 animate-pulse" />
          <div className="h-6 w-32 rounded bg-gray-200 animate-pulse" />
          <div className="h-4 w-40 rounded bg-gray-200 animate-pulse" />
        </div>
      </div>
    );
  }

  const date = new Date(tip.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
      <div className="flex items-start justify-between p-6">
        <div className="space-y-4 flex-1">
          <div className="flex items-center gap-2 text-gray-600">
            <DollarSign size={16} />
            <span className="text-sm font-medium">Transaction Summary</span>
          </div>

          <div className="space-y-2">
            <p className="text-3xl font-bold text-gray-900">
              {Number(tip.amount).toFixed(2)} XLM
            </p>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Calendar size={14} />
              <span>{date}</span>
            </div>
            {tip.memo && (
              <p className="text-sm text-gray-600 bg-gray-50 rounded px-3 py-2">
                {tip.memo}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 pt-2">
            <TrendingUp size={14} className="text-green-600" />
            <span className="text-xs font-medium text-green-600">Confirmed</span>
          </div>
        </div>
      </div>
    </div>
  );
}
