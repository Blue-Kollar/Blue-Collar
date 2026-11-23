# Accessibility Design Standards (WCAG 2.1 AA)

BlueCollar commits to meeting WCAG 2.1 Level AA across all user-facing surfaces. This document defines our accessible design standards and serves as a review checklist for design QA.

---

## 1. Colour & Contrast

### Minimum contrast ratios (AA)

| Element                                  | Ratio     |
| ---------------------------------------- | --------- |
| Normal text (< 18 px / 14 px bold)       | ≥ 4.5 : 1 |
| Large text (≥ 18 px / 14 px bold)        | ≥ 3 : 1   |
| UI components & graphical objects        | ≥ 3 : 1   |
| Focus indicators against adjacent colour | ≥ 3 : 1   |

### Rules

- Never rely on colour alone to communicate state (error, success, disabled). Always pair colour with an icon, text label, or pattern.
- Disabled controls use `opacity-50` (or equivalent) **and** `cursor-not-allowed` — contrast relaxation is permitted per WCAG for inactive UI, but the disabled state must still be perceivable.
- Placeholder text must meet 4.5 : 1 against the input background. Use `text-gray-500` on white (`#6B7280` — ratio 5.0 : 1) as the floor.
- Verify all pairings with a contrast checker whenever the palette or surface colours change.

---

## 2. Focus Management

### Focus-visible treatment

All interactive elements must show a visible focus ring when focused via keyboard. The standard treatment is:

```
outline: 2px solid var(--brand-600, #2563EB);
outline-offset: 2px;
```

Tailwind utility: `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600`

- The focus ring must have ≥ 3 : 1 contrast against the adjacent background.
- Do **not** suppress `outline` on `:focus-visible`. Browser-default `:focus` (mouse click) may be suppressed if a visible state is already applied (e.g. active button style).
- Focus rings must be visible in both light and dark modes. In dark mode use `outline-blue-400` on dark surfaces.

### Focus order

- DOM order must match visual order. Do not use CSS order or flexbox `order` to rearrange interactive elements without mirroring that in the DOM.
- Modal dialogs must trap focus: Tab and Shift + Tab cycle only through the dialog's interactive elements. On close, focus returns to the element that opened the dialog.
- When dynamic content appears (toast, inline error, dropdown), either move focus to it or announce it via a live region — never leave the user unaware.

---

## 3. Keyboard Interaction Patterns

All functionality available by mouse must be operable with keyboard alone.

| Pattern                 | Keys                                                                                |
| ----------------------- | ----------------------------------------------------------------------------------- |
| Buttons, links          | `Enter` / `Space` to activate                                                       |
| Menus, dropdowns        | `Arrow Up` / `Arrow Down` to navigate, `Enter` to select, `Escape` to close         |
| Tabs                    | `Arrow Left` / `Arrow Right` to switch, content updates on activation               |
| Modal dialogs           | `Escape` to close, focus trap active                                                |
| Radio groups            | `Arrow` keys to move selection                                                      |
| Checkboxes              | `Space` to toggle                                                                   |
| Combobox / autocomplete | `Arrow Down` to open list, arrows to navigate, `Enter` to select, `Escape` to close |

- Skip links: A "Skip to main content" link must be the first focusable element on every page.
- Keyboard shortcuts (if any) must not conflict with assistive technology shortcuts and must be documented.

---

## 4. Forms & Error Patterns

### Labels

- Every form control must have a visible `<label>` associated via `htmlFor` / `id`, or use `aria-label` / `aria-labelledby` when a visible label is not possible.
- Group related controls (e.g. radio sets) with `<fieldset>` and `<legend>`.

### Errors

- On validation failure, display error text adjacent to the field (preferably below).
- Use `aria-invalid="true"` on the field and `aria-describedby` pointing to the error message element.
- Error text colour must meet contrast requirements (use `text-red-600` on white at 4.8 : 1).
- Error messages must be concrete: "Email is required" not "Invalid input".
- On form submission failure, move focus to the first invalid field or to a summary error message at the top of the form.

### Required fields

- Mark required fields with a visible indicator (e.g. asterisk) and `aria-required="true"`.
- Provide a legend at the top of the form: "Fields marked * are required."

---

## 5. Reduced Motion

### Implementation

- Wrap all non-essential animations and transitions in a `prefers-reduced-motion` media query.
- Tailwind approach: use `motion-safe:` prefix for animations that should only run when the user has no motion preference.

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

### Rules

- Page transitions, hover lifts, skeleton pulse, and carousel auto-play are **non-essential** — gate them behind `motion-safe`.
- Opacity fades under 200 ms are acceptable even with reduced motion (they do not trigger vestibular responses).
- Loading spinners may continue animating (they communicate state), but prefer a static progress indicator or text when `prefers-reduced-motion: reduce` is active.

---

## 6. Screen Reader Patterns

### Landmarks

Every page must include these ARIA landmarks (via semantic HTML where possible):

| Landmark      | Element                        |
| ------------- | ------------------------------ |
| `banner`      | `<header>` (site header / nav) |
| `navigation`  | `<nav>`                        |
| `main`        | `<main>`                       |
| `contentinfo` | `<footer>`                     |

### Images

- Decorative images: `alt=""` and `aria-hidden="true"`.
- Informative images: descriptive `alt` text.
- Icon buttons: `aria-label` on the button, `aria-hidden="true"` on the icon SVG.

### Live regions

- Toast notifications: container with `role="status"` and `aria-live="polite"`.
- Urgent alerts (e.g. session expiry): `role="alert"` with `aria-live="assertive"`.
- Search result counts: announce via `aria-live="polite"` when results update.

### Headings

- One `<h1>` per page.
- Heading levels must not skip (no `<h1>` → `<h3>`).
- Use headings to create a scannable outline of the page content.

### Tables

- Use `<th scope="col">` / `<th scope="row">` for header cells.
- Add `<caption>` or `aria-label` to describe the table's purpose.

---

## 7. Touch & Pointer Targets

- Minimum touch target: **44 × 44 px** (WCAG) / **48 × 48 dp** (Material guideline). Use 48 px as the BlueCollar standard.
- Spacing between adjacent targets: ≥ 8 px.
- If visual size must be smaller, expand the tappable area with padding or `::after` pseudo-element hit areas.

---

## 8. Design QA Checklist

Use this checklist when reviewing designs before handoff or during design QA:

### Contrast & colour

- [ ] All text meets minimum contrast ratios (4.5 : 1 normal, 3 : 1 large)
- [ ] Interactive component boundaries meet 3 : 1 contrast
- [ ] No information conveyed by colour alone

### Focus & keyboard

- [ ] All interactive elements have a visible focus-visible ring
- [ ] Focus order matches visual reading order
- [ ] Modals trap focus and return it on close
- [ ] Page has a "Skip to main content" link

### Forms

- [ ] Every field has a visible label (or aria-label)
- [ ] Error messages appear adjacent to the field with proper colour contrast
- [ ] Required fields are visually and programmatically marked
- [ ] `aria-invalid` and `aria-describedby` are used for error states

### Motion

- [ ] Animations are gated behind `motion-safe` / `prefers-reduced-motion`
- [ ] No auto-playing motion lasts longer than 5 seconds without a stop mechanism

### Screen reader

- [ ] Page has correct landmark structure (header, nav, main, footer)
- [ ] Heading hierarchy is logical and complete (h1 → h2 → h3, no skips)
- [ ] Icon-only buttons have `aria-label`
- [ ] Decorative images have empty `alt`
- [ ] Dynamic content uses appropriate live regions

### Touch targets

- [ ] All tap targets are ≥ 48 × 48 px
- [ ] Adjacent targets have ≥ 8 px spacing
