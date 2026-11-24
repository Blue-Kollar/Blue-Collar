/**
 * Component resource hooks tests.
 *
 * All HTTP is intercepted by the shared MSW server (issue #1870) — no
 * `global.fetch` stubs and no real network access. Success and failure cases
 * are expressed as request handlers so tests stay deterministic and readable.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { FRIENDBOT_URL, HORIZON_URL, SOROBAN_RPC_URL } from '@/config/stellar';
import { buildUrl } from '@/lib/api/client';
import { server } from '@/__tests__/msw/server';
import { useFriendbotFunding } from '@/hooks/useFriendbotFunding';
import { useQuickProfileUpdate } from '@/hooks/useQuickProfileUpdate';
import { useSendWebVital } from '@/hooks/useSendWebVital';
import { useTipSimulation } from '@/hooks/useTipSimulation';
import { useTipSubmission } from '@/hooks/useTipSubmission';
import { useTransactionHistory } from '@/hooks/useTransactionHistory';

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
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

describe('component resource hooks (MSW)', () => {
  it('returns profile update data and reports failed responses', async () => {
    server.use(http.patch(buildUrl('/users/me'), () => HttpResponse.json({})));
    const profile = { firstName: 'A', lastName: 'Worker', email: 'a@example.com' };
    const { result } = renderHook(() => useQuickProfileUpdate('token'), {
      wrapper: createWrapper(),
    });
    await act(async () => expect(await result.current.mutateAsync(profile)).toEqual(profile));

    server.use(
      http.patch(buildUrl('/users/me'), () =>
        HttpResponse.json({ message: 'save failed' }, { status: 400 }),
      ),
    );
    await expectMutationError(result.current, profile, 'Failed to save');
  });

  it('returns the funded address and reports Friendbot errors', async () => {
    server.use(http.get(FRIENDBOT_URL, () => HttpResponse.json({ status: 'ok' })));
    const { result } = renderHook(() => useFriendbotFunding(), { wrapper: createWrapper() });
    await act(async () => expect(await result.current.mutateAsync('GABC')).toBe('GABC'));

    server.use(
      http.get(FRIENDBOT_URL, () =>
        HttpResponse.json({ message: 'funding failed' }, { status: 500 }),
      ),
    );
    await expectMutationError(result.current, 'GABC', 'Friendbot funding failed.');
  });

  it('returns simulation data and reports simulation errors', async () => {
    server.use(
      http.post(SOROBAN_RPC_URL, () => HttpResponse.json({ result: { minResourceFee: '100' } })),
    );
    const { result } = renderHook(() => useTipSimulation(), { wrapper: createWrapper() });
    await act(async () => {
      await expect(result.current.mutateAsync('xdr')).resolves.toEqual({
        result: { minResourceFee: '100' },
      });
    });

    server.use(
      http.post(SOROBAN_RPC_URL, () =>
        HttpResponse.json({ result: { error: 'insufficient balance' } }),
      ),
    );
    await expectMutationError(result.current, 'xdr', 'insufficient balance');
  });

  it('returns the submitted transaction and reports submission errors', async () => {
    server.use(
      http.post(`${HORIZON_URL}/transactions`, () => HttpResponse.json({ hash: 'tx-hash' })),
    );
    const { result } = renderHook(() => useTipSubmission(), { wrapper: createWrapper() });
    await act(async () => {
      await expect(result.current.mutateAsync('signed-xdr')).resolves.toEqual({ hash: 'tx-hash' });
    });

    server.use(
      http.post(`${HORIZON_URL}/transactions`, () =>
        HttpResponse.json(
          { extras: { result_codes: { transaction: 'tx_failed' } } },
          { status: 400 },
        ),
      ),
    );
    await expectMutationError(result.current, 'signed-xdr', 'tx_failed');
  });

  it('returns a transaction-history page and exposes query errors', async () => {
    server.use(
      http.get(`${HORIZON_URL}/accounts/:address/payments`, () =>
        HttpResponse.json({ _embedded: { records: [] } }),
      ),
    );
    const { result } = renderHook(() => useTransactionHistory('GABC', null), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ items: [], nextCursor: null });

    server.use(
      http.get(`${HORIZON_URL}/accounts/:address/payments`, () =>
        HttpResponse.json({ message: 'horizon down' }, { status: 500 }),
      ),
    );
    const failed = renderHook(() => useTransactionHistory('GDEF', null), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(failed.result.current.isError).toBe(true));
    expect(failed.result.current.error?.message).toBe('Unable to load transaction history');
  });

  it('returns vitals delivery data and reports fallback request failures', async () => {
    Object.defineProperty(navigator, 'sendBeacon', { configurable: true, value: undefined });
    server.use(http.post(buildUrl('/vitals'), () => HttpResponse.json({ ok: true })));
    const { result } = renderHook(() => useSendWebVital(), { wrapper: createWrapper() });
    await act(async () => expect(await result.current.mutateAsync({ name: 'LCP' })).toBe(true));

    server.use(
      http.post(buildUrl('/vitals'), () =>
        HttpResponse.json({ message: 'vitals failed' }, { status: 500 }),
      ),
    );
    await expectMutationError(result.current, { name: 'LCP' }, 'Unable to report web vital');
  });
});
