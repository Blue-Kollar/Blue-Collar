"use client";

import { useState, useCallback } from "react";
import { X, ChevronRight, ChevronLeft, Search, Bookmark, Wallet, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOnboardingState } from "@/hooks/useOnboardingState";
import { useTranslations } from "next-intl";


interface Step {
  icon: React.ReactNode;
  title: string;
  description: string;
}

export default function OnboardingTour() {
  const t = useTranslations("componentText");
  const { needsOnboarding, markDone } = useOnboardingState();
  const [step, setStep] = useState(0);
  const visible = needsOnboarding;
  const steps: Step[] = [
    { icon: <Search size={28} className="text-blue-500" />, title: t("tourFindWorkersTitle"), description: t("tourFindWorkersDescription") },
    { icon: <Bookmark size={28} className="text-blue-500" />, title: t("tourSaveWorkersTitle"), description: t("tourSaveWorkersDescription") },
    { icon: <Wallet size={28} className="text-blue-500" />, title: t("tourPayTitle"), description: t("tourPayDescription") },
    { icon: <Star size={28} className="text-blue-500" />, title: t("tourReviewTitle"), description: t("tourReviewDescription") },
  ];

  const close = useCallback(() => {
    markDone();
  }, [markDone]);

  const next = () => {
    if (step < steps.length - 1) setStep((s) => s + 1);
    else close();
  };

  const prev = () => setStep((s) => Math.max(0, s - 1));

  if (!visible) return null;

  const current = steps[step];
  if (!current) return null;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label={t("onboardingTour")}
    >
      {/* Card — stop propagation so clicking inside doesn't close */}
      <div
        className="relative w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          type="button"
          onClick={close}
          aria-label={t("skipTour")}
          className="absolute right-4 top-4 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
        >
          <X size={16} />
        </button>

        {/* Step icon */}
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50">
          {current.icon}
        </div>

        {/* Content */}
        <h2 className="mb-2 text-lg font-bold text-gray-900 dark:text-white">{current.title}</h2>
        <p className="text-sm leading-relaxed text-gray-500 dark:text-gray-400">
          {current.description}
        </p>

        {/* Dots */}
        <div className="mt-6 flex items-center justify-center gap-1.5">
          {steps.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setStep(i)}
              aria-label={t("goToStep", { step: i + 1 })}
              className={cn(
                "h-2 rounded-full transition-all",
                i === step ? "w-5 bg-blue-500" : "w-2 bg-gray-200"
              )}
            />
          ))}
        </div>

        {/* Navigation */}
        <div className="mt-5 flex items-center justify-between">
          <button
            type="button"
            onClick={prev}
            disabled={step === 0}
            className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-100 disabled:opacity-0 transition-colors"
          >
            <ChevronLeft size={15} /> {t("back")}
          </button>

          <button
            type="button"
            onClick={next}
            className="flex items-center gap-1 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            {step < steps.length - 1 ? (
              <>{t("next")} <ChevronRight size={15} /></>
            ) : (
              t("getStarted")
            )}
          </button>
        </div>

        {/* Skip link */}
        {step < steps.length - 1 && (
          <p className="mt-3 text-center text-xs text-gray-400">
            <button type="button" onClick={close} className="hover:underline">
              {t("skipTour")}
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
