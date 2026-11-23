# Visual Regression Testing Guide

This document describes how to run visual regression tests on the BlueCollar app using Playwright and Percy.

## Overview

Visual regression testing automatically detects unintended UI changes by comparing screenshots. We use two approaches:

1. **Local snapshots** — Playwright's built-in screenshot comparison (fast, runs locally)
2. **Percy** — Cloud-based visual regression testing (comprehensive, runs on CI)

## Prerequisites

- Node.js >= 20
- pnpm >= 9
- Playwright browsers: `pnpm exec playwright install`

## Running Visual Tests Locally

### Update Baseline Snapshots

When you make intentional UI changes, update the baseline screenshots:

```bash
cd packages/app
pnpm test:e2e visual.spec.ts --update-snapshots
```

This creates/updates `.png` files in `e2e/__screenshots__/`.

### Run Visual Tests

```bash
cd packages/app
pnpm test:e2e visual.spec.ts
```

Tests fail if pixel differences exceed the threshold (2% by default).

### View Differences

If a test fails, Playwright generates a diff report:

```bash
pnpm test:e2e visual.spec.ts
# Then open: playwright-report/index.html
```

## Percy Integration

Percy provides cloud-based visual regression testing with:

- Automatic baseline management
- Pixel-perfect comparisons
- Browser/device coverage
- Team collaboration features

### Setup

1. **Create a Percy project:**
   - Go to [percy.io](https://percy.io)
   - Sign up and create a new project
   - Copy your `PERCY_TOKEN`

2. **Add token to CI:**
   - GitHub Actions: Add `PERCY_TOKEN` as a repository secret
   - Local testing: `export PERCY_TOKEN=<your-token>`

### Running Percy Tests

Percy snapshots are automatically captured during E2E tests if `PERCY_TOKEN` is set:

```bash
export PERCY_TOKEN=<your-token>
cd packages/app
pnpm test:e2e visual.spec.ts
```

Snapshots are uploaded to Percy and compared against the baseline.

### Reviewing Changes

1. After tests run, Percy posts a comment on your PR with a link
2. Click the link to review visual changes
3. Approve or reject changes in the Percy dashboard
4. Merge PR once approved

## Covered Pages

| Page            | Path                | Purpose                    |
| --------------- | ------------------- | -------------------------- |
| Home            | `/en`               | Landing page, hero section |
| Workers Listing | `/en/workers`       | Worker discovery, filters  |
| Worker Profile  | `/en/workers/:id`   | Individual worker details  |
| Login           | `/en/auth/login`    | Authentication             |
| Register        | `/en/auth/register` | Account creation           |
| Dashboard       | `/en/dashboard`     | User dashboard             |

## Configuration

### Pixel Difference Threshold

Adjust the threshold in `e2e/visual.spec.ts`:

```typescript
await expect(page).toHaveScreenshot('home.png', {
  maxDiffPixelRatio: 0.02, // 2% tolerance
});
```

Lower values = stricter matching (more false positives)
Higher values = looser matching (may miss real issues)

### Percy Configuration

Create `.percy.yml` in the project root:

```yaml
version: 2
static:
  cleanUrls: true
  include: '**/*.html'
  exclude:
    - node_modules/**
discovery:
  allowed-hosts:
    - localhost
  network-idle-timeout: 750
```

## CI Integration

### GitHub Actions

Add to `.github/workflows/e2e.yml`:

```yaml
- name: Run visual regression tests
  env:
    PERCY_TOKEN: ${{ secrets.PERCY_TOKEN }}
  run: |
    cd packages/app
    pnpm test:e2e visual.spec.ts
```

### Weekly Fuzzing

Run visual tests on a schedule to catch subtle regressions:

```yaml
on:
  schedule:
    - cron: '0 0 * * 0' # Weekly on Sunday
```

## Troubleshooting

### "Percy token not found"

Ensure `PERCY_TOKEN` is set:

```bash
echo $PERCY_TOKEN  # Should print your token
```

### "Screenshot mismatch"

1. Review the diff in Playwright report or Percy dashboard
2. If the change is intentional, update snapshots: `pnpm test:e2e --update-snapshots`
3. If unintentional, fix the UI and re-run tests

### "Timeout waiting for page"

Increase the timeout in `playwright.config.ts`:

```typescript
use: {
  navigationTimeout: 30000,  // 30 seconds
}
```

### "Percy build failed"

Check Percy logs:

```bash
percy exec -- pnpm test:e2e visual.spec.ts --verbose
```

## Best Practices

1. **Keep snapshots small** — Test individual pages, not entire flows
2. **Use meaningful names** — `home.png` is better than `screenshot1.png`
3. **Review diffs carefully** — Don't approve changes you don't understand
4. **Update baselines intentionally** — Never auto-approve all changes
5. **Test responsive design** — Add tests for mobile/tablet viewports

## References

- [Playwright visual comparisons](https://playwright.dev/docs/test-snapshots)
- [Percy documentation](https://docs.percy.io/)
- [Percy + Playwright integration](https://docs.percy.io/docs/playwright)
