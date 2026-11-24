# Technical Debt: TODO/FIXME Inventory (#1892)

This is a point-in-time inventory of every `TODO`/`FIXME` marker in `packages/*`
and `contracts`, plus the commented-out-code cleanup from #1890. Descriptions
are owner-neutral.

**Tracker note:** no tracker/GitHub issues were created by this work. The
original cleanup issues (#1890, #1892) and any proposed tickets below must be
created in the tracker by the team; this document is an inventory only, not a
substitute for tracker items.

## Inventory of `TODO`/`FIXME` markers

| Location                                                   | Marker / description                                                                                                                     | Proposed issue title                       | Priority | Disposition                                |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | -------- | ------------------------------------------ |
| `packages/sdk/src/__tests__/no-ts-suppressions.test.ts:13` | JSDoc example of a forbidden `@ts-expect-error` reason: a bare `TODO` placeholder. It documents what the #1485 regression guard rejects. | None — regression-test fixture, not debt   | N/A      | Reviewed, kept (intentional documentation) |
| `packages/sdk/src/__tests__/no-ts-suppressions.test.ts:14` | JSDoc example of a forbidden `@ts-expect-error` reason: `TODO: add reason`. Same #1485 guard.                                            | None — regression-test fixture, not debt   | N/A      | Reviewed, kept (intentional documentation) |
| `packages/sdk/src/__tests__/no-ts-suppressions.test.ts:60` | Regex `/^TODO/i` in the guard that rejects placeholder suppression reasons. Executable test code, not a comment.                         | None — regression-test assertion, not debt | N/A      | Reviewed, kept                             |
| `packages/sdk/src/__tests__/no-ts-suppressions.test.ts:62` | Regex `/^FIXME/i` in the same guard. Executable test code, not a comment.                                                                | None — regression-test assertion, not debt | N/A      | Reviewed, kept                             |

There are no actionable `TODO`/`FIXME` comments in `packages/*` or `contracts`.
The four matches above are all part of a test that deliberately rejects
placeholder markers; removing or renaming them would weaken the guard.

## Related debt discovered during the cleanup

| Location                                                               | Description                                                                                                                                                                                                                                                                                        | Proposed issue title                                                     | Priority |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | -------- |
| `packages/api/src/__tests__/contract/sdk-api-contract.test.ts:239-269` | The API `Worker` response intentionally diverges from `@bluecollar/types#Worker` (PII fields stripped, `images` instead of `portfolioImages`). The type-level assertion was previously a commented-out statement; it is now prose in the `KNOWN DRIFT` test. Needs a real reconciliation decision. | Reconcile `Worker` response shape with `@bluecollar/types` (KNOWN DRIFT) | Medium   |

## Commented-out code removed (#1890)

| Location                                                           | Description                                                                                                                     | Disposition                                       |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `packages/app/src/__tests__/PaymentButton.component.test.tsx:201`  | Dead `expect(container).toHaveNoViolations()` line (vitest-axe not configured); the explanatory note and role assertion remain. | Removed; unused `container` binding also dropped  |
| `packages/api/src/__tests__/contract/sdk-api-contract.test.ts:270` | Dead `assertAssignableTo<Worker>(serialized)` line; it cannot compile due to the documented type drift.                         | Removed; replaced with prose explaining the drift |
| `docs/api-contract-testing.md:51`                                  | Documentation claimed a `// TODO` marker tracked the drift; no such marker existed after the code cleanup.                      | Reworded to point at the `KNOWN DRIFT` test       |

Explanatory comments, JSDDoc usage examples, section headers, and comments that
document intentional behavior were reviewed and kept.

## Prevention

`eslint-base-rules.js` now applies `no-warning-comments`
(`terms: ['TODO', 'FIXME']`, `location: 'start'`) at `warn` level through the
shared `baseRules` object, which all five package ESLint configs spread. New
markers surface as warnings instead of silently accumulating; any future marker
must carry an issue reference and be added to this inventory until resolved.
