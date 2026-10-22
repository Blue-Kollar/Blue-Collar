import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import EscrowForm from "../components/EscrowForm";

function fillValidForm() {
  fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "125.5" } });
  fireEvent.change(screen.getByLabelText("Counterparty Address"), {
    target: { value: "GABCDEF1234567890" },
  });
  fireEvent.change(screen.getByLabelText("Terms"), {
    target: { value: "Complete the plumbing work within 7 days" },
  });
}

describe("EscrowForm", () => {
  it("renders the default token and all fields", () => {
    render(<EscrowForm onSubmit={vi.fn()} />);

    expect(screen.getByLabelText("Amount")).toHaveValue(null);
    expect(screen.getByLabelText("Token")).toHaveValue("XLM");
    expect(screen.getByLabelText("Counterparty Address")).toHaveValue("");
    expect(screen.getByLabelText("Terms")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Create Escrow" })).toBeEnabled();
  });

  it("shows validation errors and does not submit when empty", () => {
    const onSubmit = vi.fn();
    render(<EscrowForm onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole("button", { name: "Create Escrow" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("Amount is required")).toBeInTheDocument();
    expect(screen.getByText("Counterparty address is required")).toBeInTheDocument();
    expect(screen.getByText("Terms is required")).toBeInTheDocument();
  });

  it("rejects non-positive or non-numeric amounts", () => {
    const onSubmit = vi.fn();
    render(<EscrowForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "0" } });
    fireEvent.change(screen.getByLabelText("Counterparty Address"), {
      target: { value: "GABCDEF" },
    });
    fireEvent.change(screen.getByLabelText("Terms"), { target: { value: "Terms" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Escrow" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("Amount must be greater than 0")).toBeInTheDocument();
  });

  it("submits the parsed form values", () => {
    const onSubmit = vi.fn();
    render(<EscrowForm onSubmit={onSubmit} />);

    fillValidForm();
    fireEvent.change(screen.getByLabelText("Token"), { target: { value: "USDC" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Escrow" }));

    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onSubmit).toHaveBeenCalledWith({
      amount: "125.5",
      token: "USDC",
      counterparty: "GABCDEF1234567890",
      terms: "Complete the plumbing work within 7 days",
    });
  });

  it("disables every control while submitting", () => {
    render(<EscrowForm onSubmit={vi.fn()} disabled />);

    expect(screen.getByLabelText("Amount")).toBeDisabled();
    expect(screen.getByLabelText("Token")).toBeDisabled();
    expect(screen.getByLabelText("Counterparty Address")).toBeDisabled();
    expect(screen.getByLabelText("Terms")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Create Escrow" })).toBeDisabled();
  });
});
