import type { ReactElement, ReactNode } from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ComponentType } from "react";
import messages from "@/messages/en.json";

type IntlRenderOptions = Omit<RenderOptions, "wrapper"> & {
  wrapper?: ComponentType<{ children: ReactNode }>;
};

export function renderWithIntl(
  ui: ReactElement,
  { wrapper: Wrapper, ...options }: IntlRenderOptions = {}
) {
  return render(ui, {
    ...options,
    wrapper: ({ children }) => (
      <NextIntlClientProvider locale="en" messages={messages}>
        {Wrapper ? <Wrapper>{children}</Wrapper> : children}
      </NextIntlClientProvider>
    ),
  });
}
