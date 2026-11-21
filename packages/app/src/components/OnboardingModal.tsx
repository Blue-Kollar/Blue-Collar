"use client";

/**
 * OnboardingModal — migrated to Radix Dialog for proper focus-trap and
 * Escape-key dismissal.
 * Closes #1210
 */

import { useState } from "react";
import { ChevronRight, User, Wallet, Users } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTranslations } from "next-intl";

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export default function OnboardingModal({
  isOpen,
  onClose,
  onComplete,
}: OnboardingModalProps) {
  const t = useTranslations("componentText");
  const [step, setStep] = useState(1);

  const steps = [
    {
      number: 1,
      title: t("onboardingProfileTitle"),
      description: t("onboardingProfileDescription"),
      icon: <User size={32} className="text-blue-600" aria-hidden="true" />,
      action: t("onboardingProfileAction"),
    },
    {
      number: 2,
      title: t("onboardingWalletTitle"),
      description: t("onboardingWalletDescription"),
      icon: <Wallet size={32} className="text-blue-600" aria-hidden="true" />,
      action: t("connectWallet"),
    },
    {
      number: 3,
      title: t("onboardingWorkersTitle"),
      description: t("onboardingWorkersDescription"),
      icon: <Users size={32} className="text-blue-600" aria-hidden="true" />,
      action: t("browseWorkers"),
    },
  ];

  const currentStep = steps[step - 1]!;
  const progress = (step / steps.length) * 100;

  const handleNext = () => {
    if (step < steps.length) {
      setStep(step + 1);
    } else {
      onComplete();
      onClose();
    }
  };

  const handleSkip = () => {
    onComplete();
    onClose();
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>{t("onboardingStep", { step, total: steps.length })}</DialogTitle>
        </DialogHeader>

        {/* Progress bar */}
        <div
          className="h-1 bg-gray-200"
          role="progressbar"
          aria-valuenow={step}
          aria-valuemin={1}
          aria-valuemax={steps.length}
        >
          <div
            className="h-full bg-blue-600 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Content */}
        <div className="p-8 text-center">
          <div className="mb-6 flex justify-center">{currentStep.icon}</div>

          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {currentStep.title}
          </h2>

          <p className="text-gray-600 mb-8">{currentStep.description}</p>

          {/* Step indicator */}
          <div
            className="flex justify-center gap-2 mb-8"
            role="list"
            aria-label={t("steps")}
          >
            {steps.map((s) => (
              <div
                key={s.number}
                role="listitem"
                aria-label={t(s.number === step ? "currentStep" : s.number < step ? "completedStep" : "stepNumber", { step: s.number })}
                className={`h-2 w-2 rounded-full transition-colors ${
                  s.number <= step ? "bg-blue-600" : "bg-gray-300"
                }`}
              />
            ))}
          </div>

          {/* Buttons */}
          <div className="space-y-3">
            <button
              onClick={handleNext}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2.5 rounded-md font-medium hover:bg-blue-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              {currentStep.action}
              <ChevronRight size={18} aria-hidden="true" />
            </button>

            <button
              onClick={handleSkip}
              className="w-full text-gray-600 py-2.5 rounded-md font-medium hover:bg-gray-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2"
            >
              {t("skipForNow")}
            </button>
          </div>

          {/* Step counter */}
          <p className="text-xs text-gray-500 mt-4" aria-live="polite">
            {t("onboardingStep", { step, total: steps.length })}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
