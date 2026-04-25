# feat: Worker Map View, Notification Center, Portfolio Gallery & Search Autocomplete

## Overview

This PR ships four frontend features that significantly improve worker discoverability, user engagement, and profile richness on the BlueCollar platform.

---

## What's Changed

### 🗺️ Worker Map View — closes #281

Workers can now be explored on an interactive map alongside the existing list view.

- Added a **List / Map toggle** on the workers browse page — state is client-side, no page reload needed
- Map renders with **Leaflet + OpenStreetMap** (no API key required), loaded client-side via `next/dynamic` to avoid SSR issues
- Workers are plotted as markers using `latitude` / `longitude` fields on the `Worker` type
- **Marker clustering** via `leaflet.markercluster` keeps dense areas clean and performant
- Clicking a marker opens a **custom popup** with the worker's avatar, name, category, location, and a direct "View Profile" link
- Map and cluster CSS loaded from CDN to avoid webpack asset issues with Leaflet

**Files:** `WorkerMap.tsx`, `WorkersViewToggle.tsx`, `workers/page.tsx`, `types/index.ts`, `package.json`

---

### 🔔 Notification Center — closes #273

A centralised in-app notification system accessible from the navbar.

- **Bell icon with unread badge** added to the desktop navbar — badge caps at `9+`
- Dropdown lists notifications grouped by type: `tip`, `review`, `contact`, `system` — each with a colour-coded badge, title, message, and relative timestamp (e.g. "3h ago")
- Unread notifications are visually highlighted; individual **mark-as-read** button per item
- **Mark all as read** and **Clear all** actions in the dropdown header
- Notifications persist across sessions via `localStorage`
- **Notification preferences page** at `/notifications/preferences` — toggle switches per notification type, also persisted to `localStorage`
- `NotificationContext` exposes `addNotification` so any part of the app (tip confirmations, review submissions, contact requests) can push notifications programmatically
- Dropdown closes on outside click and `Escape` key

**Files:** `NotificationContext.tsx`, `NotificationDropdown.tsx`, `notifications/preferences/page.tsx`, `[locale]/layout.tsx`, `Navbar.tsx`

---

### 🖼️ Worker Portfolio Gallery — closes #272

Workers can now showcase their work with a rich photo gallery on their profile.

- **Grid layout** (2-col mobile, 3-col desktop) displayed on the public worker profile page
- Clicking any image opens the existing **`ImageLightbox`** component for full-size viewing with zoom, pan, and pinch-to-zoom support
- In the **dashboard edit page**, the gallery is fully editable:
  - **Multi-file upload** via a styled "Add photos" button
  - **Drag-and-drop reordering** — grab the grip handle and drop to reposition
  - **Inline caption editing** — click the caption area on any image, type, then blur or press `Enter` to save
  - **Per-image remove** button appears on hover
- Read-only and editable modes are controlled by a single `editable` prop
- Added `PortfolioImage` type and `portfolioImages` field to the `Worker` type

**Files:** `PortfolioGallery.tsx`, `workers/[id]/page.tsx`, `dashboard/workers/[id]/edit/page.tsx`, `types/index.ts`

---

### 🔍 Worker Search Autocomplete — closes #274

The search input in the workers sidebar now shows live suggestions as you type.

- **Debounced API calls** (300ms) against the existing `/workers?search=` endpoint — no new backend changes needed
- Requests are cancelled via `AbortController` when a new keystroke arrives, preventing stale results
- Suggestions show up to **6 workers** with avatar (or initials fallback), name, category, and location
- **Matching text is highlighted** in both the worker name and category fields
- Full **keyboard navigation**: `↑` / `↓` to move through suggestions, `Enter` to select, `Escape` to dismiss
- Fully accessible: `role="listbox"`, `aria-expanded`, `aria-activedescendant`, `aria-selected` on each option
- Loading spinner shown during fetch; gracefully handles network errors and empty results

**Files:** `SearchAutocomplete.tsx`, `workers/page.tsx`, `api.ts`

---

## Testing

1. Run `npm install` in `packages/app` to pull in `leaflet.markercluster`
2. `npm run dev` — browse to `/workers`
3. Toggle between List and Map views
4. Type in the search box and verify autocomplete suggestions appear with highlighted text and keyboard nav works
5. Open the notification bell — use browser console to call `addNotification` from `NotificationContext` to seed test data
6. Edit a worker profile from the dashboard and add/reorder/caption portfolio images

---

Closes #281
Closes #273
Closes #272
Closes #274
