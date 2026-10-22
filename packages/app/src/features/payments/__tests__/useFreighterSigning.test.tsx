import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const walletState = vi.hoisted(() => ({
  publicKey: null as string | null,
  networkPassphrase: "Test SDF Network ; September 2015",
  signTransaction: vi.fn(),
}));

vi.mock("@/context/WalletContext", () => ({
  useWallet: () => walletState,
}));

import { useFreighterSigning } from "../hooks/useFreighterSigning";

describe("useFreighterSigning", () => {
  beforeEach(() => {
    walletState.publicKey = null;
    walletState.signTransaction.mockReset();
  });

  it("reports not connected when there is no public key", () => {
    const { result } = renderHook(() => useFreighterSigning());

    expect(result.current.isConnected).toBe(false);
    expect(result.current.publicKey).toBeNull();
  });

  it("delegates to the wallet and returns the signed XDR when connected", async () => {
    walletState.publicKey = "GABC";
    walletState.signTransaction.mockResolvedValue("SIGNED_XDR");
    const { result } = renderHook(() => useFreighterSigning());

    expect(result.current.isConnected).toBe(true);
    expect(result.current.networkPassphrase).toBe(walletState.networkPassphrase);
    await expect(result.current.signTransaction("UNSIGNED")).resolves.toBe("SIGNED_XDR");
    expect(walletState.signTransaction).toHaveBeenCalledWith("UNSIGNED");
  });

  it("propagates wallet signing errors", async () => {
    walletState.publicKey = "GABC";
    walletState.signTransaction.mockRejectedValue(new Error("User declined"));
    const { result } = renderHook(() => useFreighterSigning());

    await expect(result.current.signTransaction("UNSIGNED")).rejects.toThrow("User declined");
  });
});
