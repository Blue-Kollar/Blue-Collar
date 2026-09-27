"use client";

/**
 * OnboardingModal — migrated to Radix Dialog for proper focus-trap and
 * Escape-key dismissal.
 * Closes #1210
 */

import { useState } from "react";
import { ChevronRight, User, Wallet, Users } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
  const [step, setStep] = useState(1);

  const steps = [
    {
      number: 1,
      title: "Complete Your Profile",
      description: "Add a profile picture and bio to help workers know who you are.",
      icon: <User size={32} className="text-blue-600" aria-hidden="true" />,
      action: "Go to Profile",
    },
    {
      number: 2,
      title: "Connect Your Wallet",
      description: "Link your Stellar wallet to send tips and payments securely.",
      icon: <Wallet size={32} className="text-blue-600" aria-hidden="true" />,
      action: "Connect Wallet",
    },
    {
      number: 3,
      title: "Explore Workers",
      description: "Browse skilled workers in your area and find the perfect match.",
      icon: <Users size={32} className="text-blue-600" aria-hidden="true" />,
      action: "Browse Workers",
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
          <DialogTitle>Onboarding — Step {step} of {steps.length}</DialogTitle>
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
            aria-label="Steps"
          >
            {steps.map((s) => (
              <div
                key={s.number}
                role="listitem"
                aria-label={`Step ${s.number}${
                  s.number === step
                    ? " (current)"
                    : s.number < step
                    ? " (completed)"
                    : ""
                }`}
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
              Skip for now
            </button>
          </div>

          {/* Step counter */}
          <p className="text-xs text-gray-500 mt-4" aria-live="polite">
            Step {step} of {steps.length}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
