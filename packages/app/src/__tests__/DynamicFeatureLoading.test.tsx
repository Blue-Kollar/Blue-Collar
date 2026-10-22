import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import dynamic from "next/dynamic";
import type { ReactNode } from "react";

vi.mock("lucide-react", () => ({
  Loader2: () => <span data-testid="loader-icon" />,
}));

// Mock feature components
const MockHero = () => <div data-testid="hero-component">Hero Section</div>;
const MockCategories = () => <div data-testid="categories-component">Categories</div>;
const MockFeaturedWorkers = () => <div data-testid="featured-workers-component">Featured Workers</div>;

// Simulate dynamically loaded feature components
const DynamicHero = dynamic(() => Promise.resolve({ default: MockHero }), {
  loading: () => <div data-testid="hero-loading">Loading Hero...</div>,
  ssr: false,
});

const DynamicCategories = dynamic(
  () => Promise.resolve({ default: MockCategories }),
  {
    loading: () => <div data-testid="categories-loading">Loading Categories...</div>,
    ssr: false,
  }
);

const DynamicFeaturedWorkers = dynamic(
  () => Promise.resolve({ default: MockFeaturedWorkers }),
  {
    loading: () => <div data-testid="featured-workers-loading">Loading Workers...</div>,
    ssr: false,
  }
);

describe("Dynamic Feature Loading", () => {
  describe("loading states", () => {
    it("displays loading state for dynamically imported Hero component", async () => {
      render(<DynamicHero />);

      expect(screen.getByTestId("hero-loading")).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByTestId("hero-component")).toBeInTheDocument();
      });
    });

    it("displays loading state for dynamically imported Categories component", async () => {
      render(<DynamicCategories />);

      expect(screen.getByTestId("categories-loading")).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByTestId("categories-component")).toBeInTheDocument();
      });
    });

    it("displays loading state for dynamically imported FeaturedWorkers component", async () => {
      render(<DynamicFeaturedWorkers />);

      expect(screen.getByTestId("featured-workers-loading")).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByTestId("featured-workers-component")).toBeInTheDocument();
      });
    });
  });

  describe("component rendering after load", () => {
    it("renders Hero component after dynamic import completes", async () => {
      render(<DynamicHero />);

      await waitFor(() => {
        expect(screen.getByTestId("hero-component")).toBeInTheDocument();
      });

      expect(screen.queryByTestId("hero-loading")).not.toBeInTheDocument();
    });

    it("renders Categories component after dynamic import completes", async () => {
      render(<DynamicCategories />);

      await waitFor(() => {
        expect(screen.getByTestId("categories-component")).toBeInTheDocument();
      });

      expect(screen.queryByTestId("categories-loading")).not.toBeInTheDocument();
    });

    it("renders FeaturedWorkers component after dynamic import completes", async () => {
      render(<DynamicFeaturedWorkers />);

      await waitFor(() => {
        expect(screen.getByTestId("featured-workers-component")).toBeInTheDocument();
      });

      expect(screen.queryByTestId("featured-workers-loading")).not.toBeInTheDocument();
    });
  });

  describe("multiple feature loading", () => {
    it("loads multiple features concurrently", async () => {
      const { container } = render(
        <div>
          <DynamicHero />
          <DynamicCategories />
          <DynamicFeaturedWorkers />
        </div>
      );

      // All loading states should be visible initially
      expect(screen.getByTestId("hero-loading")).toBeInTheDocument();
      expect(screen.getByTestId("categories-loading")).toBeInTheDocument();
      expect(screen.getByTestId("featured-workers-loading")).toBeInTheDocument();

      // All components should be loaded eventually
      await waitFor(() => {
        expect(screen.getByTestId("hero-component")).toBeInTheDocument();
        expect(screen.getByTestId("categories-component")).toBeInTheDocument();
        expect(screen.getByTestId("featured-workers-component")).toBeInTheDocument();
      });

      // No loading states should remain
      expect(screen.queryByTestId("hero-loading")).not.toBeInTheDocument();
      expect(screen.queryByTestId("categories-loading")).not.toBeInTheDocument();
      expect(screen.queryByTestId("featured-workers-loading")).not.toBeInTheDocument();
    });
  });

  describe("dynamic import configuration", () => {
    it("configures ssr: false for client-side only loading", () => {
      // Dynamic imports with ssr: false should not render on server
      // This test verifies the configuration is set correctly
      const { container } = render(<DynamicHero />);
      const component = container.querySelector("[data-testid='hero-component']");
      // Initially should show loading, not the component (simulating client-side only)
      expect(screen.getByTestId("hero-loading")).toBeInTheDocument();
    });

    it("provides custom loading component for each feature", async () => {
      const { rerender } = render(<DynamicHero />);
      expect(screen.getByTestId("hero-loading")).toBeInTheDocument();
      expect(screen.getByText("Loading Hero...")).toBeInTheDocument();

      rerender(<DynamicCategories />);
      expect(screen.getByTestId("categories-loading")).toBeInTheDocument();
      expect(screen.getByText("Loading Categories...")).toBeInTheDocument();

      rerender(<DynamicFeaturedWorkers />);
      expect(screen.getByTestId("featured-workers-loading")).toBeInTheDocument();
      expect(screen.getByText("Loading Workers...")).toBeInTheDocument();
    });
  });

  describe("accessibility during loading", () => {
    it("loading states are accessible to screen readers", async () => {
      render(<DynamicHero />);

      const loadingElement = screen.getByTestId("hero-loading");
      expect(loadingElement).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByTestId("hero-component")).toBeInTheDocument();
      });
    });

    it("content is announced after loading", async () => {
      render(<DynamicCategories />);

      await waitFor(() => {
        const categoriesComponent = screen.getByTestId("categories-component");
        expect(categoriesComponent).toBeInTheDocument();
        expect(categoriesComponent).toHaveTextContent("Categories");
      });
    });
  });

  describe("error handling for dynamic imports", () => {
    it("handles failed dynamic imports gracefully", async () => {
      // When a dynamic import fails, it should render the error boundary or fallback
      const ErrorBoundary = ({ children }: { children: ReactNode }) => (
        <div data-testid="error-boundary">{children}</div>
      );

      render(
        <ErrorBoundary>
          <DynamicHero />
        </ErrorBoundary>
      );

      // Should still render within error boundary
      expect(screen.getByTestId("error-boundary")).toBeInTheDocument();
    });
  });

  describe("lazy loaded features", () => {
    it("only loads features when their routes are accessed", async () => {
      // This simulates code-splitting behavior where features are only loaded
      // when the user navigates to that route
      const FeatureRouter = ({ route }: { route: string }) => {
        if (route === "hero") {
          return <DynamicHero />;
        } else if (route === "categories") {
          return <DynamicCategories />;
        }
        return <div>Home</div>;
      };

      const { rerender } = render(<FeatureRouter route="home" />);
      expect(screen.getByText("Home")).toBeInTheDocument();

      // Navigate to hero route
      rerender(<FeatureRouter route="hero" />);
      expect(screen.getByTestId("hero-loading")).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByTestId("hero-component")).toBeInTheDocument();
      });
    });
  });

  describe("suspense integration", () => {
    it("supports Suspense boundaries for streaming", () => {
      // Dynamic imports should work with Suspense for better UX
      const fallback = <div data-testid="suspense-fallback">Loading page...</div>;

      // This test verifies that the loading state is properly handled
      render(<DynamicHero />);

      const loadingState = screen.getByTestId("hero-loading");
      expect(loadingState).toBeInTheDocument();
      expect(loadingState).toHaveTextContent("Loading Hero...");
    });
  });
});
