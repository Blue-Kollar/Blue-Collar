/**
 * ErrorState component tests (#1059 – snapshot cleanup)
 *
 * Previously used three broad `toMatchSnapshot()` calls on the full container.
 * Replaced with targeted assertions covering observable, user-facing behaviour:
 *   - Alert role present (accessibility)
 *   - Title and message text visible
 *   - Retry button present/absent depending on prop
 *   - Variant structural presence
 *
 * See packages/app/docs/SNAPSHOT_REVIEW_GUIDELINES.md for the project-wide
 * policy on when snapshots are and are not appropriate.
 */
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import ErrorState from "@/components/ErrorState";

vi.mock("lucide-react", () => ({
  AlertTriangle: (props: any) => <svg {...props} data-icon="alert-triangle" />,
}));

describe("ErrorState", () => {
  // ── Accessibility ──────────────────────────────────────────────────────────
  it("renders an alert role so screen readers announce the error", () => {
    render(<ErrorState message="Failed" />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  // ── Message and title ──────────────────────────────────────────────────────
  it("renders the message text", () => {
    render(<ErrorState message="Failed to load workers." />);
    expect(screen.getByText("Failed to load workers.")).toBeInTheDocument();
  });

  it("renders the title when provided", () => {
    render(<ErrorState title="Something went wrong" message="Failed to load workers." />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("does not render a title element when title prop is omitted", () => {
    render(<ErrorState message="Failed." />);
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
  });

  // ── Retry button ───────────────────────────────────────────────────────────
  it("does not render a retry button when onRetry is omitted", () => {
    render(<ErrorState message="Failed." />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders a retry button when onRetry is provided", () => {
    render(<ErrorState message="Failed." onRetry={() => {}} />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("calls onRetry when the retry button is clicked", async () => {
    const spy = vi.fn();
    const { getByRole } = render(<ErrorState message="Failed." onRetry={spy} />);
    getByRole("button").click();
    expect(spy).toHaveBeenCalledOnce();
  });

  // ── Variant ────────────────────────────────────────────────────────────────
  it("block variant: alert role exists at the root level", () => {
    const { container } = render(<ErrorState variant="block" message="Error" />);
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
  });

  it("inline variant: alert role exists", () => {
    render(<ErrorState variant="inline" message="Failed to load transactions." onRetry={() => {}} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Failed to load transactions.")).toBeInTheDocument();
  });

  // ── Icon ───────────────────────────────────────────────────────────────────
  it("renders the AlertTriangle icon", () => {
    const { container } = render(<ErrorState message="Failed" />);
    expect(container.querySelector("[data-icon='alert-triangle']")).not.toBeNull();
  });
});
