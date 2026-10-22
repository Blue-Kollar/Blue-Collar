"use client";

import { forwardRef, ButtonHTMLAttributes, ReactNode } from "react";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  /** Required: icon-only controls must have an accessible name. Pass a translated label. */
  "aria-label": string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    {
      children,
      className = "",
      "aria-label": ariaLabel,
      type = "button",
      ...rest
    },
    ref
  ) {
    return (
      <button
        ref={ref}
        type={type}
        aria-label={ariaLabel}
        className={`
          inline-flex items-center justify-center
          min-h-[44px] min-w-[44px] rounded-md
          transition-colors duration-150
          focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-blue-600 focus-visible:outline-offset-2
          disabled:pointer-events-none disabled:opacity-50
          ${className}
        `}
        {...rest}
      >
        {children}
      </button>
    );
  }
);
