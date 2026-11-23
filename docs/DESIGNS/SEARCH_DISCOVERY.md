# Search & Discovery Experience with Map View

> Issue #721 · Priority: High · Complexity: Medium

Redesigned discovery surface combining a **filter rail**, **results list**, and **geo map** for location-based search of skilled workers. All patterns use design tokens (`--primary: 221 83% 53%`, `--destructive: 0 84% 60%`) and Tailwind utility classes consistent with the rest of the design system.

---

## Table of Contents

- [Design Principles](#design-principles)
- [Filter Rail](#filter-rail)
  - [Category Filter](#category-filter)
  - [Distance Filter](#distance-filter)
  - [Rating Filter](#rating-filter)
  - [Availability Filter](#availability-filter)
  - [Filter → API Parameter Mapping](#filter--api-parameter-mapping)
- [Desktop Layout — List + Map Split](#desktop-layout--list--map-split)
- [Mobile Layout — Toggle Between List & Map](#mobile-layout--toggle-between-list--map)
- [Search Bar & Suggestions Dropdown](#search-bar--suggestions-dropdown)
- [Map States](#map-states)
  - [Default Pins](#default-pins)
  - [Clustered Pins](#clustered-pins)
  - [Selected Pin](#selected-pin)
- [List States](#list-states)
  - [Loading Skeleton](#loading-skeleton)
  - [Results](#results)
  - [No Results](#no-results)
- [Accessibility Notes](#accessibility-notes)

---

## Design Principles

| Principle                  | Rule                                                                                               |
| -------------------------- | -------------------------------------------------------------------------------------------------- |
| **Context-first**          | Map and list are always in sync — panning the map refines the list.                                |
| **Progressive disclosure** | Advanced filters (availability time range, verified-only) are behind an "More filters" expand.     |
| **Mobile parity**          | Every filter and state available on desktop is reachable on mobile via the toggle + sheet pattern. |
| **Backend fidelity**       | Every filter control maps 1-to-1 to an API query parameter — no client-side-only filtering.        |

---

## Filter Rail

The filter rail sits on the left on desktop (280 px fixed) and appears as a bottom sheet on mobile.

```
┌──────────────────────────────┐
│  Filters             [Reset] │
│  ────────────────────────── │
│  Category                    │
│  ┌────────────────────────┐  │
│  │ All categories      ▼  │  │
│  └────────────────────────┘  │
│                              │
│  Distance                    │
│  ●────────────────○  25 km   │
│  1 km                 50 km  │
│                              │
│  Rating                      │
│  ★ ★ ★ ☆ ☆  3+ stars        │
│  ○ 1+  ○ 2+  ● 3+  ○ 4+     │
│                              │
│  Availability                │
│  ┌────────────────────────┐  │
│  │ Any day             ▼  │  │
│  └────────────────────────┘  │
│                              │
│  ▶ More filters              │
│  ── expanded ─────────────── │
│  │ ☐ Verified only          │
│  │ Start time  [09:00]       │
│  │ End time    [17:00]       │
│  └──────────────────────────  │
│                              │
│     [ Apply Filters ]        │
└──────────────────────────────┘
```

"Reset" clears all filters and re-fetches with no params.  
"Apply Filters" fires the search request; filters do not auto-apply on change (avoids rapid re-fetches while the user is still adjusting).

---

### Category Filter

Single-select dropdown populated from `GET /categories`.

- Default: "All categories" (no `category` param sent)
- Selected: sends `category=<id>` or `categories=<id1>,<id2>` for multi-select variant

Multi-select variant (expanded state):

```
┌────────────────────────────────┐
│ ☑ Plumber                      │
│ ☐ Electrician                  │
│ ☑ Carpenter                    │
│ ☐ Welder                       │
│ ...                            │
└────────────────────────────────┘
```

Multi-select sends `categories=<id1>,<id2>`.

---

### Distance Filter

Range slider, only active when the browser has provided geolocation or the user has entered a city.

- Range: 1–50 km, step 1 km, default 25 km
- Maps to: `radius=<km>` + `lat=<lat>&lng=<lng>` (from browser geolocation) or `city=<city>`
- Disabled state (no location): slider is greyed out with tooltip "Enable location to filter by distance"

---

### Rating Filter

Radio button group for minimum star threshold.

| UI label | `minRating` param value |
| -------- | ----------------------- |
| Any      | _(omitted)_             |
| 1+ stars | `1`                     |
| 2+ stars | `2`                     |
| 3+ stars | `3`                     |
| 4+ stars | `4`                     |

---

### Availability Filter

Two-level control: day-of-week select + optional time range (under "More filters").

Day select options:

| UI label  | `available` (dayOfWeek) param |
| --------- | ----------------------------- |
| Any day   | _(omitted)_                   |
| Sunday    | `0`                           |
| Monday    | `1`                           |
| Tuesday   | `2`                           |
| Wednesday | `3`                           |
| Thursday  | `4`                           |
| Friday    | `5`                           |
| Saturday  | `6`                           |

Time range (advanced, maps to `GET /workers/search/advanced`):

- `startTime=HH:MM`
- `endTime=HH:MM`

---

### Filter → API Parameter Mapping

Full mapping of every filter control to its backend parameter:

| Filter control          | API endpoint                   | Query parameter                                           |
| ----------------------- | ------------------------------ | --------------------------------------------------------- |
| Category (single)       | `GET /workers`                 | `category=<id>`                                           |
| Category (multi)        | `GET /workers`                 | `categories=<id1>,<id2>`                                  |
| Distance slider         | `GET /workers`                 | `lat=<lat>&lng=<lng>&radius=<km>`                         |
| City text fallback      | `GET /workers`                 | `city=<city>`                                             |
| Rating minimum          | `GET /workers`                 | `minRating=<1-5>`                                         |
| Availability day        | `GET /workers`                 | `available=<0-6>`                                         |
| Availability day + time | `GET /workers/search/advanced` | `dayOfWeek=<0-6>&startTime=HH:MM&endTime=HH:MM`           |
| Verified only           | `GET /workers`                 | `isVerified=true`                                         |
| Keyword search          | `GET /workers`                 | `search=<query>`                                          |
| Full-text + geo         | `GET /workers/search/advanced` | `query=<text>&lat=&lng=&radius=`                          |
| Sort                    | `GET /workers`                 | `sortBy=rating\|newest\|oldest\|name&sortOrder=asc\|desc` |
| Pagination              | `GET /workers`                 | `page=<n>&limit=<n>` or `cursor=<id>`                     |

---

## Desktop Layout — List + Map Split

Default desktop view (≥ 1024 px). The filter rail, result list, and map are all visible simultaneously.

```
┌─────────────────────────────────────────────────────────────────────┐
│  [ 🔍 Search for a skilled worker...          ] [Search]            │
├──────────────┬──────────────────────────┬────────────────────────────┤
│              │                          │                            │
│  FILTER RAIL │  RESULTS LIST            │  MAP                       │
│  (280 px)    │  (flex-1, scrollable)    │  (flex-1, sticky)          │
│              │                          │                            │
│  Category    │  48 workers found        │  ┌──────────────────────┐  │
│  [All ▼]     │  Sort: [Newest ▼]        │  │                      │  │
│              │  ──────────────────────  │  │   📍  📍             │  │
│  Distance    │  ┌────────────────────┐  │  │       📍📍           │  │
│  ●──── 25km  │  │ 👤 John D.         │  │  │  ⑤         📍       │  │
│              │  │ Plumber · 4.8 ★    │  │  │                      │  │
│  Rating      │  │ 1.2 km away        │  │  │      📍   📍         │  │
│  ● 3+ ○ 4+  │  │ Available Mon–Fri  │  │  └──────────────────────┘  │
│              │  └────────────────────┘  │                            │
│  Availability│  ┌────────────────────┐  │  (map pans → list updates) │
│  [Any day ▼] │  │ 👤 Maria S.        │  │                            │
│              │  │ Electrician · 4.5★ │  │                            │
│  [Apply]     │  │ 3.4 km away        │  │                            │
│              │  └────────────────────┘  │                            │
│              │  [ Load more ]           │                            │
└──────────────┴──────────────────────────┴────────────────────────────┘
```

- Map is `position: sticky; top: 0; height: 100vh` so it stays in view while the list scrolls.
- Hovering a result card highlights its pin on the map (and vice versa).
- Map bounds change on pan/zoom → debounced re-fetch with `lat`, `lng`, `radius` derived from visible bounds.

---

## Mobile Layout — Toggle Between List & Map

On mobile (< 1024 px) the filter rail is hidden behind a sheet and the list/map toggle sits in a floating tab bar.

```
┌───────────────────────────────────┐
│  🔍 Search...          [⚙ Filters]│
├───────────────────────────────────┤
│                                   │
│  [ List view ]  [ Map view ]      │  ← floating toggle tabs
│                                   │
│  ── LIST VIEW (active) ─────────  │
│  ┌───────────────────────────────┐│
│  │ 👤 John D.  Plumber  4.8★    ││
│  │ 1.2 km away · Mon–Fri        ││
│  └───────────────────────────────┘│
│  ┌───────────────────────────────┐│
│  │ 👤 Maria S. Electrician 4.5★ ││
│  │ 3.4 km away · Weekdays       ││
│  └───────────────────────────────┘│
│                                   │
└───────────────────────────────────┘

── MAP VIEW (active) ──────────────
┌───────────────────────────────────┐
│  🔍 Search...          [⚙ Filters]│
│  ┌─────────────────────────────┐  │
│  │                             │  │
│  │   📍   ⑤    📍             │  │
│  │         📍                  │  │
│  └─────────────────────────────┘  │
│                                   │
│  ┌───────────────── peek card ──┐ │
│  │ 👤 John D.  Plumber  4.8★   │ │  ← slides up on pin tap
│  │ 1.2 km away  [ View Profile ]│ │
│  └──────────────────────────────┘ │
└───────────────────────────────────┘
```

**Filters sheet** (slides up from bottom on "⚙ Filters" tap):

```
┌───────────────────────────────────┐
│  ━━━━ (drag handle)               │
│  Filters                  [Reset] │
│  ────────────────────────────── │
│  (same controls as desktop rail)  │
│                                   │
│      [ Show X results ]           │
└───────────────────────────────────┘
```

"Show X results" button shows a live count (updated as filters change) and closes the sheet + applies.

---

## Search Bar & Suggestions Dropdown

```
┌────────────────────────────────────────────┐
│  🔍  Plumber near Manchester          [×]  │
├────────────────────────────────────────────┤
│  Suggestions                               │
│  ──────────────────────────────────────── │
│  🔧  Plumber                               │  ← category match
│  🔧  Plumber near Manchester               │  ← recent search
│  👤  John D. — Plumber, Manchester         │  ← worker name match
│  👤  Sarah K. — Plumber, Leeds             │  ← worker name match
│  ──────────────────────────────────────── │
│  🕐  Recent: Electrician, Welder           │  ← stored in localStorage
└────────────────────────────────────────────┘
```

**Behaviour**:

- Triggers on keystroke after 2 characters, debounced 300 ms.
- Uses `GET /workers/search/advanced?query=<text>&limit=5` for worker name matches.
- Category suggestions come from the cached `GET /categories` response (client-side filter, no extra request).
- Recent searches stored in `localStorage` under `bc_recent_searches` (max 5 entries).
- Selecting a suggestion populates the search field and fires the full search.
- `[×]` clears the field and resets to all results.
- `aria-live="polite"` region announces result count changes.
- Keyboard: Arrow keys navigate suggestions, Enter selects, Escape closes.

---

## Map States

### Default Pins

Each active worker with a location is represented by a pin.

```
  📍  (primary blue, 24px)
```

- Colour: `hsl(221, 83%, 53%)` (`--primary`)
- On hover: pin scales to 1.2×, tooltip shows worker name + rating
- On click: opens peek card (mobile) or highlights result card (desktop)

---

### Clustered Pins

When ≥ 3 pins are within 40 px of each other at the current zoom level, they merge into a cluster badge.

```
  ┌───┐
  │ 8 │   ← count of workers in cluster
  └───┘
  (filled circle, primary blue, white count)
```

- Clicking a cluster zooms the map to fit all its pins.
- At max zoom with overlapping pins, a spiral layout is used to separate them.

---

### Selected Pin

When a pin is active (hovered on desktop, tapped on mobile):

```
  📍  (larger, 32px, drop shadow)
  ┌─────────────────────────┐
  │ 👤 John D.              │  ← tooltip / peek card
  │ Plumber · ★ 4.8         │
  │ 1.2 km away             │
  │ [ View Profile ]        │
  └─────────────────────────┘
```

---

## List States

### Loading Skeleton

Shown while the API request is in flight. Mirrors the exact dimensions of the result card.

```
┌────────────────────────────────────────┐
│  ┌──────┐  ████████████  ░░░░░░░░░     │  ← name + rating shimmer
│  │      │  ████████  ░░░░░░░░░░░░      │  ← category + distance shimmer
│  │      │  ████  ░░░░░░░░░░░░░░░░      │  ← availability shimmer
│  └──────┘                              │
└────────────────────────────────────────┘
```

Repeat 4× for initial load. `aria-busy="true"` on the list container.

---

### Results

Standard result card:

```
┌────────────────────────────────────────┐
│  ┌──────┐  John D.          ★ 4.8 (32)│
│  │avatar│  Plumber · ✓ Verified       │
│  │      │  📍 1.2 km · Manchester     │
│  └──────┘  🕐 Mon–Fri, 09:00–17:00   │
│            [ View Profile ]            │
└────────────────────────────────────────┘
```

- Avatar: `w-12 h-12 rounded-full object-cover`
- Verified badge: `✓` in `text-primary` only shown when `isVerified = true`
- Distance shown only when `lat/lng` provided; falls back to "City, Country"
- "View Profile" → `/workers/<id>`

---

### No Results

Shown when the API returns an empty array.

```
┌────────────────────────────────────────┐
│                                        │
│           🔍 (icon, 48px)              │
│                                        │
│        No workers found                │
│   Try adjusting your filters or        │
│   searching in a wider area.           │
│                                        │
│   [ Clear filters ]                    │
│                                        │
└────────────────────────────────────────┘
```

Map shows a neutral empty state ("No workers in this area") with the same zoom level retained so the user can pan to a different region.

---

## Accessibility Notes

| Element                  | Requirement                                                                                                    |
| ------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Search input             | `role="combobox"`, `aria-expanded`, `aria-autocomplete="list"`, `aria-controls` pointing to suggestions list   |
| Suggestions list         | `role="listbox"`, each item `role="option"`, `aria-selected`                                                   |
| Filter rail / sheet      | `role="region"`, `aria-label="Search filters"`                                                                 |
| Map container            | `role="application"`, `aria-label="Worker locations map"`                                                      |
| Map pins                 | Each pin has `aria-label="<Worker name>, <category>, <distance>"`                                              |
| Cluster badges           | `aria-label="<n> workers in this area, click to zoom in"`                                                      |
| Result list              | `aria-live="polite"` region wraps list so screen readers announce count changes                                |
| Loading skeleton         | `aria-busy="true"` on list container; removed when results render                                              |
| List/map toggle (mobile) | `role="tablist"` + `role="tab"` + `aria-selected`                                                              |
| Filter sheet (mobile)    | `role="dialog"`, `aria-modal="true"`, focus trap, Escape to close                                              |
| Range slider (distance)  | Native `<input type="range">` with `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, `aria-valuetext="25 km"` |
