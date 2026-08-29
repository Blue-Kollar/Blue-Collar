# BlueCollar Analytics Documentation

This document outlines the event taxonomy, instrumentation, and privacy guidelines for BlueCollar's product analytics system.

## Overview

BlueCollar tracks user behavior across critical funnels to measure engagement, optimize conversion, and identify friction points. All tracking respects user consent and scrubs PII before transmission.

## Privacy & Consent

- **Consent Gating**: Analytics tracking only occurs when users grant consent via the consent banner.
- **PII Scrubbing**: All events are scrubbed of personally identifiable information (email, name, phone, wallet addresses, IP addresses) before being sent to the analytics backend.
- **Functional Tracking**: Core functional events (e.g., page views, navigation) are always enabled to maintain app functionality.

### Consent Management

```typescript
import { analytics } from '@/lib/analytics'

// Set user consent
analytics.setConsent({
  analytics: true,
  functional: true,
  marketing: false,
})
```

## Event Taxonomy

Events follow a structured naming convention: `{object}_{action}` (e.g., `worker_profile_viewed`, `tip_completed`).

### Categories

- **discovery**: Worker search and filtering
- **profile**: Worker profile interactions
- **tip**: Payment funnel events
- **review**: Review submission funnel
- **auth**: Authentication and registration
- **system**: Technical events (errors, performance)

## Core Funnels

### 1. Discovery → Profile Funnel

**Goal**: Measure how users discover and view worker profiles.

| Event | Category | Properties | Description |
|-------|----------|------------|-------------|
| `worker_searched` | discovery | `queryLength`, `resultCount` | User performs a search |
| `worker_category_viewed` | discovery | `categoryId` | User views a category page |
| `worker_filter_applied` | discovery | `filterType` | User applies a filter (location, category, rating) |
| `worker_profile_viewed` | profile | `workerId`, `source` | User views a worker profile |

**Usage Example**:

```typescript
import { analytics } from '@/lib/analytics'

// When user searches
analytics.workerSearched('plumber', 12)

// When user views a profile
analytics.workerProfileViewed('worker_123', 'search_results')
```

### 2. Profile → Contact Funnel

**Goal**: Measure engagement with worker profiles.

| Event | Category | Properties | Description |
|-------|----------|------------|-------------|
| `worker_profile_viewed` | profile | `workerId`, `source` | User views a profile |
| `worker_contact_clicked` | profile | `workerId` | User clicks contact button |
| `worker_bookmarked` | profile | `workerId` | User bookmarks a worker |

### 3. Tip Funnel

**Goal**: Measure tip conversion and identify drop-off points.

| Event | Category | Properties | Description |
|-------|----------|------------|-------------|
| `tip_modal_opened` | tip | `workerId` | User opens tip modal |
| `tip_amount_entered` | tip | `amount` | User enters tip amount |
| `tip_confirmed` | tip | `workerId`, `amount` | User confirms tip |
| `tip_completed` | tip | `workerId`, `amount`, `duration` | Tip transaction completed |
| `tip_failed` | tip | `workerId`, `reason` | Tip transaction failed |

**Usage Example**:

```typescript
// When user opens tip modal
analytics.tipModalOpened('worker_123')

// When user completes tip
const startTime = Date.now()
// ... transaction logic
const duration = Date.now() - startTime
analytics.tipCompleted('worker_123', 50, duration)
```

### 4. Review Funnel

**Goal**: Measure review submission rates.

| Event | Category | Properties | Description |
|-------|----------|------------|-------------|
| `review_modal_opened` | review | `workerId` | User opens review modal |
| `review_rating_selected` | review | `rating` | User selects a rating |
| `review_submitted` | review | `workerId`, `rating` | User submits review |

### 5. Auth Funnel

**Goal**: Track authentication flows and conversion.

| Event | Category | Properties | Description |
|-------|----------|------------|-------------|
| `login_attempted` | auth | `method` | User attempts login |
| `login_completed` | auth | `method` | User completes login |
| `signup_completed` | auth | `method` | User completes registration |

## Implementation Guidelines

### Client-Side Tracking

1. Import the analytics library:

```typescript
import { analytics } from '@/lib/analytics'
```

2. Call the appropriate event method:

```typescript
analytics.workerProfileViewed('worker_123', 'search_results')
```

### Server-Side Tracking

Server-side events are tracked via the `/api/analytics/events` endpoint. Events are batched and sent automatically by the client library.

### Testing

Always test analytics events in development:

```bash
# Check browser console for event logs
# Events are logged but not sent to backend in dev mode
```

## Analytics Backend

Events are sent to `/api/analytics/events` and should be forwarded to a dedicated analytics store:

- **Self-hosted**: ClickHouse, PostHog
- **Managed**: Mixpanel, Amplitude, Segment

### Integration Example (ClickHouse)

```typescript
// In analyticsEvents.ts controller
import { ClickHouse } from 'clickhouse'

const clickhouse = new ClickHouse({
  url: process.env.CLICKHOUSE_URL,
  basicAuth: {
    username: process.env.CLICKHOUSE_USER,
    password: process.env.CLICKHOUSE_PASSWORD,
  },
})

export async function recordEvents(req: Request, res: Response) {
  const { events } = req.body
  await clickhouse.insert('analytics_events', events)
  return res.json({ status: 'success' })
}
```

## Metrics & KPIs

### Key Performance Indicators

- **Discovery → Profile Conversion**: % of searches that lead to a profile view
- **Profile → Contact Conversion**: % of profile views that result in contact
- **Tip Completion Rate**: % of opened tip modals that complete
- **Review Submission Rate**: % of workers that receive reviews post-engagement
- **Auth Completion Rate**: % of login/signup attempts that complete

### Dashboard Queries

All metrics are accessible via the admin analytics dashboard at `/dashboard/admin`.

## Data Retention

- **Raw Events**: 90 days
- **Aggregated Metrics**: 2 years
- **User Consent Records**: Indefinite (compliance requirement)

## Privacy Compliance

BlueCollar's analytics system is designed to comply with:

- **GDPR** (EU): Consent gating, PII scrubbing, right to erasure
- **CCPA** (California): Opt-out mechanism, data disclosure
- **LGPD** (Brazil): User consent and data minimization

## Support

For analytics questions or integration support, contact the development team or open an issue on GitHub.
