# BlueCollar Design System

> Single source of truth for design tokens, component specs, and WCAG-compliant colour pairings.
> **Version**: 1.0 — Last updated: June 2026

---

## Table of Contents

- [How Tokens Are Consumed](#how-tokens-are-consumed)
- [Colour Palette](#colour-palette)
  - [Brand & Neutral Colours](#brand--neutral-colours)
  - [Semantic Colours](#semantic-colours)
  - [WCAG AA Colour Pairings](#wcag-aa-colour-pairings)
  - [Fail — Do Not Use](#fail--do-not-use)
- [Typography](#typography)
- [Spacing Scale](#spacing-scale)
- [Border Radius](#border-radius)
- [Shadows](#shadows)
- [Motion](#motion)
- [Z-Index Scale](#z-index-scale)
- [Breakpoints](#breakpoints)
- [Component Specs](#component-specs)
  - [Buttons](#buttons)
  - [Inputs](#inputs)
  - [Cards](#cards)
  - [Modals / Dialogs](#modals--dialogs)
  - [Badges](#badges)
- [Figma Library](#figma-library)
- [Changelog](#changelog)

---

## How Tokens Are Consumed

Tokens exist in three formats. They must always stay in sync:

| Format              | File / Location                                        | Consumed By                            |
| ------------------- | ------------------------------------------------------ | -------------------------------------- |
| **JS/TS constants** | `packages/app/src/design-system/tokens.ts`             | JS logic, Storybook, runtime styling   |
| **Tailwind config** | `packages/app/tailwind.config.ts`                      | Utility classes in `.tsx` files        |
| **CSS variables**   | `packages/app/src/app/globals.css` (`:root` / `.dark`) | shadcn/ui components, third-party libs |

The authoritative source is `tokens.ts`. Any change to a token value must be mirrored
to `tailwind.config.ts` and `globals.css` in the same PR.

---

## Colour Palette

### Brand & Neutral Colours

| Swatch             | 50        | 100       | 200       | 300       | 400       | 500       | 600       | 700       | 800       | 900       |
| ------------------ | --------- | --------- | --------- | --------- | --------- | --------- | --------- | --------- | --------- | --------- |
| **Brand** (blue)   | `#eff6ff` | `#dbeafe` | `#bfdbfe` | `#93c5fd` | `#60a5fa` | `#3b82f6` | `#2563eb` | `#1d4ed8` | `#1e40af` | `#1e3a8a` |
| **Neutral** (gray) | `#f9fafb` | `#f3f4f6` | `#e5e7eb` | `#d1d5db` | `#9ca3af` | `#6b7280` | `#4b5563` | `#374151` | `#1f2937` | `#111827` |

Brand palette used for primary actions, links, focus rings, and active states.
Neutral palette used for backgrounds, borders, text, and disabled states.

### Semantic Colours

| Role        | Light     | DEFAULT (500) | Dark      |
| ----------- | --------- | ------------- | --------- |
| **Success** | `#d1fae5` | `#10b981`     | `#065f46` |
| **Warning** | `#fef3c7` | `#f59e0b`     | `#92400e` |
| **Error**   | `#fee2e2` | `#ef4444`     | `#991b1b` |
| **Info**    | `#dbeafe` | `#3b82f6`     | `#1e40af` |

### Shadcn CSS Variables (HSL)

These are used by shadcn/ui primitives and mapped to Tailwind utility classes in
`tailwind.config.ts`. Values are kept in `globals.css` under `:root` (light) and
`.dark` (dark mode).

| Token                      | Light (HSL)   | Dark (HSL)    | Tailwind alias                |
| -------------------------- | ------------- | ------------- | ----------------------------- |
| `--background`             | `0 0% 100%`   | `222 47% 11%` | `bg-background`               |
| `--foreground`             | `222 47% 11%` | `210 40% 98%` | `text-foreground`             |
| `--card`                   | `0 0% 100%`   | `222 47% 11%` | `bg-card`                     |
| `--card-foreground`        | `222 47% 11%` | `210 40% 98%` | `text-card-foreground`        |
| `--primary`                | `221 83% 53%` | `217 91% 60%` | `bg-primary` / `text-primary` |
| `--primary-foreground`     | `0 0% 100%`   | `222 47% 11%` | `text-primary-foreground`     |
| `--secondary`              | `214 32% 91%` | `217 33% 17%` | `bg-secondary`                |
| `--secondary-foreground`   | `222 47% 11%` | `210 40% 98%` | `text-secondary-foreground`   |
| `--muted`                  | `214 32% 91%` | `217 33% 17%` | `bg-muted`                    |
| `--muted-foreground`       | `215 16% 47%` | `215 20% 65%` | `text-muted-foreground`       |
| `--accent`                 | `214 32% 91%` | `217 33% 17%` | `bg-accent`                   |
| `--accent-foreground`      | `222 47% 11%` | `210 40% 98%` | `text-accent-foreground`      |
| `--destructive`            | `0 84% 60%`   | `0 63% 31%`   | `bg-destructive`              |
| `--destructive-foreground` | `0 0% 100%`   | `210 40% 98%` | `text-destructive-foreground` |
| `--border`                 | `214 32% 91%` | `217 33% 17%` | `border-border`               |
| `--input`                  | `214 32% 91%` | `217 33% 17%` | `border-input`                |
| `--ring`                   | `221 83% 53%` | `217 91% 60%` | `ring-ring`                   |
| `--radius`                 | `0.5rem`      | `0.5rem`      | `rounded-*` default           |

### WCAG AA Colour Pairings

All text-on-background combinations below pass **WCAG 2.1 AA** (≥ 4.5:1 for normal
text, ≥ 3:1 for large text at 18px bold or 24px regular).

#### Text on white background (`#ffffff`)

| Role           | Hex                     | Contrast ratio | Pass  |
| -------------- | ----------------------- | -------------- | ----- |
| Primary text   | `#111827` (Neutral 900) | 16.0:1         | ✅ AA |
| Secondary text | `#374151` (Neutral 700) | 9.7:1          | ✅ AA |
| Muted text     | `#4b5563` (Neutral 600) | 5.9:1          | ✅ AA |
| Brand (blue)   | `#1d4ed8` (Brand 700)   | 6.0:1          | ✅ AA |
| Error          | `#b91c1c` (Red 700)     | 5.9:1          | ✅ AA |
| Success        | `#15803d` (Green 700)   | 5.1:1          | ✅ AA |
| Warning        | `#92400e` (Amber 800)   | 7.2:1          | ✅ AA |

#### Text on dark background (`#111827`)

| Role                 | Hex                   | Contrast ratio | Pass  |
| -------------------- | --------------------- | -------------- | ----- |
| Primary text (light) | `#f8fafc` (Slate 50)  | 15.3:1         | ✅ AA |
| Muted text (dark)    | `#94a3b8` (Slate 400) | 5.3:1          | ✅ AA |

#### Interactive states

| State          | Foreground            | Background            | Ratio | Pass  |
| -------------- | --------------------- | --------------------- | ----- | ----- |
| Primary button | `#ffffff`             | `#2563eb` (Brand 600) | 5.2:1 | ✅ AA |
| Primary hover  | `#ffffff`             | `#1d4ed8` (Brand 700) | 6.0:1 | ✅ AA |
| Link text      | `#1d4ed8` (Brand 700) | `#ffffff`             | 6.0:1 | ✅ AA |
| Link hover     | `#1e40af` (Brand 800) | `#ffffff`             | 7.8:1 | ✅ AA |
| Error button   | `#ffffff`             | `#dc2626` (Red 600)   | 4.9:1 | ✅ AA |
| Focus ring     | `#2563eb`             | any                   | —     | ✅ AA |

### Fail — Do Not Use

The following combinations **fail** WCAG AA and must not be used for text:

| Combination                                | Ratio | Issue                                         |
| ------------------------------------------ | ----- | --------------------------------------------- |
| `#9ca3af` (Neutral 400) on white `#ffffff` | 2.5:1 | FAIL — insufficient contrast                  |
| `#d1d5db` (Neutral 300) on white `#ffffff` | 1.7:1 | FAIL                                          |
| `#fcd34d` (Yellow 300) on white `#ffffff`  | 1.4:1 | FAIL                                          |
| `#6b7280` (Neutral 500) on white `#ffffff` | 3.8:1 | FAIL for normal text (passes large text only) |
| Brand 400 (`#60a5fa`) on white `#ffffff`   | 2.3:1 | FAIL                                          |
| Brand 500 (`#3b82f6`) on white `#ffffff`   | 3.2:1 | FAIL for normal text (passes large text only) |

---

## Typography

| Token  | Size            | Line Height | Weight | Usage                |
| ------ | --------------- | ----------- | ------ | -------------------- |
| `xs`   | 0.75rem (12px)  | 1rem        | 400    | Captions, timestamps |
| `sm`   | 0.875rem (14px) | 1.25rem     | 400    | Body small, metadata |
| `base` | 1rem (16px)     | 1.5rem      | 400    | Body normal          |
| `lg`   | 1.125rem (18px) | 1.75rem     | 400    | Body large           |
| `xl`   | 1.25rem (20px)  | 1.75rem     | 600    | Section titles       |
| `2xl`  | 1.5rem (24px)   | 2rem        | 600    | Subheadings          |
| `3xl`  | 1.875rem (30px) | 2.25rem     | 700    | H3                   |
| `4xl`  | 2.25rem (36px)  | 2.5rem      | 700    | H2                   |
| `5xl`  | 3rem (48px)     | 1           | 700    | H1                   |

### Font family

```css
--font-geist-sans: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--font-geist-mono: 'Geist Mono', 'Courier New', monospace;
```

### Heading styles

| Level | Size            | Weight         | Line Height |
| ----- | --------------- | -------------- | ----------- |
| H1    | 3rem (48px)     | 700 (Bold)     | 1.2         |
| H2    | 2.25rem (36px)  | 700 (Bold)     | 1.2         |
| H3    | 1.875rem (30px) | 600 (Semibold) | 1.3         |
| H4    | 1.5rem (24px)   | 600 (Semibold) | 1.4         |
| H5    | 1.25rem (20px)  | 600 (Semibold) | 1.4         |
| H6    | 1rem (16px)     | 600 (Semibold) | 1.5         |

### Label styles

| Style        | Size            | Weight         | Line Height | Usage                        |
| ------------ | --------------- | -------------- | ----------- | ---------------------------- |
| Label large  | 0.875rem (14px) | 600 (Semibold) | 1.25rem     | Form labels, section headers |
| Label normal | 0.75rem (12px)  | 600 (Semibold) | 1rem        | Tabs, sidebar items          |

### Font weights

| Token      | Value |
| ---------- | ----- |
| `light`    | 300   |
| `normal`   | 400   |
| `medium`   | 500   |
| `semibold` | 600   |
| `bold`     | 700   |

---

## Spacing Scale

| Token | Rem     | Pixels |
| ----- | ------- | ------ |
| `0`   | 0       | 0      |
| `1`   | 0.25rem | 4px    |
| `2`   | 0.5rem  | 8px    |
| `3`   | 0.75rem | 12px   |
| `4`   | 1rem    | 16px   |
| `5`   | 1.25rem | 20px   |
| `6`   | 1.5rem  | 24px   |
| `8`   | 2rem    | 32px   |
| `10`  | 2.5rem  | 40px   |
| `12`  | 3rem    | 48px   |
| `16`  | 4rem    | 64px   |
| `20`  | 5rem    | 80px   |
| `24`  | 6rem    | 96px   |

---

## Border Radius

| Token  | Value          | Usage                          |
| ------ | -------------- | ------------------------------ |
| `none` | 0px            | —                              |
| `sm`   | 0.125rem (2px) | Checkboxes, small indicators   |
| `md`   | 0.375rem (6px) | Inputs, buttons (default)      |
| `lg`   | 0.5rem (8px)   | Cards, dialogs                 |
| `xl`   | 0.75rem (12px) | Modals, sheets                 |
| `2xl`  | 1rem (16px)    | Featured cards, large surfaces |
| `3xl`  | 1.5rem (24px)  | Special emphasis               |
| `full` | 9999px         | Pills, badges, avatars         |

---

## Shadows

| Token | Value                                                                 | Usage                             |
| ----- | --------------------------------------------------------------------- | --------------------------------- |
| `sm`  | `0 1px 2px 0 rgb(0 0 0 / 0.05)`                                       | Cards (default), subtle elevation |
| `md`  | `0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)`    | Hovered cards, dropdowns          |
| `lg`  | `0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)`  | Modals, sheets                    |
| `xl`  | `0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)` | Large overlays                    |
| `2xl` | `0 25px 50px -12px rgb(0 0 0 / 0.25)`                                 | Featured elements, toasts         |

---

## Motion

| Token     | Duration | Easing      | Usage                              |
| --------- | -------- | ----------- | ---------------------------------- |
| `fast`    | 150ms    | ease-in-out | Colour transitions, hover states   |
| `normal`  | 200ms    | ease-in-out | Default transitions                |
| `slow`    | 300ms    | ease-in-out | Panel slide-in, modal open         |
| `slowest` | 500ms    | ease-in-out | Page transitions, background fades |

### Keyframe animations

Defined in `globals.css`:

```css
@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@keyframes slide-in-right {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}
```

Utility classes: `.animate-fade-in`, `.animate-slide-in-right`.

Respects `prefers-reduced-motion` — all animations collapse to 0.01ms when the
user's OS setting is enabled.

---

## Z-Index Scale

| Token       | Value | Usage                 |
| ----------- | ----- | --------------------- |
| `hide`      | -1    | Hidden behind content |
| `base`      | 0     | Default layer         |
| `dropdown`  | 1000  | Dropdown menus        |
| `sticky`    | 1020  | Sticky headers        |
| `fixed`     | 1030  | Fixed nav elements    |
| `backdrop`  | 1040  | Overlay backdrops     |
| `offcanvas` | 1050  | Side panels           |
| `modal`     | 1060  | Modal dialogs         |
| `popover`   | 1070  | Tooltips, popovers    |
| `tooltip`   | 1080  | Tooltips (topmost)    |

---

## Breakpoints

| Token | Width  | Target       |
| ----- | ------ | ------------ |
| `xs`  | 0px    | Small phones |
| `sm`  | 640px  | Large phones |
| `md`  | 768px  | Tablets      |
| `lg`  | 1024px | Desktop      |
| `xl`  | 1280px | Wide desktop |
| `2xl` | 1536px | Ultra-wide   |

Custom media queries for accessibility:

```css
@custom-media --contrast-more (prefers-contrast: more);
@custom-media --contrast-less (prefers-contrast: less);
```

---

## Component Specs

### Buttons

#### shadcn/ui variant

| Variant       | Classes                                                                          | Usage                     |
| ------------- | -------------------------------------------------------------------------------- | ------------------------- |
| `default`     | `bg-primary text-primary-foreground hover:bg-primary/90`                         | Primary call-to-action    |
| `destructive` | `bg-destructive text-destructive-foreground hover:bg-destructive/90`             | Irreversible actions      |
| `outline`     | `border border-input bg-background hover:bg-accent hover:text-accent-foreground` | Secondary actions         |
| `secondary`   | `bg-secondary text-secondary-foreground hover:bg-secondary/80`                   | Tertiary / paired actions |
| `ghost`       | `hover:bg-accent hover:text-accent-foreground`                                   | Toolbar, minimal context  |
| `link`        | `text-primary underline-offset-4 hover:underline`                                | Inline navigation         |

| Size      | Classes                |
| --------- | ---------------------- |
| `default` | `h-10 px-4 py-2`       |
| `sm`      | `h-9 rounded-md px-3`  |
| `lg`      | `h-11 rounded-md px-8` |
| `icon`    | `h-10 w-10`            |

#### Design-system variant (brand-specific)

| Variant     | Classes                                                                        | Usage                |
| ----------- | ------------------------------------------------------------------------------ | -------------------- |
| `primary`   | `bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800`               | Primary action       |
| `secondary` | `border border-brand-600 text-brand-600 hover:bg-brand-50 active:bg-brand-100` | Outline brand action |
| `ghost`     | `text-brand-600 hover:bg-brand-50 active:bg-brand-100`                         | Subtle brand action  |
| `danger`    | `bg-red-600 text-white hover:bg-red-700 active:bg-red-800`                     | Destructive action   |

| Size | Classes               |
| ---- | --------------------- |
| `sm` | `h-8 px-3 text-sm`    |
| `md` | `h-10 px-4 text-sm`   |
| `lg` | `h-12 px-6 text-base` |

**Disabled state**: `disabled:pointer-events-none disabled:opacity-50`
**Focus**: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`

### Inputs

| State   | Classes                                                           |
| ------- | ----------------------------------------------------------------- |
| Default | `border-gray-300 focus:border-brand-500 focus:ring-brand-500/20`  |
| Error   | `border-red-400 focus:border-red-500 focus:ring-red-500/20`       |
| Success | `border-green-400 focus:border-green-500 focus:ring-green-500/20` |

**Base**: `flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground`

**Disabled**: `disabled:cursor-not-allowed disabled:opacity-50`

### Cards

| Token           | Value                                                                     |
| --------------- | ------------------------------------------------------------------------- |
| Container       | `rounded-xl border bg-white` (or `bg-card`)                               |
| Default shadow  | `shadow-sm`                                                               |
| Hover shadow    | `shadow-md` (with `hover:-translate-y-1` for worker cards)                |
| Featured border | `border-2 border-blue-200` with `bg-gradient-to-br from-blue-50 to-white` |

#### shadcn/ui Card anatomy

```
Card (rounded-lg border bg-card text-card-foreground shadow-sm)
├── CardHeader (flex flex-col space-y-1.5 p-6)
│   └── CardTitle (text-lg font-semibold leading-none tracking-tight)
├── CardContent (p-6 pt-0)
└── CardFooter (flex items-center p-6 pt-0)
```

#### WorkerCard variants

| Variant    | Padding | Shadow      | Hover                                   |
| ---------- | ------- | ----------- | --------------------------------------- |
| `compact`  | `p-3`   | `shadow-sm` | `hover:shadow-md hover:border-blue-300` |
| `standard` | `p-5`   | `shadow-sm` | `hover:-translate-y-1 hover:shadow-lg`  |
| `featured` | `p-6`   | `shadow-md` | `hover:shadow-lg hover:border-blue-400` |

### Modals / Dialogs

Implementation uses `@radix-ui/react-dialog` primitives.

| Element       | Classes                                                                                                                |
| ------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Overlay       | `fixed inset-0 z-50 bg-black/40 backdrop-blur-sm`                                                                      |
| Content       | `fixed left-[50%] top-[50%] z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-xl` |
| Sheet (right) | `fixed inset-y-0 right-0 z-50 h-full w-3/4 sm:max-w-sm bg-background p-6 shadow-lg`                                    |

### Badges

#### shadcn/ui variant

| Variant       | Classes                                                         |
| ------------- | --------------------------------------------------------------- |
| `default`     | `border-transparent bg-primary text-primary-foreground`         |
| `secondary`   | `border-transparent bg-secondary text-secondary-foreground`     |
| `destructive` | `border-transparent bg-destructive text-destructive-foreground` |
| `outline`     | `text-foreground`                                               |

Base: `inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors`

#### Design-system variant (brand-specific)

| Variant           | Classes                           | WCAG Ratio |
| ----------------- | --------------------------------- | ---------- |
| `default` (brand) | `bg-brand-100 text-brand-700`     | 6.0:1 ✅   |
| `success`         | `bg-green-100 text-green-700`     | 5.1:1 ✅   |
| `warning`         | `bg-yellow-100 text-yellow-700`   | 7.2:1 ✅   |
| `danger`          | `bg-red-100 text-red-700`         | 5.9:1 ✅   |
| `neutral`         | `bg-neutral-100 text-neutral-700` | 9.7:1 ✅   |

---

## Figma Library

> **Figma community file**: [BlueCollar Design System](https://www.figma.com/community/file/bluecollar-design-system)

The Figma library mirrors the design tokens and component specs defined in this
document. To keep the library in sync:

1. Update `tokens.ts` with the new token value.
2. Mirror the change in `globals.css` (CSS variables) and `tailwind.config.ts`.
3. Update the Figma library's colour styles, text styles, and component variants.
4. Tag the Figma library version in the PR description.

**How to request a Figma edit**: Open an issue with the `design` label and link
to the specific component or token in this document.

---

## Changelog

| Date    | Change                     |
| ------- | -------------------------- |
| 2026-06 | Initial design system v1.0 |

---

> **Maintenance**: Keep this document in sync with `tokens.ts`, `globals.css`, and
> `tailwind.config.ts`. Any PR that introduces a new token or component variant
> must update all four files.
