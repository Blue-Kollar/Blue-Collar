# Reviews & Ratings UI

> Issue #723 · Priority: Medium · Complexity: Medium

Design specification for the review submission and display system. Covers the rating input, review composer, review list, verified-transaction badges, and moderation affordances.

---

## Table of Contents

- [Design Goals](#design-goals)
- [Rating Input](#rating-input)
- [Review Composer](#review-composer)
- [Review Display](#review-display)
  - [Review Summary](#review-summary)
  - [Review List](#review-list)
  - [Review Card](#review-card)
- [Sorting & Filtering](#sorting--filtering)
- [Helpful Voting](#helpful-voting)
- [Verified Transaction Badges](#verified-transaction-badges)
- [Moderation & Reporting](#moderation--reporting)
- [States](#states)

---

## Design Goals

| Goal                 | Approach                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------- |
| **Trust**            | Verified-transaction reviews are visually distinct and prioritised.                                     |
| **Abuse resistance** | One review per user per worker. Edit window of 48h. Report affordances on every review.                 |
| **Signal quality**   | "Helpful" voting surfaces the most useful reviews. Verified reviews are weighted higher in the average. |
| **Accessibility**    | Star input is keyboard-navigable (arrow keys). All interactive elements have ARIA labels.               |

---

## Rating Input

A 5-star rating input using the existing `StarIcon` from `src/icons/StarIcon.tsx`.

### Anatomy

```
┌──────────────────────────────────────────┐
│  ★ ★ ★ ★ ☆                              │
│                                          │
│  "4 out of 5"  (sr-only + visible label) │
└──────────────────────────────────────────┘
```

### Spec

```
Container: flex items-center gap-1

Each star:
  cursor-pointer
  h-7 w-7 (input mode) or h-4 w-4 (display mode)
  transition-colors duration-150

  Filled: text-yellow-400 fill-yellow-400
  Empty: text-gray-300 fill-none stroke-gray-300

  Hover preview:
    On hover over star N, fill stars 1–N with text-yellow-300
    (lighter shade to indicate "preview")

  Active/selected:
    text-yellow-400 fill-yellow-400

Keyboard navigation:
  role="radiogroup", aria-label="Rating"
  Each star: role="radio", aria-checked, aria-label="N stars"
  Arrow keys move selection
  Tab moves focus to/from the group

Label:
  ml-2 text-sm text-gray-500
  Visible: "4 out of 5"
  screen-reader: aria-live="polite"
```

### Interactive States

| State                   | Behaviour                                                       |
| ----------------------- | --------------------------------------------------------------- |
| **Idle**                | All stars empty (gray-300)                                      |
| **Hover**               | Stars 1 through hovered index fill with yellow-300 (preview)    |
| **Selected**            | Stars 1 through selected index fill with yellow-400             |
| **Disabled**            | opacity-50, cursor-not-allowed                                  |
| **Required validation** | Red ring around the star group + "Please select a rating" error |

---

## Review Composer

### Location

The review composer appears on the worker profile page, below the worker details and above the review list.

### Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  Write a Review                                                   │
│  ──────────────────────────────────────────────────────────────  │
│                                                                  │
│  Your rating *                                                   │
│  ★ ★ ★ ★ ☆     4 out of 5                                      │
│                                                                  │
│  Your review                                                     │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  Great plumber! Fixed my kitchen sink in under an hour.  │    │
│  │  Very professional and fair pricing.                     │    │
│  │                                                          │    │
│  └──────────────────────────────────────────────────────────┘    │
│  0 / 1000 characters                                             │
│                                                                  │
│  ┌──────────────────────────┐                                   │
│  │  Submit Review           │                                   │
│  └──────────────────────────┘                                   │
│                                                                  │
│  ℹ️ Verified transaction reviews are highlighted and             │
│     given more weight in the overall rating.                     │
└──────────────────────────────────────────────────────────────────┘
```

### Spec

```
Section container:
  rounded-xl border bg-white p-6 shadow-sm

Section title:
  text-base font-semibold text-gray-900

Rating field:
  Label: text-sm font-medium text-gray-700 mb-1.5
  Required: * text-red-500

Textarea:
  w-full rounded-lg border border-gray-200 px-4 py-3
  text-sm text-gray-800
  placeholder: "Share your experience with this worker..."
  min-h-[100px] resize-y
  focus: ring-2 ring-blue-500 border-blue-500

Character count:
  text-xs text-gray-400 mt-1 text-right
  When near limit (>900): text-amber-500
  When at limit (1000): text-red-500

Submit button:
  w-full sm:w-auto
  bg-blue-600 text-white rounded-lg px-6 py-2.5
  text-sm font-medium
  hover:bg-blue-700
  disabled:opacity-50 disabled:cursor-not-allowed

Info banner:
  mt-4 bg-blue-50 rounded-lg px-4 py-3
  text-xs text-blue-600
  flex items-start gap-2
  [Info icon, size 14] + text
```

### Validation Rules

| Field          | Rule                                   | Error message                                                                    |
| -------------- | -------------------------------------- | -------------------------------------------------------------------------------- |
| Rating         | Required, 1-5                          | "Please select a rating"                                                         |
| Review text    | Required, min 10 chars, max 1000 chars | "Review must be at least 10 characters" / "Review must be under 1000 characters" |
| One per worker | Server-enforced                        | "You've already reviewed this worker"                                            |

### Submission States

| State                | UI                                                                                             |
| -------------------- | ---------------------------------------------------------------------------------------------- |
| **Idle**             | Normal form                                                                                    |
| **Submitting**       | Button shows spinner + "Submitting...". Fields disabled.                                       |
| **Success**          | Toast: "Review submitted successfully". Composer collapses. New review appears at top of list. |
| **Already reviewed** | Composer replaced with: "You've already reviewed this worker. [Edit your review →]"            |
| **Not logged in**    | Composer replaced with: "Log in to leave a review. [Log in →]"                                 |
| **Error**            | Toast: "Failed to submit review. Please try again." Fields remain filled.                      |

---

## Review Display

### Review Summary

A summary bar at the top of the reviews section showing the aggregate rating.

```
┌──────────────────────────────────────────────────────────────────┐
│  Reviews & Ratings                                                │
│                                                                  │
│  ┌────────────┐  ┌──────────────────────────────────────────┐   │
│  │             │  │                                          │   │
│  │    4.3      │  │  5 ★  ████████████████████████  68%     │   │
│  │  ★★★★☆     │  │  4 ★  ██████████               22%     │   │
│  │  47 reviews │  │  3 ★  ████                      6%     │   │
│  │             │  │  2 ★  █                          2%     │   │
│  │             │  │  1 ★  █                          2%     │   │
│  │             │  │                                          │   │
│  └────────────┘  └──────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

**Spec:**

```
Container:
  flex flex-col sm:flex-row gap-6 rounded-xl border bg-white p-6 shadow-sm

Left (summary):
  flex flex-col items-center text-center min-w-[120px]
  Average: text-4xl font-bold text-gray-900
  Stars: flex gap-0.5, each h-5 w-5
  Count: text-sm text-gray-400 mt-1

Right (breakdown):
  flex-1 flex flex-col gap-1.5

  Each bar row:
    flex items-center gap-2 text-sm
    Label: "5 ★" — w-8 text-right text-gray-500
    Bar container: flex-1 h-2 rounded-full bg-gray-100 overflow-hidden
    Bar fill: h-full rounded-full bg-yellow-400
      width: percentage of total
      transition-all duration-300
    Percentage: w-10 text-right text-xs text-gray-400
```

### Review List

```
┌──────────────────────────────────────────────────────────────────┐
│  Sort: [Most Recent ▼]   Filter: [All ▼]                        │
│  ──────────────────────────────────────────────────────────────  │
│                                                                  │
│  [Review Card 1]                                                 │
│  [Review Card 2]                                                 │
│  [Review Card 3]                                                 │
│  ...                                                             │
│                                                                  │
│  [ Load More Reviews ]                                           │
└──────────────────────────────────────────────────────────────────┘
```

### Review Card

```
┌──────────────────────────────────────────────────────────────────┐
│  ┌────┐  Jane Doe                        ✓ Verified Transaction  │
│  │ av │  ★★★★★  ·  2 days ago                                   │
│  └────┘                                                          │
│                                                                  │
│  Great plumber! Fixed my kitchen sink in under an hour.          │
│  Very professional and fair pricing. Would definitely             │
│  recommend to anyone in the Lagos area.                          │
│                                                                  │
│  ────────────────────────────────────────────────────────────── │
│  👍 Helpful (12)        ·        🚩 Report                      │
└──────────────────────────────────────────────────────────────────┘
```

**Spec:**

```
Card container:
  rounded-xl border bg-white p-5 shadow-sm

Header:
  flex items-start justify-between

  Left:
    flex items-center gap-3
    Avatar: h-10 w-10 rounded-full object-cover
      (or initials fallback, same as WorkerCard)
    Name: text-sm font-semibold text-gray-800
    Stars + date: flex items-center gap-2 text-xs text-gray-400
      Stars: h-3.5 w-3.5 each

  Right (verified badge):
    flex items-center gap-1 text-xs font-medium
    ✓ Verified Transaction
    (see Verified Transaction Badges section)

Body:
  mt-3 text-sm text-gray-600 leading-relaxed

Footer:
  mt-4 pt-3 border-t flex items-center gap-4 text-xs text-gray-400

  Helpful button:
    flex items-center gap-1.5 hover:text-blue-600
    cursor-pointer transition-colors
    When voted: text-blue-600 font-medium

  Report button:
    flex items-center gap-1.5 hover:text-red-500
    cursor-pointer transition-colors
    ml-auto (pushed to the right)
```

---

## Sorting & Filtering

| Control    | Type     | Options                                                                          |
| ---------- | -------- | -------------------------------------------------------------------------------- |
| **Sort**   | Dropdown | Most Recent (default), Highest Rated, Lowest Rated, Most Helpful                 |
| **Filter** | Dropdown | All Reviews (default), Verified Only, 5 Stars, 4 Stars, 3 Stars, 2 Stars, 1 Star |

**Dropdown spec:**

```
Trigger:
  flex items-center gap-2 rounded-lg border px-3 py-2
  text-sm text-gray-600
  hover:bg-gray-50

  [label]  [ChevronDown size=14]

Dropdown menu:
  Uses existing DropdownMenu component (@radix-ui/react-dropdown-menu)
  rounded-lg border bg-white shadow-lg p-1

  Each item:
    px-3 py-2 text-sm rounded-md
    hover:bg-gray-100
    Active: bg-blue-50 text-blue-600 font-medium
```

---

## Helpful Voting

"Helpful" votes surface the best reviews.

### Behaviour

| Rule                         | Detail                                                        |
| ---------------------------- | ------------------------------------------------------------- |
| One vote per user per review | Toggle behaviour: click again to remove vote                  |
| Login required               | If not logged in, clicking shows: "Log in to vote" toast      |
| Own review                   | Cannot vote on your own review. Button hidden on own reviews. |
| Optimistic update            | Count updates immediately. Reverted on failure.               |

### States

| State         | Visual                                                         |
| ------------- | -------------------------------------------------------------- |
| **Not voted** | `text-gray-400` — "Helpful (12)"                               |
| **Voted**     | `text-blue-600 font-medium` — "Helpful (13)" with filled thumb |
| **Hover**     | `text-blue-500` on the button                                  |

---

## Verified Transaction Badges

Reviews from users who have completed an on-chain transaction (tip/payment) with the worker are marked as "Verified".

### Badge Design

```
┌──────────────────────────────────────┐
│  ✓ Verified Transaction              │
└──────────────────────────────────────┘

Badge:
  inline-flex items-center gap-1
  rounded-full px-2 py-0.5
  bg-green-50 text-green-700
  text-xs font-medium
  border border-green-200

  Icon: BadgeCheck (lucide) size 12
```

### Verification Logic

- When a review is submitted, the backend checks if the reviewer has at least one completed `tip()` transaction to the worker's `walletAddress` on the Stellar network.
- If verified, the review is stored with `isVerified: true`.
- Verified reviews appear with the badge and are sorted higher by default in the "Most Helpful" sort.

### Verified vs. Unverified Treatment

| Aspect                | Verified                                     | Unverified    |
| --------------------- | -------------------------------------------- | ------------- |
| Badge                 | Green "Verified Transaction" badge           | No badge      |
| Sort weight           | Higher in "Most Helpful"                     | Normal        |
| Average rating weight | 1.5x weight                                  | 1x weight     |
| Visual prominence     | Slightly larger avatar, green-50 left border | Standard card |

**Verified card accent:**

```
Verified review card:
  border-l-2 border-green-400
  (in addition to the standard card border)
```

---

## Moderation & Reporting

### Report Flow

1. User clicks the "Report" button on a review.
2. A dialog appears asking for the reason.

```
┌──── Report Review Dialog ──────────────────────┐
│  Report this review                             │
│  ──────────────────────────────────────────── │
│                                                 │
│  Why are you reporting this review?             │
│                                                 │
│  ○ Spam or fake review                          │
│  ○ Inappropriate or offensive content           │
│  ○ Conflict of interest                         │
│  ○ Contains personal information                │
│  ○ Other                                        │
│                                                 │
│  Additional details (optional)                  │
│  ┌───────────────────────────────────────────┐  │
│  │                                           │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
│  [ Cancel ]              [ Submit Report ]      │
└─────────────────────────────────────────────────┘

Dialog: max-w-sm rounded-2xl bg-white p-6 shadow-xl

Radio group:
  flex flex-col gap-2
  Each: flex items-center gap-2 text-sm text-gray-700
  Radio: h-4 w-4 border-2 border-gray-300 rounded-full
    Checked: border-blue-600 with inner fill

Textarea:
  w-full rounded-lg border px-3 py-2 text-sm
  min-h-[80px]

Submit button:
  bg-red-600 text-white rounded-lg px-5 py-2.5 text-sm font-medium
```

3. On submit, the report is sent to the moderation queue (see `ADMIN_DASHBOARD.md`).
4. Success toast: "Report submitted. We'll review it shortly."

### Admin-Side Moderation

From the admin dashboard, moderators can:

| Action             | Effect                                                                 |
| ------------------ | ---------------------------------------------------------------------- |
| **Hide review**    | Review hidden from public view. Author sees "Review under moderation". |
| **Remove review**  | Review permanently deleted. Author notified.                           |
| **Dismiss report** | Report closed, review remains visible.                                 |
| **Ban reviewer**   | All reviews from user hidden. Account banned.                          |

### Anti-Abuse Rules

| Rule                           | Enforcement                                               |
| ------------------------------ | --------------------------------------------------------- |
| One review per user per worker | Server-enforced unique constraint                         |
| Edit window                    | 48 hours after submission. After that, review is locked.  |
| Minimum character count        | 10 characters minimum                                     |
| Rate limiting                  | Max 5 reviews per user per day                            |
| Profanity filter               | Server-side check; flagged reviews go to moderation queue |
| Self-review prevention         | Cannot review a worker listing you curated                |

---

## States

### Loading State (Review List)

```
┌──────────────────────────────────────────────────────────────────┐
│  [ReviewSummarySkeleton]                                         │
│                                                                  │
│  [ReviewCardSkeleton]                                            │
│  [ReviewCardSkeleton]                                            │
│  [ReviewCardSkeleton]                                            │
└──────────────────────────────────────────────────────────────────┘

ReviewSummarySkeleton:
  Left: Skeleton h-12 w-16 (average), Skeleton h-4 w-24 (stars), Skeleton h-3 w-16 (count)
  Right: 5 rows of Skeleton h-2 w-full (bars)

ReviewCardSkeleton:
  Avatar: Skeleton h-10 w-10 rounded-full
  Name: Skeleton h-4 w-28
  Stars: Skeleton h-3 w-20
  Body: Skeleton h-3 w-full × 3 lines
  Footer: Skeleton h-3 w-20
```

### Empty State (No Reviews)

Uses the `EmptyState` component pattern from `STATES.md`.

```
Illustration: empty-reviews.svg
Heading: "No reviews yet"
Body: "Be the first to leave a review after completing a job."
CTA: "Write a Review" (scrolls to composer, shown only if eligible)
```

### Error State

```
Heading: "Couldn't load reviews"
Body: "There was a problem fetching reviews. Please try again."
CTA: "Try Again" (refetch)
```

Uses the existing `ErrorBoundary` component pattern.
