import type { Metadata } from "next";
import "./globals.css";
import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { AuthProvider } from "@/context/AuthContext";
import { WalletProvider } from "@/context/WalletContext";
import { OnboardingProvider } from "@/context/OnboardingContext";
import PushNotificationPrompt from "@/components/PushNotificationPrompt";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://bluecollar.app";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  const title = t("title");
  const description = t("description");

  return {
    metadataBase: new URL(BASE_URL),
    title: {
      default: title,
      template: `%s | ${t("siteName")}`,
    },
    description,
    keywords: t("keywords").split(",").map((keyword) => keyword.trim()),
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "any" },
        { url: "/favicon.svg", type: "image/svg+xml" },
      ],
    },
    manifest: "/manifest.json",
    openGraph: {
      type: "website",
      siteName: t("siteName"),
      title,
      description,
      url: BASE_URL,
      images: [{ url: "/og-image.png", width: 1200, height: 630, alt: t("siteName") }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/og-image.png"],
    },
    robots: { index: true, follow: true },
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations("layout");

  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <a href="#main-content" className="skip-to-main">
          {t("skipToMainContent")}
        </a>
        {/* Theme, locale, query and toast providers live in the locale layout (components/Providers) */}
        <AuthProvider>
          <WalletProvider>
            <OnboardingProvider>
              <ServiceWorkerRegister />
              <div id="main-content" tabIndex={-1}>
                {children}
              </div>
              <PushNotificationPrompt />
            </OnboardingProvider>
          </WalletProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
