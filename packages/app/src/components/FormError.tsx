import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface FormErrorProps {
  /** The error message to display. When falsy the component renders nothing. */
  message?: string | null;
  /** Unique id so inputs can reference this via aria-describedby */
  id?: string;
  className?: string;
}

/**
 * Shared form-level error banner.
 *
 * Use this for API / submission-level errors that don't belong to a specific
 * field.  Field-level errors should remain inside <FormField>.
 *
 * Renders nothing when `message` is falsy, so it is safe to render
 * unconditionally: `<FormError message={apiError} />`.
 */
export default function FormError({ message, id, className }: FormErrorProps) {
  if (!message) return null;

  return (
    <div
      id={id}
      role="alert"
      className={cn(
        "flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600",
        "dark:border-red-800 dark:bg-red-950/40 dark:text-red-400",
        className
      )}
    >
      <AlertCircle
        size={16}
        className="mt-0.5 shrink-0 text-red-500 dark:text-red-400"
        aria-hidden="true"
      />
      <span>{message}</span>
    </div>
  );
}
