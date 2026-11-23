# API Versioning Strategy

## Overview

BlueCollar uses **URL-based versioning** (`/api/v1/*`) to maintain backward compatibility while allowing the API to evolve.

## Current Versions

| Version | Base Path   | Status        | Sunset Date |
| ------- | ----------- | ------------- | ----------- |
| v1      | `/api/v1/*` | ✅ Current    | —           |
| —       | `/api/*`    | ⚠️ Deprecated | 2027-01-01  |

## Using the API

All new integrations should use the versioned base path:

```
https://api.bluecollar.app/api/v1/workers
https://api.bluecollar.app/api/v1/auth/login
```

## Deprecation Warnings

Requests to unversioned paths (`/api/*`) receive the following response headers:

```
Deprecation: true
Warning: 299 - "Unversioned API path is deprecated. Use /api/v1/* instead."
Sunset: Sat, 01 Jan 2027 00:00:00 GMT
X-API-Version: v1
```

## Version Discovery

```
GET /api/versions
```

Returns the current version, supported versions, and deprecation info.

## Introducing a New Version (v2)

1. Create new route files in `src/routes/v2/` (or modify existing routes with version-specific logic).
2. Mount them in `app.ts`:
   ```ts
   app.use('/api/v2/workers', v2WorkerRoutes);
   ```
3. Update `/api/versions` to include `v2` in `supported` and move `v1` to `deprecated`.
4. Set a `Sunset` date for v1 and add `deprecationWarning` middleware to v1 routes.

## Version Middleware

- `versionMiddleware` — attaches `req.apiVersion` and sets `X-API-Version` response header.
- `deprecationWarning` — adds `Deprecation`, `Warning`, and `Sunset` headers to deprecated paths.

Both are in `src/middleware/version.ts`.
