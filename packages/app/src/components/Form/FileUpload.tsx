"use client";

import * as React from "react";
import { Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FileUploadProps {
  label: string;
  accept?: string;
  multiple?: boolean;
  error?: string;
  hint?: string;
  disabled?: boolean;
  /** `image` presets `accept` to images and shows a preview of the picked file. */
  mode?: "file" | "image";
  /** Preview to show before any file is picked, e.g. the current avatar. */
  existingUrl?: string | null;
  onChange?: (files: FileList | null) => void;
  className?: string;
}

function FileUpload({
  label,
  accept,
  multiple,
  error: propError,
  hint,
  disabled,
  mode = "file",
  existingUrl,
  onChange,
  className,
}: FileUploadProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [files, setFiles] = React.useState<File[]>([]);
  const [typeError, setTypeError] = React.useState<string | null>(null);
  const inputId = React.useId();
  const errorId = `${inputId}-error`;

  const isImage = mode === "image";
  const error = propError ?? typeError ?? undefined;
  const selectedPreview = React.useMemo(
    () => (isImage && files[0] ? URL.createObjectURL(files[0]) : null),
    [files, isImage],
  );

  React.useEffect(() => {
    return () => {
      if (selectedPreview) URL.revokeObjectURL(selectedPreview);
    };
  }, [selectedPreview]);

  const preview = selectedPreview ?? existingUrl ?? null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fl = e.target.files;
    const picked = fl ? Array.from(fl) : [];

    const rejected = isImage ? picked.find((f) => !f.type.startsWith("image/")) : undefined;
    if (rejected) {
      setTypeError(`${rejected.name} is not an image.`);
      setFiles([]);
      e.target.value = "";
      onChange?.(null);
      return;
    }

    setTypeError(null);
    setFiles(picked);
    onChange?.(fl);
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      // rebuild DataTransfer to update input
      const dt = new DataTransfer();
      next.forEach((f) => dt.items.add(f));
      if (inputRef.current) inputRef.current.files = dt.files;
      onChange?.(dt.files);
      return next;
    });
  };

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
      {preview && (
        <img
          src={preview}
          alt=""
          className="h-24 w-24 rounded-md object-cover"
        />
      )}
      <label
        htmlFor={inputId}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6",
          "text-sm text-gray-500 dark:text-gray-400",
          "transition-colors hover:border-brand-400 hover:text-brand-600",
          "dark:border-gray-700 dark:hover:border-brand-500",
          error ? "border-error" : "border-gray-300",
          disabled && "pointer-events-none opacity-50"
        )}
      >
        <Upload size={20} />
        <span>Click to upload{multiple ? " files" : isImage ? " an image" : " a file"}</span>
        {(isImage ? accept ?? "image/*" : accept) && (
          <span className="text-xs text-gray-400">{isImage ? accept ?? "image/*" : accept}</span>
        )}
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={isImage ? accept ?? "image/*" : accept}
          multiple={multiple}
          disabled={disabled}
          onChange={handleChange}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          className="sr-only"
        />
      </label>
      {files.length > 0 && (
        <ul className="flex flex-col gap-1 mt-1">
          {files.map((f, i) => (
            <li key={i} className="flex items-center justify-between rounded-md bg-gray-50 dark:bg-gray-800 px-3 py-1.5 text-xs">
              <span className="truncate max-w-[calc(100%-2rem)]">{f.name}</span>
              <button type="button" onClick={() => removeFile(i)} aria-label={`Remove ${f.name}`} className="ml-2 text-gray-400 hover:text-error">
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs text-error">
          {error}
        </p>
      )}
      {!error && hint && (
        <p className="text-xs text-gray-400 dark:text-gray-500">{hint}</p>
      )}
    </div>
  );
}

export { FileUpload };
