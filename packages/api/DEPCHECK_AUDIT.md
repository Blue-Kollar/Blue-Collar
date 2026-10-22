# Dependency audit — Issue #1355

Audit of `packages/api` dependencies against actual usage in `src/`, to
find leftovers from removed features (old queue libraries, deprecated SDK
versions) that add install size and security-scan noise.

## Method

- Enumerated every entry in `dependencies` and `devDependencies`.
- Grepped `packages/api/src/**/*.ts` for `import ... from '<pkg>'` /
  `require('<pkg>')` for each one, plus config-file references (e.g. pino
  transport targets referenced by string, not `import`).
- Specifically checked for classic "replaced but not removed" patterns:
  legacy queue libraries alongside BullMQ (`bull`, `kue`, `bee-queue`,
  `agenda`), an old AWS SDK v2 alongside a v3 client, and duplicate
  Stellar/Soroban SDK packages. None of these were present in
  `package.json` to begin with.
- Attempted an automated `npx depcheck` run as a cross-check; it did not
  produce usable output in this environment, so results below are from the
  manual grep-based audit above.

## Result

Every dependency in both `dependencies` and `devDependencies` has at least
one real call site in `src/` (including ones that look unused at a glance,
e.g. `pino-pretty` — referenced only as a string `target:` in the pino
transport config in `src/config/logger.ts`, not via `import`). No
dependency was confidently zero-usage, so none were removed outright.

## Retained-with-justification (previously looked suspicious)

| Package | Why it looks unused | Why it's kept |
|---|---|---|
| `pino-pretty` | No `import` statement anywhere | Loaded by pino via a string `target` in `src/config/logger.ts` and `src/middleware/requestLogger.ts` for pretty-printed dev logs |
| `v8-profiler-next` | Only referenced from one file | `src/monitoring/profiler.ts` uses it for on-demand CPU/heap profiling |
| `node-vault` | Only referenced from one file | `src/services/vault.ts` wraps it for secret retrieval |
| `rate-limit-redis` | Only referenced from one file | `src/middleware/versionRateLimit.ts` uses its `RedisStore` for distributed rate limiting |

## Fix applied

`@types/swagger-ui-express` was listed under `dependencies` instead of
`devDependencies`. It's a type-only package (no runtime code), so shipping
it as a production dependency needlessly increases install size and
security-scan surface for something never present in the built output.
Moved it to `devDependencies`, where `@types/*` packages belong.

## Verification

Not run per task instructions (no build/test step performed as part of
this change). Since the only change is moving a type-only package between
dependency sections — no version change, no runtime import touched — this
carries effectively no risk to boot or test behavior, but should still be
confirmed with a normal install + `pnpm build` / `pnpm test` before merge.
