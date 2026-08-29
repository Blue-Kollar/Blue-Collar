import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { DashboardHeader } from "@/components/Dashboard/DashboardHeader";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("lucide-react", () => ({
  Plus: () => <span data-testid="icon-plus" />,
  Settings: () => <span data-testid="icon-settings" />,
}));

describe("DashboardHeader", () => {
  it("renders default title and subtitle", () => {
    render(<DashboardHeader />);
    expect(screen.getByText("My Workers")).toBeInTheDocument();
    expect(screen.getByText("Manage your worker listings and track performance")).toBeInTheDocument();
  });

  it("renders create worker link with correct href", () => {
    render(<DashboardHeader />);
    const link = screen.getByText("Create New Worker").closest("a");
    expect(link).toHaveAttribute("href", "/dashboard/workers/new");
  });

  it("renders custom title and subtitle", () => {
    render(<DashboardHeader title="Custom Dashboard" subtitle="Custom Subtitle" />);
    expect(screen.getByText("Custom Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Custom Subtitle")).toBeInTheDocument();
  });
});
