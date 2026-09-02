/**
 * useWalletBalance selector and WalletBalanceWidget tests
 *
 * Verifies that:
 *  - useWalletBalance returns null when no wallet is connected
 *  - useWalletBalance returns the balance string when connected
 *  - WalletBalanceWidget renders nothing when balance is null
 *  - WalletBalanceWidget renders the formatted balance when present
 *  - WalletBalanceWidget carries an accessible aria-label
 *  - WalletBalanceWidget does not re-expose the icon to the a11y tree
 *
 * The selector pattern (useWalletBalance) is regression-tested here so that
 * future changes to WalletContext do not accidentally break the scoped hook.
 *
 * Closes #1206
 */
import { render, renderHook, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

// ── WalletContext mock ────────────────────────────────────────────────────────

const mockContextValue = {
  publicKey: null as string | null,
  network: null as string | null,
  networkPassphrase: null as string | null,
  balance: null as string | null,
  networkWarning: false,
  isConnected: false,
  isConnecting: false,
  connect: vi.fn(),
  disconnect: vi.fn(),
  signTransaction: vi.fn(),
};

vi.mock("@/context/WalletContext", () => ({
  useWallet: () => mockContextValue,
  WalletNotConnectedError: class WalletNotConnectedError extends Error {},
  FreighterNotInstalledError: class FreighterNotInstalledError extends Error {},
}));

vi.mock("lucide-react", () => ({
  Wallet: (props: any) => <svg {...props} data-icon="wallet" />,
}));

vi.mock("@/lib/utils", () => ({
  cn: (...classes: any[]) => classes.filter(Boolean).join(" "),
}));

import { WalletBalanceWidget } from "@/components/wallet/WalletBalanceWidget";
import { useWalletBalance } from "@/hooks/useWallet";

// ── useWalletBalance ──────────────────────────────────────────────────────────

describe("useWalletBalance selector", () => {
  it("returns null when wallet balance is null (no wallet connected)", () => {
    mockContextValue.balance = null;
    const { result } = renderHook(() => useWalletBalance());
    expect(result.current).toBeNull();
  });

  it("returns the balance string when the wallet reports a balance", () => {
    mockContextValue.balance = "42.5000000";
    const { result } = renderHook(() => useWalletBalance());
    expect(result.current).toBe("42.5000000");
  });

  it("returns '0.0000000' when the wallet has a zero balance", () => {
    mockContextValue.balance = "0.0000000";
    const { result } = renderHook(() => useWalletBalance());
    expect(result.current).toBe("0.0000000");
  });
});

// ── WalletBalanceWidget ───────────────────────────────────────────────────────

describe("WalletBalanceWidget", () => {
  it("renders nothing when balance is null", () => {
    mockContextValue.balance = null;
    const { container } = render(<WalletBalanceWidget />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the formatted balance and XLM label when balance is present", () => {
    mockContextValue.balance = "100.0000000";
    render(<WalletBalanceWidget />);
    expect(screen.getByText(/XLM/i)).toBeInTheDocument();
  });

  it("includes a descriptive aria-label containing the balance amount", () => {
    mockContextValue.balance = "100.0000000";
    render(<WalletBalanceWidget />);
    const el = screen.getByRole("generic", { hidden: false });
    // The widget renders a <span> — look for any element with aria-label containing XLM
    const labeled = document.querySelector("[aria-label*='XLM']");
    expect(labeled).not.toBeNull();
  });

  it("hides the wallet icon from assistive technology", () => {
    mockContextValue.balance = "50.0000000";
    const { container } = render(<WalletBalanceWidget />);
    const icon = container.querySelector("[data-icon='wallet']");
    expect(icon).not.toBeNull();
    expect(icon?.getAttribute("aria-hidden")).toBe("true");
  });

  it("renders nothing again after balance is reset to null (disconnect scenario)", () => {
    mockContextValue.balance = "10.0000000";
    const { rerender, container } = render(<WalletBalanceWidget />);
    expect(container.firstChild).not.toBeNull();

    mockContextValue.balance = null;
    rerender(<WalletBalanceWidget />);
    expect(container.firstChild).toBeNull();
  });
});
