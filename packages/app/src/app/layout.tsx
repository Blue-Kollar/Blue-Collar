import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import './globals.css'
import type { ReactNode } from "react";
import { AuthProvider } from "@/context/AuthContext";

export const metadata: Metadata = {
  title: 'BlueCollar — Find Skilled Workers Near You',
  description: 'Connect with trusted local tradespeople on a decentralised Stellar-powered platform.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
