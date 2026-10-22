import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

interface LoadingStateProps {
  /** Optional text shown next to (inline) or below (block) the spinner */
  message?: string;
  /** "inline" for a compact in-flow spinner, "block" for a centered full-area state,
   *  or a skeleton that matches the layout it stands in for */
  variant?: "inline" | "block" | "list" | "card" | "detail";
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
  const t = useTranslations("common");
  const spinner = <Loader2 size={size} className="animate-spin" aria-hidden="true" />;

  if (variant === "list" || variant === "card" || variant === "detail") {
    return (
      <div role="status" className={cn("animate-pulse", className)}>
        <span className="sr-only">{message ?? t("loading")}</span>
        {variant === "list" &&
          Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 border-b py-3">
              <div className="h-10 w-10 shrink-0 rounded-full bg-gray-200 dark:bg-gray-700" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-1/3 rounded bg-gray-200 dark:bg-gray-700" />
                <div className="h-3 w-2/3 rounded bg-gray-200 dark:bg-gray-700" />
              </div>
            </div>
          ))}
        {variant === "card" && (
          <div className="space-y-3 rounded-xl border p-4">
            <div className="h-32 w-full rounded bg-gray-200 dark:bg-gray-700" />
            <div className="h-4 w-2/3 rounded bg-gray-200 dark:bg-gray-700" />
            <div className="h-3 w-1/2 rounded bg-gray-200 dark:bg-gray-700" />
          </div>
        )}
        {variant === "detail" && (
          <div className="space-y-4">
            <div className="h-48 w-full rounded bg-gray-200 dark:bg-gray-700" />
            <div className="h-6 w-1/2 rounded bg-gray-200 dark:bg-gray-700" />
            <div className="h-3 w-full rounded bg-gray-200 dark:bg-gray-700" />
            <div className="h-3 w-5/6 rounded bg-gray-200 dark:bg-gray-700" />
          </div>
        )}
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <div
        role="status"
        className={cn("flex items-center gap-2 text-sm text-gray-500", className)}
      >
        {spinner}
        {message ? <span>{message}</span> : <span className="sr-only">{t("loading")}</span>}
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
        <span className="sr-only">{t("loading")}</span>
      )}
    </div>
  );
}
