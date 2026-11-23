# BlueCollar API Migration Guide

This document provides guidance for integrating with and migrating between BlueCollar API versions.

## Overview

The BlueCollar API uses **URL path versioning** with support for multiple concurrent versions:

- **Current version**: `v2`
- **Supported versions**: `v1`, `v2`
- **Deprecated versions**: None (as of this release)

## Quick Start

### Using v2 (Current)

```bash
# Authenticate and get a token
curl -X POST https://api.bluecollar.app/api/v2/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password"}'

# List workers with v2
curl -X GET https://api.bluecollar.app/api/v2/workers \
  -H "X-API-Version: v2"
```

### Using v1 (Legacy)

```bash
# List workers with v1
curl -X GET https://api.bluecollar.app/api/v1/workers \
  -H "X-API-Version: v1"
```

## Version Differences

### Worker Resource

**v1 Fields:**

- `id`, `name`, `phone`, `email`, `bio`
- `isActive`, `walletAddress`
- `avgRating`, `reviewCount`, `categoryId`
- `createdAt`, `updatedAt`

**v2 Changes:**

- **Added**: `verificationStatus` (enum: `unverified`, `pending`, `verified`)
- All v1 fields are backward compatible

**Migration Example:**

```javascript
// v1 response
{
  "status": "success",
  "data": {
    "id": "worker-123",
    "name": "John Plumber",
    "verificationStatus": undefined  // Not present in v1
  }
}

// v2 response (same worker)
{
  "status": "success",
  "data": {
    "id": "worker-123",
    "name": "John Plumber",
    "verificationStatus": "verified"  // New in v2
  }
}
```

### User Resource

**v1 Fields:**

- `id`, `email`, `firstName`, `lastName`
- `role`, `verified`

**v2 Changes:**

- **Added**: `twoFactorEnabled` (boolean)
- All v1 fields are backward compatible

## Deprecation Policy

### Current Schedule

- **v1**: No sunset date (currently stable)
- **v2**: Current version (recommended)

Deprecation warnings will be announced **12 months** before any version is retired.

### Headers

All responses include version information:

```
X-API-Version: v2
Deprecation: false
```

When a version is deprecated:

```
X-API-Version: v1
Deprecation: true
Sunset: Sat, 01 Jan 2027 00:00:00 GMT
Warning: 299 - "API version v1 is deprecated. Migrate to v2."
```

## Rate Limiting by Version

Different versions have different rate limits:

| Version | Requests | Window |
| ------- | -------- | ------ |
| v1      | 100      | 1 min  |
| v2      | 150      | 1 min  |

See current limits at:

```bash
curl https://api.bluecollar.app/api/v1/versions
curl https://api.bluecollar.app/api/v2/versions
```

## Authentication Policies

### v1 Authentication

- JWT (Bearer token) **required**
- API keys **allowed** (deprecated, will be removed)

### v2 Authentication

- JWT (Bearer token) **required**
- API keys **not allowed**

If migrating from v1 API key auth:

```javascript
// v1: Works with API key
const headers = {
  Authorization: `ApiKey ${apiKey}`,
};

// v2: Must use JWT
const headers = {
  Authorization: `Bearer ${jwtToken}`,
};
```

## Migration Checklist

### Before Migrating from v1 to v2

- [ ] Update all API endpoints from `/api/v1/` to `/api/v2/`
- [ ] If using API keys, migrate to JWT authentication
- [ ] Update response parsing to handle `verificationStatus` field on workers
- [ ] Update user response parsing for `twoFactorEnabled` field
- [ ] Review rate limits (v2 allows 150 req/min vs v1's 100 req/min)
- [ ] Test all endpoints in staging environment
- [ ] Update API documentation/clients for your team

### Code Examples

**JavaScript/Node.js**

```javascript
// Before (v1)
async function getWorkers() {
  const response = await fetch('https://api.bluecollar.app/api/v1/workers', {
    headers: {
      'X-API-Version': 'v1',
    },
  });
  return response.json();
}

// After (v2)
async function getWorkers() {
  const response = await fetch('https://api.bluecollar.app/api/v2/workers', {
    headers: {
      'X-API-Version': 'v2',
    },
  });
  const data = response.json();
  // Handle new verificationStatus field
  return data;
}
```

**Python**

```python
# Before (v1)
import requests

workers = requests.get(
    'https://api.bluecollar.app/api/v1/workers',
    headers={'X-API-Version': 'v1'}
).json()

# After (v2)
workers = requests.get(
    'https://api.bluecollar.app/api/v2/workers',
    headers={'X-API-Version': 'v2'}
).json()

# Access new verificationStatus
for worker in workers['data']:
    print(f"{worker['name']}: {worker['verificationStatus']}")
```

**cURL**

```bash
# Before (v1)
curl https://api.bluecollar.app/api/v1/workers \
  -H "Authorization: Bearer $JWT" \
  -H "X-API-Version: v1"

# After (v2)
curl https://api.bluecollar.app/api/v2/workers \
  -H "Authorization: Bearer $JWT" \
  -H "X-API-Version: v2"
```

## API Documentation

Version-specific OpenAPI documentation is available at:

- **v1**: `https://api.bluecollar.app/api/v1/docs`
- **v2**: `https://api.bluecollar.app/api/v2/docs`
- **Latest**: `https://api.bluecollar.app/api/docs`

## Support for Multiple Versions

If you need to maintain compatibility with both v1 and v2 clients:

```javascript
function getWorkers(version = 'v2') {
  const baseUrl = `https://api.bluecollar.app/api/${version}`;
  return fetch(`${baseUrl}/workers`, {
    headers: {
      'X-API-Version': version,
      Authorization: `Bearer ${token}`,
    },
  }).then((r) => r.json());
}

// Both work
const v1Workers = await getWorkers('v1');
const v2Workers = await getWorkers('v2');
```

## Version Sunset Process

When a version approaches deprecation:

1. **Announcement** (12 months before sunset)
   - Deprecation header added
   - Warning emails sent to API integrators

2. **Grace Period** (11 months)
   - Old version continues to function
   - Requests succeed with deprecation headers

3. **Final Notice** (1 month before sunset)
   - Additional reminders sent
   - Documentation updated

4. **Retirement**
   - Endpoint returns 410 Gone
   - Clients must update to current version

## Getting Help

- **Documentation**: `/api/docs` or `/api/v2/docs`
- **Status**: `/api/ready` (health check)
- **Version Info**: `/api/version` or `/api/v2/versions`
- **Issues**: https://github.com/Blue-Kollar/Blue-Collar/issues

## Common Errors

### 400: Invalid Version

```json
{
  "status": "error",
  "message": "Invalid API version",
  "code": 400
}
```

**Solution**: Check that the version in the URL path matches a supported version.

### 429: Rate Limited

```json
{
  "status": "error",
  "message": "Too many requests for v1",
  "code": 429
}
```

**Solution**: Implement exponential backoff. Check rate limits with `/api/v1/versions`.

### 401: Unauthorized (v2)

```json
{
  "status": "error",
  "message": "Invalid authorization",
  "code": 401
}
```

**Solution**: v2 requires JWT. Ensure you're using Bearer token, not API key.

## Gradual Rollout

When deploying v2 clients:

1. Deploy v2 client code alongside v1 support
2. Route a small percentage of requests to v2 (canary deployment)
3. Monitor metrics for both versions
4. Gradually increase v2 traffic
5. Once v2 reaches 100%, deprecate v1

## Version Compatibility Matrix

| Client         | Supports | Current | Notes               |
| -------------- | -------- | ------- | ------------------- |
| Browser App    | v1, v2   | v2      | Auto-updates        |
| Mobile App     | v1, v2   | v1      | Plan to upgrade     |
| Partner API    | v1       | v1      | Should migrate soon |
| Internal Tools | v2       | v2      | Already updated     |

## Feedback

Have feedback on versioning strategy? [Open an issue](https://github.com/Blue-Kollar/Blue-Collar/issues/new)
