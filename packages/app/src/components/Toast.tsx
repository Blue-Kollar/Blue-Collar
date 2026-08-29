"use client";

import { CheckCircle2, AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ToastType } from "@/hooks/useToast";

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface Props {
  toasts: ToastItem[];
  dismiss: (id: number) => void;
}

export default function ToastContainer({ toasts, dismiss }: Props) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "flex items-center gap-3 rounded-xl px-4 py-3 shadow-lg text-sm font-medium text-white min-w-[260px]",
            t.type === "success" ? "bg-green-600" : "bg-red-600"
          )}
        >
          {t.type === "success" ? (
            <CheckCircle2 size={16} className="shrink-0" />
          ) : (
            <AlertCircle size={16} className="shrink-0" />
          )}
          <span className="flex-1">{t.message}</span>
          <button onClick={() => dismiss(t.id)} aria-label="Dismiss notification" className="shrink-0 opacity-70 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
