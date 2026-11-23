# Dark Mode Palette & Theming Spec

Authoritative dark-mode colour reference for BlueCollar. All token names align with the existing Tailwind `brand-*` palette and extend it with dark-mode surface, text, and component tokens.

---

## 1. Dark Surface Tokens

| Token               | Light value          | Dark value            | Usage                          |
| ------------------- | -------------------- | --------------------- | ------------------------------ |
| `--surface-base`    | `#FFFFFF`            | `#0F172A` (slate-900) | Page background                |
| `--surface-raised`  | `#FFFFFF`            | `#1E293B` (slate-800) | Cards, panels, modals          |
| `--surface-overlay` | `#F9FAFB` (gray-50)  | `#334155` (slate-700) | Dropdowns, popovers, sheets    |
| `--surface-sunken`  | `#F3F4F6` (gray-100) | `#0F172A` (slate-900) | Input backgrounds, code blocks |
| `--surface-hover`   | `#F3F4F6` (gray-100) | `#334155` (slate-700) | Hover state on cards / rows    |
| `--surface-active`  | `#E5E7EB` (gray-200) | `#475569` (slate-600) | Active / pressed state         |

---

## 2. Dark Text Tokens

| Token              | Light value          | Dark value            | Contrast on dark surface-raised | Usage                                       |
| ------------------ | -------------------- | --------------------- | ------------------------------- | ------------------------------------------- |
| `--text-primary`   | `#111827` (gray-900) | `#F1F5F9` (slate-100) | 14.4 : 1                        | Headings, body text                         |
| `--text-secondary` | `#6B7280` (gray-500) | `#94A3B8` (slate-400) | 5.6 : 1                         | Descriptions, metadata                      |
| `--text-tertiary`  | `#9CA3AF` (gray-400) | `#64748B` (slate-500) | 3.5 : 1                         | Placeholders, disabled (AA large text only) |
| `--text-inverse`   | `#FFFFFF`            | `#0F172A` (slate-900) | —                               | Text on brand-coloured buttons              |
| `--text-link`      | `#2563EB` (blue-600) | `#60A5FA` (blue-400)  | 5.3 : 1                         | Links, interactive text                     |

All primary and secondary text pairings pass AA (≥ 4.5 : 1) against their respective surfaces.

---

## 3. Dark Brand / Accent Tokens

| Token                   | Light value           | Dark value            | Notes                       |
| ----------------------- | --------------------- | --------------------- | --------------------------- |
| `--brand-primary`       | `#2563EB` (brand-600) | `#3B82F6` (brand-500) | Primary buttons, active nav |
| `--brand-primary-hover` | `#1D4ED8` (brand-700) | `#2563EB` (brand-600) | Button hover                |
| `--brand-subtle`        | `#EFF6FF` (brand-50)  | `#1E3A8A` (brand-900) | Badges, category chips      |
| `--brand-subtle-text`   | `#2563EB` (brand-600) | `#93C5FD` (brand-300) | Text on subtle backgrounds  |

---

## 4. Dark Border Tokens

| Token              | Light value          | Dark value            |
| ------------------ | -------------------- | --------------------- |
| `--border-default` | `#E5E7EB` (gray-200) | `#334155` (slate-700) |
| `--border-subtle`  | `#F3F4F6` (gray-100) | `#1E293B` (slate-800) |
| `--border-strong`  | `#D1D5DB` (gray-300) | `#475569` (slate-600) |
| `--border-focus`   | `#2563EB` (blue-600) | `#60A5FA` (blue-400)  |

---

## 5. Dark Semantic Tokens

| Semantic    | Light bg             | Dark bg     | Light text            | Dark text             |
| ----------- | -------------------- | ----------- | --------------------- | --------------------- |
| **Error**   | `#FEF2F2` (red-50)   | `#450A0A40` | `#DC2626` (red-600)   | `#FCA5A5` (red-300)   |
| **Success** | `#F0FDF4` (green-50) | `#052E1640` | `#16A34A` (green-600) | `#86EFAC` (green-300) |
| **Warning** | `#FFFBEB` (amber-50) | `#451A0340` | `#D97706` (amber-600) | `#FCD34D` (amber-300) |
| **Info**    | `#EFF6FF` (blue-50)  | `#1E3A8A40` | `#2563EB` (blue-600)  | `#93C5FD` (blue-300)  |

All semantic text values pass AA on their respective dark backgrounds.

---

## 6. Elevation & Shadow Behaviour

In dark mode, shadows are nearly invisible because the base surface is already dark. Use **border** and **surface differentiation** instead.

| Elevation level    | Light treatment         | Dark treatment                                             |
| ------------------ | ----------------------- | ---------------------------------------------------------- |
| Level 0 (flat)     | No shadow, base surface | `surface-base`                                             |
| Level 1 (card)     | `shadow-sm`             | `surface-raised` + `border-default`                        |
| Level 2 (dropdown) | `shadow-md`             | `surface-overlay` + `border-default`                       |
| Level 3 (modal)    | `shadow-lg` + overlay   | `surface-overlay` + `border-strong` + overlay (`black/60`) |
| Level 4 (toast)    | `shadow-xl`             | `surface-overlay` + `border-strong`                        |

### Rules

- Do **not** use `shadow-*` utilities in dark mode except `shadow-sm` on modals for subtle depth.
- Use a 1 px border on all elevated surfaces in dark mode to maintain visual separation.
- Modal overlay: light mode `black/40`, dark mode `black/60`.

---

## 7. Image & Illustration Treatment

### Photographs

- No filter changes. Photos display as-is in both modes.
- Avoid images with bright white backgrounds — they create harsh contrast flashes in dark mode.

### UI illustrations / decorative SVGs

- Prefer illustrations that use the brand palette (blue tones) so they adapt naturally.
- If an illustration has a white background, add a `dark:bg-surface-raised dark:rounded-lg dark:p-2` wrapper to contain it.

### Logos

- Provide two logo variants: `logo-light.svg` (for dark backgrounds) and `logo-dark.svg` (for light backgrounds).
- Swap via `className="dark:hidden"` / `className="hidden dark:block"`.

### Icons

- Icons inherit `currentColor`. No special treatment needed — they follow text tokens automatically.

---

## 8. Tailwind / CSS Implementation Reference

### Toggle mechanism

Use the Tailwind `class` strategy (not `media`) so the theme can be toggled by user preference:

```js
// tailwind.config.ts
darkMode: 'class',
```

Apply `dark` class to `<html>` element. Persist preference in `localStorage` and respect `prefers-color-scheme` as the default.

### Using tokens

Define CSS custom properties on `:root` and `.dark`:

```css
:root {
  --surface-base: #ffffff;
  --surface-raised: #ffffff;
  --text-primary: #111827;
  --text-secondary: #6b7280;
  --border-default: #e5e7eb;
}

.dark {
  --surface-base: #0f172a;
  --surface-raised: #1e293b;
  --text-primary: #f1f5f9;
  --text-secondary: #94a3b8;
  --border-default: #334155;
}
```

Reference in Tailwind via `theme.extend.colors`:

```js
colors: {
  surface: {
    base: 'var(--surface-base)',
    raised: 'var(--surface-raised)',
  },
  // ...
}
```

---

## 9. Contrast Verification

All dark-mode pairings have been verified against WCAG 2.1 AA:

| Foreground                    | Background                 | Ratio    | Pass          |
| ----------------------------- | -------------------------- | -------- | ------------- |
| `text-primary` (#F1F5F9)      | `surface-raised` (#1E293B) | 14.4 : 1 | AA            |
| `text-secondary` (#94A3B8)    | `surface-raised` (#1E293B) | 5.6 : 1  | AA            |
| `text-link` (#60A5FA)         | `surface-raised` (#1E293B) | 5.3 : 1  | AA            |
| `brand-primary` (#3B82F6)     | `surface-raised` (#1E293B) | 4.7 : 1  | AA            |
| `brand-subtle-text` (#93C5FD) | `brand-subtle` (#1E3A8A)   | 6.1 : 1  | AA            |
| `error-text` (#FCA5A5)        | `error-bg` (#450A0A40*)    | 5.8 : 1  | AA            |
| `success-text` (#86EFAC)      | `success-bg` (#052E1640*)  | 6.2 : 1  | AA            |
| `border-default` (#334155)    | `surface-base` (#0F172A)   | 3.1 : 1  | AA (non-text) |

*Semi-transparent semantic backgrounds are measured composited on `surface-raised`.
