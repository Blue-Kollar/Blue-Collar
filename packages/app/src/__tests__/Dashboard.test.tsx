import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import DashboardPage from "@/app/[locale]/dashboard/page";
import * as AuthContext from "@/context/AuthContext";
import * as WalletHook from "@/hooks/useWallet";
import type { AuthUser } from "@/types";

vi.mock("@/context/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/hooks/useWallet", () => ({
  useWallet: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    replace: vi.fn(),
    push: vi.fn(),
  })),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("next/dynamic", () => ({
  default: (loader: any) => {
    const Component = vi.fn(() => <div data-testid="dynamic-charts" />);
    Component.displayName = "DynamicCharts";
    return Component;
  },
}));

vi.mock("@radix-ui/react-dialog", () => ({
  Root: ({ children }: any) => <div data-testid="dialog-root">{children}</div>,
  Portal: ({ children }: any) => <div data-testid="dialog-portal">{children}</div>,
  Overlay: ({ children }: any) => <div data-testid="dialog-overlay">{children}</div>,
  Content: ({ children }: any) => <div data-testid="dialog-content">{children}</div>,
  Title: ({ children }: any) => <h2 data-testid="dialog-title">{children}</h2>,
  Description: ({ children }: any) => <p data-testid="dialog-desc">{children}</p>,
  Close: ({ children }: any) => <button data-testid="dialog-close">{children}</button>,
}));

vi.mock("lucide-react", () => ({
  Plus: () => <span data-testid="icon-plus" />,
  Pencil: () => <span data-testid="icon-pencil" />,
  Trash2: () => <span data-testid="icon-trash" />,
  ToggleLeft: () => <span data-testid="icon-toggle-left" />,
  ToggleRight: () => <span data-testid="icon-toggle-right" />,
  Loader2: () => <span data-testid="icon-loader" />,
  X: () => <span data-testid="icon-close" />,
  AlertTriangle: () => <span data-testid="icon-alert" />,
  Settings: () => <span data-testid="icon-settings" />,
  Eye: () => <span data-testid="icon-eye" />,
  Heart: () => <span data-testid="icon-heart" />,
  Star: () => <span data-testid="icon-star" />,
  MessageSquare: () => <span data-testid="icon-message" />,
  TrendingUp: () => <span data-testid="icon-trending" />,
  Download: () => <span data-testid="icon-download" />,
  BarChart3: () => <span data-testid="icon-chart" />,
}));

vi.mock("@/components/FriendbotBanner", () => ({
  default: () => <div data-testid="friendbot-banner" />,
}));

vi.mock("@/components/Skeleton", () => ({
  DashboardTableSkeleton: () => <div data-testid="skeleton-table" />,
}));

const getMyWorkers = vi.fn();
const getCuratorAnalytics = vi.fn();
const getWorkerViewTrends = vi.fn();
const toggleWorker = vi.fn();
const deleteWorker = vi.fn();
vi.mock("@/lib/api", () => ({
  getMyWorkers: (...args: unknown[]) => getMyWorkers(...args),
  getCuratorAnalytics: (...args: unknown[]) => getCuratorAnalytics(...args),
  getWorkerViewTrends: (...args: unknown[]) => getWorkerViewTrends(...args),
  toggleWorker: (...args: unknown[]) => toggleWorker(...args),
  deleteWorker: (...args: unknown[]) => deleteWorker(...args),
}));

const mockUser: AuthUser = {
  id: "user1",
  email: "curator@example.com",
  firstName: "John",
  lastName: "Doe",
  role: "curator",
  createdAt: "2026-01-01T00:00:00Z",
};

const mockWorkers = [
  {
    id: "w1",
    name: "Plumber Pro",
    isActive: true,
    createdAt: "2026-01-15T00:00:00Z",
    category: { id: "c1", name: "Plumbing" },
  },
  {
    id: "w2",
    name: "Electric Expert",
    isActive: false,
    createdAt: "2026-02-01T00:00:00Z",
    category: { id: "c2", name: "Electrical" },
  },
];

const mockAnalytics = {
  totalWorkers: 2,
  activeWorkers: 1,
  workers: [
    {
      id: "w1",
      name: "Plumber Pro",
      category: "Plumbing",
      isActive: true,
      views: 150,
      uniqueViews: 120,
      tips: 500,
      tipCount: 5,
      bookmarks: 20,
      contacts: 10,
    },
  ],
  totals: {
    views: 150,
    uniqueViews: 120,
    tips: 500,
    tipCount: 5,
    bookmarks: 20,
    contacts: 10,
    avgRating: 4.5,
    reviewCount: 10,
    contactsThisMonth: 5,
    viewsThisMonth: 50,
  },
};

/** Fresh per-test client — a shared one would leak cached results across tests. */
function renderDashboard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <DashboardPage />
    </QueryClientProvider>
  );
}

function mockAuthenticatedCurator() {
  vi.mocked(AuthContext.useAuth).mockReturnValue({
    user: mockUser,
    token: "test-token",
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
  } as any);
  vi.mocked(WalletHook.useWallet).mockReturnValue({ publicKey: null } as any);
}

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn();
  getMyWorkers.mockResolvedValue({ data: mockWorkers });
  getCuratorAnalytics.mockResolvedValue({ data: mockAnalytics });
  getWorkerViewTrends.mockResolvedValue({ data: [] });
  toggleWorker.mockResolvedValue({ data: {} });
  deleteWorker.mockResolvedValue(undefined);
});

describe("Dashboard", () => {
  it("shows loading state when auth is loading", () => {
    vi.mocked(AuthContext.useAuth).mockReturnValue({
      user: null,
      token: null,
      isLoading: true,
      login: vi.fn(),
      logout: vi.fn(),
      register: vi.fn(),
    } as any);
    vi.mocked(WalletHook.useWallet).mockReturnValue({ publicKey: null } as any);

    renderDashboard();
    expect(screen.getByTestId("skeleton-table")).toBeInTheDocument();
  });

  it("shows loading skeleton when not authenticated", () => {
    vi.mocked(AuthContext.useAuth).mockReturnValue({
      user: null,
      token: null,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      register: vi.fn(),
    } as any);
    vi.mocked(WalletHook.useWallet).mockReturnValue({ publicKey: null } as any);

    renderDashboard();
    expect(screen.getByTestId("skeleton-table")).toBeInTheDocument();
  });

  it("renders main header for authenticated curator", async () => {
    mockAuthenticatedCurator();

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText("My Workers")).toBeInTheDocument();
      expect(
        screen.getByText("Manage your worker listings and track performance")
      ).toBeInTheDocument();
    });
  });

  it("renders worker table with workers data", async () => {
    mockAuthenticatedCurator();

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText("Plumber Pro")).toBeInTheDocument();
      expect(screen.getByText("Electric Expert")).toBeInTheDocument();
      expect(screen.getByText("Plumbing")).toBeInTheDocument();
      expect(screen.getByText("Electrical")).toBeInTheDocument();
    });
  });

  it("shows active/inactive status badges", async () => {
    mockAuthenticatedCurator();

    renderDashboard();

    await waitFor(() => {
      const activeElements = screen.getAllByText("Active");
      expect(activeElements.length).toBeGreaterThan(0);
      expect(screen.getByText("Inactive")).toBeInTheDocument();
    });
  });

  it("has tabs for workers and analytics", async () => {
    mockAuthenticatedCurator();

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText("Workers")).toBeInTheDocument();
      expect(screen.getByText("Analytics")).toBeInTheDocument();
    });
  });

  it("displays error message when fetch fails", async () => {
    mockAuthenticatedCurator();
    getMyWorkers.mockRejectedValueOnce(new Error("Network error"));

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });
  });

  it("shows empty state when no workers exist", async () => {
    mockAuthenticatedCurator();
    getMyWorkers.mockResolvedValueOnce({ data: [] });

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText("No workers yet")).toBeInTheDocument();
      expect(
        screen.getByText("Create your first worker listing to get started.")
      ).toBeInTheDocument();
    });
  });

  it("has create worker and settings buttons", async () => {
    mockAuthenticatedCurator();

    renderDashboard();

    await waitFor(() => {
      const createButtons = screen.getAllByText("Create New Worker");
      expect(createButtons.length).toBeGreaterThan(0);
    });
  });

  it("renders action buttons for each worker", async () => {
    mockAuthenticatedCurator();

    renderDashboard();

    await waitFor(() => {
      expect(screen.getAllByTestId("icon-trending").length).toBeGreaterThan(0);
      expect(screen.getAllByTestId("icon-pencil").length).toBeGreaterThan(0);
      expect(screen.getAllByTestId("icon-trash").length).toBeGreaterThan(0);
    });
  });
});
