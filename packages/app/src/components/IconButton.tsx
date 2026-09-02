"use client";

import { ButtonHTMLAttributes, forwardRef, ReactNode } from "react";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    {
      children,
      className = "",
      "aria-label": ariaLabel,
      "aria-labelledby": ariaLabelledby,
      type = "button",
      ...rest
    },
    ref
  ) {
    if (
      process.env.NODE_ENV === "development" &&
      !ariaLabel &&
      !ariaLabelledby
    ) {
      console.warn(
        "[IconButton] Supply aria-label or aria-labelledby for accessibility."
      );
    }

    return (
      <button
        ref={ref}
        type={type}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledby}
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
