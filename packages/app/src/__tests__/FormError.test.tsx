/**
 * FormError component tests
 *
 * Covers the shared FormError component used across all auth and data-entry
 * forms to provide consistent error message display.
 *
 * Verifies:
 *  - Renders nothing when message is falsy (null, undefined, empty string)
 *  - Renders the error message when present
 *  - Exposes an alert role for screen-reader announcement
 *  - Accepts and applies a custom id for aria-describedby linkage
 *  - Accepts and merges a custom className
 *  - Error icon is rendered but hidden from a11y tree
 *
 * Closes #1204
 */
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import FormError from "@/components/FormError";

vi.mock("lucide-react", () => ({
  AlertCircle: (props: any) => <svg {...props} data-icon="alert-circle" />,
}));

vi.mock("@/lib/utils", () => ({
  cn: (...classes: any[]) => classes.filter(Boolean).join(" "),
}));

describe("FormError", () => {
  // ── Render-nothing contract ───────────────────────────────────────────────

  it("renders nothing when message is undefined", () => {
    const { container } = render(<FormError />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when message is null", () => {
    const { container } = render(<FormError message={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when message is an empty string", () => {
    const { container } = render(<FormError message="" />);
    expect(container.firstChild).toBeNull();
  });

  // ── Message content ───────────────────────────────────────────────────────

  it("renders the error message text when provided", () => {
    render(<FormError message="Invalid credentials." />);
    expect(screen.getByText("Invalid credentials.")).toBeInTheDocument();
  });

  it("renders a different message string", () => {
    render(<FormError message="Email is required." />);
    expect(screen.getByText("Email is required.")).toBeInTheDocument();
  });

  // ── Accessibility ─────────────────────────────────────────────────────────

  it("exposes role=alert so screen readers announce the error immediately", () => {
    render(<FormError message="Something went wrong." />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("does not expose role=alert when message is absent", () => {
    render(<FormError />);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("renders the icon with aria-hidden to avoid redundant announcements", () => {
    const { container } = render(<FormError message="Oops" />);
    const icon = container.querySelector("[data-icon='alert-circle']");
    expect(icon).not.toBeNull();
    expect(icon?.getAttribute("aria-hidden")).toBe("true");
  });

  // ── id prop for aria-describedby linkage ─────────────────────────────────

  it("applies the provided id to the wrapper element", () => {
    const { container } = render(<FormError message="Error" id="form-error" />);
    expect(container.querySelector("#form-error")).not.toBeNull();
  });

  it("does not add an id attribute when the prop is omitted", () => {
    const { container } = render(<FormError message="Error" />);
    const el = container.querySelector("[role='alert']");
    expect(el?.hasAttribute("id")).toBe(false);
  });

  // ── className merge ───────────────────────────────────────────────────────

  it("merges a custom className onto the wrapper", () => {
    const { container } = render(
      <FormError message="Error" className="mt-4" />
    );
    const el = container.querySelector("[role='alert']");
    expect(el?.className).toContain("mt-4");
  });
});
