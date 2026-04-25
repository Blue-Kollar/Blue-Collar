import type { ReactNode } from "react";
import { CheckCircle2, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  id: string;
  error?: string;
  hint?: string;
  isValid?: boolean;
  className?: string;
  children: ReactNode;
}

export default function FormField({ label, id, error, hint, isValid, className, children }: Props) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
      </label>
      <div className="relative">
        {children}
        {/* success / error icon overlay */}
        {(isValid || error) && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
            {error
              ? <AlertCircle size={15} className="text-red-500" />
              : <CheckCircle2 size={15} className="text-green-500" />}
          </span>
        )}
      </div>
      {error && (
        <p className="flex items-center gap-1 text-xs text-red-500" role="alert">
          {error}
        </p>
      )}
      {!error && hint && (
        <p className="flex items-center gap-1 text-xs text-gray-400">
          <Info size={11} />
          {hint}
        </p>
      )}
    </div>
  );
}
