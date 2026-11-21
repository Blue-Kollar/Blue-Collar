import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import messages from "@/messages/pt.json";
import Pagination from "../Pagination";

describe("Pagination translations", () => {
  it("renders Portuguese navigation labels", () => {
    render(
      <NextIntlClientProvider locale="pt" messages={messages}>
        <Pagination page={1} pages={2} onPageChange={vi.fn()} />
      </NextIntlClientProvider>
    );

    expect(screen.getByRole("navigation", { name: "Paginação" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Página anterior" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Próxima página" })).toBeInTheDocument();
  });
});
