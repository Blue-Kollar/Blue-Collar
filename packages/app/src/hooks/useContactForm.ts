"use client";

import { useState, type FormEvent } from "react";
import { useSendContactRequest } from "@/hooks/queries";

/** Looks up a translated message by key. */
export type ContactTranslate = (key: string) => string;

export type ContactStatus = "idle" | "loading" | "success" | "error";

/**
 * Message, validation, submission and status for the contact-a-worker form. The modal renders
 * these values and calls handleSubmit; it holds no submission logic itself.
 */
export function useContactForm(workerId: string, t: ContactTranslate) {
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<ContactStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const sendContactRequest = useSendContactRequest(workerId);

  const reset = () => {
    setMessage("");
    setStatus("idle");
    setError(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) return setError(t("errorEmpty"));
    if (trimmed.length < 10) return setError(t("errorTooShort"));
    if (trimmed.length > 1000) return setError(t("errorTooLong"));

    setStatus("loading");
    setError(null);
    try {
      await sendContactRequest.mutateAsync(trimmed);
      setStatus("success");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("errorGeneric");
      setError(msg.includes("429") ? t("errorRateLimit") : msg);
      setStatus("error");
    }
  };

  return { message, setMessage, status, error, setError, reset, handleSubmit };
}
