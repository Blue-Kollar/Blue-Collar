# Snapshot Test Review Guidelines

> Issues: #1059 — snapshot test cleanup and review process; #1869 — final
> snapshot policy cleanup.
>
> This document is the canonical reference for snapshot testing decisions in
> `packages/app`. Update it if the project's testing strategy changes.

---

## Current policy (final state after #1869)

**There are no `toMatchSnapshot()` calls and no `.snap` files in `packages/app`.**
All component tests now assert observable behaviour: accessible roles, labels,
text, key attributes and element counts. A Tailwind class rename, icon upgrade
or wrapper-element change must never break a unit test on its own.

| Allowed                                                                           | Not allowed                                                                            |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Narrow `toMatchInlineSnapshot()` for a small, stable serialized value (see below) | `toMatchSnapshot()` / `toMatchInlineSnapshot()` on a rendered container or DOM subtree |
| Playwright `toHaveScreenshot()` visual baselines (human-reviewed PNGs)            | Snapshots of third-party library output (recharts, Radix internals)                    |
|                                                                                   | Snapshots used as a substitute for text, role or disabled-state assertions             |

---

## The problem with broad snapshots

A snapshot of the full component container (`expect(container).toMatchSnapshot()`)
pins the **entire DOM subtree** — CSS class names, wrapper elements, icon SVG
attributes, data attributes, whitespace. This means:

- A CSS class rename (e.g., Tailwind upgrade) breaks the test even though
  behaviour is unchanged.
- A new icon version breaks the test.
- A developer runs `vitest --update-snapshots` to "fix" it without reading
  the diff, silently accepting a real regression.

Over time, snapshot diffs become noise that reviewers stop reading. This is why
the remaining broad snapshots were removed in #1869.

---

## When snapshots ARE appropriate

Use a **narrow inline snapshot** only when you need to detect unintentional
changes to a small, stable, serialised value that is itself the contract:

| Scenario                                                              | Why it's appropriate                   |
| --------------------------------------------------------------------- | -------------------------------------- |
| A serialised data format (e.g. CSV export, error-envelope JSON)       | The format IS the contract             |
| A small pure-function result that is awkward to assert field-by-field | Diff is visible inline and < ~20 lines |

**Poor candidates:**

| Scenario                                                       | Why it's inappropriate                          |
| -------------------------------------------------------------- | ----------------------------------------------- |
| `expect(container).toMatchSnapshot()` on any component or page | Too broad; breaks on unrelated changes          |
| Snapshot of third-party library output                         | You don't own the snapshot shape                |
| Testing text via a snapshot                                    | Use `screen.getByText(...)`                     |
| Testing that a button exists via a snapshot                    | Use `screen.getByRole('button', { name: ... })` |

---

## Replacing a broad snapshot with targeted assertions

Instead of:

```tsx
// ❌ Broad — breaks on unrelated DOM changes
it('renders correctly', () => {
  const { container } = render(<LoadingState message="Loading…" />);
  expect(container).toMatchSnapshot();
});
```

Write:

```tsx
// ✅ Targeted — tests observable, user-facing behaviour
it('shows the message text', () => {
  render(<LoadingState message="Loading…" />);
  expect(screen.getByText('Loading…')).toBeInTheDocument();
});

it('exposes a status role for screen readers', () => {
  render(<LoadingState />);
  expect(screen.getByRole('status')).toBeInTheDocument();
});
```

---

## Allowed narrow inline snapshots

`toMatchInlineSnapshot()` is preferable to file-based snapshots when the value
is small enough to read inline (< ~20 lines) and the diff should be visible in
the PR:

```tsx
// ✅ Inline snapshot — diff is visible directly in the PR
it('serialises the API error shape', () => {
  expect(formatApiError({ code: 401, message: 'Unauthorized' })).toMatchInlineSnapshot(`
    {
      "code": 401,
      "message": "Unauthorized",
      "status": "error",
    }
  `);
});
```

Do not use this escape hatch for rendered React elements — assert roles,
labels, text and attributes instead.

---

## Visual regression snapshots (Playwright)

Playwright's `toHaveScreenshot()` (used in `packages/app/visual/snapshots.spec.ts`)
is a different kind of snapshot — it captures a pixel-level PNG of a rendered
page. These are appropriate because:

- They are reviewed visually by a human before being committed as a baseline.
- They cover full-page visual regressions that unit tests cannot catch.
- They are stored in `visual/__snapshots__/` and updated deliberately with
  `playwright test --update-snapshots`.

They are **not** subject to the anti-patterns above.

---

## Snapshot review checklist

When a snapshot-related diff appears in a PR, the reviewer **must**:

1. **Read the full diff** — do not accept it without understanding what changed.
2. **Ask**: is the snapshot narrow (a serialised value or a visual baseline)?
   Reject any `toMatchSnapshot()` on a rendered container or DOM subtree.
3. **Ask**: did user-facing behaviour change intentionally? If yes, is the
   assertion updated to describe the new behaviour?
4. **Ask**: is the diff caused by a dependency upgrade (e.g. icon library)?
   If so, remove the snapshot and write a targeted assertion instead.
5. **Reject** a snapshot update that exists only to make CI pass without a
   corresponding intentional component change.
6. Confirm no new `.snap` file was added under `src/` and that obsolete `.snap`
   files were deleted in the same change.

---

## Audit results (#1059, #1267, #1869)

| File                                                           | Finding                                                 | Action taken                                                         |
| -------------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------- |
| `src/__tests__/LoadingState.test.tsx`                          | 3 broad `toMatchSnapshot()` calls                       | **Replaced** (#1059) with role/text/variant assertions               |
| `src/__tests__/ErrorState.test.tsx`                            | 3 broad `toMatchSnapshot()` calls                       | **Replaced** (#1059) with alert/message/retry assertions             |
| `src/__tests__/ui-snapshots.test.tsx`                          | 16 snapshot call sites → 27 stored snapshots            | **Replaced** (#1869) with role, label, text and count assertions     |
| `src/__tests__/__snapshots__/ui-snapshots.test.tsx.snap`       | 27 committed snapshots                                  | **Deleted** (#1869)                                                  |
| `src/__tests__/cls-skeleton-loaders.test.tsx`                  | 4 `toMatchSnapshot()` calls (generated on first run)    | **Replaced** (#1869) with busy-state, dimension and count assertions |
| `src/components/charts/__tests__/ChartComponents.test.tsx`     | 3 `toMatchSnapshot()` calls                             | **Replaced** (#1869) with chart data/key/axis assertions             |
| `src/components/Dashboard/__tests__/DashboardWidgets.test.tsx` | 3 `toMatchSnapshot()` calls                             | **Replaced** (#1869) with metric/event/stat assertions               |
| `visual/snapshots.spec.ts`                                     | Playwright `toHaveScreenshot()` visual regression suite | **Kept** — appropriate human-reviewed pixel snapshots                |

Snapshot counts removed by #1869: **27 stored snapshots** in the committed
`.snap` file plus **10** that would have been generated on first run by the
other three files (4 skeleton + 3 chart + 3 widget calls) — **37 total**.

No `.snap` files remain under `packages/app/src`, and no `toMatchSnapshot()`
calls remain in the app package. Behavioural coverage (roles, disabled state,
error text, ARIA) is the primary strategy for stateful and design-system
components alike.

---

## Running app tests

```bash
# A single behavioural test file
pnpm --filter @bluecollar/app exec vitest run src/__tests__/ui-snapshots.test.tsx

# Full app unit suite
pnpm --filter @bluecollar/app exec vitest run

# Playwright visual baselines (separate suite)
pnpm --filter @bluecollar/app exec playwright test visual/ --update-snapshots
```
