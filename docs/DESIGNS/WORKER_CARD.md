# Worker Card Redesign — Information Hierarchy

> Issue #719 · Priority: High · Complexity: Medium

The worker card is the primary discovery unit. This redesign surfaces trust signals — verification, rating, category, location — as the dominant visual layer while keeping the card compact and scannable. All three variants (compact, standard, featured) are redesigned mobile-first (375 px base).

---

## Table of Contents

- [Design Principles](#design-principles)
- [Design Tokens & Spacing](#design-tokens--spacing)
- [Information Hierarchy](#information-hierarchy)
- [Compact Variant](#compact-variant)
- [Standard Variant](#standard-variant)
- [Featured Variant](#featured-variant)
- [Mobile vs Desktop Differences](#mobile-vs-desktop-differences)
- [Loading Skeleton](#loading-skeleton)
- [Empty & Error States](#empty--error-states)
- [Hover / Press / Focus States](#hover--press--focus-states)
- [Verification Badge Spec](#verification-badge-spec)
- [Rating Display Spec](#rating-display-spec)
- [Handoff Spec — Spacing & Token Usage](#handoff-spec--spacing--token-usage)
- [Accessibility Annotations](#accessibility-annotations)

---

## Design Principles

| Principle                | Rule                                                                                                                                   |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Trust first**          | Verification badge and rating score are placed immediately adjacent to the worker's name — never below the fold.                       |
| **Scannability**         | Category tag uses a filled pill so it reads as a label, not a link. Rating uses both stars and a numeric score for colour-blind users. |
| **Progressive detail**   | Bio and location are secondary. They are present in standard/featured but truncated; absent in compact.                                |
| **Consistent elevation** | Cards use a single shadow level at rest, elevated on hover — never the reverse.                                                        |

---

## Design Tokens & Spacing

All values map directly to the CSS custom properties in `src/app/globals.css`.

| Token                  | Value              | Usage                                                      |
| ---------------------- | ------------------ | ---------------------------------------------------------- |
| `--primary`            | `hsl(221 83% 53%)` | Verification badge, category pill border, CTA button, ring |
| `--primary-foreground` | `hsl(0 0% 100%)`   | Text on primary fills                                      |
| `--secondary`          | `hsl(214 32% 91%)` | Category pill background, card border                      |
| `--muted-foreground`   | `hsl(215 16% 47%)` | Bio text, location text, review count                      |
| `--border`             | `hsl(214 32% 91%)` | Card border at rest                                        |
| `--radius`             | `0.5rem`           | Base radius (cards use `calc(var(--radius) * 2) = 1rem`)   |
| `--destructive`        | `hsl(0 84% 60%)`   | Inactive / error badge                                     |

**Spacing scale used in cards** (Tailwind):

| Usage                      | Token   | px    |
| -------------------------- | ------- | ----- |
| Card padding (standard)    | `p-5`   | 20 px |
| Card padding (compact)     | `p-3`   | 12 px |
| Card padding (featured)    | `p-6`   | 24 px |
| Avatar → name gap          | `gap-3` | 12 px |
| Section gap (standard)     | `gap-4` | 16 px |
| Badge icon size (compact)  | 14 px   | —     |
| Badge icon size (standard) | 16 px   | —     |
| Badge icon size (featured) | 20 px   | —     |

---

## Information Hierarchy

Visual priority order, top to bottom, for all variants:

```
1. Avatar  +  Name  +  Verification badge   ← trust anchor (always visible)
2. Rating (stars + score + count)           ← quality signal (always visible)
3. Category pill                            ← context (always visible)
4. Location / distance                      ← relevance (standard + featured)
5. Bio (truncated)                          ← detail (standard + featured)
6. CTA button                               ← action (standard + featured)
```

Compact omits items 4–6 entirely.

---

## Compact Variant

Used in map peek cards, sidebars, and comparison panels. Mobile width: 100%. Desktop: min 200 px.

```
┌─────────────────────────────────────────┐
│  ┌────┐  John Doe  ✓             ★ 4.8  │
│  │ JD │  Plumber                        │
│  └────┘                                 │
└─────────────────────────────────────────┘
```

**Layout**: single row, `flex items-center gap-3`.  
**Avatar**: `h-10 w-10 rounded-full ring-1 ring-primary/20`  
**Name + badge**: `font-semibold text-sm text-foreground` + `BadgeCheck` 14 px `text-primary` immediately after name  
**Category**: `text-xs text-muted-foreground` (plain text, no pill in compact)  
**Rating**: right-aligned, `Star` 12 px fill-yellow-400 + numeric score `text-xs`  
**No CTA, no bio, no location.**

**Dark mode**: same structure, tokens auto-switch via `.dark` class.

---

## Standard Variant

Default card in the discovery grid. Mobile: full-width single column. Desktop: fixed 280–320 px in a 3-column grid.

```
┌──────────────────────────────────────────┐
│                          [☐ Compare]     │
│  ┌──────┐  John Doe  ✓        [♡]        │
│  │avatar│  ┌─────────────┐               │
│  │      │  │  Plumber    │  ← pill       │
│  └──────┘  └─────────────┘               │
│                                          │
│  ★★★★☆  4.8  (32 reviews)               │
│                                          │
│  Expert plumber with 10 years of         │
│  experience in…  (2-line clamp)          │
│                                          │
│  📍 Manchester, UK                       │
│                                          │
│  ┌──────────────────────────────────┐    │
│  │         View Profile             │    │
│  └──────────────────────────────────┘    │
└──────────────────────────────────────────┘
```

**Card container**: `rounded-xl border bg-card p-5 shadow-sm`  
**Hover**: `hover:-translate-y-1 hover:shadow-lg transition-all duration-200`  
**Avatar**: `h-14 w-14 rounded-full ring-2 ring-primary/20 object-cover`  
**Fallback initials**: `bg-secondary text-primary font-bold text-lg` (same dimensions)  
**Name**: `font-semibold text-foreground` truncated  
**Verification badge**: `BadgeCheck` 16 px `text-primary` — placed inline, right of name  
**Category pill**: `bg-secondary text-primary text-xs font-medium px-2 py-0.5 rounded-full`  
**Rating row**: `StarRating` component (existing) + `text-xs text-muted-foreground` score + count  
**Bio**: `text-sm text-muted-foreground line-clamp-2 leading-relaxed`  
**Location**: `MapPin` 12 px `text-muted-foreground` + `text-xs text-muted-foreground`  
**CTA**: `w-full rounded-md border border-primary py-1.5 text-sm font-medium text-primary` → on hover: `bg-primary text-primary-foreground`

---

## Featured Variant

Shown in "Featured Workers" homepage section and top of search results. Mobile: full-width. Desktop: 360–400 px.

```
┌─────────────────────────────────────────────┐
│                              ⚡ Featured     │
│  ┌────────┐  John Doe  ✓                    │
│  │ avatar │  ┌─────────────┐                │
│  │  80px  │  │  Plumber    │                │
│  └────────┘  └─────────────┘                │
│              ★★★★☆  4.8  (32 reviews)       │
│                                             │
│  Expert plumber with over 10 years of       │
│  experience in residential and commercial   │
│  projects. (3-line clamp)                   │
│                                             │
│  📍 Manchester, UK                          │
│  🟢 Available now                           │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │           View Full Profile         │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

**Card container**: `rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-secondary/40 to-card p-6 shadow-md`  
**Hover**: `hover:shadow-xl hover:border-primary/60 transition-all duration-200`  
**Featured badge**: `absolute top-4 right-4` — `bg-primary text-primary-foreground text-xs font-semibold px-2 py-1 rounded-full flex items-center gap-1` + `Zap` 12 px  
**Avatar**: `h-20 w-20 rounded-full ring-4 ring-card shadow-md object-cover`  
**Name**: `text-lg font-bold text-foreground`  
**Verification badge**: `BadgeCheck` 20 px `text-primary`  
**Category pill**: `bg-primary/10 text-primary text-sm font-semibold px-3 py-1 rounded-lg`  
**Rating**: full `StarRating` + `text-sm font-semibold text-foreground` score + `text-sm text-muted-foreground` count  
**Bio**: `text-sm text-muted-foreground line-clamp-3 leading-relaxed`  
**Active status dot**: `h-2 w-2 rounded-full bg-green-500` + `text-xs text-green-700` "Available now" — only shown when `isActive = true`  
**CTA**: `w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground` → hover: `bg-primary/90`

---

## Mobile vs Desktop Differences

| Property                  | Mobile (< 640 px)          | Desktop (≥ 640 px)         |
| ------------------------- | -------------------------- | -------------------------- |
| Standard card width       | 100% (single column)       | 280–320 px (3-column grid) |
| Featured card width       | 100%                       | 360–400 px                 |
| Compact card width        | 100%                       | min 200 px                 |
| Avatar size (standard)    | `h-12 w-12`                | `h-14 w-14`                |
| Bio line clamp (standard) | 2 lines                    | 2 lines                    |
| Bio line clamp (featured) | 2 lines                    | 3 lines                    |
| Compare checkbox          | Hidden (space-constrained) | Visible top-right          |
| CTA button                | Full width                 | Full width within card     |

---

## Loading Skeleton

Shown while `GET /workers` is in flight. Mirrors standard card dimensions exactly to prevent layout shift.

```
┌──────────────────────────────────────────┐
│                                          │
│  ┌──────┐  ████████████░░░░░  ← name    │
│  │      │  ██████░░░░░░░░░░░  ← cat     │
│  └──────┘                               │
│                                          │
│  ████░░░░░░░░░░░░░░░░░░░  ← rating      │
│                                          │
│  ████████████████░░░░░░░  ← bio line 1  │
│  ████████████░░░░░░░░░░░  ← bio line 2  │
│                                          │
│  ████░░░░░░░░░  ← location              │
│                                          │
│  ████████████████████████  ← CTA bar    │
└──────────────────────────────────────────┘
```

**Implementation**: `animate-pulse` on each shimmer element.

- Avatar circle: `h-14 w-14 rounded-full bg-secondary`
- Name bar: `h-4 w-32 rounded bg-secondary`
- Category bar: `h-3 w-20 rounded-full bg-secondary`
- Rating bar: `h-3 w-24 rounded bg-secondary`
- Bio lines: `h-3 w-full rounded bg-secondary` × 2
- Location: `h-3 w-28 rounded bg-secondary`
- CTA: `h-8 w-full rounded-md bg-secondary`

`aria-busy="true"` on list container; each skeleton card has `aria-hidden="true"`.

**Repeat**: 6 skeletons for initial 3-column grid load; 3 for "load more".

---

## Empty & Error States

### Empty (no workers returned)

```
┌──────────────────────────────────────────┐
│                                          │
│           🔍  (icon, 48px)               │
│                                          │
│       No workers found                   │
│  Try adjusting your filters or           │
│  searching in a wider area.              │
│                                          │
│       [ Clear filters ]                  │
│                                          │
└──────────────────────────────────────────┘
```

### Error (API failure)

```
┌──────────────────────────────────────────┐
│                                          │
│           ⚠  (icon, 48px, text-destructive) │
│                                          │
│       Couldn't load workers              │
│  Check your connection and try again.    │
│                                          │
│       [ Retry ]                          │
│                                          │
└──────────────────────────────────────────┘
```

Icon uses `text-destructive` (`hsl(var(--destructive))`).

### Inactive Worker Card

When `isActive = false` and the card must still be shown (curator dashboard):

- Card opacity: `opacity-60`
- Status badge: `bg-secondary text-muted-foreground` pill "Inactive" — replaces the active/verified area
- No CTA button — replaced with `text-xs text-muted-foreground` "Profile not visible to users"

---

## Hover / Press / Focus States

### Standard & Featured — hover

| Property        | Value                                             |
| --------------- | ------------------------------------------------- |
| Transform       | `translateY(-4px)` (`hover:-translate-y-1`)       |
| Shadow          | `shadow-lg` (elevated from `shadow-sm`)           |
| CTA border+text | → fills with `bg-primary text-primary-foreground` |
| Transition      | `transition-all duration-200 ease-in-out`         |

### Compact — hover

| Property                 | Value                                   |
| ------------------------ | --------------------------------------- |
| Shadow                   | `shadow-md` (elevated from `shadow-sm`) |
| Border                   | `border-primary/40`                     |
| No transform (too small) | —                                       |

### Press / active state (mobile tap)

```css
/* Applied via active: variant */
transform: translateY(0px) scale(0.98);
box-shadow: shadow-sm;
```

`active:scale-[0.98] active:translate-y-0`

### Focus (keyboard navigation)

The entire card is a `<Link>` (or wraps one). Focus ring:

```css
focus-visible:outline-none
focus-visible:ring-2
focus-visible:ring-ring          /* hsl(var(--ring)) = primary */
focus-visible:ring-offset-2
focus-visible:ring-offset-background
```

**Bookmark button** (nested interactive): has its own focus ring and is reachable by Tab independently of the card link. `tabIndex={0}` with `stopPropagation` on click.

**Compare checkbox** (nested interactive): same as bookmark — independently focusable.

---

## Verification Badge Spec

| Variant  | Icon         | Size  | Colour         | Position              |
| -------- | ------------ | ----- | -------------- | --------------------- |
| Compact  | `BadgeCheck` | 14 px | `text-primary` | Inline, right of name |
| Standard | `BadgeCheck` | 16 px | `text-primary` | Inline, right of name |
| Featured | `BadgeCheck` | 20 px | `text-primary` | Inline, right of name |

**When `isVerified = false`**: badge is not rendered at all (no empty placeholder).  
**`aria-label`**: `"Verified worker"` on the icon element; `aria-hidden="true"` is NOT used because it carries semantic meaning.

---

## Rating Display Spec

Rating is always shown as **stars + numeric score + review count** to serve both sighted users and colour-blind users.

| Variant  | Stars                           | Score                                   | Count                           |
| -------- | ------------------------------- | --------------------------------------- | ------------------------------- |
| Compact  | 1 `Star` icon (filled/unfilled) | `text-xs`                               | `text-xs` in `()`               |
| Standard | Full `StarRating` (5 stars)     | `text-xs text-muted-foreground`         | `text-xs` in `()`               |
| Featured | Full `StarRating` (5 stars)     | `text-sm font-semibold text-foreground` | `text-sm text-muted-foreground` |

**When `averageRating = null`** (no reviews yet): show `"No reviews yet"` in `text-xs text-muted-foreground`. Do not render the star row.

**Star fill logic**: `i < Math.round(averageRating)` → `fill-yellow-400 text-yellow-400`; else `text-secondary` (unfilled).

---

## Handoff Spec — Spacing & Token Usage

### Standard Card — full token map

```
┌────────────────────────────────────────────────────────────┐
│  border: 1px hsl(var(--border))                            │
│  border-radius: calc(var(--radius) * 2)   [= 1rem]         │
│  background: hsl(var(--card))                              │
│  padding: 20px (p-5)                                       │
│  box-shadow: 0 1px 3px rgba(0,0,0,.1) (shadow-sm)          │
│                                                            │
│  ┌──────┐  16px gap  ┌─────────────────────────────────┐  │
│  │avatar│            │ name: font-semibold 14px         │  │
│  │56×56 │            │       hsl(var(--foreground))     │  │
│  │ring: 2px primary/20│ ✓  BadgeCheck 16px text-primary │  │
│  └──────┘            │ category pill: 4px gap below name│  │
│  ────────────────────┴─────────────────────────────────── │
│  16px gap                                                  │
│  StarRating + score text-xs muted-foreground               │
│  ────────────────────────────────────────────────────────  │
│  16px gap                                                  │
│  bio: text-sm muted-foreground line-clamp-2 leading-6      │
│  ────────────────────────────────────────────────────────  │
│  location: text-xs muted-foreground  gap-1 MapPin 12px     │
│  ────────────────────────────────────────────────────────  │
│  mt-auto pt-4 (auto push CTA to bottom)                    │
│  CTA: border border-primary rounded-md py-6px w-full       │
│       text-sm font-medium text-primary                     │
│       hover→ bg-primary text-primary-foreground            │
└────────────────────────────────────────────────────────────┘
```

### Category Pill

```
background: hsl(var(--secondary))       /* blue-50 equivalent */
color:      hsl(var(--primary))         /* blue-600 */
font-size:  0.75rem (text-xs)
font-weight: 500 (font-medium)
padding:    2px 8px (py-0.5 px-2)
border-radius: 9999px (rounded-full)
```

### Verification Badge (standard)

```
icon:       BadgeCheck (lucide-react)
size:       16 × 16 px
color:      hsl(var(--primary))
margin-left: 6px (gap-1.5 in flex row)
aria-label: "Verified worker"
```

---

## Accessibility Annotations

| Element                   | Requirement                                                                                                                   |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Card link (`<Link>`)      | `aria-label="View profile of {worker.name}"` when card contains nested interactive elements                                   |
| Verification badge icon   | `aria-label="Verified worker"` — NOT `aria-hidden`                                                                            |
| Star rating               | `role="img"` + `aria-label="Rating: 4.8 out of 5 stars, 32 reviews"`                                                          |
| Bookmark button           | `aria-label="Bookmark {worker.name}"` / `"Remove bookmark for {worker.name}"`                                                 |
| Compare checkbox          | `aria-label="Compare {worker.name}"`                                                                                          |
| Avatar `<Image>`          | `alt="{worker.name}"`                                                                                                         |
| Initials fallback `<div>` | `aria-hidden="true"` (name is already in the DOM)                                                                             |
| Skeleton cards            | `aria-hidden="true"` on each skeleton; `aria-busy="true"` on list container                                                   |
| Inactive badge            | `aria-label="Worker is currently inactive"`                                                                                   |
| Focus ring                | `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`                                                    |
| Card hover animation      | Respects `prefers-reduced-motion`: `@media (prefers-reduced-motion: reduce) { .card { transition: none; transform: none; } }` |
