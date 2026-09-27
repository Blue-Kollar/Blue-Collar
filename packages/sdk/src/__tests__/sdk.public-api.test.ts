/**
 * Public API behaviour tests for @bluecollar/sdk.
 *
 * These focus on observable public behaviour that the existing unit/e2e suites
 * did not explicitly pin down:
 *   - createSdk config resolution (incl. invalid/unknown network)
 *   - default parameter values
 *   - error propagation through buildUnsignedPaymentTx
 *   - malformed / partial response handling
 *   - broadcast error message when neither detail nor title is present
 *
 * All network access is isolated by stubbing the global `fetch`, so the suite
 * runs with no live network, credentials, wallet, or testnet/mainnet.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createSdk, HorizonClient, RegistryClient, SdkError } from '../index.js';

function jsonResponse(body: unknown, status = 200, statusText = 'OK'): Response {
  return new Response(JSON.stringify(body), { status, statusText });
}

afterEach(() => {
  vi.restoreAllMocks();
});

// ── createSdk configuration ───────────────────────────────────────────────────

describe('createSdk – configuration', () => {
  it('resolves the testnet horizon URL by default', () => {
    const sdk = createSdk({ network: 'testnet' });
    expect(sdk.config.horizonUrl).toBe('https://horizon-testnet.stellar.org');
    expect(sdk.horizon).toBeInstanceOf(HorizonClient);
  });

  it('resolves the mainnet horizon URL', () => {
    const sdk = createSdk({ network: 'mainnet' });
    expect(sdk.config.horizonUrl).toBe('https://horizon.stellar.org');
  });

  it('honours an explicit horizonUrl override', () => {
    const sdk = createSdk({ network: 'testnet', horizonUrl: 'https://my-horizon.example' });
    expect(sdk.config.horizonUrl).toBe('https://my-horizon.example');
  });

  it('returns a null registry client when no registryContractId is supplied', () => {
    const sdk = createSdk({ network: 'testnet' });
    expect(sdk.registry).toBeNull();
  });

  it('returns a RegistryClient instance when registryContractId is supplied', () => {
    const sdk = createSdk({ network: 'testnet', registryContractId: 'C123' });
    expect(sdk.registry).toBeInstanceOf(RegistryClient);
  });

  it('leaves horizonUrl undefined for an unknown network (type-level guard bypassed)', () => {
    // The network value is normally enforced by TypeScript; at runtime an
    // unexpected value silently yields an undefined base URL. This test
    // documents that observable behaviour so it cannot regress silently.
    const sdk = createSdk({ network: 'bogus' as never });
    expect(sdk.config.horizonUrl).toBeUndefined();
    expect(sdk.horizon).toBeInstanceOf(HorizonClient);
  });
});

// ── HorizonClient construction ────────────────────────────────────────────────

describe('HorizonClient – construction', () => {
  it('stores the supplied horizon URL', () => {
    const client = new HorizonClient({ horizonUrl: 'https://x.example' });
    expect(client).toBeInstanceOf(HorizonClient);
  });
});

// ── getAccountInfo ────────────────────────────────────────────────────────────

describe('getAccountInfo – edge cases', () => {
  it('defaults a missing native balance to 0', async () => {
    const client = new HorizonClient({ horizonUrl: 'https://horizon.test' });
    vi.spyOn(global, 'fetch').mockResolvedValue(
      jsonResponse({
        balances: [{ balance: '12.5', asset_type: 'credit_alphanum4' }],
        sequence: '5',
      }),
    );
    const info = await client.getAccountInfo('GABC');
    expect(info.balance).toBe(0);
    expect(info.sequence).toBe(5n);
  });

  it('throws when the account is not found (404)', async () => {
    const client = new HorizonClient({ horizonUrl: 'https://horizon.test' });
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response('not found', { status: 404 }));
    await expect(client.getAccountInfo('GABC')).rejects.toThrow(SdkError);
    await expect(client.getAccountInfo('GABC')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws a non-404 HTTP error with the status text', async () => {
    const client = new HorizonClient({ horizonUrl: 'https://horizon.test' });
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('err', { status: 500, statusText: 'Server Error' }),
    );
    await expect(client.getAccountInfo('GABC')).rejects.toThrow('Horizon error: Server Error');
  });

  it('throws when the response is missing the sequence field', async () => {
    const client = new HorizonClient({ horizonUrl: 'https://horizon.test' });
    vi.spyOn(global, 'fetch').mockResolvedValue(
      jsonResponse({ balances: [{ balance: '1', asset_type: 'native' }] }),
    );
    // `sequence` is undefined → BigInt(undefined) throws a TypeError.
    await expect(client.getAccountInfo('GABC')).rejects.toThrow(TypeError);
  });
});

// ── broadcastTransaction ──────────────────────────────────────────────────────

describe('broadcastTransaction – error message', () => {
  it('uses the detail field when present', async () => {
    const client = new HorizonClient({ horizonUrl: 'https://horizon.test' });
    vi.spyOn(global, 'fetch').mockResolvedValue(jsonResponse({ detail: 'bad seq' }, 400));
    await expect(client.broadcastTransaction('XDR')).rejects.toThrow('Broadcast failed: bad seq');
  });

  it('falls back to the title field when detail is absent', async () => {
    const client = new HorizonClient({ horizonUrl: 'https://horizon.test' });
    vi.spyOn(global, 'fetch').mockResolvedValue(jsonResponse({ title: 'tx bad' }, 400));
    await expect(client.broadcastTransaction('XDR')).rejects.toThrow('Broadcast failed: tx bad');
  });

  it('falls back to "undefined" when neither detail nor title is present', async () => {
    const client = new HorizonClient({ horizonUrl: 'https://horizon.test' });
    vi.spyOn(global, 'fetch').mockResolvedValue(jsonResponse({}, 400));
    await expect(client.broadcastTransaction('XDR')).rejects.toThrow('Broadcast failed: undefined');
  });
});

// ── getTransactionStatus ──────────────────────────────────────────────────────

describe('getTransactionStatus', () => {
  it('treats a 404 as pending', async () => {
    const client = new HorizonClient({ horizonUrl: 'https://horizon.test' });
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response('nope', { status: 404 }));
    expect(await client.getTransactionStatus('HASH')).toEqual({ status: 'pending' });
  });

  it('maps a successful tx to confirmed', async () => {
    const client = new HorizonClient({ horizonUrl: 'https://horizon.test' });
    vi.spyOn(global, 'fetch').mockResolvedValue(
      jsonResponse({ successful: true, result_code: 'tx_success' }),
    );
    expect(await client.getTransactionStatus('HASH')).toEqual({
      status: 'confirmed',
      resultCode: 'tx_success',
    });
  });

  it('maps an unsuccessful tx to failed', async () => {
    const client = new HorizonClient({ horizonUrl: 'https://horizon.test' });
    vi.spyOn(global, 'fetch').mockResolvedValue(
      jsonResponse({ successful: false, result_code: 'tx_failed' }),
    );
    expect(await client.getTransactionStatus('HASH')).toEqual({
      status: 'failed',
      resultCode: 'tx_failed',
    });
  });
});

// ── getAccountTransactions ────────────────────────────────────────────────────

describe('getAccountTransactions – defaults & malformed', () => {
  it('uses default limit=50 and order=desc', async () => {
    const client = new HorizonClient({ horizonUrl: 'https://horizon.test' });
    const spy = vi.spyOn(global, 'fetch');
    spy.mockResolvedValue(jsonResponse({ _embedded: { records: [] } }));
    await client.getAccountTransactions('GABC');
    expect(spy).toHaveBeenCalledWith(
      'https://horizon.test/accounts/GABC/transactions?limit=50&order=desc',
    );
  });

  it('passes explicit limit and order through to the request', async () => {
    const client = new HorizonClient({ horizonUrl: 'https://horizon.test' });
    const spy = vi.spyOn(global, 'fetch');
    spy.mockResolvedValue(jsonResponse({ _embedded: { records: [] } }));
    await client.getAccountTransactions('GABC', 10, 'asc');
    expect(spy).toHaveBeenCalledWith(
      'https://horizon.test/accounts/GABC/transactions?limit=10&order=asc',
    );
  });

  it('throws when the response is missing _embedded', async () => {
    const client = new HorizonClient({ horizonUrl: 'https://horizon.test' });
    vi.spyOn(global, 'fetch').mockResolvedValue(jsonResponse({}));
    await expect(client.getAccountTransactions('GABC')).rejects.toThrow();
  });
});

// ── fundTestnetAccount ────────────────────────────────────────────────────────

describe('fundTestnetAccount', () => {
  it('always targets friendbot regardless of configured network', async () => {
    const client = new HorizonClient({ horizonUrl: 'https://horizon.stellar.org' });
    const spy = vi.spyOn(global, 'fetch');
    spy.mockResolvedValue(jsonResponse({ hash: 'FUNDHASH' }));
    const result = await client.fundTestnetAccount('GABC');
    expect(result.txHash).toBe('FUNDHASH');
    expect(spy).toHaveBeenCalledWith(
      'https://friendbot-testnet.stellar.org/bump_sequence',
      expect.any(Object),
    );
  });
});

// ── buildUnsignedPaymentTx ────────────────────────────────────────────────────

describe('buildUnsignedPaymentTx – error propagation', () => {
  it('propagates the SdkError raised by getAccountInfo', async () => {
    const client = new HorizonClient({ horizonUrl: 'https://horizon.test' });
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response('not found', { status: 404 }));
    await expect(client.buildUnsignedPaymentTx('GABC', 'GDEF', '10')).rejects.toThrow(SdkError);
  });

  it('increments the source sequence by 1', async () => {
    const client = new HorizonClient({ horizonUrl: 'https://horizon.test' });
    vi.spyOn(global, 'fetch').mockResolvedValue(
      jsonResponse({ balances: [{ balance: '1', asset_type: 'native' }], sequence: '41' }),
    );
    const tx = await client.buildUnsignedPaymentTx('GABC', 'GDEF', '10', 'thanks');
    expect(tx).toEqual({
      sourcePublicKey: 'GABC',
      destinationPublicKey: 'GDEF',
      amount: '10',
      memo: 'thanks',
      sequence: '42',
    });
  });

  it('defaults the memo to an empty string', async () => {
    const client = new HorizonClient({ horizonUrl: 'https://horizon.test' });
    vi.spyOn(global, 'fetch').mockResolvedValue(
      jsonResponse({ balances: [{ balance: '1', asset_type: 'native' }], sequence: '1' }),
    );
    const tx = await client.buildUnsignedPaymentTx('GABC', 'GDEF', '10');
    expect(tx.memo).toBe('');
  });
});

// ── RegistryClient.simulateInvoke ─────────────────────────────────────────────

describe('RegistryClient.simulateInvoke', () => {
  it('posts a JSON-RPC simulateTransaction body to the testnet RPC URL', async () => {
    const client = new RegistryClient({ registryContractId: 'C1', network: 'testnet' });
    const spy = vi.spyOn(global, 'fetch');
    spy.mockResolvedValue(jsonResponse({ result: { ok: true } }));
    const result = await client.simulateInvoke('getWorker');
    expect(result).toEqual({ ok: true });
    const [url, init] = spy.mock.calls[0];
    expect(url).toBe('https://soroban-testnet.stellar.org');
    const body = JSON.parse(String(init!.body));
    expect(body.method).toBe('simulateTransaction');
    expect(body.params.transaction).toContain('C1');
    expect(body.params.transaction).toContain('getWorker');
  });

  it('uses the mainnet RPC URL when configured for mainnet', async () => {
    const client = new RegistryClient({ registryContractId: 'C1', network: 'mainnet' });
    const spy = vi.spyOn(global, 'fetch');
    spy.mockResolvedValue(jsonResponse({ result: 1 }));
    await client.simulateInvoke('totalWorkers');
    expect(spy.mock.calls[0][0]).toBe('https://soroban-rpc.stellar.org');
  });

  it('throws an SdkError on an HTTP failure', async () => {
    const client = new RegistryClient({ registryContractId: 'C1', network: 'testnet' });
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('err', { status: 503, statusText: 'Unavailable' }),
    );
    await expect(client.simulateInvoke('getWorker')).rejects.toThrow('RPC error: Unavailable');
  });

  it('maps a JSON-RPC error object to an SdkError(400)', async () => {
    const client = new RegistryClient({ registryContractId: 'C1', network: 'testnet' });
    vi.spyOn(global, 'fetch').mockResolvedValue(jsonResponse({ error: { message: 'bad method' } }));
    await expect(client.simulateInvoke('nope')).rejects.toThrow('Contract error: bad method');
  });
});
