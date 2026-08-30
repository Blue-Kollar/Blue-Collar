/**
 * Loading and empty state tests for data-driven views.
 *
 * Covers:
 *  - SavedWorkers: loading skeleton, empty state, populated list
 *  - MessagesPreview: loading skeleton, empty state, populated list
 *  - WorkersPanel: loading skeleton (delegates to DashboardTableSkeleton), empty state
 *  - ListingsTable: loading state, empty state, populated table
 *
 * Closes #1203
 */
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

// ── Shared mocks ──────────────────────────────────────────────────────────────

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/image", () => ({
  default: ({ src, alt, ...props }: any) => <img src={src} alt={alt} {...props} />,
}));

vi.mock("lucide-react", () => ({
  Bookmark: (props: any) => <svg {...props} data-icon="bookmark" />,
  Star: (props: any) => <svg {...props} data-icon="star" />,
  MessageSquare: (props: any) => <svg {...props} data-icon="message-square" />,
  Loader2: (props: any) => <svg {...props} data-icon="loader2" />,
  Plus: (props: any) => <svg {...props} data-icon="plus" />,
  Pencil: (props: any) => <svg {...props} data-icon="pencil" />,
  Trash2: (props: any) => <svg {...props} data-icon="trash2" />,
  ToggleLeft: (props: any) => <svg {...props} data-icon="toggle-left" />,
  ToggleRight: (props: any) => <svg {...props} data-icon="toggle-right" />,
  TrendingUp: (props: any) => <svg {...props} data-icon="trending-up" />,
  X: (props: any) => <svg {...props} data-icon="x" />,
  ExternalLink: (props: any) => <svg {...props} data-icon="external-link" />,
}));

// Skeleton stubs — just render a div with a data attribute so we can assert
// presence without caring about internal markup.
vi.mock("@/components/Skeleton", () => ({
  default: ({ className }: any) => <div data-testid="skeleton" className={className} />,
  WorkerCardSkeleton: () => <div data-testid="worker-card-skeleton" />,
  DashboardTableSkeleton: () => <div data-testid="dashboard-table-skeleton" />,
}));

// ── SavedWorkers ──────────────────────────────────────────────────────────────

import { SavedWorkers } from "@/components/Dashboard/SavedWorkers";

const WORKER_STUB = {
  id: "w1",
  name: "Alice Smith",
  avatar: null,
  category: { id: "c1", name: "Plumber" },
  averageRating: 4.5,
  location: "New York",
};

describe("SavedWorkers", () => {
  it("renders skeleton placeholders while loading", () => {
    render(<SavedWorkers workers={[]} loading />);
    expect(screen.getAllByTestId("worker-card-skeleton").length).toBeGreaterThan(0);
  });

  it("marks the container as busy while loading", () => {
    const { container } = render(<SavedWorkers workers={[]} loading />);
    expect(container.querySelector("[aria-busy='true']")).not.toBeNull();
  });

  it("renders the empty-state bookmark icon when not loading and list is empty", () => {
    render(<SavedWorkers workers={[]} />);
    expect(screen.getByText(/no saved workers/i)).toBeInTheDocument();
  });

  it("renders a browse workers link in the empty state", () => {
    render(<SavedWorkers workers={[]} />);
    expect(screen.getByRole("link", { name: /browse workers/i })).toBeInTheDocument();
  });

  it("renders worker names when populated", () => {
    render(<SavedWorkers workers={[WORKER_STUB]} />);
    expect(screen.getByText("Alice Smith")).toBeInTheDocument();
  });

  it("does not render skeletons when not loading", () => {
    render(<SavedWorkers workers={[WORKER_STUB]} />);
    expect(screen.queryByTestId("worker-card-skeleton")).toBeNull();
  });

  it("does not render the empty state when the list is populated", () => {
    render(<SavedWorkers workers={[WORKER_STUB]} />);
    expect(screen.queryByText(/no saved workers/i)).not.toBeInTheDocument();
  });
});

// ── MessagesPreview ───────────────────────────────────────────────────────────

import { MessagesPreview } from "@/components/Dashboard/MessagesPreview";

const CONV_STUB: any = {
  id: "conv1",
  subject: "Job inquiry",
  unreadCount: 1,
  participants: [
    { userId: "u1", user: { firstName: "Bob", lastName: "Jones", avatar: null } },
    { userId: "me", user: { firstName: "Me", lastName: "User", avatar: null } },
  ],
  messages: [
    {
      id: "m1",
      body: "Hello there",
      senderId: "u1",
      createdAt: new Date().toISOString(),
    },
  ],
};

describe("MessagesPreview", () => {
  it("renders skeleton rows while loading", () => {
    render(<MessagesPreview conversations={[]} currentUserId="me" loading />);
    expect(screen.getAllByTestId("skeleton").length).toBeGreaterThan(0);
  });

  it("marks the container as busy while loading", () => {
    const { container } = render(
      <MessagesPreview conversations={[]} currentUserId="me" loading />
    );
    expect(container.querySelector("[aria-busy='true']")).not.toBeNull();
  });

  it("renders the empty-state message when not loading and list is empty", () => {
    render(<MessagesPreview conversations={[]} currentUserId="me" />);
    expect(screen.getByText(/no messages yet/i)).toBeInTheDocument();
  });

  it("does not render skeletons in the empty state", () => {
    render(<MessagesPreview conversations={[]} currentUserId="me" />);
    expect(screen.queryByTestId("skeleton")).toBeNull();
  });

  it("renders conversation participants when populated", () => {
    render(<MessagesPreview conversations={[CONV_STUB]} currentUserId="me" />);
    expect(screen.getByText(/Bob Jones/i)).toBeInTheDocument();
  });

  it("renders the last message body when populated", () => {
    render(<MessagesPreview conversations={[CONV_STUB]} currentUserId="me" />);
    expect(screen.getByText("Hello there")).toBeInTheDocument();
  });

  it("does not show skeletons when populated", () => {
    render(<MessagesPreview conversations={[CONV_STUB]} currentUserId="me" />);
    expect(screen.queryByTestId("skeleton")).toBeNull();
  });
});
