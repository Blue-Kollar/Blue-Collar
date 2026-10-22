# Issue 1 — Consolidate duplicate serializer field-shaping logic

## What changed

- `serializers/base.serializer.ts` gained two composable helpers so resource
  serializers stop re-implementing the same patterns:
  - `embed(key, relation, serializer)` — conditionally nests a related
    record's serialized form, replacing the repeated
    `...(x ? { key: serializer.serialize(x) } : {})` spread that appeared in
    both `worker.serializer.ts` and `review.serializer.ts`.
  - `pick(record, keys)` — narrows an already-serialized record to a fixed
    field set, used to derive summary shapes from full shapes instead of
    re-deriving each field by hand.
- `worker.serializer.ts` and `review.serializer.ts` were updated to call
  `this.embed(...)` instead of duplicating the conditional-spread pattern.
- Added `serializers/job.serializer.ts` with `JobSerializer` (full shape) and
  `JobSummarySerializer` (list/search shape). The summary serializer is
  composed on top of the full serializer via `pick()`, so the two never
  drift on *how* a field is derived — only on *which* fields are kept. This
  is the concrete "job vs. job summary" consolidation called out in the
  issue; previously job records were returned to clients unserialized
  (raw Prisma rows) directly from `controllers/jobs.ts`.
- Exported the new serializer from `serializers/index.ts`.
- Added output-shape tests (`serializers/serializers.test.ts`) for
  `JobSerializer` and `JobSummarySerializer`: relation embedding, omission
  when relations aren't loaded, exact summary field set, and collection
  serialization.

## Audit notes

- No serializer in `serializers/` had zero call sites, so none were removed.
- `worker.serializer.ts` and `review.serializer.ts` were the two existing
  serializers with overlapping "embed a relation if present" logic; both now
  share `BaseSerializer.embed`.

## Follow-up (not done here, out of scope for this pass)

- `controllers/jobs.ts` still returns raw service output rather than piping
  through `jobSerializer` / `jobSummarySerializer`. Wiring that in is a
  separate, slightly riskier change (touches response shape for the jobs
  list/detail endpoints) and should land with its own test pass against the
  live routes.
