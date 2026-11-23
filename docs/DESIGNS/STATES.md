# Empty, Loading & Error State Library

> Issue #726 · Priority: Medium · Complexity: Low

A consistent set of empty-state illustrations, skeletons, and error pages used across the BlueCollar app. All patterns use the existing design tokens (`--primary: 221 83% 53%`, `--destructive: 0 84% 60%`) and Tailwind utility classes from the design system.

---

## Table of Contents

- [Design Principles](#design-principles)
- [Error Pages](#error-pages)
  - [404 — Not Found](#404--not-found)
  - [500 — Server Error](#500--server-error)
  - [Offline](#offline)
- [Skeleton Loaders](#skeleton-loaders)
  - [Card Skeleton](#card-skeleton)
  - [List / Table Row Skeleton](#list--table-row-skeleton)
  - [Profile Skeleton](#profile-skeleton)
  - [Form Skeleton](#form-skeleton)
- [Empty States](#empty-states)
  - [No Results](#no-results)
  - [No Messages](#no-messages)
  - [No Listings](#no-listings)
  - [No Reviews](#no-reviews)
  - [No Notifications](#no-notifications)
- [Illustration Assets](#illustration-assets)
- [Implementation Reference](#implementation-reference)

---

## Design Principles

| Principle         | Rule                                                                                                     |
| ----------------- | -------------------------------------------------------------------------------------------------------- |
| **Clarity**       | Every state must tell the user _what happened_ and _what to do next_.                                    |
| **Consistency**   | All states share the same layout spine: icon/illustration → heading → body → action.                     |
| **Optimism**      | Use encouraging language ("No workers yet" not "No workers found"). Suggest the next action.             |
| **Performance**   | Skeletons mirror the real layout exactly — same heights, gaps, and border-radii — to avoid layout shift. |
| **Accessibility** | All illustrations carry `role="img"` + `aria-label`. Skeleton containers carry `aria-busy="true"`.       |

---

## Error Pages

All error pages are full-viewport centered layouts. They share a common anatomy:

```
┌──────────────────────────────────────────┐
│                                          │
│              [ Illustration ]            │
│              (120×120 SVG)               │
│                                          │
│            Error Code (optional)         │
│               Heading (h1)               │
│          Description (body text)         │
│                                          │
│         [ Primary CTA Button ]           │
│          Secondary link (opt.)           │
│                                          │
└──────────────────────────────────────────┘
```

### 404 — Not Found

| Property         | Value                                                                               |
| ---------------- | ----------------------------------------------------------------------------------- |
| **Illustration** | `empty-search.svg` — magnifying glass with question mark, blue-100/blue-500 palette |
| **Heading**      | "Page not found"                                                                    |
| **Body**         | "The page you're looking for doesn't exist or has been moved."                      |
| **Primary CTA**  | "Go Home" → `/`                                                                     |
| **Secondary**    | "Browse Workers" → `/workers`                                                       |

**Layout spec:**

```
┌────────────────────────────────────────────────────┐
│  min-h-screen flex flex-col items-center           │
│  justify-center px-4 text-center                   │
│                                                    │
│  ┌──────────────────────────────┐                  │
│  │  🔍❓ (empty-search.svg)    │  120×120          │
│  │  role="img"                  │                  │
│  │  aria-label="Page not found" │                  │
│  └──────────────────────────────┘                  │
│                                                    │
│  <p class="text-6xl font-bold text-gray-200">      │
│    404                                             │
│  </p>                                              │
│                                                    │
│  <h1 class="mt-4 text-xl font-semibold             │
│    text-gray-900">                                 │
│    Page not found                                  │
│  </h1>                                             │
│                                                    │
│  <p class="mt-2 text-sm text-gray-500 max-w-sm">   │
│    The page you're looking for doesn't exist       │
│    or has been moved.                              │
│  </p>                                              │
│                                                    │
│  <div class="mt-6 flex gap-3">                     │
│    [Go Home]        bg-blue-600 text-white         │
│    [Browse Workers] border text-gray-600           │
│  </div>                                            │
│                                                    │
└────────────────────────────────────────────────────┘
```

### 500 — Server Error

| Property         | Value                                                                               |
| ---------------- | ----------------------------------------------------------------------------------- |
| **Illustration** | `server-error.svg` — broken gear icon, red-50/red-500 palette                       |
| **Heading**      | "Something went wrong"                                                              |
| **Body**         | "Our servers hit an unexpected error. We've been notified and are looking into it." |
| **Primary CTA**  | "Try Again" → `window.location.reload()`                                            |
| **Secondary**    | "Go Home" → `/`                                                                     |

**Layout spec:** Same anatomy as 404. Uses `destructive` colour for the illustration container:

```
Illustration container:
  h-28 w-28 rounded-full bg-red-50
  flex items-center justify-center

Icon inside:
  server-error.svg at 64×64, text-red-500

Error code:
  <p class="text-6xl font-bold text-gray-200">500</p>
```

### Offline

| Property         | Value                                                              |
| ---------------- | ------------------------------------------------------------------ |
| **Illustration** | `offline.svg` — disconnected Wi-Fi icon, gray-200/gray-400 palette |
| **Heading**      | "You're offline"                                                   |
| **Body**         | "Check your internet connection and try again."                    |
| **Primary CTA**  | "Retry" → `window.location.reload()`                               |

**Behaviour:**

- Auto-detects via `navigator.onLine` and `online`/`offline` window events.
- When connection resumes, automatically reload the current route.
- The CTA button shows a spinner while retrying.

---

## Skeleton Loaders

All skeletons use the base `Skeleton` component (see `packages/app/src/components/Skeleton.tsx`):

```tsx
<div className="animate-pulse rounded-md bg-gray-200" />
```

Skeletons use `aria-busy="true"` on the container and `aria-hidden="true"` on individual skeleton bars.

### Card Skeleton

Matches the `WorkerCard` component layout exactly. Already implemented as `WorkerCardSkeleton`.

```
┌──────────────────────────────┐
│  ┌────┐  ████████████        │  Avatar (h-14 w-14 rounded-full)
│  │    │  ██████               │  Name line + badge
│  └────┘                      │
│                              │
│  ████████████████████████    │  Bio line 1
│  ██████████████████          │  Bio line 2
│  ████████                    │  Location
│                              │
│  ┌──────────────────────┐    │  CTA button
│  │                      │    │
│  └──────────────────────┘    │
└──────────────────────────────┘

Classes: flex flex-col gap-4 rounded-xl border bg-white p-5 shadow-sm
```

### List / Table Row Skeleton

For data tables (e.g., dashboard worker list, admin panels).

```
┌──────────────────────────────────────────────────────────────┐
│  Header row: bg-gray-50, real text labels                    │
├──────────────────────────────────────────────────────────────┤
│  ████████████  │  ██████  │  ████  │  ████████  │  ██  ██   │
├──────────────────────────────────────────────────────────────┤
│  ██████████    │  ████████│  ████  │  ██████    │  ██  ██   │
├──────────────────────────────────────────────────────────────┤
│  ████████████  │  ██████  │  ████  │  ████████  │  ██  ██   │
└──────────────────────────────────────────────────────────────┘
```

**Spec per row:**

| Column   | Skeleton width        | Height             |
| -------- | --------------------- | ------------------ |
| Name     | `w-32`                | `h-4`              |
| Category | `w-20`                | `h-5 rounded-full` |
| Status   | `w-14`                | `h-5 rounded-full` |
| Date     | `w-24`                | `h-4`              |
| Actions  | two `w-7 h-7` circles | `rounded-md`       |

Render 5 rows by default. Each row separated by `divide-y`.

### Profile Skeleton

Matches the worker profile detail page. Already implemented as `WorkerProfileSkeleton`.

```
┌─────────────────────────────────────────────┐
│  ████████  (back link)                      │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │  ┌────┐  ████████████████           │    │
│  │  │    │  ██████████                 │    │
│  │  └────┘                             │    │
│  │                                     │    │
│  │  ████████████████████████████████   │    │
│  │  ██████████████████████████         │    │
│  │  ████████████████████               │    │
│  │                                     │    │
│  │  Contact details block              │    │
│  │  ████████████████                   │    │
│  │  ██████████████████████             │    │
│  │  ████████████████                   │    │
│  │                                     │    │
│  │  ────────────────────────────────   │    │
│  │  Wallet / Tip section               │    │
│  │  ████████████████  │  [████████]    │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘

Container: mx-auto max-w-2xl px-4 py-10
Card: rounded-2xl border bg-white p-8 shadow-sm
```

### Form Skeleton

For the worker create/edit form and other multi-field forms.

```
┌─────────────────────────────────────────────┐
│  ████████████████  (page title)             │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │  Label skeleton   h-3 w-16          │    │
│  │  Input skeleton   h-10 w-full       │    │
│  │                                     │    │
│  │  Label skeleton   h-3 w-20          │    │
│  │  Input skeleton   h-10 w-full       │    │
│  │                                     │    │
│  │  Label skeleton   h-3 w-24          │    │
│  │  Textarea skel.   h-24 w-full       │    │
│  │                                     │    │
│  │  [██████████████████████]  button   │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘

Gap between field groups: gap-6
Input skeletons: rounded-lg
Button skeleton: h-10 w-full rounded-lg
```

---

## Empty States

All empty states follow a shared layout:

```
┌──────────────────────────────────────────┐
│  flex flex-col items-center justify-center│
│  py-20 text-center                       │
│                                          │
│         [ Illustration ]                 │
│         (80×80 SVG)                      │
│                                          │
│          Heading (font-medium)           │
│       Description (text-sm gray-400)     │
│                                          │
│        [ Primary CTA Button ]            │
│                                          │
└──────────────────────────────────────────┘
```

### No Results

| Property         | Value                                                       |
| ---------------- | ----------------------------------------------------------- |
| **Context**      | Worker search/filter returns zero matches                   |
| **Illustration** | `empty-search.svg` — magnifying glass with "0"              |
| **Heading**      | "No workers found"                                          |
| **Body**         | "Try adjusting your filters or search in a different area." |
| **CTA**          | "Clear Filters" → resets all filters                        |

### No Messages

| Property         | Value                                                                 |
| ---------------- | --------------------------------------------------------------------- |
| **Context**      | User's message inbox is empty                                         |
| **Illustration** | `empty-inbox.svg` — open envelope, blue-100 palette                   |
| **Heading**      | "No messages yet"                                                     |
| **Body**         | "When you contact a worker or receive a reply, it will show up here." |
| **CTA**          | "Browse Workers" → `/workers`                                         |

### No Listings

| Property         | Value                                              |
| ---------------- | -------------------------------------------------- |
| **Context**      | Curator dashboard has no worker listings           |
| **Illustration** | `empty-listings.svg` — clipboard with plus sign    |
| **Heading**      | "No workers yet"                                   |
| **Body**         | "Create your first worker listing to get started." |
| **CTA**          | "Create Worker" → `/dashboard/workers/new`         |

_Note: This pattern is already implemented inline in `dashboard/page.tsx`. The design formalises it with an illustration asset._

### No Reviews

| Property         | Value                                                             |
| ---------------- | ----------------------------------------------------------------- |
| **Context**      | Worker profile has no reviews                                     |
| **Illustration** | `empty-reviews.svg` — star with speech bubble                     |
| **Heading**      | "No reviews yet"                                                  |
| **Body**         | "Be the first to leave a review after completing a job."          |
| **CTA**          | "Write a Review" (shown only if user has a completed transaction) |

### No Notifications

| Property         | Value                                                                       |
| ---------------- | --------------------------------------------------------------------------- |
| **Context**      | Notification centre is empty                                                |
| **Illustration** | `empty-notifications.svg` — bell with checkmark                             |
| **Heading**      | "You're all caught up"                                                      |
| **Body**         | "New notifications will appear here when there's activity on your account." |
| **CTA**          | None (passive state)                                                        |

---

## Illustration Assets

All illustrations are optimised SVGs using the BlueCollar colour palette. They should be placed in `packages/app/public/illustrations/`.

| Asset file                | Used by          | Palette                                | Size    |
| ------------------------- | ---------------- | -------------------------------------- | ------- |
| `empty-search.svg`        | 404, No Results  | `blue-100`, `blue-500`, `gray-200`     | 120×120 |
| `server-error.svg`        | 500              | `red-50`, `red-500`, `gray-200`        | 120×120 |
| `offline.svg`             | Offline page     | `gray-200`, `gray-400`                 | 120×120 |
| `empty-inbox.svg`         | No Messages      | `blue-100`, `blue-500`                 | 80×80   |
| `empty-listings.svg`      | No Listings      | `blue-100`, `blue-500`                 | 80×80   |
| `empty-reviews.svg`       | No Reviews       | `yellow-100`, `yellow-500`, `blue-500` | 80×80   |
| `empty-notifications.svg` | No Notifications | `blue-100`, `blue-500`                 | 80×80   |

**Illustration guidelines:**

- Flat style, 2-colour max (primary + one accent from the token palette).
- No text inside SVGs — keeps them language-agnostic.
- Max file size: 3 KB per SVG (use SVGO for optimisation).
- Viewbox should match the artboard size (e.g., `viewBox="0 0 120 120"`).
- All paths use `currentColor` or design-token hex values — no hardcoded colours outside the palette.

---

## Implementation Reference

### Existing Components

| Component               | File                               | Status      |
| ----------------------- | ---------------------------------- | ----------- |
| `Skeleton` (base)       | `src/components/Skeleton.tsx`      | Implemented |
| `WorkerCardSkeleton`    | `src/components/Skeleton.tsx`      | Implemented |
| `WorkerProfileSkeleton` | `src/components/Skeleton.tsx`      | Implemented |
| `ErrorBoundary`         | `src/components/ErrorBoundary.tsx` | Implemented |
| Workers error page      | `src/app/workers/error.tsx`        | Implemented |
| Worker profile error    | `src/app/workers/[id]/error.tsx`   | Implemented |
| Workers loading         | `src/app/workers/loading.tsx`      | Implemented |
| Worker profile loading  | `src/app/workers/[id]/loading.tsx` | Implemented |

### Components to Add

| Component          | Proposed file                      | Description                                           |
| ------------------ | ---------------------------------- | ----------------------------------------------------- |
| `NotFoundPage`     | `src/app/not-found.tsx`            | Global 404 page                                       |
| `GlobalError`      | `src/app/global-error.tsx`         | Global 500 page                                       |
| `OfflineBanner`    | `src/components/OfflineBanner.tsx` | Offline detection + full-page fallback                |
| `EmptyState`       | `src/components/EmptyState.tsx`    | Reusable empty-state shell (icon, heading, body, CTA) |
| `TableRowSkeleton` | `src/components/Skeleton.tsx`      | Add to existing file                                  |
| `FormSkeleton`     | `src/components/Skeleton.tsx`      | Add to existing file                                  |

### Reusable `EmptyState` Component API

```tsx
interface EmptyStateProps {
  illustration: string; // path to SVG in /public/illustrations/
  heading: string;
  description: string;
  action?: {
    label: string;
    href?: string; // renders Link
    onClick?: () => void; // renders button
  };
  className?: string;
}
```

### Colour Tokens (reference)

| Token                | Light                | Dark                      |
| -------------------- | -------------------- | ------------------------- |
| `--primary`          | `hsl(221, 83%, 53%)` | `hsl(217, 91%, 60%)`      |
| `--destructive`      | `hsl(0, 84%, 60%)`   | `hsl(0, 63%, 31%)`        |
| `--muted`            | `hsl(214, 32%, 91%)` | `hsl(217, 33%, 17%)`      |
| `--muted-foreground` | `hsl(215, 16%, 47%)` | `hsl(215, 20%, 65%)`      |
| Skeleton pulse       | `bg-gray-200`        | `bg-gray-700` (dark mode) |
