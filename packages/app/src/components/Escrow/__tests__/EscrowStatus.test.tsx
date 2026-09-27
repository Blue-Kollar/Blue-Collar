import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import EscrowStatus, { Escrow } from "../EscrowStatus";

describe("EscrowStatus - Issue #1380", () => {
  const mockEscrow: Escrow = {
    id: "escrow-123",
    amount: "100",
    token: "USDC",
    counterparty: "G123456789",
    terms: "Complete the job within 7 days",
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  const mockHandlers = {
    onRelease: () => {},
    onDispute: () => {},
  };

  describe("Status Rendering", () => {
    it("should render pending status with correct label", () => {
      render(
        <EscrowStatus
          escrow={mockEscrow}
          {...mockHandlers}
        />
      );
      expect(screen.getByText("Pending")).toBeInTheDocument();
    });

    it("should render funded status with correct label", () => {
      const fundedEscrow = { ...mockEscrow, status: "funded" as const };
      render(
        <EscrowStatus
          escrow={fundedEscrow}
          {...mockHandlers}
        />
      );
      expect(screen.getByText("Funded")).toBeInTheDocument();
    });

    it("should render released status with correct label", () => {
      const releasedEscrow = { ...mockEscrow, status: "released" as const };
      render(
        <EscrowStatus
          escrow={releasedEscrow}
          {...mockHandlers}
        />
      );
      expect(screen.getByText("Released")).toBeInTheDocument();
    });

    it("should render disputed status with correct label", () => {
      const disputedEscrow = { ...mockEscrow, status: "disputed" as const };
      render(
        <EscrowStatus
          escrow={disputedEscrow}
          {...mockHandlers}
        />
      );
      expect(screen.getByText("Disputed")).toBeInTheDocument();
    });

    it("should render cancelled status with correct label", () => {
      const cancelledEscrow = { ...mockEscrow, status: "cancelled" as const };
      render(
        <EscrowStatus
          escrow={cancelledEscrow}
          {...mockHandlers}
        />
      );
      expect(screen.getByText("Cancelled")).toBeInTheDocument();
    });
  });

  describe("Status Badge Styling", () => {
    it("should apply correct color class for pending status", () => {
      const { container } = render(
        <EscrowStatus
          escrow={mockEscrow}
          {...mockHandlers}
        />
      );
      const statusElement = container.querySelector('.text-yellow-500');
      expect(statusElement).toBeInTheDocument();
    });

    it("should apply correct color class for funded status", () => {
      const fundedEscrow = { ...mockEscrow, status: "funded" as const };
      const { container } = render(
        <EscrowStatus
          escrow={fundedEscrow}
          {...mockHandlers}
        />
      );
      const statusElement = container.querySelector('.text-blue-500');
      expect(statusElement).toBeInTheDocument();
    });

    it("should apply correct color class for released status", () => {
      const releasedEscrow = { ...mockEscrow, status: "released" as const };
      const { container } = render(
        <EscrowStatus
          escrow={releasedEscrow}
          {...mockHandlers}
        />
      );
      const statusElement = container.querySelector('.text-green-600');
      expect(statusElement).toBeInTheDocument();
    });

    it("should apply correct color class for disputed status", () => {
      const disputedEscrow = { ...mockEscrow, status: "disputed" as const };
      const { container } = render(
        <EscrowStatus
          escrow={disputedEscrow}
          {...mockHandlers}
        />
      );
      const statusElement = container.querySelector('.text-orange-500');
      expect(statusElement).toBeInTheDocument();
    });

    it("should apply correct color class for cancelled status", () => {
      const cancelledEscrow = { ...mockEscrow, status: "cancelled" as const };
      const { container } = render(
        <EscrowStatus
          escrow={cancelledEscrow}
          {...mockHandlers}
        />
      );
      const statusElement = container.querySelector('.text-gray-400');
      expect(statusElement).toBeInTheDocument();
    });
  });

  describe("Timeline Rendering", () => {
    it("should render timeline for pending status", () => {
      render(
        <EscrowStatus
          escrow={mockEscrow}
          {...mockHandlers}
        />
      );
      expect(screen.getByLabelText("Escrow progress")).toBeInTheDocument();
    });

    it("should render timeline for funded status", () => {
      const fundedEscrow = { ...mockEscrow, status: "funded" as const };
      render(
        <EscrowStatus
          escrow={fundedEscrow}
          {...mockHandlers}
        />
      );
      expect(screen.getByLabelText("Escrow progress")).toBeInTheDocument();
    });

    it("should render timeline for released status", () => {
      const releasedEscrow = { ...mockEscrow, status: "released" as const };
      render(
        <EscrowStatus
          escrow={releasedEscrow}
          {...mockHandlers}
        />
      );
      expect(screen.getByLabelText("Escrow progress")).toBeInTheDocument();
    });

    it("should not render timeline for disputed status", () => {
      const disputedEscrow = { ...mockEscrow, status: "disputed" as const };
      render(
        <EscrowStatus
          escrow={disputedEscrow}
          {...mockHandlers}
        />
      );
      expect(screen.queryByLabelText("Escrow progress")).not.toBeInTheDocument();
    });

    it("should not render timeline for cancelled status", () => {
      const cancelledEscrow = { ...mockEscrow, status: "cancelled" as const };
      render(
        <EscrowStatus
          escrow={cancelledEscrow}
          {...mockHandlers}
        />
      );
      expect(screen.queryByLabelText("Escrow progress")).not.toBeInTheDocument();
    });
  });

  describe("Amount Display", () => {
    it("should display amount with token", () => {
      render(
        <EscrowStatus
          escrow={mockEscrow}
          {...mockHandlers}
        />
      );
      expect(screen.getByText("100 USDC")).toBeInTheDocument();
    });

    it("should display counterparty address", () => {
      render(
        <EscrowStatus
          escrow={mockEscrow}
          {...mockHandlers}
        />
      );
      expect(screen.getByText("G123456789")).toBeInTheDocument();
    });
  });

  describe("Expiry Information", () => {
    it("should display expiry date when provided", () => {
      const expiryTime = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const escrowWithExpiry = { ...mockEscrow, expiresAt: expiryTime };
      render(
        <EscrowStatus
          escrow={escrowWithExpiry}
          {...mockHandlers}
        />
      );
      expect(screen.getByText(/Expires/)).toBeInTheDocument();
    });

    it("should not display expiry when not provided", () => {
      render(
        <EscrowStatus
          escrow={mockEscrow}
          {...mockHandlers}
        />
      );
      expect(screen.queryByText(/Expires/)).not.toBeInTheDocument();
    });
  });

  describe("Action Buttons", () => {
    it("should show Release and Dispute buttons for funded status", () => {
      const fundedEscrow = { ...mockEscrow, status: "funded" as const };
      render(
        <EscrowStatus
          escrow={fundedEscrow}
          {...mockHandlers}
        />
      );
      expect(screen.getByText("Release")).toBeInTheDocument();
      expect(screen.getByText("Dispute")).toBeInTheDocument();
    });

    it("should not show action buttons for pending status", () => {
      render(
        <EscrowStatus
          escrow={mockEscrow}
          {...mockHandlers}
        />
      );
      expect(screen.queryByText("Release")).not.toBeInTheDocument();
      expect(screen.queryByText("Dispute")).not.toBeInTheDocument();
    });

    it("should not show action buttons for released status", () => {
      const releasedEscrow = { ...mockEscrow, status: "released" as const };
      render(
        <EscrowStatus
          escrow={releasedEscrow}
          {...mockHandlers}
        />
      );
      expect(screen.queryByText("Release")).not.toBeInTheDocument();
      expect(screen.queryByText("Dispute")).not.toBeInTheDocument();
    });
  });

  describe("Explorer Link", () => {
    it("should display explorer link when tx hash is provided", () => {
      const escrowWithTx = {
        ...mockEscrow,
        txHash: "abc123def456",
      };
      render(
        <EscrowStatus
          escrow={escrowWithTx}
          {...mockHandlers}
        />
      );
      expect(screen.getByText("View on Explorer")).toBeInTheDocument();
    });

    it("should not display explorer link when tx hash is not provided", () => {
      render(
        <EscrowStatus
          escrow={mockEscrow}
          {...mockHandlers}
        />
      );
      expect(screen.queryByText("View on Explorer")).not.toBeInTheDocument();
    });

    it("should have correct href for explorer link", () => {
      const escrowWithTx = {
        ...mockEscrow,
        txHash: "abc123def456",
      };
      render(
        <EscrowStatus
          escrow={escrowWithTx}
          {...mockHandlers}
        />
      );
      const explorerLink = screen.getByText("View on Explorer").closest('a');
      expect(explorerLink).toHaveAttribute('target', '_blank');
      expect(explorerLink).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });

  describe("Accessibility", () => {
    it("should have proper ARIA labels", () => {
      render(
        <EscrowStatus
          escrow={mockEscrow}
          {...mockHandlers}
        />
      );
      const statusElement = screen.getByRole("status");
      expect(statusElement).toBeInTheDocument();
    });

    it("should have sr-only content for screen readers", () => {
      const { container } = render(
        <EscrowStatus
          escrow={mockEscrow}
          {...mockHandlers}
        />
      );
      const srOnlyElements = container.querySelectorAll('.sr-only');
      expect(srOnlyElements.length).toBeGreaterThan(0);
    });
  });
});
