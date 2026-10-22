"use client";

import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { queryClient } from "@/lib/queryClient";

interface ProvidersProps {
  children: ReactNode;
  /** Active locale, passed explicitly so intl does not have to infer it from the request. */
  locale: string;
  /** Translation catalogue for the active locale, loaded by the server layout. */
  messages: AbstractIntlMessages;
}

/**
 * Single provider tree for theme, locale, server-state and toast notifications.
 * Mounted once in the locale layout so every page shares the same instances.
 */
export function Providers({ children, locale, messages }: ProvidersProps) {
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="bc_theme">
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        {/* Rendered at a fixed position, so it has no layout impact */}
        <Toaster position="bottom-right" richColors closeButton />
      </ThemeProvider>
    </NextIntlClientProvider>
  );
}
