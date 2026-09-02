/**
 * sharedApiHooks.test.tsx
 *
 * Unit tests verifying that components no longer call the API directly but
 * instead use the shared React Query hooks (issue #1199).
 *
 * Each test renders the component in a QueryClientProvider with a mocked
 * API module and confirms the hook (and therefore the API function) is called
 * instead of a raw fetch/import inside the component.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act,fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach,describe, expect, it, vi } from "vitest";

// ── mock @/lib/api so components don't hit the network ───────────────────────
vi.mock("@/lib/api", () => ({
  toggleBookmark: vi.fn().mockResolvedValue({ data: { bookmarked: true } }),
  createReview: vi.fn().mockResolvedValue({ data: { id: "r1", rating: 5, comment: "" } }),
  toggleReviewHelpful: vi.fn().mockResolvedValue({ data: { helpful: true, count: 3 } }),
  sendContactRequest: vi.fn().mockResolvedValue({ status: "success" }),
  getWorkerReviews: vi.fn().mockResolvedValue({ data: [], averageRating: null, reviewCount: 0, distribution: [] }),
}));

vi.mock("@/lib/api/payments", () => ({
  getInvoice: vi.fn().mockResolvedValue({
    data: {
      id: "inv1",
      invoiceNumber: "INV-001",
      status: "issued",
      currency: "XLM",
      platformFeePct: 0,
      lineItems: [],
      issuer: { name: "Alice", address: "GAAA" },
      recipient: { name: "Bob", address: "GBBB" },
      createdAt: "2024-01-01T00:00:00Z",
      dueDate: "2024-02-01T00:00:00Z",
    },
  }),
}));

// next-intl requires a provider in tests; stub it simply
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => {
    if (values) return `${key}:${JSON.stringify(values)}`;
    return key;
  },
}));

// AuthContext stub
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: null }),
}));

// ── helper ────────────────────────────────────────────────────────────────────

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

// ── BookmarkButton uses useToggleBookmark ─────────────────────────────────────

describe("BookmarkButton", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls toggleBookmark via the shared mutation hook on click", async () => {
    const { toggleBookmark } = await import("@/lib/api");
    const BookmarkButton = (await import("@/components/BookmarkButton")).default;

    render(<BookmarkButton workerId="w1" />, { wrapper });

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => expect(toggleBookmark).toHaveBeenCalledWith("w1"));
  });
});

// ── ReviewForm uses useCreateReview ──────────────────────────────────────────

describe("ReviewForm", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls createReview via the shared mutation hook on submit", async () => {
    const { createReview } = await import("@/lib/api");
    const ReviewForm = (await import("@/components/ReviewForm")).default;
    const onReviewCreated = vi.fn();

    render(<ReviewForm workerId="w1" onReviewCreated={onReviewCreated} />, { wrapper });

    // Click the 5-star button (last radio in the group)
    const stars = screen.getAllByRole("radio");
    fireEvent.click(stars[4]);

    fireEvent.click(screen.getByRole("button", { name: /submit review/i }));

    await waitFor(() =>
      expect(createReview).toHaveBeenCalledWith("w1", expect.objectContaining({ rating: 5 }))
    );
  });
});

// ── ReviewHelpfulButton uses useToggleReviewHelpful ──────────────────────────

describe("ReviewHelpfulButton", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls toggleReviewHelpful via the shared mutation hook on click", async () => {
    const { toggleReviewHelpful } = await import("@/lib/api");
    const ReviewHelpfulButton = (await import("@/components/ReviewHelpfulButton")).default;

    render(<ReviewHelpfulButton reviewId="rev1" />, { wrapper });

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() =>
      expect(toggleReviewHelpful).toHaveBeenCalledWith("rev1")
    );
  });

  it("reflects the server response for helpful/count", async () => {
    const ReviewHelpfulButton = (await import("@/components/ReviewHelpfulButton")).default;

    render(<ReviewHelpfulButton reviewId="rev1" initialCount={2} />, { wrapper });

    fireEvent.click(screen.getByRole("button"));

    // After mutation resolves, count should update to server value (3)
    await waitFor(() => expect(screen.getByText("3")).toBeInTheDocument());
  });
});

// ── ContactModal uses useSendContactRequest ───────────────────────────────────

describe("ContactModal", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls sendContactRequest via the shared mutation hook on submit", async () => {
    const { sendContactRequest } = await import("@/lib/api");
    const ContactModal = (await import("@/components/ContactModal")).default;

    render(<ContactModal workerId="w1" workerName="Alice" />, { wrapper });

    // Open the modal
    fireEvent.click(screen.getByRole("button"));

    // Fill in a message (must be >= 10 chars)
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "Hello, I need help with my plumbing." } });

    // Submit
    const submitBtn = screen.getByRole("button", { name: /sendmessage/i });
    fireEvent.click(submitBtn);

    await waitFor(() =>
      expect(sendContactRequest).toHaveBeenCalledWith(
        "w1",
        "Hello, I need help with my plumbing."
      )
    );
  });
});

// ── InvoiceView uses useInvoice ───────────────────────────────────────────────

describe("InvoiceView", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders invoice details fetched via the shared useInvoice hook", async () => {
    const { getInvoice } = await import("@/lib/api/payments");
    const InvoiceView = (await import("@/components/InvoiceView")).default;

    render(<InvoiceView invoiceId="inv1" />, { wrapper });

    await waitFor(() => expect(getInvoice).toHaveBeenCalledWith("inv1"));
    // The invoice number heading should be visible once data loads
    await waitFor(() =>
      expect(screen.getByText(/INV-001/i)).toBeInTheDocument()
    );
  });

  it("skips the fetch when a pre-fetched invoice is supplied", async () => {
    const { getInvoice } = await import("@/lib/api/payments");
    const { default: InvoiceView, calculateSubtotal } = await import(
      "@/components/InvoiceView"
    );

    const invoice = {
      id: "inv1",
      invoiceNumber: "INV-002",
      status: "paid" as const,
      currency: "XLM",
      platformFeePct: 2,
      lineItems: [{ description: "Work", quantity: 1, unitAmount: 100 }],
      issuer: { name: "Alice", address: "GAAA" },
      recipient: { name: "Bob", address: "GBBB" },
      createdAt: "2024-01-01T00:00:00Z",
      dueDate: "2024-02-01T00:00:00Z",
    };

    // calculateSubtotal is a pure helper — test it independently too
    expect(calculateSubtotal(invoice.lineItems)).toBe(100);

    render(<InvoiceView invoiceId="inv1" invoice={invoice as never} />, { wrapper });

    // Should not call the API
    expect(getInvoice).not.toHaveBeenCalled();
    expect(screen.getByText(/INV-002/i)).toBeInTheDocument();
  });
});
