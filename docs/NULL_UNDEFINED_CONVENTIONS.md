# Null / Undefined Handling Conventions

> **TL;DR** — prefer `undefined` over `null` for optional values in all TypeScript
> service, utility, and controller code. Use `null` only where the database, an
> external library, or an explicit API contract requires it.

---

## Convention

### 1. Prefer `undefined` for absent optional values

```ts
// ✅ Good — optional parameter
function greet(name?: string) {
  return `Hello, ${name ?? 'World'}`
}

// ✅ Good — absent value in a service return
interface UserProfile {
  bio?: string            // absent = undefined
}

// ❌ Avoid — unnecessary null
let cursor: string | null = null  // use: let cursor: string | undefined
```

### 2. Use `null` only for these exceptions

| Case | Reason | Example |
|---|---|---|
| **Prisma ORM fields** | Prisma generates `null` for nullable DB columns | `user.avatar` → `string \| null` |
| **JSON serialisation** | JSON has `null` but not `undefined`; some API contracts require it | `{ "bio": null }` |
| **Third-party library types** | You do not control the return type | `jwt.verify` may return `null` |
| **Explicit reset-to-null DB writes** | Writing `null` to a DB column to clear it | `{ resetToken: null }` in `userRepository.update` |

### 3. Nullish coalescing and optional chaining

Prefer `??` over `|| ` for null/undefined checks (avoids falsy-value pitfalls):

```ts
// ✅
const limit = opts.limit ?? 20

// ❌ (treats 0 and '' as absent)
const limit = opts.limit || 20
```

---

## ESLint enforcement

An ESLint rule in `packages/api/.eslintrc.json` warns when `null` is assigned to
a variable or used as a right-hand side in service/util code:

```
no-restricted-syntax: Prefer `undefined` over `null` for optional values …
```

**Suppressing the rule for a known exception:**

```ts
// eslint-disable-next-line no-restricted-syntax
const resetToken: string | null = null  // Prisma DB column reset
```

---

## High-traffic modules refactored (issue #1073)

The following modules were audited and updated to prefer `undefined`:

| Module | Change |
|---|---|
| `packages/api/src/services/auth.service.ts` | Internal error state vars use `undefined`; Prisma column writes keep `null` |
| `packages/api/src/services/user.service.ts` | Optional function params use `undefined` |
| `packages/api/src/services/category.service.ts` | Service method return types use `T \| undefined` internally |
| `packages/api/src/container/types.ts` | Interface optional fields use `?:` (implies `undefined`) |

---

## Remaining exceptions (tracked for follow-up)

1. **`packages/types/src/index.ts`** — API response DTOs use `string | null` for
   fields that originate from Prisma and are sent directly to clients (e.g.
   `Worker.avatar?: string | null`). Changing these would be a breaking API
   contract change and is deferred.

2. **`packages/api/src/services/auth.service.ts`** — Calls like
   `{ resetToken: null, verificationToken: null }` in Prisma `update` calls must
   stay as `null` to write NULL to the database column.

3. **`packages/app/src/`** — Frontend code is outside the ESLint scope of the API
   package rule. A separate `.eslintrc` update for the app package is deferred.

---

## Acceptance criteria (issue #1073)

- [x] Convention defined in this document
- [x] ESLint rule added to `packages/api/.eslintrc.json`
- [x] High-traffic service modules reviewed and updated
- [x] Exceptions documented above
