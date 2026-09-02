"use client";

import { createContext, ReactNode,useContext, useEffect, useState } from "react";

import OnboardingModal from "@/components/OnboardingModal";
import { useAuth } from "@/hooks/useAuth";

interface OnboardingContextType {
  showOnboarding: boolean;
  completeOnboarding: () => Promise<void>;
  restartOnboarding: () => void;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (user && !user.onboardingCompleted) {
      const dismissed = sessionStorage.getItem("onboarding-dismissed");
      if (!dismissed) {
        setShowOnboarding(true);
      }
    }
  }, [user]);

  const completeOnboarding = async () => {
    try {
      const response = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onboardingCompleted: true }),
      });

      if (response.ok) {
        setShowOnboarding(false);
        sessionStorage.setItem("onboarding-dismissed", "true");
      }
    } catch (error) {
      console.error("Failed to complete onboarding:", error);
    }
  };

  const restartOnboarding = () => {
    setShowOnboarding(true);
    sessionStorage.removeItem("onboarding-dismissed");
  };

  return (
    <OnboardingContext.Provider
      value={{ showOnboarding, completeOnboarding, restartOnboarding }}
    >
      {children}
      <OnboardingModal
        isOpen={showOnboarding}
        onClose={() => {
          setShowOnboarding(false);
          sessionStorage.setItem("onboarding-dismissed", "true");
        }}
        onComplete={completeOnboarding}
      />
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error("useOnboarding must be used within OnboardingProvider");
  }
  return context;
}
