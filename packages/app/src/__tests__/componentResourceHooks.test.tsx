import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useFriendbotFunding } from "@/hooks/useFriendbotFunding";
import { useQuickProfileUpdate } from "@/hooks/useQuickProfileUpdate";
import { useSendWebVital } from "@/hooks/useSendWebVital";
import { useTipSimulation } from "@/hooks/useTipSimulation";
import { useTipSubmission } from "@/hooks/useTipSubmission";
import { useTransactionHistory } from "@/hooks/useTransactionHistory";

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function mockFetchResponse({ ok = true, body = {} }: { ok?: boolean; body?: unknown } = {}) {
  const fetchMock = vi.fn().mockResolvedValue({ ok, json: async () => body });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function expectMutationError<TVariables>(
  mutation: { mutateAsync: (variables: TVariables) => Promise<unknown> },
  variables: TVariables,
  message: string,
) {
  let error: unknown;
  await act(async () => {
    try {
      await mutation.mutateAsync(variables);
    } catch (caught) {
      error = caught;
    }
  });
  expect(error).toEqual(new Error(message));
}

afterEach(() => vi.unstubAllGlobals());

describe("component resource hooks", () => {
  it("returns profile update data and reports failed responses", async () => {
    const profile = { firstName: "A", lastName: "Worker", email: "a@example.com" };
    mockFetchResponse();
    const { result } = renderHook(() => useQuickProfileUpdate("token"), { wrapper: createWrapper() });
    await act(async () => expect(await result.current.mutateAsync(profile)).toEqual(profile));

    mockFetchResponse({ ok: false });
    await expectMutationError(result.current, profile, "Failed to save");
  });

  it("returns the funded address and reports Friendbot errors", async () => {
    mockFetchResponse();
    const { result } = renderHook(() => useFriendbotFunding(), { wrapper: createWrapper() });
    await act(async () => expect(await result.current.mutateAsync("GABC")).toBe("GABC"));

    mockFetchResponse({ ok: false });
    await expectMutationError(result.current, "GABC", "Friendbot funding failed.");
  });

  it("returns simulation data and reports simulation errors", async () => {
    mockFetchResponse({ body: { result: { minResourceFee: "100" } } });
    const { result } = renderHook(() => useTipSimulation(), { wrapper: createWrapper() });
    await act(async () => {
      await expect(result.current.mutateAsync("xdr")).resolves.toEqual({ result: { minResourceFee: "100" } });
    });

    mockFetchResponse({ body: { result: { error: "insufficient balance" } } });
    await expectMutationError(result.current, "xdr", "insufficient balance");
  });

  it("returns the submitted transaction and reports submission errors", async () => {
    mockFetchResponse({ body: { hash: "tx-hash" } });
    const { result } = renderHook(() => useTipSubmission(), { wrapper: createWrapper() });
    await act(async () => {
      await expect(result.current.mutateAsync("signed-xdr")).resolves.toEqual({ hash: "tx-hash" });
    });

    mockFetchResponse({ ok: false, body: { extras: { result_codes: { transaction: "tx_failed" } } } });
    await expectMutationError(result.current, "signed-xdr", "tx_failed");
  });

  it("returns a transaction-history page and exposes query errors", async () => {
    mockFetchResponse({ body: { _embedded: { records: [] } } });
    const { result } = renderHook(() => useTransactionHistory("GABC", null), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ items: [], nextCursor: null });

    mockFetchResponse({ ok: false });
    const failed = renderHook(() => useTransactionHistory("GDEF", null), { wrapper: createWrapper() });
    await waitFor(() => expect(failed.result.current.isError).toBe(true));
    expect(failed.result.current.error?.message).toBe("Unable to load transaction history");
  });

  it("returns vitals delivery data and reports fallback request failures", async () => {
    Object.defineProperty(navigator, "sendBeacon", { configurable: true, value: undefined });
    mockFetchResponse();
    const { result } = renderHook(() => useSendWebVital(), { wrapper: createWrapper() });
    await act(async () => expect(await result.current.mutateAsync({ name: "LCP" })).toBe(true));

    mockFetchResponse({ ok: false });
    await expectMutationError(result.current, { name: "LCP" }, "Unable to report web vital");
  });
});