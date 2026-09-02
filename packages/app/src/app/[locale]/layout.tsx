import { QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { Toaster } from "sonner";

import BottomNav from "@/components/BottomNav";
import CompareDrawer from "@/components/CompareDrawer";
import InstallPrompt from "@/components/InstallPrompt";
import OfflineBanner from "@/components/OfflineBanner";
import OnboardingTour from "@/components/OnboardingTour";
import WebVitalsReporter from "@/components/WebVitalsReporter";
import { HORIZON_URL } from "@/config/stellar";
import { AuthProvider } from "@/context/AuthContext";
import { CompareProvider } from "@/context/CompareContext";
import { ModalProvider } from "@/context/ModalContext";
import { NotificationProvider } from "@/context/NotificationContext";
import { WalletProvider } from "@/context/WalletContext";
import { queryClient } from "@/lib/queryClient";

// ── Deferred (non-critical) component wrappers to reduce CLS ─────────────────
function DeferredNonCritical() {
  return (
    <Suspense fallback={null}>
      <WebVitalsReporter />
      <OfflineBanner />
      <InstallPrompt />
      <CompareDrawer />
      <OnboardingTour />
    </Suspense>
  );
}

export default async function LocaleLayout({ 
  children, 
  params: { locale } 
}: { 
  children: ReactNode
  params: { locale: string } 
}) {
  const messages = await getMessages()

  return (
    <html lang={locale} suppressHydrationWarning>
      <body>
        {/* ═══ Resource hints for Core Web Vitals ═══ */}
        <link rel="preconnect" href={process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"} />
        <link rel="dns-prefetch" href={process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"} />
        <link rel="preconnect" href={HORIZON_URL} />
        <link rel="dns-prefetch" href={HORIZON_URL} />
        <link rel="preconnect" href="https://unpkg.com" />
        <link rel="dns-prefetch" href="https://unpkg.com" />

        <a href="#main-content" className="skip-to-main">
          Skip to main content
        </a>
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="bc_theme">
            <QueryClientProvider client={queryClient}>
              <AuthProvider>
                <WalletProvider>
                  <ModalProvider>
                    <CompareProvider>
                      <div id="main-content" tabIndex={-1}>
                        {children}
                      </div>
                      <DeferredNonCritical />
                    </CompareProvider>
                  </ModalProvider>
                </WalletProvider>
              </AuthProvider>
            </QueryClientProvider>
            {/* Toaster rendered at fixed position — no layout impact */}
            <Toaster position="bottom-right" richColors closeButton />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
