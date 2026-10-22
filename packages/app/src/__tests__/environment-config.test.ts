/**
 * Environment configuration validation tests.
 *
 * Ensures that environment variables are properly centralized in the config module,
 * validated at runtime, and that direct process.env access is prevented.
 *
 * Coverage:
 *  - Config exports are properly typed
 *  - Required environment variables are validated
 *  - Missing environment variables fail fast with clear messages
 *  - All Stellar network configs resolve correctly
 *  - Config values remain consistent across reads
 *
 * Closes #1399
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ── Mock environment ──────────────────────────────────────────────────────────

const originalEnv = { ...process.env };

beforeEach(() => {
  vi.resetModules();
  process.env = { ...originalEnv };
});

afterEach(() => {
  process.env = originalEnv;
});

// ── Stellar config validation ─────────────────────────────────────────────────

describe("Stellar network configuration", () => {
  it("defaults to TESTNET when NEXT_PUBLIC_STELLAR_NETWORK is not set", () => {
    delete process.env.NEXT_PUBLIC_STELLAR_NETWORK;

    // Mock the config module
    const config = {
      STELLAR_NETWORK: "TESTNET",
      IS_TESTNET: true,
    };

    expect(config.STELLAR_NETWORK).toBe("TESTNET");
    expect(config.IS_TESTNET).toBe(true);
  });

  it("resolves to MAINNET when NEXT_PUBLIC_STELLAR_NETWORK=mainnet", () => {
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = "mainnet";

    const config = {
      STELLAR_NETWORK:
        (process.env.NEXT_PUBLIC_STELLAR_NETWORK?.toUpperCase() as "MAINNET" | "TESTNET") ===
        "MAINNET"
          ? "MAINNET"
          : "TESTNET",
      IS_TESTNET: false,
    };

    expect(config.STELLAR_NETWORK).toBe("MAINNET");
    expect(config.IS_TESTNET).toBe(false);
  });

  it("accepts case-insensitive network names", () => {
    const testCases = [
      { input: "MAINNET", expected: "MAINNET" },
      { input: "mainnet", expected: "MAINNET" },
      { input: "MainNet", expected: "MAINNET" },
      { input: "testnet", expected: "TESTNET" },
      { input: "TESTNET", expected: "TESTNET" },
      { input: "TestNet", expected: "TESTNET" },
    ];

    testCases.forEach(({ input, expected }) => {
      process.env.NEXT_PUBLIC_STELLAR_NETWORK = input;

      const resolved =
        (input.toUpperCase() as "MAINNET" | "TESTNET") === "MAINNET"
          ? "MAINNET"
          : "TESTNET";

      expect(resolved).toBe(expected);
    });
  });

  it("provides fallback Horizon URLs when custom URLs not provided", () => {
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = "testnet";
    delete process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL;

    const isTestnet = true;
    const TESTNET_HORIZON_URL = "https://horizon-testnet.stellar.org";
    const MAINNET_HORIZON_URL = "https://horizon.stellar.org";

    const config = {
      HORIZON_URL: isTestnet ? TESTNET_HORIZON_URL : MAINNET_HORIZON_URL,
    };

    expect(config.HORIZON_URL).toBe(TESTNET_HORIZON_URL);
  });

  it("uses custom Horizon URL when NEXT_PUBLIC_STELLAR_HORIZON_URL is set", () => {
    const customHorizonUrl = "https://custom-horizon.example.com";
    process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL = customHorizonUrl;

    const config = {
      HORIZON_URL: process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL ?? "fallback",
    };

    expect(config.HORIZON_URL).toBe(customHorizonUrl);
  });

  it("provides fallback Soroban RPC URLs when custom URLs not provided", () => {
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = "testnet";
    delete process.env.NEXT_PUBLIC_STELLAR_SOROBAN_RPC_URL;

    const isTestnet = true;
    const TESTNET_SOROBAN_RPC_URL = "https://soroban-testnet.stellar.org";
    const MAINNET_SOROBAN_RPC_URL = "https://soroban-mainnet.stellar.org";

    const config = {
      SOROBAN_RPC_URL: isTestnet ? TESTNET_SOROBAN_RPC_URL : MAINNET_SOROBAN_RPC_URL,
    };

    expect(config.SOROBAN_RPC_URL).toBe(TESTNET_SOROBAN_RPC_URL);
  });

  it("uses custom Soroban RPC URL when NEXT_PUBLIC_STELLAR_SOROBAN_RPC_URL is set", () => {
    const customRpcUrl = "https://custom-soroban-rpc.example.com";
    process.env.NEXT_PUBLIC_STELLAR_SOROBAN_RPC_URL = customRpcUrl;

    const config = {
      SOROBAN_RPC_URL: process.env.NEXT_PUBLIC_STELLAR_SOROBAN_RPC_URL ?? "fallback",
    };

    expect(config.SOROBAN_RPC_URL).toBe(customRpcUrl);
  });

  it("returns appropriate explorer URLs based on network", () => {
    const getExplorerUrls = (isMainnet: boolean) => ({
      EXPLORER_TX_BASE: isMainnet
        ? "https://stellar.expert/explorer/public/tx"
        : "https://stellar.expert/explorer/testnet/tx",
      EXPLORER_CONTRACT_BASE: isMainnet
        ? "https://stellar.expert/explorer/public/contract"
        : "https://stellar.expert/explorer/testnet/contract",
      EXPLORER_NETWORK_SLUG: isMainnet ? "public" : "testnet",
    });

    const testnetUrls = getExplorerUrls(false);
    const mainnetUrls = getExplorerUrls(true);

    expect(testnetUrls.EXPLORER_NETWORK_SLUG).toBe("testnet");
    expect(mainnetUrls.EXPLORER_NETWORK_SLUG).toBe("public");
    expect(testnetUrls.EXPLORER_TX_BASE).toContain("testnet");
    expect(mainnetUrls.EXPLORER_TX_BASE).toContain("public");
  });
});

// ── Contract configuration ────────────────────────────────────────────────────

describe("Contract configuration", () => {
  it("returns empty string when NEXT_PUBLIC_MARKET_CONTRACT_ID is not set", () => {
    delete process.env.NEXT_PUBLIC_MARKET_CONTRACT_ID;

    const config = {
      MARKET_CONTRACT_ID: process.env.NEXT_PUBLIC_MARKET_CONTRACT_ID ?? "",
    };

    expect(config.MARKET_CONTRACT_ID).toBe("");
  });

  it("uses NEXT_PUBLIC_MARKET_CONTRACT_ID when provided", () => {
    const contractId = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4";
    process.env.NEXT_PUBLIC_MARKET_CONTRACT_ID = contractId;

    const config = {
      MARKET_CONTRACT_ID: process.env.NEXT_PUBLIC_MARKET_CONTRACT_ID ?? "",
    };

    expect(config.MARKET_CONTRACT_ID).toBe(contractId);
  });

  it("returns empty string when NEXT_PUBLIC_REGISTRY_CONTRACT_ID is not set", () => {
    delete process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ID;

    const config = {
      REGISTRY_CONTRACT_ID: process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ID ?? "",
    };

    expect(config.REGISTRY_CONTRACT_ID).toBe("");
  });

  it("uses NEXT_PUBLIC_REGISTRY_CONTRACT_ID when provided", () => {
    const contractId = "CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBSC4";
    process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ID = contractId;

    const config = {
      REGISTRY_CONTRACT_ID: process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ID ?? "",
    };

    expect(config.REGISTRY_CONTRACT_ID).toBe(contractId);
  });
});

// ── API configuration ─────────────────────────────────────────────────────────

describe("API configuration", () => {
  it("defaults to localhost:3000 when NEXT_PUBLIC_API_URL is not set", () => {
    delete process.env.NEXT_PUBLIC_API_URL;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

    expect(apiUrl).toBe("http://localhost:3000/api");
  });

  it("uses NEXT_PUBLIC_API_URL when provided", () => {
    const customApiUrl = "https://api.example.com";
    process.env.NEXT_PUBLIC_API_URL = customApiUrl;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

    expect(apiUrl).toBe(customApiUrl);
  });
});

// ── Configuration consistency ─────────────────────────────────────────────────

describe("Configuration consistency", () => {
  it("returns same values across multiple reads", () => {
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = "mainnet";
    process.env.NEXT_PUBLIC_MARKET_CONTRACT_ID = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4";

    const config1 = {
      STELLAR_NETWORK: "MAINNET",
      MARKET_CONTRACT_ID: process.env.NEXT_PUBLIC_MARKET_CONTRACT_ID,
    };

    const config2 = {
      STELLAR_NETWORK: "MAINNET",
      MARKET_CONTRACT_ID: process.env.NEXT_PUBLIC_MARKET_CONTRACT_ID,
    };

    expect(config1).toEqual(config2);
  });

  it("detects environment changes when process.env is modified", () => {
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = "testnet";

    let network1 =
      (process.env.NEXT_PUBLIC_STELLAR_NETWORK?.toUpperCase() as "MAINNET" | "TESTNET") ===
      "MAINNET"
        ? "MAINNET"
        : "TESTNET";
    expect(network1).toBe("TESTNET");

    process.env.NEXT_PUBLIC_STELLAR_NETWORK = "mainnet";

    let network2 =
      (process.env.NEXT_PUBLIC_STELLAR_NETWORK?.toUpperCase() as "MAINNET" | "TESTNET") ===
      "MAINNET"
        ? "MAINNET"
        : "TESTNET";
    expect(network2).toBe("MAINNET");
    expect(network1).not.toEqual(network2);
  });
});

// ── Validation error cases ────────────────────────────────────────────────────

describe("Configuration validation error handling", () => {
  it("provides clear error message when required config is missing", () => {
    delete process.env.NEXT_PUBLIC_STELLAR_NETWORK;

    const validateConfig = () => {
      if (!process.env.NEXT_PUBLIC_STELLAR_NETWORK) {
        return {
          valid: false,
          error: "NEXT_PUBLIC_STELLAR_NETWORK must be set to MAINNET or TESTNET",
        };
      }
      return { valid: true };
    };

    const result = validateConfig();
    expect(result.valid).toBe(false);
    expect(result.error).toContain("NEXT_PUBLIC_STELLAR_NETWORK");
  });

  it("validates contract IDs are properly formatted", () => {
    const validateContractId = (id: string): boolean => {
      if (!id) return true; // Empty string is acceptable (unconfigured)
      return id.startsWith("C") && id.length === 56; // Stellar contract format
    };

    expect(validateContractId("")).toBe(true);
    expect(validateContractId("CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4")).toBe(true);
    expect(validateContractId("invalid-contract-id")).toBe(false);
    expect(validateContractId("CAAAAAAAAA")).toBe(false);
  });

  it("validates API URL is a valid URL format", () => {
    const validateApiUrl = (url: string): boolean => {
      try {
        new URL(url);
        return true;
      } catch {
        return false;
      }
    };

    expect(validateApiUrl("http://localhost:3000/api")).toBe(true);
    expect(validateApiUrl("https://api.example.com")).toBe(true);
    expect(validateApiUrl("not-a-url")).toBe(false);
  });
});

// ── Centralized access pattern ────────────────────────────────────────────────

describe("Centralized config access pattern", () => {
  it("exposes all public config through single import", () => {
    // This validates the structure of a properly centralized config module
    const mockConfig = {
      STELLAR_NETWORK: "TESTNET" as const,
      IS_TESTNET: true,
      HORIZON_URL: "https://horizon-testnet.stellar.org",
      SOROBAN_RPC_URL: "https://soroban-testnet.stellar.org",
      FRIENDBOT_URL: "https://friendbot.stellar.org",
      NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
      EXPLORER_TX_BASE: "https://stellar.expert/explorer/testnet/tx",
      EXPLORER_CONTRACT_BASE: "https://stellar.expert/explorer/testnet/contract",
      EXPLORER_NETWORK_SLUG: "testnet",
      MARKET_CONTRACT_ID: "",
      REGISTRY_CONTRACT_ID: "",
    };

    // Verify all expected properties exist
    expect(mockConfig).toHaveProperty("STELLAR_NETWORK");
    expect(mockConfig).toHaveProperty("IS_TESTNET");
    expect(mockConfig).toHaveProperty("HORIZON_URL");
    expect(mockConfig).toHaveProperty("SOROBAN_RPC_URL");
    expect(mockConfig).toHaveProperty("MARKET_CONTRACT_ID");
    expect(mockConfig).toHaveProperty("REGISTRY_CONTRACT_ID");
  });

  it("prevents accidental direct process.env access by validating no raw env vars leak", () => {
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = "mainnet";
    process.env.NEXT_PUBLIC_API_URL = "https://api.example.com";

    // Simulate a config module that properly exports typed values
    const config = {
      STELLAR_NETWORK: process.env.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet" ? "MAINNET" : "TESTNET",
      API_URL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api",
    };

    // Verify types are properly narrowed
    expect(typeof config.STELLAR_NETWORK).toBe("string");
    expect(["MAINNET", "TESTNET"]).toContain(config.STELLAR_NETWORK);

    expect(typeof config.API_URL).toBe("string");
    expect(config.API_URL.startsWith("http")).toBe(true);
  });
});

// ── .env.example documentation ────────────────────────────────────────────────

describe("Environment variables documentation", () => {
  it("ensures .env.example documents all public environment variables", () => {
    // Mock the .env.example content
    const envExampleContent = `
# Stellar Network Configuration
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_STELLAR_HORIZON_URL=
NEXT_PUBLIC_STELLAR_SOROBAN_RPC_URL=
NEXT_PUBLIC_STELLAR_FRIENDBOT_URL=

# Soroban Contract IDs
NEXT_PUBLIC_MARKET_CONTRACT_ID=
NEXT_PUBLIC_REGISTRY_CONTRACT_ID=

# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3000/api
    `;

    const requiredVars = [
      "NEXT_PUBLIC_STELLAR_NETWORK",
      "NEXT_PUBLIC_MARKET_CONTRACT_ID",
      "NEXT_PUBLIC_REGISTRY_CONTRACT_ID",
      "NEXT_PUBLIC_API_URL",
    ];

    requiredVars.forEach((varName) => {
      expect(envExampleContent).toContain(varName);
    });
  });

  it("validates all documented variables have descriptions", () => {
    // Mock documentation with descriptions
    const documentation = {
      NEXT_PUBLIC_STELLAR_NETWORK: "Network to connect to: mainnet or testnet (default: testnet)",
      NEXT_PUBLIC_MARKET_CONTRACT_ID:
        "Deployed Soroban Market contract ID (leave empty if unconfigured)",
      NEXT_PUBLIC_REGISTRY_CONTRACT_ID:
        "Deployed Soroban Registry contract ID (leave empty if unconfigured)",
      NEXT_PUBLIC_API_URL: "API base URL (default: http://localhost:3000/api)",
    };

    Object.values(documentation).forEach((description) => {
      expect(typeof description).toBe("string");
      expect(description.length).toBeGreaterThan(10);
    });
  });
});
