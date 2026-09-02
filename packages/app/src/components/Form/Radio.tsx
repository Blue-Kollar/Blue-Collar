"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export interface RadioOption {
  label: string;
  value: string;
  disabled?: boolean;
}

export interface RadioGroupProps {
  label: string;
  name: string;
  options: RadioOption[];
  value?: string;
  onChange?: (value: string) => void;
  error?: string;
  hint?: string;
  className?: string;
}

function RadioGroup({ label, name, options, value, onChange, error, hint, className }: RadioGroupProps) {
  const groupId = React.useId();
  const errorId = `${groupId}-error`;

  return (
    <fieldset className={cn("flex flex-col gap-2", className)}>
      <legend className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</legend>
      <div className="flex flex-col gap-2" role="radiogroup" aria-describedby={error ? errorId : undefined}>
        {options.map((opt) => {
          const optId = `${groupId}-${opt.value}`;
          return (
            <label key={opt.value} className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="radio"
                id={optId}
                name={name}
                value={opt.value}
                checked={value === opt.value}
                onChange={() => onChange?.(opt.value)}
                disabled={opt.disabled}
                className={cn(
                  "h-4 w-4 accent-brand-600 border-gray-300 dark:border-gray-600",
                  "focus:ring-2 focus:ring-brand-500/20",
                  "disabled:cursor-not-allowed disabled:opacity-50"
                )}
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">{opt.label}</span>
            </label>
          );
        })}
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-xs text-error">
          {error}
        </p>
      )}
      {!error && hint && (
        <p className="text-xs text-gray-400 dark:text-gray-500">{hint}</p>
      )}
    </fieldset>
  );
}

export { RadioGroup };
