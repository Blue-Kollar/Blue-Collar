"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Loader2, CheckCircle2, MessageSquare } from "lucide-react";
import { useTranslations } from "next-intl";
import { sendContactRequest } from "@/lib/api";

interface Props {
  workerId: string;
  workerName: string;
}

export default function ContactModal({ workerId, workerName }: Props) {
  const t = useTranslations("contact");
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setMessage("");
    setStatus("idle");
    setError(null);
  };

  const handleOpenChange = (val: boolean) => {
    setOpen(val);
    if (!val) reset();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) return setError(t("errorEmpty"));
    if (trimmed.length < 10) return setError(t("errorTooShort"));
    if (trimmed.length > 1000) return setError(t("errorTooLong"));

    setStatus("loading");
    setError(null);
    try {
      await sendContactRequest(workerId, trimmed);
      setStatus("success");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("errorGeneric");
      setError(msg.includes("429") ? t("errorRateLimit") : msg);
      setStatus("error");
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild>
        <button className="flex items-center gap-2 rounded-lg border border-blue-600 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors" aria-label={t("title", { name: workerName })}>
          <MessageSquare size={15} aria-hidden="true" />
          {t("title", { name: workerName }).split(" ")[0]}
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <div className="flex items-start justify-between">
            <div>
              <Dialog.Title className="text-lg font-semibold text-gray-900">
                {t("title", { name: workerName })}
              </Dialog.Title>
              <Dialog.Description className="mt-0.5 text-sm text-gray-500">
                {t("description")}
              </Dialog.Description>
            </div>
            <Dialog.Close
              aria-label={t("ariaClose")}
              className="rounded-md p-1 text-gray-400 hover:text-gray-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <X size={18} aria-hidden="true" />
            </Dialog.Close>
          </div>

          {status === "success" ? (
            <div role="status" className="mt-6 flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle2 size={36} className="text-green-500" aria-hidden="true" />
              <p className="text-sm font-medium text-gray-800">{t("messageSent")}</p>
              <p className="text-xs text-gray-500">
                {t("messageSentDescription", { name: workerName })}
              </p>
              <Dialog.Close className="mt-2 rounded-lg bg-gray-100 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors">
                {t("close")}
              </Dialog.Close>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
              <div>
                <label htmlFor="contact-message" className="mb-1.5 block text-sm font-medium text-gray-700">
                  {t("messageLabel")}
                </label>
                <textarea
                  id="contact-message"
                  rows={5}
                  value={message}
                  onChange={(e) => { setMessage(e.target.value); setError(null); }}
                  placeholder={t("messagePlaceholder", { name: workerName })}
                  className="w-full rounded-lg border px-3 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
                <div className="mt-1 flex justify-between">
                  {error ? (
                    <p role="alert" className="text-xs text-red-500">{error}</p>
                  ) : (
                    <span />
                  )}
                  <span
                    aria-live="polite"
                    className={`text-xs ${message.length > 1000 ? "text-red-500" : "text-gray-400"}`}
                  >
                    {t("charCount", { count: message.length })}
                  </span>
                </div>
              </div>

              <div className="flex gap-3">
                <Dialog.Close className="flex-1 rounded-lg border py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                  {t("cancel")}
                </Dialog.Close>
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
                >
                  {status === "loading" && <Loader2 size={14} className="animate-spin" />}
                  {t("sendMessage")}
                </button>
              </div>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
