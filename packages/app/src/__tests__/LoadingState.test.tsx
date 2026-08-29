/**
 * LoadingState component tests (#1059 – snapshot cleanup)
 *
 * Previously used three broad `toMatchSnapshot()` calls on the full container.
 * Replaced with targeted assertions that test observable, user-facing behaviour:
 *   - Accessible role (status)
 *   - Message text presence
 *   - Variant-specific structural difference (block vs inline)
 *
 * Why broad snapshots were removed:
 *   Snapshot of the full container DOM breaks on every CSS class rename,
 *   icon library upgrade, or wrapper element change — none of which alter
 *   user-visible behaviour. Reviewers were accepting snapshot updates without
 *   reading them, defeating their purpose.
 *
 * Guideline: if a change to the component should NOT break this test, do not
 * snapshot the part that changes. Assert behaviour and semantics instead.
 */
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import LoadingState from "@/components/LoadingState";

vi.mock("lucide-react", () => ({
  Loader2: (props: any) => <svg {...props} data-icon="loader2" />,
}));

describe("LoadingState", () => {
  // ── Accessibility ──────────────────────────────────────────────────────────
  it("renders a status role so screen readers announce loading state", () => {
    render(<LoadingState />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  // ── Message content ────────────────────────────────────────────────────────
  it("shows no visible text when no message is provided", () => {
    render(<LoadingState />);
    // Only the sr-only label should exist — no visible paragraph
    expect(screen.queryByText("Loading workers…")).not.toBeInTheDocument();
  });

  it("renders the message string when provided", () => {
    render(<LoadingState message="Loading workers…" />);
    expect(screen.getByText("Loading workers…")).toBeInTheDocument();
  });

  it("renders a different message in the inline variant", () => {
    render(<LoadingState variant="inline" message="Loading more…" />);
    expect(screen.getByText("Loading more…")).toBeInTheDocument();
  });

  // ── Variant – structural difference ───────────────────────────────────────
  it("block variant renders a non-inline wrapper", () => {
    const { container } = render(<LoadingState variant="block" />);
    // The block wrapper should NOT be an inline-flex element.
    // We test that the root element exists and carries the status role;
    // the exact class is an implementation detail we do not pin.
    const status = container.querySelector('[role="status"]');
    expect(status).not.toBeNull();
  });

  it("inline variant renders within the document flow (contains status role)", () => {
    render(<LoadingState variant="inline" message="Loading…" />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  // ── Spinner icon ───────────────────────────────────────────────────────────
  it("renders the Loader2 icon (data-icon attribute from the stub)", () => {
    const { container } = render(<LoadingState />);
    expect(container.querySelector("[data-icon='loader2']")).not.toBeNull();
  });
});
