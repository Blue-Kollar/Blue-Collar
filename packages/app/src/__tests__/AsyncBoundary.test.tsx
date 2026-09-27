import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import AsyncBoundary from "@/components/AsyncBoundary";

vi.mock("lucide-react", () => ({
  Loader2: () => <span data-testid="loader-icon" />,
  AlertCircle: () => <span data-testid="alert-icon" />,
}));

describe("AsyncBoundary", () => {
  describe("loading state", () => {
    it("renders loading spinner when state is loading", () => {
      render(
        <AsyncBoundary state="loading">
          <div data-testid="content">Content</div>
        </AsyncBoundary>
      );

      expect(screen.getByTestId("loader-icon")).toBeInTheDocument();
      expect(screen.queryByTestId("content")).not.toBeInTheDocument();
    });

    it("displays loading text when state is loading", () => {
      render(
        <AsyncBoundary state="loading" loadingText="Loading data...">
          <div data-testid="content">Content</div>
        </AsyncBoundary>
      );

      expect(screen.getByText("Loading data...")).toBeInTheDocument();
    });

    it("uses default loading text when loadingText is not provided", () => {
      render(
        <AsyncBoundary state="loading">
          <div data-testid="content">Content</div>
        </AsyncBoundary>
      );

      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });
  });

  describe("error state", () => {
    it("renders error message when state is error", () => {
      render(
        <AsyncBoundary state="error" error="Failed to load data">
          <div data-testid="content">Content</div>
        </AsyncBoundary>
      );

      expect(screen.getByTestId("alert-icon")).toBeInTheDocument();
      expect(screen.getByText("Failed to load data")).toBeInTheDocument();
      expect(screen.queryByTestId("content")).not.toBeInTheDocument();
    });

    it("displays generic error message when no error text provided", () => {
      render(
        <AsyncBoundary state="error">
          <div data-testid="content">Content</div>
        </AsyncBoundary>
      );

      expect(screen.getByText("An error occurred")).toBeInTheDocument();
    });

    it("renders retry button when onRetry callback is provided", () => {
      const onRetry = vi.fn();
      render(
        <AsyncBoundary state="error" error="Failed" onRetry={onRetry}>
          <div data-testid="content">Content</div>
        </AsyncBoundary>
      );

      const retryButton = screen.getByRole("button", { name: /retry/i });
      expect(retryButton).toBeInTheDocument();

      retryButton.click();
      expect(onRetry).toHaveBeenCalledOnce();
    });

    it("does not render retry button when onRetry is not provided", () => {
      render(
        <AsyncBoundary state="error" error="Failed">
          <div data-testid="content">Content</div>
        </AsyncBoundary>
      );

      expect(screen.queryByRole("button", { name: /retry/i })).not.toBeInTheDocument();
    });

    it("has accessible role=alert for error state", () => {
      render(
        <AsyncBoundary state="error" error="Failed to load">
          <div data-testid="content">Content</div>
        </AsyncBoundary>
      );

      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });

  describe("empty state", () => {
    it("renders empty state message when state is empty", () => {
      render(
        <AsyncBoundary state="empty" emptyMessage="No data available">
          <div data-testid="content">Content</div>
        </AsyncBoundary>
      );

      expect(screen.getByText("No data available")).toBeInTheDocument();
      expect(screen.queryByTestId("content")).not.toBeInTheDocument();
    });

    it("uses default empty message when emptyMessage is not provided", () => {
      render(
        <AsyncBoundary state="empty">
          <div data-testid="content">Content</div>
        </AsyncBoundary>
      );

      expect(screen.getByText("No results found")).toBeInTheDocument();
    });

    it("renders custom empty state component when provided", () => {
      render(
        <AsyncBoundary
          state="empty"
          emptyComponent={<div data-testid="custom-empty">Custom empty</div>}
        >
          <div data-testid="content">Content</div>
        </AsyncBoundary>
      );

      expect(screen.getByTestId("custom-empty")).toBeInTheDocument();
      expect(screen.queryByTestId("content")).not.toBeInTheDocument();
    });
  });

  describe("success state", () => {
    it("renders children when state is success", () => {
      render(
        <AsyncBoundary state="success">
          <div data-testid="content">Content loaded</div>
        </AsyncBoundary>
      );

      expect(screen.getByTestId("content")).toBeInTheDocument();
      expect(screen.getByText("Content loaded")).toBeInTheDocument();
    });

    it("does not render loading, error, or empty states when state is success", () => {
      render(
        <AsyncBoundary state="success">
          <div data-testid="content">Content</div>
        </AsyncBoundary>
      );

      expect(screen.queryByTestId("loader-icon")).not.toBeInTheDocument();
      expect(screen.queryByTestId("alert-icon")).not.toBeInTheDocument();
    });
  });

  describe("state transitions", () => {
    it("transitions from loading to success", () => {
      const { rerender } = render(
        <AsyncBoundary state="loading">
          <div data-testid="content">Content</div>
        </AsyncBoundary>
      );

      expect(screen.getByTestId("loader-icon")).toBeInTheDocument();

      rerender(
        <AsyncBoundary state="success">
          <div data-testid="content">Content loaded</div>
        </AsyncBoundary>
      );

      expect(screen.queryByTestId("loader-icon")).not.toBeInTheDocument();
      expect(screen.getByTestId("content")).toBeInTheDocument();
    });

    it("transitions from loading to error", () => {
      const { rerender } = render(
        <AsyncBoundary state="loading">
          <div data-testid="content">Content</div>
        </AsyncBoundary>
      );

      expect(screen.getByTestId("loader-icon")).toBeInTheDocument();

      rerender(
        <AsyncBoundary state="error" error="Failed to load">
          <div data-testid="content">Content</div>
        </AsyncBoundary>
      );

      expect(screen.queryByTestId("loader-icon")).not.toBeInTheDocument();
      expect(screen.getByText("Failed to load")).toBeInTheDocument();
    });

    it("transitions from error to success", () => {
      const { rerender } = render(
        <AsyncBoundary state="error" error="Failed">
          <div data-testid="content">Content</div>
        </AsyncBoundary>
      );

      expect(screen.getByText("Failed")).toBeInTheDocument();

      rerender(
        <AsyncBoundary state="success">
          <div data-testid="content">Content loaded</div>
        </AsyncBoundary>
      );

      expect(screen.queryByText("Failed")).not.toBeInTheDocument();
      expect(screen.getByTestId("content")).toBeInTheDocument();
    });
  });

  describe("accessibility", () => {
    it("renders with proper ARIA labels for loading state", () => {
      render(
        <AsyncBoundary state="loading" loadingText="Fetching data">
          <div data-testid="content">Content</div>
        </AsyncBoundary>
      );

      const loadingContainer = screen.getByText("Fetching data").closest("div");
      expect(loadingContainer).toHaveAttribute("role", "status");
    });

    it("announces loading completion", () => {
      const { rerender } = render(
        <AsyncBoundary state="loading">
          <div data-testid="content">Content</div>
        </AsyncBoundary>
      );

      rerender(
        <AsyncBoundary state="success">
          <div data-testid="content">Content loaded</div>
        </AsyncBoundary>
      );

      const status = screen.getByRole("status");
      expect(status).toHaveTextContent("Content loaded");
    });
  });
});
