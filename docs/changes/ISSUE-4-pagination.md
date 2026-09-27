# Issue 4 — Standardize pagination contract across list endpoints

## Inventory (as found in `controllers/`)

| Endpoint(s) | Params | Notes |
|---|---|---|
| jobs, bookmarks, disputes, notifications, messages, reviews, verifications, webhooks, admin-audit, admin-users, admin-workers, audit, bookings, escrow | `page` / `limit` | Majority shape. Defaults and clamping duplicated ad hoc in every controller (`Number(x ?? default)`, `parseInt(x) || default`, `Math.min(x, cap)`, all written slightly differently). |
| `indexer.ts` (`GET /api/events`) | `limit` / `offset` | The one true offset-based outlier — `?limit=50&offset=0` instead of `page`. |
| `workers.ts` geo search | `cursor` (no `page`) in "cursor-paginated mode", vs. `page`/`lat`/`lng` in "geo-radius mode" — two different contracts on the *same* endpoint depending on query shape | Already partially cursor-based; the most write-heavy list endpoint (worker search) is the strongest candidate to standardize fully onto cursors. |
| `wallet.ts`, `analytics.ts`, `recommendations.ts` | `limit` only, no `page` | Effectively "top N", not true pagination — left out of scope. |

**Conclusion:** the dominant contract is page/limit, with one offset-based
outlier (`indexer.ts`) and one endpoint (`workers.ts`) already half-migrated
to cursors. Per the issue's own recommendation, cursor-based is the better
fit for high-write tables (jobs, worker search) since offset pagination
skips/duplicates rows under concurrent inserts.

## What changed in this pass

Given the size of a full migration (15+ endpoints, `1-2 days` per the
issue's own estimate), this pass establishes the shared contract and fully
migrates one representative high-write endpoint (`jobs`) rather than
touching every controller:

- `utils/pagination.ts`: `PaginationMeta` now always includes `nextCursor`
  and `hasMore` alongside the existing `total`/`page`/`limit`/`pages`, so
  every endpoint using `buildPaginationMeta`/`createPaginationHelper` gets
  the same response shape. Added `encodeCursor`/`decodeCursor` (opaque,
  base64url-encoded `{id, createdAt}`) and cursor parsing in
  `createPaginationHelper`. `page`/`limit` query params keep working
  unchanged — `cursor` is purely additive.
- `controllers/jobs.ts`: `listJobs`, `myPostedJobs`, `myApplications` now
  parse pagination via `parsePaginationParams` instead of ad hoc
  `Number(x ?? default)`, and accept (but don't yet require) `cursor`.
- `services/job.service.ts`: the three job list operations now build their
  `meta` via `buildPaginationMeta`, so `GET /api/v1/jobs`,
  `/jobs/me/posted`, and `/jobs/me/applications` all return the same
  `{ total, page, limit, pages, nextCursor, hasMore }` shape.
- `openapi/spec.ts`: `jobQuerySchema` gained `cursor`; the jobs-list
  response schema now references a shared `paginationMetaSchema` matching
  the new meta shape. `openapi.json` is generated
  (`npm run generate:openapi` / `scripts/generate-openapi.ts`) and wasn't
  regenerated here per the "don't build" constraint — regenerating it is a
  follow-up before merge.
- Added `utils/pagination.test.ts` covering param parsing/clamping,
  skip/take math, cursor encode/decode round-trip, and `buildPaginationMeta`
  behavior (with/without a last record, last page vs. not).

## Follow-up (not done here)

- Migrate the remaining `page`/`limit` controllers listed above onto
  `parsePaginationParams`/`buildPaginationMeta` (mechanical, low-risk,
  mostly deleting duplicated clamping logic).
- Convert `indexer.ts` from `offset` to the standard contract (breaking
  unless done with a backwards-compatible `offset` fallback, per the
  issue's acceptance criteria).
- Fully unify `workers.ts` geo search onto cursor mode instead of two
  parallel pagination contracts on one endpoint.
- Regenerate `openapi.json` and add per-endpoint OpenAPI request tests once
  more endpoints are migrated.
