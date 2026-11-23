# Admin & Moderation Dashboard

> Issue #725 · Priority: Medium · Complexity: Medium

Design specification for the admin surface covering user management, listing moderation, dispute review, and platform analytics. Built on the existing design system (Tailwind tokens, Radix primitives, Lucide icons).

---

## Table of Contents

- [Roles & Access](#roles--access)
- [Information Architecture](#information-architecture)
- [Dashboard Overview](#dashboard-overview)
- [User Management](#user-management)
- [Listing Moderation](#listing-moderation)
- [Dispute Resolution](#dispute-resolution)
- [Audit Log](#audit-log)
- [Data-Density & Table Patterns](#data-density--table-patterns)
- [Navigation & Layout](#navigation--layout)

---

## Roles & Access

Only users with `role: admin` can access `/admin/*` routes. The app already enforces three roles via the Prisma schema:

| Role      | Access                                    |
| --------- | ----------------------------------------- |
| `user`    | Public pages, own profile                 |
| `curator` | `/dashboard` — manage own worker listings |
| `admin`   | Everything above + `/admin/*`             |

Server-side middleware must reject non-admin users with a `403` before any data is returned.

---

## Information Architecture

```
/admin
├── /admin                     → Overview (dashboard home)
├── /admin/users               → User management table
│   └── /admin/users/[id]      → User detail sheet (slide-over)
├── /admin/listings            → Listing moderation queue
│   └── /admin/listings/[id]   → Listing detail sheet
├── /admin/disputes            → Dispute resolution queue
│   └── /admin/disputes/[id]   → Dispute detail + timeline
└── /admin/audit-log           → Audit log browser
```

---

## Dashboard Overview

The overview page provides at-a-glance metrics and recent activity.

### Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  Sidebar (w-60)  │  Main content (flex-1)                       │
│                  │                                               │
│  Logo            │  ┌─────────────────────────────────────────┐  │
│  ─────           │  │  h1: "Dashboard"                        │  │
│  Overview  ●     │  │  p: "Platform overview and key metrics" │  │
│  Users           │  └─────────────────────────────────────────┘  │
│  Listings        │                                               │
│  Disputes        │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ │
│  Audit Log       │  │ Total  │ │ Active │ │ Open   │ │ New    │ │
│                  │  │ Users  │ │ Listgs │ │ Dispts │ │ Users  │ │
│                  │  │  1,247 │ │   342  │ │    8   │ │   23   │ │
│                  │  │ +12%   │ │ +5%    │ │ -2     │ │ today  │ │
│                  │  └────────┘ └────────┘ └────────┘ └────────┘ │
│                  │                                               │
│                  │  ┌────────────────────┐ ┌──────────────────┐  │
│                  │  │  Recent Activity   │ │  Moderation Q    │  │
│                  │  │  (activity feed)   │ │  (pending items) │  │
│                  │  │                    │ │                  │  │
│                  │  └────────────────────┘ └──────────────────┘  │
│                  │                                               │
└──────────────────────────────────────────────────────────────────┘
```

### Metric Cards

Each metric card follows this spec:

```
┌──────────────────────────────────┐
│  ┌──────┐                        │
│  │ icon │   Label (text-sm       │
│  └──────┘   text-gray-500)       │
│                                  │
│  Value (text-2xl font-bold)      │
│  Trend badge (+12% ▲ or -2 ▼)   │
└──────────────────────────────────┘

Card: rounded-xl border bg-white p-5 shadow-sm
Icon container: h-10 w-10 rounded-lg bg-{color}-50
  flex items-center justify-center
Trend up:   text-green-600 bg-green-50 rounded-full px-2 py-0.5 text-xs
Trend down: text-red-600   bg-red-50   rounded-full px-2 py-0.5 text-xs
```

| Metric            | Icon             | Colour   |
| ----------------- | ---------------- | -------- |
| Total Users       | `Users` (lucide) | `blue`   |
| Active Listings   | `Briefcase`      | `green`  |
| Open Disputes     | `AlertTriangle`  | `amber`  |
| New Users (today) | `UserPlus`       | `violet` |

### Recent Activity Feed

A vertical list showing the 10 most recent admin-relevant events.

```
┌──────────────────────────────────────────────┐
│  Recent Activity                     View All│
│  ─────────────────────────────────────────── │
│  ● [avatar] Jane D. registered         2m   │
│  ● [avatar] Worker "Mike P." flagged   15m   │
│  ● [avatar] Dispute #42 resolved       1h   │
│  ● ...                                       │
└──────────────────────────────────────────────┘

Each row:
  flex items-center gap-3 py-3 border-b last:border-0
  Avatar: h-8 w-8 rounded-full
  Description: text-sm text-gray-700, flex-1
  Timestamp: text-xs text-gray-400 shrink-0
```

### Moderation Queue Summary

Shows the first 5 items needing moderation action.

```
┌──────────────────────────────────────────────┐
│  Moderation Queue (8)                View All│
│  ─────────────────────────────────────────── │
│  Flagged: "John's Plumbing"     Review  →   │
│  Reported: "ElectroPro"         Review  →   │
│  ...                                         │
└──────────────────────────────────────────────┘
```

---

## User Management

### User Table — `/admin/users`

```
┌────────────────────────────────────────────────────────────────────────┐
│  h1: "Users"          [Search input]              [Role filter ▼]     │
│  p: "1,247 total"                                                      │
├────────────────────────────────────────────────────────────────────────┤
│  □  User              Email                Role    Joined    Status   │
├────────────────────────────────────────────────────────────────────────┤
│  □  [av] Jane Doe     jane@example.com     user    Jan 5     Active   │
│  □  [av] Mike P.      mike@pm.com          curator Dec 12    Active   │
│  □  [av] Spam Bot     spam@bot.io          user    Jun 20    Banned   │
│  ...                                                                   │
├────────────────────────────────────────────────────────────────────────┤
│  Showing 1-20 of 1,247        [ ← ]  1  2  3  ...  63  [ → ]        │
└────────────────────────────────────────────────────────────────────────┘
```

**Columns:**

| Column   | Width    | Content                                                  |
| -------- | -------- | -------------------------------------------------------- |
| Checkbox | `w-10`   | Bulk select                                              |
| User     | `flex-1` | Avatar (h-8 w-8) + full name                             |
| Email    | `w-56`   | Truncated if long                                        |
| Role     | `w-24`   | Badge: `user` (gray), `curator` (blue), `admin` (violet) |
| Joined   | `w-28`   | Relative date (e.g., "Jan 5, 2025")                      |
| Status   | `w-24`   | Badge: Active (green), Banned (red), Suspended (amber)   |

**Search:** Debounced (300ms), searches across name and email.

**Filters:**

- Role: All / User / Curator / Admin
- Status: All / Active / Banned / Suspended

### User Detail — Slide-Over Sheet

Clicking a user row opens a `Sheet` (Radix `@radix-ui/react-dialog`) from the right.

```
┌──── Sheet (max-w-md) ──────────────────┐
│  ← Close                               │
│                                         │
│  ┌────┐                                │
│  │ av │  Jane Doe                       │
│  └────┘  jane@example.com              │
│          Role: user  ·  Active          │
│          Joined: Jan 5, 2025            │
│          Location: Lagos, NG            │
│                                         │
│  ─────────────────────────────────────  │
│  Wallet: GABCD...XYZ                    │
│                                         │
│  ─────────────────────────────────────  │
│  Worker Listings (3)                    │
│  • Mike's Plumbing (Active)             │
│  • Quick Electrical (Inactive)          │
│  • ...                                  │
│                                         │
│  ─────────────────────────────────────  │
│  Actions                               │
│  ┌─────────────────┐ ┌───────────────┐ │
│  │ Change Role  ▼  │ │ Ban User      │ │
│  └─────────────────┘ └───────────────┘ │
│                                         │
└─────────────────────────────────────────┘
```

### Ban / Suspension Flow

1. Admin clicks "Ban User" or "Suspend User" button.
2. A confirmation dialog appears (same pattern as the delete confirmation in the curator dashboard).
3. For suspension: admin selects a duration (24h / 7d / 30d / custom).
4. For ban: admin enters a reason (required, min 10 chars).
5. On confirm, the action is logged to the audit trail.

```
┌─── Confirmation Dialog ───────────────────┐
│  ⚠️  Ban this user?                       │
│                                            │
│  This will immediately revoke access for   │
│  Jane Doe. All their worker listings will  │
│  be deactivated.                           │
│                                            │
│  Reason (required):                        │
│  ┌──────────────────────────────────────┐  │
│  │                                      │  │
│  └──────────────────────────────────────┘  │
│                                            │
│  [ Cancel ]            [ Ban User ]        │
└────────────────────────────────────────────┘

Dialog: max-w-sm rounded-2xl bg-white p-6 shadow-xl
Ban button: bg-red-600 text-white
```

---

## Listing Moderation

### Moderation Queue — `/admin/listings`

Shows all listings that have been flagged, are pending review, or were recently reported.

```
┌────────────────────────────────────────────────────────────────────────┐
│  h1: "Listing Moderation"                                              │
│  Tabs: [ All | Pending (5) | Flagged (3) | Approved | Rejected ]      │
├────────────────────────────────────────────────────────────────────────┤
│  Listing            Category    Curator       Flags  Status   Action   │
├────────────────────────────────────────────────────────────────────────┤
│  Mike's Plumbing    Plumbing    Jane Doe       2     Pending  Review → │
│  Quick Electrical   Electrical  Bob S.         0     Pending  Review → │
│  Spam Service       Other       Spam Bot       5     Flagged  Review → │
├────────────────────────────────────────────────────────────────────────┤
│  Showing 1-20 of 42                                                    │
└────────────────────────────────────────────────────────────────────────┘
```

**Tab badges** show the count of items in each status. The active tab uses `border-b-2 border-blue-600 text-blue-600`.

**Status badges:**

| Status   | Colour                       |
| -------- | ---------------------------- |
| Pending  | `bg-amber-50 text-amber-600` |
| Flagged  | `bg-red-50 text-red-600`     |
| Approved | `bg-green-50 text-green-600` |
| Rejected | `bg-gray-100 text-gray-500`  |

### Listing Detail — Slide-Over Sheet

```
┌──── Sheet (max-w-lg) ──────────────────────┐
│  ← Close                                    │
│                                              │
│  ┌────┐  Mike's Plumbing                    │
│  │ av │  Category: Plumbing                 │
│  └────┘  Curator: Jane Doe                  │
│          Created: Jan 10, 2025              │
│          Status: Pending                     │
│                                              │
│  ─────────────────────────────────────────   │
│  Bio:                                        │
│  "Experienced plumber with 10 years..."      │
│                                              │
│  Contact: +234 801 234 5678                  │
│  Location: Lagos, Nigeria                    │
│  Wallet: GABCD...XYZ                         │
│                                              │
│  ─────────────────────────────────────────   │
│  Flags (2)                                   │
│  • "Possibly fake listing" — user123, 2d ago │
│  • "Duplicate entry" — user456, 5d ago       │
│                                              │
│  ─────────────────────────────────────────   │
│  ┌──────────────┐  ┌────────────────────┐   │
│  │  ✓ Approve   │  │  ✗ Reject          │   │
│  └──────────────┘  └────────────────────┘   │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │  Admin note (optional)                 │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘

Approve button: bg-green-600 text-white
Reject button: bg-red-600 text-white
```

---

## Dispute Resolution

### Dispute Queue — `/admin/disputes`

```
┌────────────────────────────────────────────────────────────────────────┐
│  h1: "Disputes"                                                        │
│  Tabs: [ Open (8) | In Progress (3) | Resolved | Escalated ]          │
├────────────────────────────────────────────────────────────────────────┤
│  #   Subject              Parties           Opened    Status           │
├────────────────────────────────────────────────────────────────────────┤
│  42  Payment not received  Jane ↔ Mike      Jun 18    Open             │
│  41  Service not rendered  Bob ↔ ElectroPro Jun 15    In Progress      │
│  40  Overcharged           Alice ↔ QuickFix Jun 12    Resolved         │
├────────────────────────────────────────────────────────────────────────┤
│  Showing 1-20 of 34                                                    │
└────────────────────────────────────────────────────────────────────────┘
```

### Dispute Detail — `/admin/disputes/[id]`

Full-page view (not a sheet) because disputes require more context.

```
┌──────────────────────────────────────────────────────────────────┐
│  ← Back to Disputes                                              │
│                                                                  │
│  Dispute #42: Payment not received          Status: Open         │
│  Opened: Jun 18, 2025                                            │
│                                                                  │
│  ┌──────────────── Parties ────────────────────────────────────┐ │
│  │  ┌────┐ Jane Doe (Complainant)    ┌────┐ Mike P. (Worker)  │ │
│  │  │ av │ jane@example.com          │ av │ mike@pm.com       │ │
│  │  └────┘ View profile →            └────┘ View profile →    │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌──────────────── Timeline ───────────────────────────────────┐ │
│  │                                                              │ │
│  │  ● Jun 18, 10:30 AM                                         │ │
│  │  │ Jane opened dispute                                      │ │
│  │  │ "I paid 500 XLM but the worker says they didn't..."      │ │
│  │  │                                                          │ │
│  │  ● Jun 18, 2:15 PM                                          │ │
│  │  │ Mike responded                                           │ │
│  │  │ "I completed the work but haven't received payment..."   │ │
│  │  │                                                          │ │
│  │  ● Jun 19, 9:00 AM                                          │ │
│  │  │ Admin note (internal)                                    │ │
│  │  │ "Checking on-chain transaction records..."               │ │
│  │  │                                                          │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌──────────────── Evidence ───────────────────────────────────┐ │
│  │  Transaction hash: 0xabc...123  [View on Explorer →]        │ │
│  │  Attachments: screenshot.png (142 KB)                       │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌──────────────── Actions ────────────────────────────────────┐ │
│  │  ┌──────────────────────────────────────────────────────┐   │ │
│  │  │  Add internal note...                                │   │ │
│  │  └──────────────────────────────────────────────────────┘   │ │
│  │                                                              │ │
│  │  ┌──────────┐  ┌────────────┐  ┌───────────────────────┐   │ │
│  │  │ Resolve  │  │ Escalate   │  │ Request more info     │   │ │
│  │  └──────────┘  └────────────┘  └───────────────────────┘   │ │
│  └──────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

**Timeline spec:**

```
Each timeline entry:
  relative to a vertical line (border-l-2 border-gray-200 ml-3)

  Timestamp dot:
    absolute -left-[7px]
    h-3 w-3 rounded-full bg-blue-500 border-2 border-white

  Internal notes:
    bg-amber-50 border border-amber-200 rounded-lg p-3
    Label: "Internal — not visible to parties"
```

**Resolution flow:**

1. Admin clicks "Resolve".
2. Modal asks for resolution type: "Favour Complainant" / "Favour Worker" / "Mutual Resolution".
3. Admin enters resolution summary (required).
4. If financial remedy is needed, admin can trigger a refund (links to on-chain action).
5. Both parties are notified.

---

## Audit Log

### Audit Log Browser — `/admin/audit-log`

```
┌────────────────────────────────────────────────────────────────────────┐
│  h1: "Audit Log"                                                       │
│  ┌──────────────────────────────────┐  ┌───────────┐  ┌────────────┐  │
│  │  Search by actor or action...    │  │ Type ▼    │  │ Date range │  │
│  └──────────────────────────────────┘  └───────────┘  └────────────┘  │
├────────────────────────────────────────────────────────────────────────┤
│  Timestamp          Actor          Action              Target          │
├────────────────────────────────────────────────────────────────────────┤
│  Jun 20, 14:32     admin@bc.com   Banned user          user/clxyz     │
│  Jun 20, 14:30     admin@bc.com   Rejected listing     worker/cl123   │
│  Jun 19, 09:15     admin@bc.com   Resolved dispute     dispute/42     │
│  Jun 18, 11:00     system         Auto-flagged listing worker/cl456   │
│  ...                                                                   │
├────────────────────────────────────────────────────────────────────────┤
│  Showing 1-50 of 1,203                                                 │
└────────────────────────────────────────────────────────────────────────┘
```

**Filters:**

| Filter     | Type        | Options                                                         |
| ---------- | ----------- | --------------------------------------------------------------- |
| Search     | Text input  | Free-text across actor and action                               |
| Type       | Dropdown    | All / User actions / Listing actions / Dispute actions / System |
| Date range | Date picker | Start date → End date                                           |

**Row click** expands an inline detail panel showing the full JSON payload of the action (for debugging).

```
┌────────────────────────────────────────────────────────────────────────┐
│  Jun 20, 14:32     admin@bc.com   Banned user          user/clxyz     │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │  {                                                                │ │
│  │    "action": "user.ban",                                          │ │
│  │    "actor": "admin@bc.com",                                       │ │
│  │    "target": "clxyz",                                             │ │
│  │    "reason": "Spam account",                                      │ │
│  │    "ip": "102.89.xx.xx",                                          │ │
│  │    "timestamp": "2025-06-20T14:32:00Z"                            │ │
│  │  }                                                                │ │
│  └──────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘

Detail panel: bg-gray-50 rounded-lg p-4 font-mono text-xs
```

---

## Data-Density & Table Patterns

All admin tables follow these shared conventions:

### Table Structure

```
Container: rounded-xl border bg-white shadow-sm overflow-hidden
Header row: bg-gray-50 border-b
  text-xs font-semibold uppercase tracking-wide text-gray-500
  px-5 py-3.5

Body rows: divide-y
  px-5 py-4
  hover:bg-gray-50 transition-colors

Pagination bar: border-t px-5 py-3
  flex items-center justify-between
```

### Pagination

```
┌──────────────────────────────────────────────────────────────────┐
│  Showing 1-20 of 1,247 results         [←] 1 2 3 ... 63 [→]   │
└──────────────────────────────────────────────────────────────────┘

"Showing X-Y of Z": text-sm text-gray-500
Page buttons: h-8 w-8 rounded-md text-sm
  Active: bg-blue-600 text-white
  Inactive: text-gray-600 hover:bg-gray-100
  Disabled: opacity-40 cursor-not-allowed
```

### Bulk Actions

When one or more checkboxes are selected, a bulk action bar slides in above the table:

```
┌──────────────────────────────────────────────────────────────────┐
│  ✓ 3 selected    [ Ban Selected ]  [ Change Role ▼ ]  [ Clear ]│
└──────────────────────────────────────────────────────────────────┘

Bar: bg-blue-50 border border-blue-200 rounded-lg px-4 py-2
  flex items-center gap-3 text-sm
```

### Responsive Behaviour

- **Desktop (≥1024px):** Full table with all columns visible, sidebar pinned.
- **Tablet (768-1023px):** Sidebar collapses to icons-only (w-16). Table hides lowest-priority columns (e.g., "Joined" date).
- **Mobile (<768px):** Sidebar becomes a top hamburger menu. Tables switch to a card-based layout:

```
┌──────────────────────────────────┐
│  [av] Jane Doe                   │
│  jane@example.com                │
│  Role: user · Active             │
│  Joined: Jan 5, 2025             │
│  ────────────────────────────    │
│  [View] [Ban]                    │
└──────────────────────────────────┘
```

---

## Navigation & Layout

### Admin Sidebar

```
┌──────────────────────┐
│  ┌────┐              │
│  │ BC │ BlueCollar   │  Logo + app name
│  └────┘ Admin        │
│                      │
│  ─────────────────── │
│                      │
│  📊 Overview         │  NavLink, active = bg-blue-50 text-blue-600
│  👥 Users            │  font-medium border-l-2 border-blue-600
│  📋 Listings         │
│  ⚖️  Disputes  (8)   │  Badge for open count
│  📝 Audit Log        │
│                      │
│  ─────────────────── │
│                      │
│  ← Back to App       │  Link to /dashboard
│                      │
│  ─────────────────── │
│                      │
│  [av] Admin Name     │  Current user info
│       admin@bc.com   │
│       [Logout]       │
│                      │
└──────────────────────┘

Sidebar: w-60 border-r bg-white h-screen sticky top-0
  flex flex-col
NavLinks: flex items-center gap-3 px-4 py-2.5 rounded-lg
  text-sm text-gray-600 hover:bg-gray-50
Active: bg-blue-50 text-blue-600 font-medium
Badge: ml-auto bg-red-500 text-white text-xs rounded-full
  h-5 min-w-[20px] flex items-center justify-center
```

### Admin Layout Component

The admin layout wraps all `/admin/*` routes:

```
┌──────────────────────────────────────────────────────────────────┐
│  Sidebar (w-60)  │  ┌───────────────────────────────────────┐   │
│                  │  │  Top bar (optional breadcrumb)        │   │
│                  │  └───────────────────────────────────────┘   │
│                  │                                               │
│                  │  ┌───────────────────────────────────────┐   │
│                  │  │  Page content                         │   │
│                  │  │  (rendered by child route)             │   │
│                  │  │                                       │   │
│                  │  └───────────────────────────────────────┘   │
│                  │                                               │
└──────────────────────────────────────────────────────────────────┘

Layout: flex min-h-screen
Main: flex-1 bg-gray-50 p-6 lg:p-8
```
