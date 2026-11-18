"use client";

import { useState } from "react";
import { Loader2, CheckCircle2, MessageSquare } from "lucide-react";
import { useTranslations } from "next-intl";
import { useContactForm } from "@/hooks/useContactForm";
import { useSubmitGuard } from "@/hooks/useSubmitGuard";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";
import Modal from "@/components/ui/Modal";

interface Props {
  workerId: string;
  workerName: string;
}

export default function ContactModal({ workerId, workerName }: Props) {
  const t = useTranslations("contact");
  const [open, setOpen] = useState(false);
  const { message, setMessage, status, error, setError, reset, handleSubmit } = useContactForm(
    workerId,
    (key) => t(key as never),
  );
  const { guard, isActive } = useSubmitGuard();
  const [inputValue, setInputValue] = useState(message);

  const debouncedSetMessage = useDebouncedCallback((value: string) => {
    setMessage(value);
  }, 200);

  const handleOpenChange = (val: boolean) => {
    setOpen(val);
    if (!val) {
      reset();
      setInputValue("");
    }
  };

  const handleChange = (value: string) => {
    setInputValue(value);
    setError(null);
    debouncedSetMessage(value);
  };

  const onSubmit = guard(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await handleSubmit(e);
  });

  const isSubmitting = status === "loading" || isActive;

  return (
    <Modal
      open={open}
      onOpenChange={handleOpenChange}
      trigger={
        <button className="flex items-center gap-2 rounded-lg border border-blue-600 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors" aria-label={t("title", { name: workerName })}>
          <MessageSquare size={15} aria-hidden="true" />
          {t("title", { name: workerName }).split(" ")[0]}
        </button>
      }
      title={t("title", { name: workerName })}
      description={t("description")}
      closeLabel={t("ariaClose")}
    >
      {status === "success" ? (
        <div role="status" className="mt-6 flex flex-col items-center gap-3 py-4 text-center">
          <CheckCircle2 size={36} className="text-green-500" aria-hidden="true" />
          <p className="text-sm font-medium text-gray-800">{t("messageSent")}</p>
          <p className="text-xs text-gray-500">
            {t("messageSentDescription", { name: workerName })}
          </p>
          <Modal.Close className="mt-2 rounded-lg bg-gray-100 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors">
            {t("close")}
          </Modal.Close>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-4">
          <div>
            <label htmlFor="contact-message" className="mb-1.5 block text-sm font-medium text-gray-700">
              {t("messageLabel")}
            </label>
            <textarea
              id="contact-message"
              rows={5}
              value={inputValue}
              onChange={(e) => handleChange(e.target.value)}
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
                className={`text-xs ${inputValue.length > 1000 ? "text-red-500" : "text-gray-400"}`}
              >
                {t("charCount", { count: inputValue.length })}
              </span>
            </div>
          </div>

          <div className="flex gap-3">
            <Modal.Close className="flex-1 rounded-lg border py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              {t("cancel")}
            </Modal.Close>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              {isSubmitting && <Loader2 size={14} className="animate-spin" />}
              {t("sendMessage")}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
