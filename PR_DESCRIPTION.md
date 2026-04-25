# feat: worker map view, notification center, portfolio gallery & search autocomplete

## Summary

This PR implements four frontend features across issues #281, #273, #272, and #274.

---

## Changes

### #281 — Worker Map View

- `WorkerMap.tsx` — Leaflet map with OpenStreetMap tiles, plots workers as markers using `latitude`/`longitude` fields. Dynamically imports `leaflet.markercluster` for dense-area clustering. Custom popup on marker click shows avatar, name, category, location and a "View Profile" link.
- `WorkersViewToggle.tsx` — Client component with List/Map toggle buttons. Map loaded via `next/dynamic` (SSR disabled). Replaces the static grid in the workers page.
- `workers/page.tsx` — Swapped static grid + EmptyState for `WorkersViewToggle`. Pagination remains server-rendered.
- `package.json` — Added `leaflet.markercluster` + `@types/leaflet.markercluster`.
- `types/index.ts` — Added `latitude`, `longitude` fields to `Worker`.

### #273 — Notification Center

- `NotificationContext.tsx` — React context providing `notifications`, `unreadCount`, `markRead`, `markAllRead`, `addNotification`, `clearAll`. Persists to `localStorage`.
- `NotificationDropdown.tsx` — Bell icon with unread badge in the Navbar. Dropdown lists notifications with type badges (tip/review/contact/system), relative timestamps, per-item mark-as-read, mark-all-read, and clear-all.
- `notifications/preferences/page.tsx` — Toggle switches for each notification type, persisted to `localStorage`.
- `[locale]/layout.tsx` — Wrapped providers with `NotificationProvider`.
- `Navbar.tsx` — Added `NotificationDropdown` to desktop action bar.

### #272 — Worker Portfolio Gallery

- `PortfolioGallery.tsx` — Grid gallery with lightbox (reuses `ImageLightbox`), multi-file upload, drag-and-drop reordering, inline caption editing, and per-image remove. Read-only mode for public profile view.
- `workers/[id]/page.tsx` — Renders `PortfolioGallery` (read-only) when `portfolioImages` are present.
- `dashboard/workers/[id]/edit/page.tsx` — Adds editable `PortfolioGallery` section below the worker form.
- `types/index.ts` — Added `PortfolioImage` type and `portfolioImages` field to `Worker`.

### #274 — Worker Search Autocomplete

- `SearchAutocomplete.tsx` — Fully accessible autocomplete input:
  - Debounced API calls (300ms) against `/workers?search=` with `AbortController` to cancel stale requests
  - Shows up to 6 suggestions with worker avatar/initials, name, category, and location
  - Highlights matching text in both name and category fields
  - Full keyboard navigation: `↑`/`↓` to move, `Enter` to select, `Escape` to dismiss
  - ARIA attributes: `role="listbox"`, `aria-expanded`, `aria-activedescendant`
  - Loading spinner while fetching
- `workers/page.tsx` — Replaced plain search `<input>` in the sidebar with `SearchAutocomplete`.
- `api.ts` — Added `searchWorkers` helper function.

---

Closes #281
Closes #273
Closes #272
Closes #274
