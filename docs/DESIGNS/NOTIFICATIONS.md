# Notification Centre & Toast System

> Issue #724 · Priority: Medium · Complexity: Low

Design specification for the in-app notification centre, badge system, and transient toast patterns. Builds on the existing `Toast` component and `useToast` hook.

---

## Table of Contents

- [Toast System](#toast-system)
  - [Existing Implementation](#existing-implementation)
  - [Toast Variants](#toast-variants)
  - [Toast Anatomy](#toast-anatomy)
  - [Motion & Dismissal](#motion--dismissal)
- [Notification Centre](#notification-centre)
  - [Notification Bell & Badge](#notification-bell--badge)
  - [Notification Panel](#notification-panel)
  - [Notification Types & Grouping](#notification-types--grouping)
  - [Read / Unread States](#read--unread-states)
  - [Empty State](#empty-state)
- [Notification Preferences](#notification-preferences)
- [Push Notification Spec](#push-notification-spec)

---

## Toast System

### Existing Implementation

The app already has a toast system:

- **Component:** `src/components/Toast.tsx` — renders a fixed container at `bottom-5 right-5`
- **Hook:** `src/hooks/useToast.ts` — manages toast state with auto-dismiss at 3.5s
- **Types:** Currently supports `success` and `error`

The design extends this to cover additional variants while keeping the existing API.

### Toast Variants

| Variant         | Icon            | Background      | Use case                                             |
| --------------- | --------------- | --------------- | ---------------------------------------------------- |
| **Success**     | `CheckCircle2`  | `bg-green-600`  | Action completed (listing created, profile saved)    |
| **Error**       | `AlertCircle`   | `bg-red-600`    | Action failed (network error, validation)            |
| **Info**        | `Info`          | `bg-blue-600`   | Informational (new feature, system notice)           |
| **Warning**     | `AlertTriangle` | `bg-amber-500`  | Caution (approaching limit, pending verification)    |
| **Transaction** | `ArrowUpRight`  | `bg-violet-600` | Blockchain transaction (tip sent, payment confirmed) |

### Toast Anatomy

```
┌───────────────────────────────────────────────────┐
│  [icon]  Message text goes here              [✕]  │
│                                                   │
│          Optional detail line (text-xs             │
│          opacity-80)                               │
│                                                   │
│          ━━━━━━━━━━━━━━━━━━━━━━━━━  (progress bar) │
└───────────────────────────────────────────────────┘
```

**Spec:**

```
Container:
  flex items-start gap-3 rounded-xl px-4 py-3 shadow-lg
  text-sm font-medium text-white
  min-w-[280px] max-w-[400px]

Icon: shrink-0, size 16

Message: flex-1
  Primary: text-sm font-medium
  Detail (optional): text-xs opacity-80 mt-0.5

Dismiss button: shrink-0 opacity-70 hover:opacity-100

Progress bar (optional):
  absolute bottom-0 left-0 right-0 h-0.5
  bg-white/30
  Animated width from 100% to 0% over the auto-dismiss duration
  rounded-b-xl overflow-hidden
```

### Transaction Toast — Special Variant

For blockchain transactions, the toast includes a link to the explorer:

```
┌───────────────────────────────────────────────────┐
│  [↗]  Tip sent successfully                 [✕]  │
│       500 XLM to Mike's Plumbing                  │
│       View on Stellar Explorer →                  │
│       ━━━━━━━━━━━━━━━━━━━━━━━━━                   │
└───────────────────────────────────────────────────┘

Explorer link: text-xs underline opacity-80 hover:opacity-100
  cursor-pointer
```

### Motion & Dismissal

| Behaviour          | Spec                                                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| **Enter**          | Slide in from right + fade in. `translateX(100%) → translateX(0)`, `opacity: 0 → 1`. Duration: `200ms ease-out`.                |
| **Exit**           | Slide out to right + fade out. Reverse of enter. Duration: `150ms ease-in`.                                                     |
| **Auto-dismiss**   | Default: 3.5s (existing). Transaction toasts: 6s (longer for explorer link). Persistent: no auto-dismiss (for critical errors). |
| **Manual dismiss** | Click the `✕` button.                                                                                                           |
| **Hover pause**    | Hovering over a toast pauses the auto-dismiss timer. Timer resumes on mouse leave.                                              |
| **Stacking**       | Max 3 visible toasts. Oldest dismissed when a 4th arrives. Stack gap: `gap-2` (8px).                                            |
| **Swipe dismiss**  | On touch devices, swipe right to dismiss. Threshold: 100px horizontal drag.                                                     |

**CSS animation keyframes:**

```css
@keyframes toast-enter {
  from {
    opacity: 0;
    transform: translateX(100%);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes toast-exit {
  from {
    opacity: 1;
    transform: translateX(0);
  }
  to {
    opacity: 0;
    transform: translateX(100%);
  }
}

@keyframes toast-progress {
  from {
    width: 100%;
  }
  to {
    width: 0%;
  }
}
```

### Updated `ToastType`

```typescript
type ToastType = 'success' | 'error' | 'info' | 'warning' | 'transaction';

interface ToastOptions {
  message: string;
  type: ToastType;
  detail?: string;
  duration?: number; // ms, default 3500
  persistent?: boolean; // no auto-dismiss
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
}
```

---

## Notification Centre

### Notification Bell & Badge

The notification bell lives in the `Navbar` component, next to the user avatar.

```
Navbar (existing):
┌──────────────────────────────────────────────────────┐
│  [Logo] BlueCollar       [Nav links]   🔔(3)  [av]  │
└──────────────────────────────────────────────────────┘
```

**Bell spec:**

```
Bell container:
  relative
  rounded-full p-2 hover:bg-gray-100 transition-colors
  cursor-pointer

Icon: Bell (lucide), size 20, text-gray-600

Badge (unread count):
  absolute -top-0.5 -right-0.5
  h-4.5 min-w-[18px] px-1
  rounded-full bg-red-500 text-white
  text-[10px] font-bold
  flex items-center justify-center
  border-2 border-white

  When count > 99: show "99+"
  When count == 0: badge hidden

Badge animation:
  On new notification: scale(0) → scale(1.2) → scale(1)
  Duration: 300ms, ease-out
```

### Notification Panel

Clicking the bell opens a dropdown panel (not a full page).

```
┌──── Notification Panel (w-96) ──────────────────┐
│  Notifications              Mark all as read     │
│  ────────────────────────────────────────────── │
│                                                  │
│  Today                                           │
│  ┌──────────────────────────────────────────┐   │
│  │ ● [av] Jane Doe left a review on your   │   │  ← unread (dot)
│  │        listing "Mike's Plumbing"         │   │
│  │        ★★★★★ · 2 hours ago              │   │
│  └──────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────┐   │
│  │   [av] You received a 500 XLM tip from  │   │  ← read (no dot)
│  │        Alice for "Quick Electrical"      │   │
│  │        5 hours ago                       │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  Yesterday                                       │
│  ┌──────────────────────────────────────────┐   │
│  │ ● [ic] Your listing "Mike's Plumbing"   │   │
│  │        was approved by admin             │   │
│  │        Yesterday at 3:15 PM              │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  ────────────────────────────────────────────── │
│  View all notifications →                        │
└──────────────────────────────────────────────────┘
```

**Panel spec:**

```
Panel container:
  absolute right-0 top-full mt-2
  w-96 max-h-[480px] overflow-y-auto
  rounded-xl border bg-white shadow-xl
  z-50

Header:
  flex items-center justify-between px-4 py-3 border-b
  "Notifications": text-sm font-semibold text-gray-900
  "Mark all as read": text-xs text-blue-600 hover:underline cursor-pointer

Group label ("Today", "Yesterday", "Earlier"):
  px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide
  bg-gray-50

Notification row:
  flex items-start gap-3 px-4 py-3
  hover:bg-gray-50 cursor-pointer transition-colors
  border-b last:border-0

  Avatar/Icon: h-9 w-9 rounded-full shrink-0
  Content: flex-1
    Title: text-sm text-gray-800 (bold actor name)
    Timestamp: text-xs text-gray-400 mt-0.5

Unread indicator:
  h-2 w-2 rounded-full bg-blue-500 shrink-0 mt-1.5

Footer:
  border-t px-4 py-2.5 text-center
  "View all notifications →": text-sm text-blue-600 hover:underline
```

### Notification Types & Grouping

| Type            | Icon/Avatar                  | Example                                         |
| --------------- | ---------------------------- | ----------------------------------------------- |
| **Review**      | Reviewer avatar              | "Jane Doe left a 5-star review on your listing" |
| **Transaction** | `ArrowDownLeft` on violet bg | "You received a 500 XLM tip from Alice"         |
| **Listing**     | `Briefcase` on blue bg       | "Your listing was approved/rejected"            |
| **System**      | `Info` on gray bg            | "Platform maintenance scheduled for..."         |
| **Dispute**     | `AlertTriangle` on amber bg  | "A dispute was filed regarding your listing"    |

**Grouping rules:**

- Group by date: "Today", "Yesterday", "Earlier this week", "This month", "Older".
- Within a group, sort by timestamp descending (newest first).
- If multiple notifications relate to the same entity (e.g., 3 reviews on the same listing), collapse into a single entry: "Jane and 2 others left reviews on your listing".

**Grouped notification:**

```
┌──────────────────────────────────────────────────┐
│ ● [av][av][av]  Jane and 2 others left reviews   │
│    (stacked)    on "Mike's Plumbing"              │
│                 2h, 4h, 6h ago                    │
└──────────────────────────────────────────────────┘

Stacked avatars:
  flex -space-x-2
  Each: h-7 w-7 rounded-full border-2 border-white
  Max 3 visible, then "+N" badge
```

### Read / Unread States

| State       | Visual treatment                                                                               |
| ----------- | ---------------------------------------------------------------------------------------------- |
| **Unread**  | Blue dot (`h-2 w-2 bg-blue-500 rounded-full`) on the left. Row has `bg-blue-50/50` background. |
| **Read**    | No dot. Row has transparent/white background.                                                  |
| **Hovered** | `bg-gray-50` regardless of read state.                                                         |

**Mark as read triggers:**

1. Click the notification row (navigates + marks read).
2. "Mark all as read" header action.
3. Auto-mark as read after the notification panel is open for 5 seconds (for visible items only).

### Empty State

When no notifications exist:

```
┌──── Notification Panel ─────────────────────────┐
│  Notifications                                   │
│  ────────────────────────────────────────────── │
│                                                  │
│       [empty-notifications.svg]                  │
│       80×80                                      │
│                                                  │
│       "You're all caught up"                     │
│       text-sm font-medium text-gray-500          │
│                                                  │
│       "New notifications will appear here"       │
│       text-xs text-gray-400                      │
│                                                  │
└──────────────────────────────────────────────────┘
```

Uses the `empty-notifications.svg` illustration from the States library (see `STATES.md`).

---

## Notification Preferences

Accessible from: User settings or a gear icon in the notification panel header.

### Preferences UI — `/settings/notifications`

```
┌──────────────────────────────────────────────────────────────────┐
│  h1: "Notification Preferences"                                   │
│  p: "Choose how and when you want to be notified."               │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Email Notifications                                       │  │
│  │  ─────────────────────────────────────────────────────────│  │
│  │                                                            │  │
│  │  Reviews & Ratings              [━━━●] On                 │  │
│  │  Get notified when someone                                │  │
│  │  leaves a review on your listing                          │  │
│  │                                                            │  │
│  │  Transactions                   [━━━●] On                 │  │
│  │  Tips, payments, and refund                               │  │
│  │  confirmations                                            │  │
│  │                                                            │  │
│  │  Listing Updates                [●━━━] Off                │  │
│  │  Approval, rejection, and                                 │  │
│  │  moderation actions                                       │  │
│  │                                                            │  │
│  │  Disputes                       [━━━●] On                 │  │
│  │  New disputes, updates, and                               │  │
│  │  resolutions                                              │  │
│  │                                                            │  │
│  │  Platform Updates               [●━━━] Off                │  │
│  │  New features, maintenance,                               │  │
│  │  and announcements                                        │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Push Notifications                                        │  │
│  │  ─────────────────────────────────────────────────────────│  │
│  │                                                            │  │
│  │  (Same categories as above,                               │  │
│  │   independent toggle for each)                            │  │
│  │                                                            │  │
│  │  [Enable Push Notifications]   (if not yet granted)       │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Quiet Hours                                               │  │
│  │  ─────────────────────────────────────────────────────────│  │
│  │                                                            │  │
│  │  Mute all notifications         [●━━━] Off                │  │
│  │  between:                                                  │  │
│  │  [10:00 PM ▼]  and  [7:00 AM ▼]                          │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  [ Save Preferences ]                                            │
└──────────────────────────────────────────────────────────────────┘
```

**Toggle spec:**

```
Toggle track:
  h-5 w-9 rounded-full transition-colors
  On: bg-blue-600
  Off: bg-gray-200

Toggle thumb:
  h-4 w-4 rounded-full bg-white shadow-sm
  transition-transform
  On: translate-x-4
  Off: translate-x-0.5
```

**Preference categories:**

| Category          | Default (Email) | Default (Push) |
| ----------------- | --------------- | -------------- |
| Reviews & Ratings | On              | On             |
| Transactions      | On              | On             |
| Listing Updates   | On              | Off            |
| Disputes          | On              | On             |
| Platform Updates  | Off             | Off            |

**Settings card spec:**

```
Card: rounded-xl border bg-white p-6 shadow-sm

Section title:
  text-base font-semibold text-gray-900

Each preference row:
  flex items-start justify-between py-4 border-b last:border-0

  Left side:
    Label: text-sm font-medium text-gray-800
    Description: text-xs text-gray-400 mt-0.5 max-w-xs

  Right side:
    Toggle component
```

---

## Push Notification Spec

Push notifications are sent via the browser Push API and shown as system notifications.

### Permission Request Flow

```
Step 1: User visits notification preferences
Step 2: Clicks "Enable Push Notifications"
Step 3: Browser permission prompt appears
Step 4a: If granted → show success toast, toggle appears
Step 4b: If denied → show info banner explaining how to re-enable in browser settings
```

**Permission denied banner:**

```
┌──────────────────────────────────────────────────────────────────┐
│  ℹ️  Push notifications are blocked by your browser.             │
│     To enable them, click the lock icon in your address bar      │
│     and allow notifications for this site.                       │
└──────────────────────────────────────────────────────────────────┘

Banner: bg-blue-50 border border-blue-200 rounded-lg px-4 py-3
  text-sm text-blue-700
  flex items-start gap-3
```

### Notification Payload

```typescript
interface PushNotification {
  title: string; // "New Review"
  body: string; // "Jane Doe left a 5-star review"
  icon: string; // App icon URL
  badge: string; // Small monochrome badge
  tag: string; // Dedup key (e.g., "review-42")
  data: {
    url: string; // Deep link on click
    notificationId: string;
  };
}
```

### Click Behaviour

- Clicking a push notification opens the app at the `data.url` deep link.
- The notification is marked as read in the notification centre.
- If the app is already open, focus the existing tab instead of opening a new one.
