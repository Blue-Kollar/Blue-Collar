"use client";

import { useCallback, useEffect, useState } from "react";

/** The one persisted flag that records a finished onboarding tour. */
export const ONBOARDING_DONE_KEY = "bc_tour_done";

/**
 * Whether the user still needs onboarding, backed by one localStorage flag. Reads and writes are
 * best effort: if storage is unavailable, onboarding simply shows again.
 */
export function useOnboardingState() {
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    try {
      setNeedsOnboarding(localStorage.getItem(ONBOARDING_DONE_KEY) === null);
    } catch {
      setNeedsOnboarding(true);
    }
  }, []);

  const markDone = useCallback(() => {
    try {
      localStorage.setItem(ONBOARDING_DONE_KEY, "1");
    } catch {
      // Storage unavailable; the tour will show again next visit.
    }
    setNeedsOnboarding(false);
  }, []);

  return { needsOnboarding, markDone };
}
