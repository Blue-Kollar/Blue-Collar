# API Contract Testing

> Issue: #1268 — Add API contract tests validating response shapes against
> `packages/types`

This document explains the API contract tests that prevent backend response
shapes from silently drifting away from the shared types in `@bluecollar/types`.

## What an API contract test is

A contract test asserts that what the API **actually returns** matches the
**agreed response shape**. Here the contract is the set of entity/response
types that frontend, mobile and SDK consumers depend on. If a serializer
renames, drops, or mistypes a field, the contract test fails — catching the
drift at test time instead of in production clients.

## Covered endpoints / entities

The serializers are exactly what the route controllers return, so validating
them validates the real endpoint responses. The following high-value entities
are covered:

| Entity | Serializer | Contract schema |
|---|---|---|
| `Category` | `serializers/category.serializer.ts` | `CategorySchema` |
| `User` (sanitised) | `serializers/user.serializer.ts` | `SerializedUserSchema` |
| `Review` (with author) | `serializers/review.serializer.ts` | `SerializedReviewSchema` |
| `Worker` | `serializers/worker.serializer.ts` | `SerializedWorkerSchema` |
| `AccountInfo` (Stellar wallet) | controller output | `AccountInfoSchema` |
| List responses | — | `PaginatedSchema(...)` + `ApiEnvelopeSchema` |

Endpoints consumed by these entities include `GET /api/categories`,
`GET /api/workers`, `GET /api/workers/:id`, `GET /api/workers/:id/reviews`,
`GET /api/auth/me`, `GET /api/wallet/account/:publicKey`, etc.

## How the response is validated (runtime, not just compile time)

`packages/api/src/__tests__/contract/responseSchemas.ts` defines **zod**
schemas that mirror the real response shapes. `packages/api/src/__tests__/contract/apiContract.test.ts`
runs the real serializers against representative fixtures and validates the
output with `schema.safeParse(...)`.

- This is **runtime** validation — it catches a renamed/removed/retyped field,
  not just a TypeScript compile error.
- `@bluecollar/types` is the canonical source. The schemas follow the shared
  types for every entity whose API response matches them (`Category`, `User`,
  `Review`, `AccountInfo`, the envelope). Where the live response diverges
  from `@bluecollar/types` (notably `Worker`, which intentionally strips the PII
  fields `phone`/`email` and emits an `images` object instead of
  `portfolioImages`), the schema mirrors the **actual** serializer output — that
  is what clients receive — and a `// TODO` tracks reconciling `@bluecollar/types`.

## How a shape mismatch causes the test to fail

`apiContract.test.ts` includes explicit negative tests:

```ts
// Missing required field → contract violated
expect(SerializedWorkerSchema.safeParse({ name: 'No id', isVerified: true, isActive: true }).success).toBe(false)
// Wrong type → contract violated
expect(SerializedWorkerSchema.safeParse({ ...worker, isVerified: 'yes' }).success).toBe(false)
// Missing envelope status code → contract violated
expect(ApiEnvelopeSchema.safeParse({ status: 'success', data: {} }).success).toBe(false)
```

If a serializer changes a field's type or removes a required field, the
corresponding `safeParse` returns `{ success: false }` and the test fails.

## How to add a contract test for a new endpoint

1. Add a zod schema to `responseSchemas.ts` for the new entity/response. Mirror
   the real serializer output and reference the matching `@bluecollar/types`
   type for field names.
2. Add a `describe` block to `apiContract.test.ts` that builds a representative
   fixture, runs the real serializer (or controller output), and asserts
   `schema.safeParse(result).success === true`.
3. Add a negative case if the shape has critical required fields.
4. Run:

```bash
pnpm --filter @bluecollar/api test:contract
```

The suite is pure (no DB / network) and runs as part of the API test workflow.

## Why serializers and not a live `supertest` call

The full Express `app` requires a database connection, which is not available in
every local/CI context. Validating the serializers directly exercises the exact
objects the controllers return, so it is deterministic, fast, and still catches
response-shape drift. (A `supertest` variant can be layered on later by mocking
the data layer if end-to-end envelope validation is desired.)
