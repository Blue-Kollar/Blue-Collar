/**
 * Unit tests for shared Stellar network constants.
 *
 * These tests assert that every constant has the exact value mandated by the
 * Stellar protocol and SDF's published network definitions.  A mismatch here
 * means a real transaction could be signed against the wrong network.
 *
 * Issue: #1295 — Consolidate duplicate constants into packages/sdk/src/constants.ts
 */

import { describe, it, expect } from 'vitest';
import {
  // Network names
  TESTNET_PASSPHRASE,
  MAINNET_PASSPHRASE,
  NETWORK_PASSPHRASES,
  // Horizon URLs
  TESTNET_HORIZON_URL,
  MAINNET_HORIZON_URL,
  HORIZON_URLS,
  // Soroban RPC URLs
  TESTNET_SOROBAN_RPC_URL,
  MAINNET_SOROBAN_RPC_URL,
  SOROBAN_RPC_URLS,
  // Friendbot
  TESTNET_FRIENDBOT_URL,
  // Explorer
  TESTNET_EXPLORER_TX_BASE,
  MAINNET_EXPLORER_TX_BASE,
  TESTNET_EXPLORER_CONTRACT_BASE,
  MAINNET_EXPLORER_CONTRACT_BASE,
  // Numeric
  STROOPS_PER_XLM,
  XLM_DECIMAL_PLACES,
  MIN_XLM_AMOUNT,
  BASE_FEE_STROOPS,
  // Combined record
  STELLAR_NETWORKS,
} from '../constants.js';

// ─── Network passphrases ──────────────────────────────────────────────────────

describe('network passphrases', () => {
  it('TESTNET_PASSPHRASE matches the official SDF value', () => {
    expect(TESTNET_PASSPHRASE).toBe('Test SDF Network ; September 2015');
  });

  it('MAINNET_PASSPHRASE matches the official SDF value', () => {
    expect(MAINNET_PASSPHRASE).toBe('Public Global Stellar Network ; September 2015');
  });

  it('NETWORK_PASSPHRASES.testnet equals TESTNET_PASSPHRASE', () => {
    expect(NETWORK_PASSPHRASES.testnet).toBe(TESTNET_PASSPHRASE);
  });

  it('NETWORK_PASSPHRASES.mainnet equals MAINNET_PASSPHRASE', () => {
    expect(NETWORK_PASSPHRASES.mainnet).toBe(MAINNET_PASSPHRASE);
  });

  it('testnet and mainnet passphrases are distinct (no copy-paste mistake)', () => {
    expect(TESTNET_PASSPHRASE).not.toBe(MAINNET_PASSPHRASE);
  });
});

// ─── Horizon URLs ─────────────────────────────────────────────────────────────

describe('Horizon URLs', () => {
  it('TESTNET_HORIZON_URL points to the official SDF testnet endpoint', () => {
    expect(TESTNET_HORIZON_URL).toBe('https://horizon-testnet.stellar.org');
  });

  it('MAINNET_HORIZON_URL points to the official SDF mainnet endpoint', () => {
    expect(MAINNET_HORIZON_URL).toBe('https://horizon.stellar.org');
  });

  it('HORIZON_URLS.testnet equals TESTNET_HORIZON_URL', () => {
    expect(HORIZON_URLS.testnet).toBe(TESTNET_HORIZON_URL);
  });

  it('HORIZON_URLS.mainnet equals MAINNET_HORIZON_URL', () => {
    expect(HORIZON_URLS.mainnet).toBe(MAINNET_HORIZON_URL);
  });

  it('URLs use https', () => {
    expect(TESTNET_HORIZON_URL.startsWith('https://')).toBe(true);
    expect(MAINNET_HORIZON_URL.startsWith('https://')).toBe(true);
  });

  it('URLs have no trailing slash', () => {
    expect(TESTNET_HORIZON_URL.endsWith('/')).toBe(false);
    expect(MAINNET_HORIZON_URL.endsWith('/')).toBe(false);
  });
});

// ─── Soroban RPC URLs ─────────────────────────────────────────────────────────

describe('Soroban RPC URLs', () => {
  it('TESTNET_SOROBAN_RPC_URL points to the official SDF testnet RPC endpoint', () => {
    expect(TESTNET_SOROBAN_RPC_URL).toBe('https://soroban-testnet.stellar.org');
  });

  it('MAINNET_SOROBAN_RPC_URL points to the official SDF mainnet RPC endpoint', () => {
    expect(MAINNET_SOROBAN_RPC_URL).toBe('https://soroban-mainnet.stellar.org');
  });

  it('SOROBAN_RPC_URLS.testnet equals TESTNET_SOROBAN_RPC_URL', () => {
    expect(SOROBAN_RPC_URLS.testnet).toBe(TESTNET_SOROBAN_RPC_URL);
  });

  it('SOROBAN_RPC_URLS.mainnet equals MAINNET_SOROBAN_RPC_URL', () => {
    expect(SOROBAN_RPC_URLS.mainnet).toBe(MAINNET_SOROBAN_RPC_URL);
  });

  it('URLs use https', () => {
    expect(TESTNET_SOROBAN_RPC_URL.startsWith('https://')).toBe(true);
    expect(MAINNET_SOROBAN_RPC_URL.startsWith('https://')).toBe(true);
  });

  it('URLs have no trailing slash', () => {
    expect(TESTNET_SOROBAN_RPC_URL.endsWith('/')).toBe(false);
    expect(MAINNET_SOROBAN_RPC_URL.endsWith('/')).toBe(false);
  });
});

// ─── Friendbot ────────────────────────────────────────────────────────────────

describe('Friendbot', () => {
  it('TESTNET_FRIENDBOT_URL contains the expected endpoint', () => {
    expect(TESTNET_FRIENDBOT_URL).toBe('https://friendbot-testnet.stellar.org/bump_sequence');
  });

  it('TESTNET_FRIENDBOT_URL uses https', () => {
    expect(TESTNET_FRIENDBOT_URL.startsWith('https://')).toBe(true);
  });
});

// ─── Explorer URLs ────────────────────────────────────────────────────────────

describe('Explorer URLs', () => {
  it('TESTNET_EXPLORER_TX_BASE is the stellar.expert testnet tx path', () => {
    expect(TESTNET_EXPLORER_TX_BASE).toBe('https://stellar.expert/explorer/testnet/tx');
  });

  it('MAINNET_EXPLORER_TX_BASE is the stellar.expert mainnet tx path', () => {
    expect(MAINNET_EXPLORER_TX_BASE).toBe('https://stellar.expert/explorer/public/tx');
  });

  it('TESTNET_EXPLORER_CONTRACT_BASE is the stellar.expert testnet contract path', () => {
    expect(TESTNET_EXPLORER_CONTRACT_BASE).toBe('https://stellar.expert/explorer/testnet/contract');
  });

  it('MAINNET_EXPLORER_CONTRACT_BASE is the stellar.expert mainnet contract path', () => {
    expect(MAINNET_EXPLORER_CONTRACT_BASE).toBe('https://stellar.expert/explorer/public/contract');
  });
});

// ─── Numeric constants ────────────────────────────────────────────────────────

describe('numeric constants', () => {
  it('STROOPS_PER_XLM is 10,000,000 (BigInt)', () => {
    expect(STROOPS_PER_XLM).toBe(10_000_000n);
  });

  it('XLM_DECIMAL_PLACES is 7', () => {
    expect(XLM_DECIMAL_PLACES).toBe(7);
  });

  it('MIN_XLM_AMOUNT equals 1 stroop expressed in XLM (1 / STROOPS_PER_XLM)', () => {
    expect(MIN_XLM_AMOUNT).toBe(1 / 10_000_000);
    expect(MIN_XLM_AMOUNT).toBe(0.0000001);
  });

  it('BASE_FEE_STROOPS is 100 stroops', () => {
    expect(BASE_FEE_STROOPS).toBe(100);
  });

  it('STROOPS_PER_XLM has the correct number of decimal places', () => {
    // 10^7 = 10_000_000, which means 7 decimal places — consistent with XLM_DECIMAL_PLACES
    expect(STROOPS_PER_XLM.toString().length - 1).toBe(XLM_DECIMAL_PLACES);
  });
});

// ─── STELLAR_NETWORKS combined record ─────────────────────────────────────────

describe('STELLAR_NETWORKS combined record', () => {
  it('testnet entry contains the correct passphrase', () => {
    expect(STELLAR_NETWORKS.testnet.passphrase).toBe(TESTNET_PASSPHRASE);
  });

  it('mainnet entry contains the correct passphrase', () => {
    expect(STELLAR_NETWORKS.mainnet.passphrase).toBe(MAINNET_PASSPHRASE);
  });

  it('testnet entry contains the correct Horizon URL', () => {
    expect(STELLAR_NETWORKS.testnet.horizonUrl).toBe(TESTNET_HORIZON_URL);
  });

  it('mainnet entry contains the correct Horizon URL', () => {
    expect(STELLAR_NETWORKS.mainnet.horizonUrl).toBe(MAINNET_HORIZON_URL);
  });

  it('testnet entry contains the correct Soroban RPC URL', () => {
    expect(STELLAR_NETWORKS.testnet.sorobanRpcUrl).toBe(TESTNET_SOROBAN_RPC_URL);
  });

  it('mainnet entry contains the correct Soroban RPC URL', () => {
    expect(STELLAR_NETWORKS.mainnet.sorobanRpcUrl).toBe(MAINNET_SOROBAN_RPC_URL);
  });

  it('testnet has a friendbotUrl', () => {
    expect(STELLAR_NETWORKS.testnet.friendbotUrl).toBe(TESTNET_FRIENDBOT_URL);
  });

  it('mainnet has no friendbotUrl (null)', () => {
    expect(STELLAR_NETWORKS.mainnet.friendbotUrl).toBeNull();
  });

  it('testnet and mainnet entries are distinct (no aliasing)', () => {
    expect(STELLAR_NETWORKS.testnet).not.toBe(STELLAR_NETWORKS.mainnet);
    expect(STELLAR_NETWORKS.testnet.passphrase).not.toBe(STELLAR_NETWORKS.mainnet.passphrase);
  });
});

// ─── Cross-constant consistency checks ───────────────────────────────────────

describe('cross-constant consistency', () => {
  it('NETWORK_PASSPHRASES map is consistent with individual constants', () => {
    expect(NETWORK_PASSPHRASES).toEqual({
      testnet: TESTNET_PASSPHRASE,
      mainnet: MAINNET_PASSPHRASE,
    });
  });

  it('HORIZON_URLS map is consistent with individual constants', () => {
    expect(HORIZON_URLS).toEqual({
      testnet: TESTNET_HORIZON_URL,
      mainnet: MAINNET_HORIZON_URL,
    });
  });

  it('SOROBAN_RPC_URLS map is consistent with individual constants', () => {
    expect(SOROBAN_RPC_URLS).toEqual({
      testnet: TESTNET_SOROBAN_RPC_URL,
      mainnet: MAINNET_SOROBAN_RPC_URL,
    });
  });

  it('STELLAR_NETWORKS testnet entry is fully consistent with individual constants', () => {
    expect(STELLAR_NETWORKS.testnet).toMatchObject({
      passphrase: TESTNET_PASSPHRASE,
      horizonUrl: TESTNET_HORIZON_URL,
      sorobanRpcUrl: TESTNET_SOROBAN_RPC_URL,
      friendbotUrl: TESTNET_FRIENDBOT_URL,
    });
  });

  it('STELLAR_NETWORKS mainnet entry is fully consistent with individual constants', () => {
    expect(STELLAR_NETWORKS.mainnet).toMatchObject({
      passphrase: MAINNET_PASSPHRASE,
      horizonUrl: MAINNET_HORIZON_URL,
      sorobanRpcUrl: MAINNET_SOROBAN_RPC_URL,
    });
  });
});
