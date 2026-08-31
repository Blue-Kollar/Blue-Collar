/**
 * Unit tests for src/config/stellar.ts
 *
 * Closes #1207 — verifies that the network config module correctly derives
 * URLs and flags from the NEXT_PUBLIC_STELLAR_NETWORK environment variable.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// We need to re-import the module after mutating process.env so we use
// vi.resetModules() to get a fresh module evaluation each time.
describe("stellar config", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    Object.assign(process.env, originalEnv);
    vi.resetModules();
  });

  it("defaults to testnet when NEXT_PUBLIC_STELLAR_NETWORK is unset", async () => {
    delete process.env.NEXT_PUBLIC_STELLAR_NETWORK;
    vi.resetModules();
    const config = await import("@/config/stellar");
    expect(config.STELLAR_NETWORK).toBe("TESTNET");
    expect(config.IS_TESTNET).toBe(true);
    expect(config.HORIZON_URL).toContain("testnet");
    expect(config.SOROBAN_RPC_URL).toContain("testnet");
    expect(config.NETWORK_PASSPHRASE).toBe("Test SDF Network ; September 2015");
    expect(config.EXPLORER_TX_BASE).toContain("testnet");
    expect(config.EXPLORER_CONTRACT_BASE).toContain("testnet");
    expect(config.EXPLORER_NETWORK_SLUG).toBe("testnet");
  });

  it("switches to mainnet when NEXT_PUBLIC_STELLAR_NETWORK=MAINNET", async () => {
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = "MAINNET";
    vi.resetModules();
    const config = await import("@/config/stellar");
    expect(config.STELLAR_NETWORK).toBe("MAINNET");
    expect(config.IS_TESTNET).toBe(false);
    expect(config.HORIZON_URL).toBe("https://horizon.stellar.org");
    expect(config.SOROBAN_RPC_URL).toBe("https://soroban-mainnet.stellar.org");
    expect(config.NETWORK_PASSPHRASE).toBe("Public Global Stellar Network ; September 2015");
    expect(config.EXPLORER_TX_BASE).toContain("public");
    expect(config.EXPLORER_NETWORK_SLUG).toBe("public");
  });

  it("is case-insensitive for the network name (mainnet)", async () => {
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = "mainnet";
    vi.resetModules();
    const config = await import("@/config/stellar");
    expect(config.STELLAR_NETWORK).toBe("MAINNET");
    expect(config.IS_TESTNET).toBe(false);
  });

  it("treats unknown network values as testnet", async () => {
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = "STAGING";
    vi.resetModules();
    const config = await import("@/config/stellar");
    expect(config.STELLAR_NETWORK).toBe("TESTNET");
    expect(config.IS_TESTNET).toBe(true);
  });

  it("honours NEXT_PUBLIC_STELLAR_HORIZON_URL override", async () => {
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = "TESTNET";
    process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL = "http://localhost:8000";
    vi.resetModules();
    const config = await import("@/config/stellar");
    expect(config.HORIZON_URL).toBe("http://localhost:8000");
  });

  it("honours NEXT_PUBLIC_STELLAR_SOROBAN_RPC_URL override", async () => {
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = "TESTNET";
    process.env.NEXT_PUBLIC_STELLAR_SOROBAN_RPC_URL = "http://localhost:8001";
    vi.resetModules();
    const config = await import("@/config/stellar");
    expect(config.SOROBAN_RPC_URL).toBe("http://localhost:8001");
  });

  it("honours NEXT_PUBLIC_STELLAR_FRIENDBOT_URL override", async () => {
    process.env.NEXT_PUBLIC_STELLAR_FRIENDBOT_URL = "http://localhost:8002/friendbot";
    vi.resetModules();
    const config = await import("@/config/stellar");
    expect(config.FRIENDBOT_URL).toBe("http://localhost:8002/friendbot");
  });

  it("EXPLORER_TX_BASE and EXPLORER_CONTRACT_BASE differ only in the last path segment", async () => {
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = "TESTNET";
    vi.resetModules();
    const config = await import("@/config/stellar");
    expect(config.EXPLORER_TX_BASE).toMatch(/\/tx$/);
    expect(config.EXPLORER_CONTRACT_BASE).toMatch(/\/contract$/);
  });
});
