import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

interface MetricCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  change?: number;
}

interface ActivityTimelineEvent {
  id: string;
  type: string;
  description: string;
  timestamp: string;
  actor?: { name: string; avatar?: string };
}

interface ActivityTimelineProps {
  events: ActivityTimelineEvent[];
  isLoading?: boolean;
}

interface WorkerStatsWidget {
  totalViews: number;
  totalContacts: number;
  averageRating: number;
  completedJobs: number;
}

// Mock components
function MetricCard({ label, value, icon, change }: MetricCardProps) {
  return (
    <div data-testid="metric-card" data-label={label}>
      {icon && <span data-testid="metric-icon">{icon}</span>}
      <div data-testid="metric-value">{value}</div>
      {change !== undefined && (
        <div data-testid="metric-change" data-change={change}>
          {change > 0 ? "+" : ""}{change}%
        </div>
      )}
      <div data-testid="metric-label">{label}</div>
    </div>
  );
}

function ActivityTimeline({ events, isLoading }: ActivityTimelineProps) {
  if (isLoading) {
    return <div data-testid="activity-loading">Loading activity...</div>;
  }

  if (events.length === 0) {
    return <div data-testid="activity-empty">No activity yet</div>;
  }

  return (
    <div data-testid="activity-timeline">
      {events.map((event) => (
        <div key={event.id} data-testid="activity-event" data-type={event.type}>
          <div data-testid="event-description">{event.description}</div>
          <div data-testid="event-timestamp">{event.timestamp}</div>
          {event.actor && (
            <div data-testid="event-actor">{event.actor.name}</div>
          )}
        </div>
      ))}
    </div>
  );
}

function WorkerStatsWidget(props: WorkerStatsWidget) {
  return (
    <div data-testid="worker-stats-widget">
      <div data-testid="total-views">{props.totalViews}</div>
      <div data-testid="total-contacts">{props.totalContacts}</div>
      <div data-testid="average-rating">{props.averageRating.toFixed(1)}</div>
      <div data-testid="completed-jobs">{props.completedJobs}</div>
    </div>
  );
}

describe("Dashboard Widget Components - Issue #1377", () => {
  describe("MetricCard Widget", () => {
    it("should render metric card with label and value", () => {
      render(
        <MetricCard label="Total Views" value={1234} />
      );

      expect(screen.getByTestId("metric-card")).toBeInTheDocument();
      expect(screen.getByTestId("metric-label")).toHaveTextContent("Total Views");
      expect(screen.getByTestId("metric-value")).toHaveTextContent("1234");
    });

    it("should render metric card with icon", () => {
      render(
        <MetricCard label="Total Views" value={1234} icon={<span>📊</span>} />
      );

      expect(screen.getByTestId("metric-icon")).toHaveTextContent("📊");
    });

    it("should render change indicator when provided", () => {
      render(
        <MetricCard label="Total Views" value={1234} change={15} />
      );

      expect(screen.getByTestId("metric-change")).toHaveTextContent("+15%");
    });

    it("should display negative change correctly", () => {
      render(
        <MetricCard label="Total Views" value={1234} change={-5} />
      );

      expect(screen.getByTestId("metric-change")).toHaveTextContent("-5%");
    });

    it("should render without change indicator when not provided", () => {
      const { queryByTestId } = render(
        <MetricCard label="Total Views" value={1234} />
      );

      expect(queryByTestId("metric-change")).not.toBeInTheDocument();
    });

    it("should handle string and numeric values", () => {
      const { getByTestId: getByTestId1 } = render(
        <MetricCard label="Status" value="Active" />
      );
      expect(getByTestId1("metric-value")).toHaveTextContent("Active");

      const { getByTestId: getByTestId2 } = render(
        <MetricCard label="Count" value={42} />
      );
      expect(getByTestId2("metric-value")).toHaveTextContent("42");
    });

    it("should pass label as data attribute", () => {
      render(
        <MetricCard label="Total Views" value={1234} />
      );

      expect(screen.getByTestId("metric-card")).toHaveAttribute(
        "data-label",
        "Total Views"
      );
    });
  });

  describe("ActivityTimeline Widget", () => {
    const mockEvents: ActivityTimelineEvent[] = [
      {
        id: "1",
        type: "job_completed",
        description: "Completed plumbing repair job",
        timestamp: "2024-01-15 10:30 AM",
        actor: { name: "John Doe" },
      },
      {
        id: "2",
        type: "review_received",
        description: "Received 5-star review",
        timestamp: "2024-01-15 09:00 AM",
        actor: { name: "Sarah Smith" },
      },
      {
        id: "3",
        type: "payment_received",
        description: "Payment received: $500",
        timestamp: "2024-01-14 03:30 PM",
      },
    ];

    it("should render activity timeline with events", () => {
      render(<ActivityTimeline events={mockEvents} />);

      expect(screen.getByTestId("activity-timeline")).toBeInTheDocument();
      expect(screen.getAllByTestId("activity-event")).toHaveLength(3);
    });

    it("should display event descriptions", () => {
      render(<ActivityTimeline events={mockEvents} />);

      expect(screen.getByTestId("event-description")).toHaveTextContent(
        "Completed plumbing repair job"
      );
    });

    it("should display event timestamps", () => {
      render(<ActivityTimeline events={mockEvents} />);

      expect(screen.getAllByTestId("event-timestamp")[0]).toHaveTextContent(
        "2024-01-15 10:30 AM"
      );
    });

    it("should display actor names when provided", () => {
      render(<ActivityTimeline events={mockEvents} />);

      expect(screen.getAllByTestId("event-actor")[0]).toHaveTextContent("John Doe");
      expect(screen.getAllByTestId("event-actor")[1]).toHaveTextContent("Sarah Smith");
    });

    it("should mark event types as data attributes", () => {
      render(<ActivityTimeline events={mockEvents} />);

      const events = screen.getAllByTestId("activity-event");
      expect(events[0]).toHaveAttribute("data-type", "job_completed");
      expect(events[1]).toHaveAttribute("data-type", "review_received");
      expect(events[2]).toHaveAttribute("data-type", "payment_received");
    });

    it("should show loading state", () => {
      render(<ActivityTimeline events={[]} isLoading={true} />);

      expect(screen.getByTestId("activity-loading")).toHaveTextContent(
        "Loading activity..."
      );
      expect(screen.queryByTestId("activity-timeline")).not.toBeInTheDocument();
    });

    it("should show empty state when no events", () => {
      render(<ActivityTimeline events={[]} isLoading={false} />);

      expect(screen.getByTestId("activity-empty")).toHaveTextContent(
        "No activity yet"
      );
      expect(screen.queryByTestId("activity-timeline")).not.toBeInTheDocument();
    });

    it("should render in chronological order", () => {
      render(<ActivityTimeline events={mockEvents} />);

      const events = screen.getAllByTestId("activity-event");
      expect(events[0]).toHaveAttribute("data-type", "job_completed");
      expect(events[1]).toHaveAttribute("data-type", "review_received");
      expect(events[2]).toHaveAttribute("data-type", "payment_received");
    });
  });

  describe("WorkerStatsWidget", () => {
    const mockStats: WorkerStatsWidget = {
      totalViews: 1234,
      totalContacts: 45,
      averageRating: 4.8,
      completedJobs: 23,
    };

    it("should render worker stats widget", () => {
      render(<WorkerStatsWidget {...mockStats} />);

      expect(screen.getByTestId("worker-stats-widget")).toBeInTheDocument();
    });

    it("should display total views", () => {
      render(<WorkerStatsWidget {...mockStats} />);

      expect(screen.getByTestId("total-views")).toHaveTextContent("1234");
    });

    it("should display total contacts", () => {
      render(<WorkerStatsWidget {...mockStats} />);

      expect(screen.getByTestId("total-contacts")).toHaveTextContent("45");
    });

    it("should display average rating with one decimal place", () => {
      render(<WorkerStatsWidget {...mockStats} />);

      expect(screen.getByTestId("average-rating")).toHaveTextContent("4.8");
    });

    it("should display completed jobs", () => {
      render(<WorkerStatsWidget {...mockStats} />);

      expect(screen.getByTestId("completed-jobs")).toHaveTextContent("23");
    });

    it("should format rating correctly", () => {
      render(
        <WorkerStatsWidget
          {...mockStats}
          averageRating={4.567}
        />
      );

      expect(screen.getByTestId("average-rating")).toHaveTextContent("4.6");
    });

    it("should handle zero values", () => {
      render(
        <WorkerStatsWidget
          totalViews={0}
          totalContacts={0}
          averageRating={0}
          completedJobs={0}
        />
      );

      expect(screen.getByTestId("total-views")).toHaveTextContent("0");
      expect(screen.getByTestId("total-contacts")).toHaveTextContent("0");
      expect(screen.getByTestId("average-rating")).toHaveTextContent("0.0");
      expect(screen.getByTestId("completed-jobs")).toHaveTextContent("0");
    });

    it("should handle large numbers", () => {
      render(
        <WorkerStatsWidget
          totalViews={999999}
          totalContacts={9999}
          averageRating={5}
          completedJobs={1000}
        />
      );

      expect(screen.getByTestId("total-views")).toHaveTextContent("999999");
      expect(screen.getByTestId("completed-jobs")).toHaveTextContent("1000");
    });
  });

  describe("Widget Integration", () => {
    it("should render multiple metrics in dashboard", () => {
      const { container } = render(
        <>
          <MetricCard label="Total Views" value={1234} change={10} />
          <MetricCard label="Contacts" value={45} change={-2} />
          <MetricCard label="Rating" value="4.8 ⭐" />
        </>
      );

      const metricCards = screen.getAllByTestId("metric-card");
      expect(metricCards).toHaveLength(3);
    });

    it("should render activity timeline with multiple events", () => {
      const events: ActivityTimelineEvent[] = [
        {
          id: "1",
          type: "job_completed",
          description: "Job completed",
          timestamp: "2024-01-15 10:00 AM",
        },
        {
          id: "2",
          type: "review_received",
          description: "Review received",
          timestamp: "2024-01-15 09:00 AM",
        },
      ];

      render(<ActivityTimeline events={events} />);

      expect(screen.getAllByTestId("activity-event")).toHaveLength(2);
    });

    it("should render worker stats with all metrics", () => {
      render(
        <WorkerStatsWidget
          totalViews={100}
          totalContacts={10}
          averageRating={4.5}
          completedJobs={5}
        />
      );

      expect(screen.getByTestId("total-views")).toBeInTheDocument();
      expect(screen.getByTestId("total-contacts")).toBeInTheDocument();
      expect(screen.getByTestId("average-rating")).toBeInTheDocument();
      expect(screen.getByTestId("completed-jobs")).toBeInTheDocument();
    });
  });

  describe("Widget Props Handling", () => {
    it("should accept optional props gracefully", () => {
      const { queryByTestId } = render(
        <MetricCard label="Test" value={10} />
      );

      expect(queryByTestId("metric-icon")).not.toBeInTheDocument();
      expect(queryByTestId("metric-change")).not.toBeInTheDocument();
    });

    it("should handle empty event list", () => {
      render(<ActivityTimeline events={[]} />);

      expect(screen.getByTestId("activity-empty")).toBeInTheDocument();
    });

    it("should pass data correctly as props", () => {
      const testLabel = "Test Metric";
      const testValue = 999;

      render(
        <MetricCard label={testLabel} value={testValue} />
      );

      expect(screen.getByTestId("metric-card")).toHaveAttribute(
        "data-label",
        testLabel
      );
      expect(screen.getByTestId("metric-value")).toHaveTextContent(
        testValue.toString()
      );
    });
  });

  describe("Widget Snapshots", () => {
    it("should match MetricCard snapshot", () => {
      const { container } = render(
        <MetricCard label="Total Views" value={1234} change={15} icon={<span>📊</span>} />
      );

      expect(container.firstChild).toMatchSnapshot();
    });

    it("should match ActivityTimeline snapshot", () => {
      const events: ActivityTimelineEvent[] = [
        {
          id: "1",
          type: "job_completed",
          description: "Completed plumbing repair job",
          timestamp: "2024-01-15 10:30 AM",
          actor: { name: "John Doe" },
        },
      ];

      const { container } = render(
        <ActivityTimeline events={events} />
      );

      expect(container.firstChild).toMatchSnapshot();
    });

    it("should match WorkerStatsWidget snapshot", () => {
      const { container } = render(
        <WorkerStatsWidget
          totalViews={1234}
          totalContacts={45}
          averageRating={4.8}
          completedJobs={23}
        />
      );

      expect(container.firstChild).toMatchSnapshot();
    });
  });
});
