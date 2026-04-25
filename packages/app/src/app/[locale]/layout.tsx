import type { ReactNode } from "react";
import { AuthProvider } from "@/context/AuthContext";
import { WalletProvider } from "@/context/WalletContext";
import { CompareProvider } from "@/context/CompareContext";
import { NotificationProvider } from "@/context/NotificationContext";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import CompareDrawer from "@/components/CompareDrawer";
import BottomNav from "@/components/BottomNav";
import OnboardingTour from "@/components/OnboardingTour";

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
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="bc_theme">
            <AuthProvider>
              <WalletProvider>
                <CompareProvider>
                  {children}
                  <CompareDrawer />
                  <OnboardingTour />
                </CompareProvider>
              </WalletProvider>
            </AuthProvider>
            <Toaster position="bottom-right" richColors closeButton />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
