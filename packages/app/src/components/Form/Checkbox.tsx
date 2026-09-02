"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
  error?: string;
  hint?: string;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, error, hint, className, id, ...props }, ref) => {
    const checkId = id ?? React.useId();
    const errorId = `${checkId}-error`;

    return (
      <div className="flex flex-col gap-1">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            ref={ref}
            id={checkId}
            type="checkbox"
            aria-invalid={!!error}
            aria-describedby={error ? errorId : undefined}
            className={cn(
              "h-4 w-4 rounded border-gray-300 dark:border-gray-600",
              "accent-brand-600 focus:ring-2 focus:ring-brand-500/20",
              "disabled:cursor-not-allowed disabled:opacity-50",
              className
            )}
            {...props}
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
        </label>
        {error && (
          <p id={errorId} role="alert" className="text-xs text-error ml-6">
            {error}
          </p>
        )}
        {!error && hint && (
          <p className="text-xs text-gray-400 dark:text-gray-500 ml-6">{hint}</p>
        )}
      </div>
    );
  }
);
Checkbox.displayName = "FormCheckbox";

export { Checkbox };
