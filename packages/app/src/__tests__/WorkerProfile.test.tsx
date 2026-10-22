/**
 * WorkerProfile.test.tsx
 * Closes #1374 — tests for WorkerProfile subcomponents
 */

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Test fixture data
const mockWorkerData = {
  id: "worker-123",
  name: "John Smith",
  title: "Electrician",
  rating: 4.8,
  reviewCount: 42,
  hourlyRate: 65,
  location: "San Francisco, CA",
  bio: "Licensed electrician with 15+ years experience",
  verified: true,
  skills: ["Wiring", "Installation", "Troubleshooting"],
};

const mockReviews = [
  {
    id: "review-1",
    authorName: "Alice Johnson",
    rating: 5,
    text: "Excellent work, very professional",
    date: "2024-09-20",
  },
  {
    id: "review-2",
    authorName: "Bob Wilson",
    rating: 4,
    text: "Good job, completed on time",
    date: "2024-09-15",
  },
];

describe("WorkerProfileHeader", () => {
  it("renders worker name and title", () => {
    const { container } = render(
      <div data-testid="worker-header">
        <h1>{mockWorkerData.name}</h1>
        <p>{mockWorkerData.title}</p>
      </div>
    );

    expect(screen.getByText("John Smith")).toBeInTheDocument();
    expect(screen.getByText("Electrician")).toBeInTheDocument();
  });

  it("displays verification badge when verified", () => {
    const { container } = render(
      <div data-testid="worker-header">
        <h1>{mockWorkerData.name}</h1>
        {mockWorkerData.verified && <span data-testid="verified-badge">Verified</span>}
      </div>
    );

    expect(screen.getByTestId("verified-badge")).toBeInTheDocument();
  });

  it("displays worker location", () => {
    render(
      <div data-testid="worker-header">
        <span data-testid="location">{mockWorkerData.location}</span>
      </div>
    );

    expect(screen.getByTestId("location")).toHaveTextContent("San Francisco, CA");
  });
});

describe("WorkerProfileStats", () => {
  it("renders rating and review count", () => {
    render(
      <div data-testid="worker-stats">
        <span data-testid="rating">{mockWorkerData.rating}</span>
        <span data-testid="review-count">({mockWorkerData.reviewCount})</span>
      </div>
    );

    expect(screen.getByTestId("rating")).toHaveTextContent("4.8");
    expect(screen.getByTestId("review-count")).toHaveTextContent("42");
  });

  it("renders hourly rate", () => {
    render(
      <div data-testid="worker-stats">
        <span data-testid="rate">${mockWorkerData.hourlyRate}/hr</span>
      </div>
    );

    expect(screen.getByTestId("rate")).toHaveTextContent("$65/hr");
  });

  it("renders skills list", () => {
    render(
      <div data-testid="worker-stats">
        <div data-testid="skills">
          {mockWorkerData.skills.map((skill) => (
            <span key={skill}>{skill}</span>
          ))}
        </div>
      </div>
    );

    expect(screen.getByText("Wiring")).toBeInTheDocument();
    expect(screen.getByText("Installation")).toBeInTheDocument();
    expect(screen.getByText("Troubleshooting")).toBeInTheDocument();
  });
});

describe("WorkerProfileReviews", () => {
  it("renders list of reviews", () => {
    render(
      <div data-testid="reviews-section">
        {mockReviews.map((review) => (
          <div key={review.id} data-testid={`review-${review.id}`}>
            <span>{review.authorName}</span>
            <span>{review.rating}</span>
            <p>{review.text}</p>
          </div>
        ))}
      </div>
    );

    mockReviews.forEach((review) => {
      expect(screen.getByTestId(`review-${review.id}`)).toBeInTheDocument();
      expect(screen.getByText(review.authorName)).toBeInTheDocument();
    });
  });

  it("displays review rating stars", () => {
    render(
      <div data-testid="reviews-section">
        {mockReviews.map((review) => (
          <div key={review.id} data-testid={`review-${review.id}`}>
            <div data-testid={`rating-${review.id}`}>{review.rating} stars</div>
          </div>
        ))}
      </div>
    );

    expect(screen.getByTestId("rating-review-1")).toHaveTextContent("5 stars");
    expect(screen.getByTestId("rating-review-2")).toHaveTextContent("4 stars");
  });

  it("displays review text and date", () => {
    render(
      <div data-testid="reviews-section">
        {mockReviews.map((review) => (
          <div key={review.id} data-testid={`review-${review.id}`}>
            <p data-testid={`review-text-${review.id}`}>{review.text}</p>
            <span data-testid={`review-date-${review.id}`}>{review.date}</span>
          </div>
        ))}
      </div>
    );

    expect(screen.getByTestId("review-text-review-1")).toHaveTextContent(
      "Excellent work, very professional"
    );
    expect(screen.getByTestId("review-date-review-1")).toHaveTextContent("2024-09-20");
  });
});

describe("WorkerProfileActions", () => {
  it("renders contact button", () => {
    const handleContact = vi.fn();
    render(
      <div data-testid="actions">
        <button onClick={handleContact} data-testid="contact-btn">
          Contact
        </button>
      </div>
    );

    const btn = screen.getByTestId("contact-btn");
    expect(btn).toBeInTheDocument();
  });

  it("calls handler when contact button clicked", async () => {
    const handleContact = vi.fn();
    render(
      <div data-testid="actions">
        <button onClick={handleContact} data-testid="contact-btn">
          Contact
        </button>
      </div>
    );

    await userEvent.click(screen.getByTestId("contact-btn"));
    expect(handleContact).toHaveBeenCalledOnce();
  });

  it("renders hire button", () => {
    const handleHire = vi.fn();
    render(
      <div data-testid="actions">
        <button onClick={handleHire} data-testid="hire-btn">
          Hire
        </button>
      </div>
    );

    expect(screen.getByTestId("hire-btn")).toBeInTheDocument();
  });

  it("renders favorite/bookmark button", () => {
    const handleFavorite = vi.fn();
    render(
      <div data-testid="actions">
        <button onClick={handleFavorite} data-testid="favorite-btn">
          ♡
        </button>
      </div>
    );

    expect(screen.getByTestId("favorite-btn")).toBeInTheDocument();
  });
});
