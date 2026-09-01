# Test Coverage Report

> **Issue #1283** — Aggregated coverage across all BlueCollar packages.

## Overview

BlueCollar uses per-package coverage reporters that differ by runtime and test
framework.  The table below summarises each package's format and where its raw
output lives after running `test:coverage`:

| Package | Test Runner | Coverage Provider | Reporters | Output Dir |
|---------|-------------|-------------------|-----------|------------|
| `packages/api` | Vitest | V8 (Node) | `text`, `json`, `html` | `packages/api/coverage/` |
| `packages/app` | Vitest | V8 (jsdom) | `text`, `json`, `html` | `packages/app/coverage/` |
| `packages/sdk` | Vitest | V8 (Node) | `text`, `json`, `html` | `packages/sdk/coverage/` |
| `packages/mobile` | Jest (jest-expo) | Istanbul | `text`, `lcov`, `html` | `packages/mobile/coverage/` |

The `contracts` package is written in Rust and uses `cargo tarpaulin` (or
`cargo llvm-cov`) for coverage — it is tracked separately and not included in
the JS/TS aggregate report.

---

## Aggregated Report

The root script `scripts/aggregate-coverage.sh` merges per-package Istanbul
JSON reports (`coverage-final.json`) from `api`, `app`, and `sdk` using
[`nyc`](https://github.com/istanbuljs/nyc), then appends the mobile `lcov.info`
to produce a single multi-format report in `coverage/aggregate/`.

```
coverage/aggregate/
├── index.html              # Browsable HTML line-by-line coverage
├── lcov.info               # Merged LCOV for Codecov / SonarCloud upload
├── coverage-final.json     # Raw Istanbul merged JSON
├── coverage-summary.json   # Machine-readable per-file summary
└── text-summary.txt        # Plain-text table (printed to stdout during run)
```

---

## Running Coverage

### Run all tests + aggregate

```bash
pnpm coverage:all
```

This command:
1. Runs `test:coverage` in each JS/TS package.
2. Merges `coverage-final.json` from api, app, and sdk via `nyc merge`.
3. Appends `packages/mobile/coverage/lcov.info` to the LCOV output.
4. Generates HTML, LCOV, JSON-summary, and text-summary into `coverage/aggregate/`.

### Aggregate without re-running tests

Use this when you already have fresh per-package coverage dirs and just want
to regenerate the merged report:

```bash
pnpm coverage:aggregate
# or equivalently:
bash scripts/aggregate-coverage.sh --no-run
```

### Per-package only

```bash
pnpm --filter @bluecollar/api test:coverage
pnpm --filter @bluecollar/app test:coverage
pnpm --filter @bluecollar/sdk test:coverage
pnpm --filter @bluecollar/mobile test:coverage
```

---

## Reading the HTML Report

Open `coverage/aggregate/index.html` in your browser (no server needed — it is
a self-contained static file).

The top-level summary table shows aggregated **Statements**, **Branches**,
**Functions**, and **Lines** percentages.  Click any filename to drill into
line-level coverage with colour coding:

- **Green** — executed
- **Red** — not executed
- **Yellow** — partially covered branch

---

## Thresholds

Each package enforces its own thresholds (see per-package `vitest.config.ts` /
`jest` config).  The aggregate report is informational — it does **not**
enforce a single monorepo-wide threshold because packages have legitimately
different coverage targets (e.g. the app excludes Next.js App Router pages that
are tested by Playwright e2e instead).

| Package | Lines | Functions | Branches | Statements |
|---------|-------|-----------|----------|------------|
| api     | 85 %  | 85 %      | 80 %     | 85 %       |
| app     | 85 %  | 85 %      | 80 %     | 85 %       |
| sdk     | 85 %  | 85 %      | 80 %     | 85 %       |
| mobile  | 85 %  | 85 %      | 80 %     | 85 %       |

---

## CI Integration

The GitHub Actions workflow (`.github/workflows/ci.yml`) uploads
`coverage/aggregate/` as a build artifact named `coverage-report`.  Download
it from the workflow run page → **Artifacts** to inspect coverage offline.

To upload to Codecov add the following step after `pnpm coverage:all`:

```yaml
- name: Upload to Codecov
  uses: codecov/codecov-action@v4
  with:
    files: coverage/aggregate/lcov.info
    flags: monorepo
    fail_ci_if_error: true
```

---

## Excluding Generated / Non-Testable Files

Files excluded from coverage instrumentation are configured at the
per-package level:

- **api** — `src/database/**`, `src/commands/**`, `src/index.ts`, `src/config/**`
- **app** — `src/app/**` (Next.js pages — covered by Playwright e2e)
- **sdk** — `src/types.ts`, test files
- **mobile** — `src/app/_layout.tsx`, test files

To add new exclusions edit the `coverage.exclude` array in the relevant
`vitest.config.ts` or the `collectCoverageFrom` array in `package.json` (for
mobile/Jest).
