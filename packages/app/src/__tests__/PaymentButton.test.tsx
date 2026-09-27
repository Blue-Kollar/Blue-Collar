import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import PaymentButton from "@/components/Payment/PaymentButton";
import { PaymentFlowProvider } from "@/context/PaymentFlowContext";

vi.mock("@/components/TipModal", () => ({
  default: ({ trigger }: { trigger: React.ReactNode }) => <div>{trigger}</div>,
}));

vi.mock("lucide-react", () => ({
  Wallet: () => <span data-testid="wallet-icon" />,
}));

describe("PaymentButton", () => {
  it("renders enabled button when walletAddress is provided as prop", () => {
    render(
      <PaymentButton
        workerName="John Plumber"
        walletAddress="GABCDEF1234567890"
        label="Pay / Tip"
      />
    );

    const button = screen.getByRole("button", { name: /Pay \/ Tip/i });
    expect(button).not.toBeDisabled();
    expect(button).toBeInTheDocument();
  });

  it("renders disabled button when walletAddress is not provided", () => {
    render(
      <PaymentButton
        workerName="John Plumber"
        label="Pay / Tip"
      />
    );

    const button = screen.getByRole("button", { name: /Pay \/ Tip/i });
    expect(button).toBeDisabled();
  });

  it("renders disabled button when walletAddress is null", () => {
    render(
      <PaymentButton
        workerName="John Plumber"
        walletAddress={null}
        label="Pay / Tip"
      />
    );

    const button = screen.getByRole("button", { name: /Pay \/ Tip/i });
    expect(button).toBeDisabled();
  });

  it("uses context value when walletAddress prop is not provided", () => {
    render(
      <PaymentFlowProvider
        workerName="Jane Electrician"
        walletAddress="GCONTEXT123456789"
      >
        <PaymentButton label="Send Payment" />
      </PaymentFlowProvider>
    );

    const button = screen.getByRole("button", { name: /Send Payment/i });
    expect(button).not.toBeDisabled();
  });

  it("prefers prop value over context value for walletAddress", () => {
    render(
      <PaymentFlowProvider
        workerName="Jane Electrician"
        walletAddress="GCONTEXT123456789"
      >
        <PaymentButton
          walletAddress="GPROPS987654321"
          label="Pay"
        />
      </PaymentFlowProvider>
    );

    const button = screen.getByRole("button", { name: /Pay/i });
    expect(button).not.toBeDisabled();
  });

  it("uses default label when label prop is not provided", () => {
    render(
      <PaymentButton walletAddress="GABCDEF1234567890" />
    );

    expect(screen.getByRole("button", { name: /Pay \/ Tip/i })).toBeInTheDocument();
  });

  it("renders wallet icon", () => {
    render(
      <PaymentButton walletAddress="GABCDEF1234567890" />
    );

    expect(screen.getByTestId("wallet-icon")).toBeInTheDocument();
  });

  it("has correct styling classes for disabled state", () => {
    render(
      <PaymentButton label="Pay" />
    );

    const button = screen.getByRole("button", { name: /Pay/i });
    expect(button).toHaveClass("bg-gray-200", "text-gray-400", "cursor-not-allowed");
  });

  it("has correct styling classes for enabled state", () => {
    render(
      <PaymentButton walletAddress="GABCDEF1234567890" label="Pay" />
    );

    const button = screen.getByRole("button", { name: /Pay/i });
    expect(button).toHaveClass("bg-blue-600", "hover:bg-blue-700", "text-white");
  });
});
