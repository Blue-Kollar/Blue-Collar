# Testing Coverage Policy

**Issue:** #1867 — Enforce 85% test coverage thresholds across the Blue-Collar monorepo

---

## Coverage targets

The monorepo enforces an **85% line-coverage target** across all packages to ensure code quality and catch regressions early. This threshold applies to:

- **Lines**: 85%
- **Functions**: 85%
- **Statements**: 85%
- **Branches**: 80% (see exceptions below)

---

## Per-package enforcement

Each package maintains its own test configuration with coverage thresholds:

| Package               | Test runner            | Config file                          | Threshold enforcement                                            |
| --------------------- | ---------------------- | ------------------------------------ | ---------------------------------------------------------------- |
| `packages/api`        | Vitest + Jest (legacy) | `vitest.config.ts`, `jest.config.js` | ✅ 85% global + per-module (services, controllers, repositories) |
| `packages/app`        | Vitest + Jest (legacy) | `vitest.config.ts`, `jest.config.js` | ✅ 85% global                                                    |
| `packages/sdk`        | Vitest                 | `vitest.config.ts`                   | ✅ 85% global                                                    |
| `packages/types`      | N/A                    | —                                    | Type-only package; no tests required                             |
| `packages/test-utils` | Vitest                 | `vitest.config.ts`                   | ✅ 85% global                                                    |

Coverage reports are generated per-package and aggregated in CI. Failing to meet the threshold causes the test run to exit with a non-zero code, blocking merges.

---

## Branch coverage exception

**Branch coverage is set at 80%** (not 85%) for the following reasons:

### API (`packages/api`)

Many middleware branches depend on runtime environment flags that are not fully exercisable in unit tests without a live database or external service:

- `if (process.env.NODE_ENV === 'production')` — production-only code paths
- `if (user?.role === 'admin')` — role-based conditional logic
- Database connection fallbacks and retry logic

These branches are validated through:

- E2E tests (requires live DB; excluded from default coverage)
- Manual smoke testing in staging environments
- Integration tests that mock infrastructure

### App (`packages/app`)

React components have conditional rendering for loading, error, and empty states that are tested **indirectly** through component integration tests but not as **isolated unit-test branches**:

- `{loading && <Spinner />}`
- `{error && <ErrorMessage />}`
- `{items.length === 0 && <EmptyState />}`

The Vitest coverage tool counts these as untested branches even when the states are exercised through higher-level component tests.

---

## Excluded from coverage

The following files are excluded from coverage requirements:

### Common exclusions (all packages)

- `**/*.test.ts`, `**/*.spec.ts` — Test files themselves
- `**/*.d.ts` — TypeScript declaration files
- `**/index.ts` — Barrel exports (no logic)
- `**/__tests__/**` — Test directories

### Package-specific exclusions

#### `packages/api`

- `src/database/**` — Migration and seed scripts (covered by E2E)
- `src/commands/**` — CLI scripts (covered by manual testing)
- `src/index.ts` — Application entry point

#### `packages/app`

- `src/app/**` — Next.js App Router pages/layouts (covered by Playwright E2E)
- `**/*.stories.tsx` — Storybook stories (not production code)

---

## Coverage enforcement in CI

### GitHub Actions workflows

Coverage is enforced in the following workflows:

| Workflow             | Packages tested | Threshold enforced                              |
| -------------------- | --------------- | ----------------------------------------------- |
| `api-tests.yml`      | `packages/api`  | ✅ 85% lines                                    |
| `type-check.yml`     | `packages/app`  | ✅ 85% lines                                    |
| `contract-tests.yml` | `packages/sdk`  | ✅ 85% lines (Rust contracts tested separately) |

Each workflow runs:

```bash
pnpm --filter <package> test --run --coverage
```

The test command exits with code `1` if coverage falls below the threshold, failing the CI check and blocking the PR.

### Local enforcement

Developers can verify coverage locally before pushing:

```bash
# Run tests with coverage for a specific package
pnpm --filter @bluecollar/api test:coverage

# Run tests with coverage for all packages
pnpm -r test:coverage

# Generate HTML coverage report (opens in browser)
pnpm --filter @bluecollar/api test:coverage
# Then open: packages/api/coverage/index.html
```

---

## Per-module thresholds (API only)

The API package enforces **additional per-module thresholds** for critical layers:

| Module              | Lines | Functions | Statements | Branches |
| ------------------- | ----- | --------- | ---------- | -------- |
| `src/services/`     | 85%   | 85%       | 85%        | 80%      |
| `src/controllers/`  | 85%   | 85%       | 85%        | 80%      |
| `src/repositories/` | 85%   | 85%       | 85%        | 80%      |

This prevents regressions in core business logic even if other parts of the codebase have high coverage.

---

## Coverage baseline tracking

The monorepo tracks coverage baselines to prevent **silent regressions**:

1. **Baseline report** — Generated on `main` via:

   ```bash
   pnpm --filter @bluecollar/api test:coverage:baseline
   ```

   Outputs `coverage/coverage-summary.json` with current coverage percentages.

2. **PR comparison** — CI compares the PR's coverage against the baseline:
   - ✅ Coverage increased or stayed the same → Pass
   - ⚠️ Coverage decreased → Warning comment posted to PR
   - ❌ Coverage fell below 85% threshold → CI fails

3. **Ratcheting** — Once coverage increases, it cannot decrease below the new level without explicit justification in the PR.

---

## Rationale

### Why 85%?

- **Industry standard** — 85% is widely accepted as a balance between thorough testing and diminishing returns
- **Catches most bugs** — Studies show 85%+ coverage catches 90%+ of detectable bugs
- **Prevents regressions** — High coverage makes refactoring safer

### Why not 100%?

- **Diminishing returns** — The last 15% often covers trivial code (getters, type guards, error messages)
- **False sense of security** — 100% coverage does not mean bug-free code; it means every line was executed, not that every behavior was validated
- **Maintenance burden** — Tests for edge cases in generated code or framework internals are brittle and low-value

### Why per-package?

- **Isolation** — Each package has different testing needs (API has integration tests; App has component tests; SDK is pure logic)
- **Ownership** — Teams can iterate on their package's tests independently
- **Performance** — Smaller test suites run faster than a monolithic suite

---

## Improving coverage

If a PR fails coverage checks:

1. **Identify untested code**:

   ```bash
   pnpm --filter <package> test:coverage
   # Open coverage/index.html to see red-highlighted lines
   ```

2. **Write missing tests**:
   - Unit tests for pure functions
   - Integration tests for HTTP routes
   - Component tests for React components

3. **Re-run coverage**:

   ```bash
   pnpm --filter <package> test:coverage
   ```

4. **If the uncovered code is intentionally excluded** (e.g., a CLI script or Next.js page):
   - Add it to the `exclude` pattern in the coverage config
   - Document the exclusion reason in this file

---

## References

- [Issue #1055](https://github.com/Perihelion-Protocol/Perihelion/issues/1055) — Original coverage enforcement proposal
- [Issue #1867](https://github.com/Perihelion-Protocol/Perihelion/issues/1867) — Jest config threshold update
- `packages/api/vitest.config.ts` — API coverage configuration
- `packages/app/vitest.config.ts` — App coverage configuration
- `packages/sdk/vitest.config.ts` — SDK coverage configuration
