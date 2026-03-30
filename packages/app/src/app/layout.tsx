import type { Metadata } from "next";
import "./globals.css";
import type { ReactNode } from "react";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://bluecollar.app";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "BlueCollar — Find Skilled Workers Near You",
    template: "%s | BlueCollar",
  },
  description:
    "Connect with trusted local tradespeople on a decentralised Stellar-powered platform.",
  keywords: ["skilled workers", "tradespeople", "Stellar", "blockchain", "local services"],
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
  },
  openGraph: {
    type: "website",
    siteName: "BlueCollar",
    title: "BlueCollar — Find Skilled Workers Near You",
    description:
      "Connect with trusted local tradespeople on a decentralised Stellar-powered platform.",
    url: BASE_URL,
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "BlueCollar" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "BlueCollar — Find Skilled Workers Near You",
    description:
      "Connect with trusted local tradespeople on a decentralised Stellar-powered platform.",
    images: ["/og-image.png"],
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
