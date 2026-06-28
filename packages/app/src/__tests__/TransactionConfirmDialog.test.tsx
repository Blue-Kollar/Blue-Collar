/**
 * TransactionConfirmDialog.test.tsx
 * Closes #823 — confirms dialog renders correctly and wires confirm/cancel
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import TransactionConfirmDialog from "@/components/Payment/TransactionConfirmDialog";
import type { TransactionSummary } from "@/lib/transactions";

vi.mock("@/lib/utils", () => ({ cn: (...a: unknown[]) => a.filter(Boolean).join(" ") }));
vi.mock("lucide-react", () => ({
  AlertTriangle: () => <span data-testid="alert-icon" />,
  CheckCircle2: () => <span data-testid="check-icon" />,
  X: () => <span />,
}));

const paymentSummary: TransactionSummary = {
  type: "payment",
  from: "GSOURCE123",
  to: "GDEST456",
  amountDisplay: "10.0000000 XLM",
  networkName: "TESTNET",
  networkPassphrase: "Test SDF Network ; September 2015",
  fee: "0.0000100 XLM",
  operations: [{ type: "payment", description: "Pay 10.0000000 XLM to GDEST456" }],
};

describe("TransactionConfirmDialog", () => {
  it("renders transaction details when open with a summary", () => {
    render(
      <TransactionConfirmDialog
        open={true}
        summary={paymentSummary}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText("Confirm Transaction")).toBeInTheDocument();
    expect(screen.getByTestId("tx-destination")).toHaveTextContent("GDEST456");
    expect(screen.getByTestId("tx-amount")).toHaveTextContent("10.0000000 XLM");
    expect(screen.getByText("TESTNET")).toBeInTheDocument();
    expect(screen.getByText("0.0000100 XLM")).toBeInTheDocument();
  });

  it("calls onConfirm when Sign & Submit is clicked", async () => {
    const onConfirm = vi.fn();
    render(
      <TransactionConfirmDialog
        open={true}
        summary={paymentSummary}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    );
    await userEvent.click(screen.getByTestId("confirm-sign-btn"));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("calls onCancel when Cancel is clicked", async () => {
    const onCancel = vi.fn();
    render(
      <TransactionConfirmDialog
        open={true}
        summary={paymentSummary}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );
    await userEvent.click(screen.getByTestId("cancel-btn"));
    expect(onCancel).toHaveBeenCalled();
  });

  it("disables Sign & Submit and shows warning when networkWarning=true", () => {
    render(
      <TransactionConfirmDialog
        open={true}
        summary={paymentSummary}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        networkWarning={true}
      />
    );
    expect(screen.getByTestId("confirm-sign-btn")).toBeDisabled();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("disables Sign & Submit when summary is null", () => {
    render(
      <TransactionConfirmDialog
        open={true}
        summary={null}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByTestId("confirm-sign-btn")).toBeDisabled();
  });

  it("shows contract_call type correctly", () => {
    const contractSummary: TransactionSummary = {
      ...paymentSummary,
      type: "contract_call",
      to: "",
      amountDisplay: "",
      operations: [{ type: "contract_call", description: "Invoke smart contract function" }],
    };
    render(
      <TransactionConfirmDialog
        open={true}
        summary={contractSummary}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByText("Smart contract invocation")).toBeInTheDocument();
  });
});
