# API Reference

The canonical, machine-readable reference for the BlueCollar API is the OpenAPI 3.1
document checked into this package:

**[`openapi.json`](./openapi.json)**

## Browsing it

**Interactively (local dev):** run the API (`pnpm dev` from `packages/api`) and open:

- http://localhost:3000/api/v1/docs — Swagger UI for the current version (v1)
- http://localhost:3000/api/v2/docs — Swagger UI for v2
- http://localhost:3000/api/docs — Swagger UI for the unversioned/legacy surface

Each also serves the raw spec as JSON at the same path + `/openapi.json`
(e.g. `http://localhost:3000/api/v1/docs/openapi.json`). Swagger UI is only mounted
outside `NODE_ENV=production`/`test` — see `src/app.ts` — so in deployed environments
use the checked-in `openapi.json` or paste it into an external viewer
(e.g. https://editor.swagger.io).

**Statically:** open `openapi.json` in any OpenAPI-aware tool (Swagger Editor, Postman's
"Import" via OpenAPI, Redoc, an IDE plugin) or read it directly — every operation has a
`summary` and, where relevant, request/response schemas and a `security` requirement.

## How the spec is generated

The spec is generated from code, not written by hand as raw JSON:

- `src/openapi/registry.ts` — shared, reusable schemas (Error, Success, User, Worker, …)
  and the `bearerAuth` security scheme.
- `src/openapi/spec.ts` + `src/openapi/paths/*.ts` — one `registry.registerPath(...)`
  call per endpoint, grouped by domain (auth, workers, wallet, escrow, …). Most reuse
  the same Zod schemas the route's `validate(...)` middleware uses, so the documented
  request shape and the enforced one can't drift apart for validated routes.
- `src/openapi/spec-versioned.ts` — derives the `/api/v1/docs` and `/api/v2/docs`
  variants from the same source spec (v2 is the v1 document with `/api/v1/` path
  prefixes swapped for `/api/v2/`), rather than maintaining a second, separately
  hand-written registry.
- `npm run openapi:generate` (`src/scripts/generate-openapi.ts`) — writes the current
  spec to `openapi.json`.

To document a new endpoint: add a `registry.registerPath(...)` call in the relevant
`src/openapi/paths/<domain>.ts` file (create one for a new domain, following the
existing files as a template), then run `npm run openapi:generate` and commit the
updated `openapi.json`.

### Keeping it in sync

`src/__tests__/openapi-sync.test.ts` runs in CI on every change under `packages/api/src/**`
(via the existing `api-tests.yml` workflow) and fails the build if:

1. Any route mounted in `app.ts` has no corresponding `openapi.json` entry, or
2. `openapi.json` doesn't match what `buildSpec()` currently produces (i.e. someone
   edited a `paths/*.ts` file without re-running `openapi:generate`).

## Authentication

See [AUTHENTICATION.md](./AUTHENTICATION.md) for the full login/refresh/2FA/OAuth flow.
Authenticated endpoints expect `Authorization: Bearer <jwt>`; this is declared per-operation
in the spec via the `bearerAuth` security scheme.

## Versioning

See [API_VERSIONING.md](./API_VERSIONING.md). In short: use `/api/v1/*` (or `/api/v2/*`
where noted); the unversioned `/api/*` prefix is deprecated.

## The `X-HTTP-Method` override pattern

Browsers' `multipart/form-data` requests (used for file uploads, e.g. avatars, worker
photos, portfolio images) can only be sent as `GET` or `POST`. To update a resource with
an attached file using `PUT`/`PATCH` semantics, send a `POST` with an
`X-HTTP-Method: PUT` (or `PATCH`) header — the `method-override` middleware
(`src/app.ts`) rewrites `req.method` before your route handler runs.

```bash
curl -X POST http://localhost:3000/api/v1/workers/123 \
  -H "Authorization: Bearer <jwt>" \
  -H "X-HTTP-Method: PUT" \
  -F "name=Updated Name" \
  -F "avatar=@avatar.jpg"
```

This applies wherever a route accepts both a JSON body and a `multipart/form-data`
upload for the same logical update (e.g. `PUT /workers/{id}`, portfolio item updates).
The affected operations are documented in `openapi.json`.

## Other artifacts in this package

- [`CURL_EXAMPLES.md`](./CURL_EXAMPLES.md) — worked `curl` examples for common flows.
- [`POSTMAN_COLLECTION.json`](./POSTMAN_COLLECTION.json) — importable Postman collection
  (hand-maintained; may lag `openapi.json` — prefer the OpenAPI spec as the source of truth).
- [`RESPONSE_FORMAT.md`](./RESPONSE_FORMAT.md) — the `{ status, code, data|message }`
  response envelope used across endpoints.
