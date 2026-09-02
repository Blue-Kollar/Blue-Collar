# TypeScript Strict Mode Migration Note — Issue #1288

## Summary

This document describes the outcome of enabling TypeScript strict mode across all shared packages as part of issue [#1288].

## Findings

**`strict: true` was already present in every package's `tsconfig.json` before this issue was
addressed.** No tsconfig changes were required. The audit confirmed:

| Package              | `strict: true` before #1288 |
|----------------------|:--------------------------:|
| `packages/types`     | ✅ already set             |
| `packages/sdk`       | ✅ already set             |
| `packages/api`       | ✅ already set             |
| `packages/app`       | ✅ already set             |
| `packages/mobile`    | ✅ already set             |
| `packages/monitoring`| ✅ already set             |
| `packages/test-utils`| ✅ already set             |

## Type Errors Fixed

Enabling strict checking surfaced several pre-existing errors that were fixed as part of this work:

### `packages/sdk`

- **`sdk.e2e.test.ts` lines 53 and 454**: `afterEach(() => vi.restoreAllMocks())` returned
  `VitestUtils` instead of `void`. Fixed by wrapping in a block: `afterEach(() => { vi.restoreAllMocks() })`.

  Root cause: `vi.restoreAllMocks()` returns the `VitestUtils` chain, which is not assignable to
  Vitest's `Awaitable<void>` callback type.

### `packages/types`

- **`index.ts` — `AuthUser`**: `interface AuthUser extends User {}` is an empty interface, flagged
  by `@typescript-eslint/no-empty-object-type`. Converted to a type alias:
  ```ts
  export type AuthUser = User
  ```
  This is a **non-breaking change** for consumers — `type AuthUser = User` is structurally
  identical to the empty extending interface for all practical use.

- **`index.ts` — `UpdateWorkerDTO`**: Same pattern. `interface UpdateWorkerDTO extends Partial<CreateWorkerDTO> {}` 
  converted to:
  ```ts
  export type UpdateWorkerDTO = Partial<CreateWorkerDTO>
  ```

- **`__tests__/regression.shared-types.test.ts` line 152**: Useless escape `[\{<]` in a regex
  character class — `\{` has no special meaning inside `[]`. Fixed to `[{<]`.

- **`__tests__/regression.shared-types.test.ts` line 14**: `vi` was imported from `vitest` but
  never called anywhere in the file. Removed to silence the `@typescript-eslint/no-unused-vars`
  warning surfaced by the shared ESLint config (#1289).

## Pre-existing Type Debt (out of scope)

`packages/api` has ~150+ pre-existing type errors across controllers, services, and tests. These
errors **existed before this issue** and are **not caused by enabling strict mode** (which was
already on). They are the result of accumulated divergence between the Prisma schema and
controller/service code, and stale test fixtures. A separate issue should be opened to track the
`packages/api` strict-mode cleanup.

## Migration Guide for Consumers of `@bluecollar/types`

### `AuthUser`

Before (interface extending empty):
```ts
export interface AuthUser extends User {}
```

After (type alias):
```ts
export type AuthUser = User
```

**Impact:** None. Type aliases and empty-extending interfaces behave identically for structural
typing. You can use `AuthUser` exactly as before. If you were checking `instanceof AuthUser`
(which is not valid for interfaces/types anyway), that was already broken.

### `UpdateWorkerDTO`

Before:
```ts
export interface UpdateWorkerDTO extends Partial<CreateWorkerDTO> {}
```

After:
```ts
export type UpdateWorkerDTO = Partial<CreateWorkerDTO>
```

**Impact:** None. Same structural type.

## Downstream Build Status

| Package  | `tsc --noEmit` after #1288 | Notes |
|----------|:-------------------------:|-------|
| `types`  | ✅ clean                  | 0 errors |
| `sdk`    | ✅ clean                  | 0 errors (2 fixed) |
| `api`    | ❌ pre-existing errors    | ~150 errors unrelated to #1288 |
| `app`    | ✅ clean                  | 0 errors |

## Related Issues

- `#1289` — Shared ESLint config (see `eslint-base-rules.js`)
- `#1290` — Remove commented-out / dead code (no dead blocks found)
