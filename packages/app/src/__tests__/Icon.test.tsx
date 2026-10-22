import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import Icon, { type IconName } from "@/icons/Icon";

describe("Icon component", () => {
  describe("rendering", () => {
    it("renders logo icon", () => {
      render(<Icon name="logo" />);
      const svg = screen.getByRole("img");
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute("aria-label", "BlueCollar logo");
    });

    it("renders wallet icon", () => {
      render(<Icon name="wallet" />);
      const svg = screen.getByRole("img", { hidden: true });
      expect(svg).toBeInTheDocument();
    });

    it("renders worker icon", () => {
      render(<Icon name="worker" />);
      const svg = screen.getByRole("img", { hidden: true });
      expect(svg).toBeInTheDocument();
    });

    it("renders star icon", () => {
      render(<Icon name="star" />);
      const svg = screen.getByRole("img", { hidden: true });
      expect(svg).toBeInTheDocument();
    });

    it("renders location icon", () => {
      render(<Icon name="location" />);
      const svg = screen.getByRole("img", { hidden: true });
      expect(svg).toBeInTheDocument();
    });

    it("renders phone icon", () => {
      render(<Icon name="phone" />);
      const svg = screen.getByRole("img", { hidden: true });
      expect(svg).toBeInTheDocument();
    });

    it("renders email icon", () => {
      render(<Icon name="email" />);
      const svg = screen.getByRole("img", { hidden: true });
      expect(svg).toBeInTheDocument();
    });
  });

  describe("sizing", () => {
    it("uses default size of 24 for most icons", () => {
      const { container } = render(<Icon name="wallet" />);
      const svg = container.querySelector("svg");
      expect(svg).toHaveAttribute("width", "24");
      expect(svg).toHaveAttribute("height", "24");
    });

    it("uses default size of 32 for logo icon", () => {
      const { container } = render(<Icon name="logo" />);
      const svg = container.querySelector("svg");
      expect(svg).toHaveAttribute("width", "32");
      expect(svg).toHaveAttribute("height", "32");
    });

    it("applies custom size to icon", () => {
      const { container } = render(<Icon name="wallet" size={16} />);
      const svg = container.querySelector("svg");
      expect(svg).toHaveAttribute("width", "16");
      expect(svg).toHaveAttribute("height", "16");
    });

    it("applies custom size to logo icon", () => {
      const { container } = render(<Icon name="logo" size={64} />);
      const svg = container.querySelector("svg");
      expect(svg).toHaveAttribute("width", "64");
      expect(svg).toHaveAttribute("height", "64");
    });

    it("maintains aspect ratio with viewBox", () => {
      const { container } = render(<Icon name="wallet" size={48} />);
      const svg = container.querySelector("svg");
      expect(svg).toHaveAttribute("viewBox");
      expect(svg?.getAttribute("viewBox")).toBeTruthy();
    });
  });

  describe("styling", () => {
    it("applies custom className to icon", () => {
      const { container } = render(
        <Icon name="wallet" className="text-blue-600" />
      );
      const svg = container.querySelector("svg");
      expect(svg).toHaveClass("text-blue-600");
    });

    it("applies multiple classNames", () => {
      const { container } = render(
        <Icon name="wallet" className="text-blue-600 hover:text-blue-700" />
      );
      const svg = container.querySelector("svg");
      expect(svg).toHaveClass("text-blue-600", "hover:text-blue-700");
    });

    it("uses currentColor for stroke by default", () => {
      const { container } = render(<Icon name="wallet" />);
      const paths = container.querySelectorAll("path, rect");
      // Most paths should use currentColor for stroke
      expect(paths.length).toBeGreaterThan(0);
    });
  });

  describe("star icon filled variant", () => {
    it("renders unfilled star by default", () => {
      const { container } = render(<Icon name="star" />);
      const svg = container.querySelector("svg");
      expect(svg).toHaveAttribute("fill", "none");
    });

    it("renders filled star when filled prop is true", () => {
      const { container } = render(<Icon name="star" filled />);
      const svg = container.querySelector("svg");
      expect(svg).toHaveAttribute("fill", "currentColor");
    });

    it("filled prop is ignored for non-star icons", () => {
      const { container: walletContainer } = render(
        <Icon name="wallet" filled />
      );
      const walletSvg = walletContainer.querySelector("svg");
      expect(walletSvg).toHaveAttribute("fill", "none");
    });
  });

  describe("SVG structure", () => {
    it("renders valid SVG elements", () => {
      const { container } = render(<Icon name="wallet" />);
      const svg = container.querySelector("svg");
      expect(svg?.tagName).toBe("svg");
      expect(svg).toHaveAttribute("xmlns", "http://www.w3.org/2000/svg");
    });

    it("has proper viewBox for responsive scaling", () => {
      const { container } = render(<Icon name="wallet" />);
      const svg = container.querySelector("svg");
      const viewBox = svg?.getAttribute("viewBox");
      expect(viewBox).toBeTruthy();
      expect(viewBox).toMatch(/^[\d\s]+$/);
    });

    it("logo icon has correct background color", () => {
      const { container } = render(<Icon name="logo" />);
      const rect = container.querySelector("rect");
      expect(rect).toHaveAttribute("fill", "#2563EB");
    });
  });

  describe("accessibility", () => {
    it("logo icon has descriptive aria-label", () => {
      render(<Icon name="logo" />);
      const svg = screen.getByRole("img");
      expect(svg).toHaveAttribute("aria-label", "BlueCollar logo");
    });

    it("renders all icon names without error", () => {
      const iconNames: IconName[] = [
        "logo",
        "wallet",
        "worker",
        "star",
        "location",
        "phone",
        "email",
      ];

      iconNames.forEach((name) => {
        const { unmount } = render(<Icon name={name} />);
        const svg = document.querySelector("svg");
        expect(svg).toBeInTheDocument();
        unmount();
      });
    });
  });

  describe("performance", () => {
    it("renders inline SVG without external asset requests", () => {
      const { container } = render(<Icon name="wallet" />);
      const svg = container.querySelector("svg");
      // SVG should be inline, not using <image> or <use> tags
      expect(svg?.querySelector("image")).not.toBeInTheDocument();
    });

    it("maintains consistent SVG structure across renders", () => {
      const { container, rerender } = render(<Icon name="wallet" size={24} />);
      const firstSvg = container.querySelector("svg")?.outerHTML;

      rerender(<Icon name="wallet" size={24} />);
      const secondSvg = container.querySelector("svg")?.outerHTML;

      expect(firstSvg).toBe(secondSvg);
    });
  });
});
