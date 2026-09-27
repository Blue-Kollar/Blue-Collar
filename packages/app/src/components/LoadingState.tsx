import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingStateProps {
  /** Optional text shown next to (inline) or below (block) the spinner */
  message?: string;
  /** "inline" for a compact in-flow spinner, "block" for a centered full-area state */
  variant?: "inline" | "block";
  /** Spinner size in pixels */
  size?: number;
  className?: string;
}

export default function LoadingState({
  message,
  variant = "block",
  size = 28,
  className,
}: LoadingStateProps) {
  const spinner = <Loader2 size={size} className="animate-spin" aria-hidden="true" />;

  if (variant === "inline") {
    return (
      <div
        role="status"
        className={cn("flex items-center gap-2 text-sm text-gray-500", className)}
      >
        {spinner}
        {message ? <span>{message}</span> : <span className="sr-only">Loading</span>}
      </div>
    );
  }

  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-16 text-gray-400",
        className
      )}
    >
      {spinner}
      {message ? (
        <p className="text-sm text-gray-500">{message}</p>
      ) : (
        <span className="sr-only">Loading</span>
      )}
    </div>
  );
}
