/**
 * useTransactionList.test.ts
 *
 * Unit tests for the split transaction hooks (issue #1200):
 *   - useTransactionFilters
 *   - useTransactionPolling
 *   - useTransactionList (composition)
 */

import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useTransactionFilters } from "@/hooks/useTransactionFilters";
import { useTransactionPolling } from "@/hooks/useTransactionPolling";
import { useTransactionList } from "@/hooks/useTransactionList";

// ── helpers ──────────────────────────────────────────────────────────────────

type Item = { from: string; assetType: string };
const getFrom = (i: Item) => i.from;
const getAssetType = (i: Item) => i.assetType;

const ITEMS: Item[] = [
  { from: "GAAA", assetType: "native" },
  { from: "GBBB", assetType: "credit_alphanum4" },
  { from: "GAAA", assetType: "native" },
];

// ── useTransactionFilters ─────────────────────────────────────────────────────

describe("useTransactionFilters", () => {
  it("returns all items when no filter is set", () => {
    const { result } = renderHook(() =>
      useTransactionFilters(ITEMS, getFrom, getAssetType)
    );
    expect(result.current.filtered).toHaveLength(3);
  });

  it("filters by fromAddress", () => {
    const { result } = renderHook(() =>
      useTransactionFilters(ITEMS, getFrom, getAssetType)
    );
    act(() => result.current.setFilterOptions({ fromAddress: "GAAA" }));
    expect(result.current.filtered).toHaveLength(2);
    expect(result.current.filtered.every((i) => i.from === "GAAA")).toBe(true);
  });

  it("filters by assetType", () => {
    const { result } = renderHook(() =>
      useTransactionFilters(ITEMS, getFrom, getAssetType)
    );
    act(() =>
      result.current.setFilterOptions({ assetType: "credit_alphanum4" })
    );
    expect(result.current.filtered).toHaveLength(1);
    expect(result.current.filtered[0].from).toBe("GBBB");
  });

  it("combines fromAddress and assetType filters", () => {
    const { result } = renderHook(() =>
      useTransactionFilters(ITEMS, getFrom, getAssetType)
    );
    act(() =>
      result.current.setFilterOptions({
        fromAddress: "GAAA",
        assetType: "native",
      })
    );
    expect(result.current.filtered).toHaveLength(2);
  });

  it("clearFilters restores the full list", () => {
    const { result } = renderHook(() =>
      useTransactionFilters(ITEMS, getFrom, getAssetType)
    );
    act(() => result.current.setFilterOptions({ fromAddress: "GAAA" }));
    act(() => result.current.clearFilters());
    expect(result.current.filtered).toHaveLength(3);
    expect(result.current.filterOptions).toEqual({});
  });

  it("returns an empty list when the filter matches nothing", () => {
    const { result } = renderHook(() =>
      useTransactionFilters(ITEMS, getFrom, getAssetType)
    );
    act(() =>
      result.current.setFilterOptions({ fromAddress: "GNOBODY" })
    );
    expect(result.current.filtered).toHaveLength(0);
  });
});

// ── useTransactionPolling ────────────────────────────────────────────────────

describe("useTransactionPolling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls onPoll after the interval elapses", () => {
    const onPoll = vi.fn();
    renderHook(() =>
      useTransactionPolling(onPoll, { intervalMs: 1_000, enabled: true })
    );
    vi.advanceTimersByTime(1_000);
    expect(onPoll).toHaveBeenCalledTimes(1);
  });

  it("calls onPoll multiple times across multiple intervals", () => {
    const onPoll = vi.fn();
    renderHook(() =>
      useTransactionPolling(onPoll, { intervalMs: 500, enabled: true })
    );
    vi.advanceTimersByTime(2_000);
    expect(onPoll).toHaveBeenCalledTimes(4);
  });

  it("does not poll when enabled is false", () => {
    const onPoll = vi.fn();
    renderHook(() =>
      useTransactionPolling(onPoll, { intervalMs: 1_000, enabled: false })
    );
    vi.advanceTimersByTime(5_000);
    expect(onPoll).not.toHaveBeenCalled();
  });

  it("skips the tick when document is hidden", () => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    const onPoll = vi.fn();
    renderHook(() =>
      useTransactionPolling(onPoll, { intervalMs: 1_000, enabled: true })
    );
    vi.advanceTimersByTime(3_000);
    expect(onPoll).not.toHaveBeenCalled();
  });

  it("polls immediately when the tab becomes visible again", () => {
    const onPoll = vi.fn();
    renderHook(() =>
      useTransactionPolling(onPoll, { intervalMs: 60_000, enabled: true })
    );
    // Simulate tab becoming visible
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(onPoll).toHaveBeenCalledTimes(1);
  });
});

// ── useTransactionList ───────────────────────────────────────────────────────

const HORIZON = "https://horizon-testnet.stellar.org";
const WALLET = "GABC123";

function makeHorizonPayment(overrides: Record<string, unknown> = {}) {
  return {
    id: "p1",
    type: "payment",
    created_at: "2024-01-01T00:00:00Z",
    from: "GFROM",
    amount: "10.0000000",
    transaction_hash: "hash1",
    asset_type: "native",
    ...overrides,
  };
}

function stubHorizonResponse(records: unknown[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ _embedded: { records } }),
    })
  );
}

describe("useTransactionList", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("returns incoming payments after a successful fetch", async () => {
    stubHorizonResponse([makeHorizonPayment({ from: "GFROM" })]);

    const { result } = renderHook(() =>
      useTransactionList({ walletAddress: WALLET })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.transactions).toHaveLength(1);
    expect(result.current.error).toBeNull();
    expect(result.current.total).toBe(1);
  });

  it("excludes payments where from === walletAddress (own outgoing payments)", async () => {
    stubHorizonResponse([
      makeHorizonPayment({ from: WALLET }),          // outgoing — excluded
      makeHorizonPayment({ from: "GOTHER", id: "p2" }), // incoming — kept
    ]);

    const { result } = renderHook(() =>
      useTransactionList({ walletAddress: WALLET })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.transactions).toHaveLength(1);
    expect(result.current.transactions[0].from).toBe("GOTHER");
  });

  it("excludes non-payment record types", async () => {
    stubHorizonResponse([
      makeHorizonPayment({ type: "create_account" }),
      makeHorizonPayment({ from: "GFROM2", id: "p2" }),
    ]);

    const { result } = renderHook(() =>
      useTransactionList({ walletAddress: WALLET })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.transactions).toHaveLength(1);
  });

  it("sets error on fetch failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500 })
    );

    const { result } = renderHook(() =>
      useTransactionList({ walletAddress: WALLET })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeTruthy();
    expect(result.current.transactions).toHaveLength(0);
  });

  it("paginates correctly", async () => {
    const records = Array.from({ length: 15 }, (_, i) =>
      makeHorizonPayment({ id: `p${i}`, from: `GSENDER${i}` })
    );
    stubHorizonResponse(records);

    const { result } = renderHook(() =>
      useTransactionList({ walletAddress: WALLET, pageSize: 5 })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.transactions).toHaveLength(5);
    expect(result.current.totalPages).toBe(3);
    expect(result.current.total).toBe(15);

    act(() => result.current.setPage(2));
    expect(result.current.page).toBe(2);
    expect(result.current.transactions).toHaveLength(5);
  });

  it("filters by marketContractId when provided", async () => {
    const CONTRACT = "CMARKET";
    stubHorizonResponse([
      makeHorizonPayment({ from: CONTRACT, id: "p1" }),
      makeHorizonPayment({ from: "GOTHER", id: "p2" }),
    ]);

    const { result } = renderHook(() =>
      useTransactionList({
        walletAddress: WALLET,
        marketContractId: CONTRACT,
      })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.transactions).toHaveLength(1);
    expect(result.current.transactions[0].from).toBe(CONTRACT);
  });
});
