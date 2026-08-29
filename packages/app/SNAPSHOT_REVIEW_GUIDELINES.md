# Snapshot Test Review Guidelines

> Issue: #1059 — Snapshot test cleanup and review process
>
> This document is the canonical reference for snapshot testing decisions in
> this project. Update it if the project's testing strategy changes.

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

Over time, snapshot diffs become noise that reviewers stop reading.

---

## When snapshots ARE appropriate

Use snapshots only when you need to detect **unintentional structural changes**
to a highly stable, visually-reviewed component, AND you have a process for
reviewing those diffs carefully.

**Good candidates:**

| Scenario | Why it's appropriate |
|---|---|
| A design-system primitive (Button, Badge) whose DOM structure is intentionally frozen | Small, stable, reviewed on every update |
| A serialised data format (e.g., CSV export, email template HTML) | The format IS the contract |
| A Playwright visual regression screenshot (`toHaveScreenshot`) | Captures pixel-level regressions across full pages; reviewed by a human |

**Poor candidates:**

| Scenario | Why it's inappropriate |
|---|---|
| `expect(container).toMatchSnapshot()` on a full page component | Too broad; breaks on unrelated changes |
| Snapshot of a component that renders third-party library output | You don't own the snapshot shape |
| Testing that text content is correct via a snapshot | Use `screen.getByText(...)` instead |
| Testing that a button exists via a snapshot | Use `screen.getByRole('button', { name: ... })` instead |

---

## Snapshot review checklist

When a snapshot diff appears in a PR, the reviewer **must**:

1. **Read the full diff** — do not accept it without understanding what changed.
2. **Ask**: did the component's user-facing behaviour change? If yes, is that
   intentional?
3. **Ask**: is the diff caused by a dependency upgrade (e.g., icon library)?
   If so, consider removing the snapshot and writing a targeted assertion.
4. **Reject** a snapshot update that looks like it was committed just to make
   CI pass without a corresponding intentional component change.

---

## Replacing a broad snapshot with targeted assertions

Instead of:

```tsx
// ❌ Broad — breaks on unrelated DOM changes
it('renders correctly', () => {
  const { container } = render(<LoadingState message="Loading…" />)
  expect(container).toMatchSnapshot()
})
```

Write:

```tsx
// ✅ Targeted — tests observable, user-facing behaviour
it('shows the message text', () => {
  render(<LoadingState message="Loading…" />)
  expect(screen.getByText('Loading…')).toBeInTheDocument()
})

it('exposes a status role for screen readers', () => {
  render(<LoadingState />)
  expect(screen.getByRole('status')).toBeInTheDocument()
})
```

---

## Inline snapshots

`toMatchInlineSnapshot()` is preferable to file-based snapshots when:
- The snapshot is small enough to read inline (< ~20 lines of serialised output).
- You want code review to surface the snapshot content automatically.

```tsx
// ✅ Inline snapshot — diff is visible directly in the PR
it('serialises the API error shape', () => {
  expect(formatApiError({ code: 401, message: 'Unauthorized' })).toMatchInlineSnapshot(`
    {
      "code": 401,
      "message": "Unauthorized",
      "status": "error",
    }
  `)
})
```

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

## Updating a snapshot deliberately

```bash
# Vitest: update all stale file-based snapshots
pnpm --filter @bluecollar/app test -- --update-snapshots

# Playwright: update visual baselines for a specific spec
pnpm --filter @bluecollar/app exec playwright test visual/ --update-snapshots
```

Always commit snapshot updates in a **separate commit** from the component
change, with a commit message that explains what changed and why:

```
test(snapshot): update LoadingState snapshots after Tailwind v4 class rename

The `animate-spin` class was renamed to `motion-safe:animate-spin` in the
Tailwind v4 migration. No user-visible behaviour changed.
```

---

## Audit results (#1059)

Files audited: all `*.test.{ts,tsx}` files under `packages/app/src/__tests__/`
and `packages/mobile/src/**/__tests__/`.

| File | Finding | Action taken |
|---|---|---|
| `LoadingState.test.tsx` | 3 broad `toMatchSnapshot()` calls on full container | **Replaced** with 7 targeted assertions |
| `ErrorState.test.tsx` | 3 broad `toMatchSnapshot()` calls on full container | **Replaced** with 9 targeted assertions (added retry-click test) |
| `visual/snapshots.spec.ts` | Playwright `toHaveScreenshot()` — visual regression suite | **Kept** — appropriate use of pixel snapshots |
| All other test files | No `toMatchSnapshot` usage found | No action required |

No stored `.snap` files were found on disk. The two files above used
`toMatchSnapshot()` but the snapshot files had not yet been committed (they
are generated on first run). Replacing them now prevents those files from
ever being created.
