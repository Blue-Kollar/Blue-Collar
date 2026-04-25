"use client";

import { useState, useEffect, useCallback } from "react";
import { X, ChevronRight, ChevronLeft, Search, Bookmark, Wallet, Star, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

const TOUR_KEY = "bc_tour_done";

interface Step {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const STEPS: Step[] = [
  {
    icon: <Search size={28} className="text-blue-500" />,
    title: "Find skilled workers",
    description:
      "Use the search bar to find tradespeople by name, skill, or location. Filter by category to narrow results.",
  },
  {
    icon: <Bookmark size={28} className="text-blue-500" />,
    title: "Save your favourites",
    description:
      "Tap the bookmark icon on any worker card to save them. Access all your saved workers from the Bookmarks page.",
  },
  {
    icon: <Wallet size={28} className="text-blue-500" />,
    title: "Pay with Stellar",
    description:
      "Connect your Freighter wallet to send instant, low-fee payments directly to workers on the Stellar network.",
  },
  {
    icon: <Star size={28} className="text-blue-500" />,
    title: "Leave a review",
    description:
      "After hiring a worker, leave a rating and comment to help others in the community make informed decisions.",
  },
];

interface Props {
  /** Force the tour to show regardless of localStorage (for restart) */
  forceShow?: boolean;
  onClose?: () => void;
}

export default function OnboardingTour({ forceShow, onClose }: Props) {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (forceShow) {
      setVisible(true);
      setStep(0);
      return;
    }
    const done = localStorage.getItem(TOUR_KEY);
    if (!done) setVisible(true);
  }, [forceShow]);

  const close = useCallback(() => {
    localStorage.setItem(TOUR_KEY, "1");
    setVisible(false);
    onClose?.();
  }, [onClose]);

  const next = () => {
    if (step < STEPS.length - 1) setStep((s) => s + 1);
    else close();
  };

  const prev = () => setStep((s) => Math.max(0, s - 1));

  if (!visible) return null;

  const current = STEPS[step];

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label="Onboarding tour"
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
          aria-label="Skip tour"
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
          {STEPS.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setStep(i)}
              aria-label={`Go to step ${i + 1}`}
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
            <ChevronLeft size={15} /> Back
          </button>

          <button
            type="button"
            onClick={next}
            className="flex items-center gap-1 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            {step < STEPS.length - 1 ? (
              <>Next <ChevronRight size={15} /></>
            ) : (
              "Get started"
            )}
          </button>
        </div>

        {/* Skip link */}
        {step < STEPS.length - 1 && (
          <p className="mt-3 text-center text-xs text-gray-400">
            <button type="button" onClick={close} className="hover:underline">
              Skip tour
            </button>
          </p>
        )}
      </div>
    </div>
  );
}

/** Small button to restart the tour — place anywhere in the UI */
export function RestartTourButton({ className }: { className?: string }) {
  const [show, setShow] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setShow(true)}
        className={cn(
          "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50 transition-colors",
          className
        )}
      >
        <RotateCcw size={12} /> Restart tour
      </button>
      {show && <OnboardingTour forceShow onClose={() => setShow(false)} />}
    </>
  );
}
