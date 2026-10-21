/**
 * wallet.service.injection.test.ts — unit tests for WalletService with an
 * injected Stellar client (#1585).
 *
 * The default Stellar client is replaced with a proxy that throws on any
 * access, so these tests fail if the service ever reaches for the real
 * network instead of the injected fake.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/clients/stellar.client.js', () => ({
  stellarClient: new Proxy(
    {},
    {
      get() {
        throw new Error('default stellar client must not be used');
      },
    },
  ),
  StellarClient: vi.fn(),
}));

vi.mock('@/repositories/wallet.repository.js', () => ({
  walletRepository: new Proxy(
    {},
    {
      get() {
        throw new Error('default wallet repository must not be used');
      },
    },
  ),
}));

import { createWalletService } from './wallet.service.js';
import { AppError } from '@/utils/app-error.js';
import type { StellarClient } from '@/clients/stellar.client.js';

const PUBLIC_KEY = 'GABC';
const USER_ID = 'user-1';

function makeFakeClient() {
  return {
    getAccountInfo: vi.fn().mockResolvedValue({ balance: 42, sequence: BigInt(7) }),
  };
}

function makeFakeRepo() {
  return {
    upsertAccount: vi.fn(
      async (publicKey: string, userId: string, balance: number, sequence: bigint) => ({
        publicKey,
        userId,
        balance,
        sequence,
        lastSyncedAt: new Date(0),
      }),
    ),
    findByUserId: vi.fn().mockResolvedValue(null),
    findByPublicKey: vi.fn().mockResolvedValue(null),
  };
}

describe('createWalletService with injected Stellar client', () => {
  let client: ReturnType<typeof makeFakeClient>;
  let repo: ReturnType<typeof makeFakeRepo>;
  let service: ReturnType<typeof createWalletService>;

  beforeEach(() => {
    client = makeFakeClient();
    repo = makeFakeRepo();
    service = createWalletService({
      stellarClient: client as unknown as StellarClient,
      walletRepository: repo as any,
    });
  });

  describe('syncStellarAccount', () => {
    it('reads account info from the injected client and persists it', async () => {
      await service.syncStellarAccount(USER_ID, PUBLIC_KEY);

      expect(client.getAccountInfo).toHaveBeenCalledWith(PUBLIC_KEY);
      expect(repo.upsertAccount).toHaveBeenCalledWith(PUBLIC_KEY, USER_ID, 42, BigInt(7));
    });
  });

  describe('getUserBalance', () => {
    it('returns the cached balance for a linked account without calling the client', async () => {
      repo.findByUserId.mockResolvedValueOnce({
        publicKey: PUBLIC_KEY,
        balance: 10,
        lastSyncedAt: new Date(0),
      });

      const result = await service.getUserBalance(USER_ID);

      expect(result).toEqual({ publicKey: PUBLIC_KEY, balance: 10, lastSyncedAt: new Date(0) });
      expect(client.getAccountInfo).not.toHaveBeenCalled();
    });

    it('throws 404 when the user has no linked account', async () => {
      await expect(service.getUserBalance(USER_ID)).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('buildUnsignedTx', () => {
    it('uses the next sequence number from the injected client', async () => {
      repo.findByPublicKey.mockResolvedValueOnce({ publicKey: PUBLIC_KEY, userId: USER_ID });

      const tx = await service.buildUnsignedTx(PUBLIC_KEY, 'GDEST', '5', 'thanks');

      expect(tx.sequence).toBe('8');
      expect(tx.memo).toBe('thanks');
      expect(tx.destinationPublicKey).toBe('GDEST');
    });

    it('defaults the memo to an empty string', async () => {
      repo.findByPublicKey.mockResolvedValueOnce({ publicKey: PUBLIC_KEY, userId: USER_ID });

      const tx = await service.buildUnsignedTx(PUBLIC_KEY, 'GDEST', '5');

      expect(tx.memo).toBe('');
    });

    it('throws 404 when the source account is not stored', async () => {
      await expect(service.buildUnsignedTx(PUBLIC_KEY, 'GDEST', '5')).rejects.toMatchObject({
        statusCode: 404,
      });
      expect(client.getAccountInfo).not.toHaveBeenCalled();
    });
  });

  describe('linkStellarAccount', () => {
    it('links a new account using the injected client balance and sequence', async () => {
      await service.linkStellarAccount(USER_ID, PUBLIC_KEY);

      expect(repo.upsertAccount).toHaveBeenCalledWith(PUBLIC_KEY, USER_ID, 42, BigInt(7));
    });

    it('allows the same user to re-link their own account', async () => {
      repo.findByPublicKey.mockResolvedValueOnce({ publicKey: PUBLIC_KEY, userId: USER_ID });

      await expect(service.linkStellarAccount(USER_ID, PUBLIC_KEY)).resolves.toBeDefined();
    });

    it('throws 409 when the public key belongs to a different user', async () => {
      repo.findByPublicKey.mockResolvedValueOnce({ publicKey: PUBLIC_KEY, userId: 'other-user' });

      await expect(service.linkStellarAccount(USER_ID, PUBLIC_KEY)).rejects.toBeInstanceOf(
        AppError,
      );
      expect(repo.upsertAccount).not.toHaveBeenCalled();
    });
  });
});
