# Mobile-First Navigation Pattern

Design specification for the BlueCollar mobile bottom navigation bar, information architecture, and touch interaction patterns.

---

## 1. Bottom Tab Bar

### Structure

The bottom navigation is a fixed bar at the viewport bottom, visible on all authenticated and public pages on viewports ≤ 768 px (md breakpoint). On desktop (> 768 px) the top navbar is used instead.

```
┌──────────────────────────────────────────────────────┐
│  [Home]     [Workers]     [Activity]     [Profile]   │
│   🏠           👷           📋            👤         │
│  Home       Workers      Activity       Profile      │
└──────────────────────────────────────────────────────┘
```

- Height: 64 px (includes safe-area inset on notched devices via `env(safe-area-inset-bottom)`)
- Background: white with `border-top: 1px solid gray-200`
- Elevation: `z-50` — above page content, below modals/sheets

### Tab item anatomy

Each tab item consists of:

```
  ┌─────────────┐
  │    [Icon]    │   24 × 24 px icon
  │    Label     │   11 px / semibold
  │  (optional   │
  │   badge)     │
  └─────────────┘
```

- Icon size: 24 × 24 px
- Label: 11 px, font-weight 600
- Spacing: 2 px gap between icon and label
- Each tab occupies equal width (25% of viewport)

### States

| State    | Icon colour | Label colour | Background        |
| -------- | ----------- | ------------ | ----------------- |
| Inactive | `gray-400`  | `gray-500`   | transparent       |
| Active   | `blue-600`  | `blue-600`   | transparent       |
| Pressed  | `blue-700`  | `blue-700`   | `blue-50` (brief) |

- The active tab has an additional 2 px rounded indicator pill above the icon:
  - Colour: `blue-600`
  - Width: 20 px, centred above the icon
  - Transition: width scales from 0 → 20 px over 200 ms (`motion-safe`)

---

## 2. Touch Target Sizes

All interactive areas in the bottom nav must meet the 48 × 48 dp minimum.

| Element  | Visual size                | Tappable area                    |
| -------- | -------------------------- | -------------------------------- |
| Tab item | ~56 × 48 px (icon + label) | Full column width × 64 px height |
| Badge    | 16 × 16 px                 | Inherits parent tab hit area     |

- The tap target extends to the full width of the tab column and the full height of the bar — no dead zones between tabs.
- On devices with a bottom safe area (iPhone notch), the visual bar is 64 px + `env(safe-area-inset-bottom)`, but the extra inset area is **not** tappable.

---

## 3. Badge Treatment

Badges appear on tab icons to indicate unread or pending items.

### Badge anatomy

```
   ┌──────┐
   │ Icon │  ● 16 px red circle, top-right of icon
   └──────┘     with count or dot
```

- Position: top-right corner of the icon, offset (-4 px, -4 px)
- Dot badge (no count): 8 × 8 px circle, `red-500`
- Count badge: min 16 × 16 px, `red-500` background, white text (11 px bold), pill-shaped
  - For counts > 99: display "99+"
  - Max width: auto-expand with 4 px horizontal padding
- The badge must meet 3 : 1 contrast against the bar background (`red-500` on white = 4.0 : 1)

### Accessibility

- Badge count is exposed via `aria-label` on the tab button: e.g. `"Activity, 3 new items"`
- Badge is `aria-hidden="true"` — the label carries the information

---

## 4. Tab Transition Motion

### Page transitions (motion-safe)

When switching between tabs, content transitions using a cross-fade:

- Outgoing view: opacity 1 → 0 over 150 ms
- Incoming view: opacity 0 → 1 over 150 ms (starts at 100 ms, so 50 ms overlap)
- No horizontal slide — cross-fade reduces vestibular discomfort

### Reduced motion

When `prefers-reduced-motion: reduce` is active:

- No fade transition — instant swap
- Active indicator appears immediately (no scale animation)

### Tab press feedback

- On `touchstart` / `pointerdown`: background flashes `blue-50` for 150 ms
- This gives tactile confirmation without interfering with navigation

---

## 5. Role-Based Destinations

Primary tab destinations vary by user role:

### Unauthenticated / Guest

| Tab     | Destination                   | Icon      |
| ------- | ----------------------------- | --------- |
| Home    | Landing page (`/`)            | `Home`    |
| Workers | Worker discovery (`/workers`) | `HardHat` |
| Login   | Login page (`/auth/login`)    | `LogIn`   |

3-tab layout for guests — simpler IA until authenticated.

### Authenticated — Standard user

| Tab      | Destination                         | Icon            |
| -------- | ----------------------------------- | --------------- |
| Home     | Landing page (`/`)                  | `Home`          |
| Workers  | Worker discovery (`/workers`)       | `HardHat`       |
| Activity | Booking/activity feed (`/activity`) | `ClipboardList` |
| Profile  | User profile (`/profile`)           | `User`          |

### Authenticated — Curator

| Tab       | Destination                      | Icon              |
| --------- | -------------------------------- | ----------------- |
| Home      | Landing page (`/`)               | `Home`            |
| Workers   | Worker discovery (`/workers`)    | `HardHat`         |
| Dashboard | Curator dashboard (`/dashboard`) | `LayoutDashboard` |
| Profile   | User profile (`/profile`)        | `User`            |

### Authenticated — Admin

| Tab       | Destination                    | Icon              |
| --------- | ------------------------------ | ----------------- |
| Home      | Landing page (`/`)             | `Home`            |
| Workers   | Worker discovery (`/workers`)  | `HardHat`         |
| Dashboard | Admin dashboard (`/dashboard`) | `LayoutDashboard` |
| Profile   | User profile (`/profile`)      | `User`            |

---

## 6. Implementation Notes

- Use CSS `position: fixed; bottom: 0` with `padding-bottom: env(safe-area-inset-bottom)` for notch safety.
- Pages must add bottom padding equal to the nav height (64 px + safe area) to prevent content from being hidden behind the bar.
- The bottom nav is hidden during full-screen flows: onboarding, wallet connection modals, and payment sheets.
- On tablets in portrait (768–1024 px), prefer the bottom nav. On landscape tablets and desktop, use the top navbar.
- Icons: use `lucide-react` consistently with `size={24}` and `strokeWidth={1.75}`.
