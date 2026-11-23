# API Versioning Strategy

> Issue #748 — BlueCollar API versioning policy, lifecycle, and migration guide.

## URL Structure

All API routes are served under an explicit version prefix:

```
/api/v1/<resource>
/api/v2/<resource>
```

Unversioned `/api/<resource>` paths respond with a `301 Permanent Redirect` to `/api/v1/<resource>` and include deprecation headers:

```
Deprecation: true
Warning: 299 - "Unversioned API path is deprecated. Use /api/v1/* instead."
Sunset: Sat, 01 Jan 2027 00:00:00 GMT
```

Clients **must** migrate to versioned URLs before the sunset date.

## Version Detection

The server resolves the API version in this order:

1. **URL path** — `/api/v1/`, `/api/v2/`
2. **`Accept-Version` header** — `Accept-Version: v2`
3. **Default** — falls back to `v2` (current)

The resolved version is echoed back in every response via the `X-API-Version` header.

## Version Lifecycle

| Phase          | Description                                          | SLA                      |
| -------------- | ---------------------------------------------------- | ------------------------ |
| **Current**    | Actively maintained, receives features and fixes     | Full support             |
| **Stable**     | No new features; security and critical fixes only    | ≥ 12 months notice       |
| **Deprecated** | End-of-life announced, `Deprecation` headers emitted | ≥ 6 months sunset window |
| **Sunset**     | Version removed; requests receive `410 Gone`         | —                        |

### Current versions

| Version | Status  | Sunset date        |
| ------- | ------- | ------------------ |
| `v1`    | Stable  | TBD (≥ 2027-01-01) |
| `v2`    | Current | —                  |

## Deprecation Headers

When a deprecated version is detected, the following headers are added to every response:

```
Deprecation: true
Sunset: <RFC 7231 date>
Warning: 299 - "API version v1 is deprecated. Migrate to v2."
```

## Per-Version Differences

### v1 vs v2 field changes

| Resource | v1 fields       | Added in v2          |
| -------- | --------------- | -------------------- |
| `worker` | Standard fields | `verificationStatus` |
| `user`   | Standard fields | `twoFactorEnabled`   |

### Authentication policies

| Version | JWT Bearer  | API Key    |
| ------- | ----------- | ---------- |
| `v1`    | ✅ Required | ✅ Allowed |
| `v2`    | ✅ Required | ❌ Removed |

Using an API key in v2 returns `401 Unauthorized`. Migrate to JWT Bearer tokens.

### Rate limits

| Version | Requests / minute |
| ------- | ----------------- |
| `v1`    | 100               |
| `v2`    | 150               |

## Per-Version Schema Validation

Request bodies are validated against the schema of the resolved version. Sending a field that does not exist in the target version returns:

```json
{
  "status": "error",
  "message": "Request payload contains fields that are not supported in this API version.",
  "errors": ["Invalid fields for worker in v1: verificationStatus"],
  "version": "v1",
  "code": 400
}
```

Use the `perVersionSchemaValidation(resourceType)` middleware from `src/utils/schemaVersioning.ts` on mutation routes.

## Version Discovery Endpoints

```
GET /api/version         → current versions summary
GET /api/v1/version      → v1 status + sunset
GET /api/v2/version      → v2 status + sunset
GET /api/v1/versions     → all versions with rate-limit & auth policies
GET /api/v2/versions     → same
```

## Migration Guide: v1 → v2

1. Update the base URL from `/api/v1/` to `/api/v2/`.
2. Remove all `Authorization: ApiKey <key>` headers; use `Authorization: Bearer <jwt>` instead.
3. Expect `verificationStatus` in worker responses.
4. Expect `twoFactorEnabled` in user responses.
5. Rate limit increases from 100 to 150 req/min — adjust retry logic accordingly.

## Support Window Policy

- New versions are announced at least **3 months** before release.
- Deprecated versions receive **at least 6 months** before sunset.
- Security patches are backported to the current and the most recent stable version.
