# API Response Format

All Blue-Collar API endpoints return JSON responses with a consistent structure. This document covers success responses, error responses, paginated responses, and includes cURL examples for each.

---

## Table of Contents

- [Success Responses](#success-responses)
- [Error Responses](#error-responses)
- [Paginated Responses](#paginated-responses)
- [Authentication Responses](#authentication-responses)

---

## Success Responses

### Structure

```json
{
  "status": "success",
  "code": 200,
  "message": "Optional human-readable message",
  "data": {}
}
```

| Field     | Type                | Required | Description                                                                     |
| --------- | ------------------- | -------- | ------------------------------------------------------------------------------- |
| `status`  | `"success"`         | Yes      | Always `"success"` for non-error responses                                      |
| `code`    | `number`            | Yes      | Mirrors the HTTP status code (`200`, `201`, `202`, etc.)                        |
| `data`    | `object` \| `array` | No       | The returned resource or collection; omitted for 204 and message-only responses |
| `message` | `string`            | No       | Present on action endpoints (login, verify, delete, etc.)                       |

### Single Resource — 200 OK

Returned when fetching an existing resource.

```json
{
  "status": "success",
  "code": 200,
  "data": {
    "id": "clx9abc123def456",
    "name": "Jane Muthoni",
    "bio": "Experienced electrician with 8 years in residential wiring.",
    "avatar": "https://cdn.example.com/avatars/jane.jpg",
    "phone": "+254712345678",
    "email": "jane@example.com",
    "walletAddress": "GBVZM...",
    "isActive": true,
    "isVerified": true,
    "stellarContractId": "CAABC...",
    "categoryId": "cat_01",
    "curatorId": "usr_curator_01",
    "locationId": "loc_01",
    "createdAt": "2024-03-15T10:00:00.000Z",
    "updatedAt": "2024-06-01T08:30:00.000Z",
    "category": {
      "id": "cat_01",
      "name": "Electrical"
    },
    "curator": {
      "id": "usr_curator_01",
      "email": "curator@example.com",
      "firstName": "Admin",
      "lastName": "User"
    }
  }
}
```

**cURL example:**

```bash
curl -X GET https://api.bluecollar.example.com/api/workers/clx9abc123def456 \
  -H "Authorization: Bearer <token>"
```

### Created Resource — 201 Created

Returned when a new resource is successfully created.

```json
{
  "status": "success",
  "code": 201,
  "data": {
    "id": "clx9newworker789",
    "name": "Peter Omondi",
    "bio": "Plumber specialising in commercial buildings.",
    "avatar": null,
    "phone": "+254798765432",
    "email": "peter@example.com",
    "walletAddress": null,
    "isActive": true,
    "isVerified": false,
    "stellarContractId": null,
    "categoryId": "cat_02",
    "curatorId": "usr_curator_01",
    "locationId": "loc_05",
    "createdAt": "2024-06-02T12:00:00.000Z",
    "updatedAt": "2024-06-02T12:00:00.000Z"
  }
}
```

**cURL example:**

```bash
curl -X POST https://api.bluecollar.example.com/api/workers \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Peter Omondi",
    "bio": "Plumber specialising in commercial buildings.",
    "phone": "+254798765432",
    "email": "peter@example.com",
    "categoryId": "cat_02",
    "locationId": "loc_05"
  }'
```

### Message-Only Response — 200 OK

Returned for action endpoints where no resource data needs to be returned (e.g. email verification, password reset).

```json
{
  "status": "success",
  "message": "Email verified successfully",
  "code": 200
}
```

**cURL example:**

```bash
curl -X PUT https://api.bluecollar.example.com/api/auth/verify-account \
  -H "Content-Type: application/json" \
  -d '{ "token": "<verification-token>" }'
```

### No Content — 204 No Content

Returned when a resource is deleted. The response body is empty.

**cURL example:**

```bash
curl -X DELETE https://api.bluecollar.example.com/api/workers/clx9abc123def456 \
  -H "Authorization: Bearer <token>"
```

---

## Error Responses

All errors follow one of two shapes depending on where they originate.

### Structure (General Errors)

```json
{
  "status": "error",
  "message": "Human-readable error description",
  "code": 404,
  "errorCode": "NOT_FOUND",
  "traceId": "abc123def456"
}
```

| Field             | Type      | Required | Description                                                                              |
| ----------------- | --------- | -------- | ---------------------------------------------------------------------------------------- |
| `status`          | `"error"` | Yes      | Always `"error"`                                                                         |
| `message`         | `string`  | Yes      | Human-readable description of what went wrong                                            |
| `code`            | `number`  | Yes      | HTTP status code                                                                         |
| `errorCode`       | `string`  | No       | Machine-readable error code (see [Error Codes](#error-codes) below)                      |
| `traceId`         | `string`  | No       | OpenTelemetry trace ID; present in production for debugging with the observability stack |
| `stack`           | `string`  | No       | Stack trace — development environment only                                               |
| `originalMessage` | `string`  | No       | Underlying error message — development environment only                                  |

### Structure (Validation Errors)

Validation failures from the Zod middleware include a field-level `errors` map instead of `errorCode`.

```json
{
  "status": "error",
  "message": "Validation failed",
  "code": 400,
  "errors": {
    "email": ["Invalid email address"],
    "password": ["Must be at least 8 characters"]
  }
}
```

| Field    | Type                       | Description                                                     |
| -------- | -------------------------- | --------------------------------------------------------------- |
| `errors` | `Record<string, string[]>` | Map of field path → array of validation messages for that field |

### Error Codes

The `errorCode` field uses the following string values:

| `errorCode`            | HTTP Status | Scenario                                       |
| ---------------------- | ----------- | ---------------------------------------------- |
| `UNAUTHORIZED`         | 401         | Request requires authentication                |
| `FORBIDDEN`            | 403         | Authenticated user lacks permission            |
| `INVALID_CREDENTIALS`  | 401         | Email/password combination is incorrect        |
| `ACCOUNT_NOT_VERIFIED` | 403         | Email address has not been verified            |
| `TOKEN_EXPIRED`        | 401         | JWT access or refresh token has expired        |
| `TOKEN_INVALID`        | 401         | JWT token is malformed or tampered             |
| `NOT_FOUND`            | 404         | Requested resource does not exist              |
| `CONFLICT`             | 409         | Resource already exists (e.g. duplicate email) |
| `VALIDATION_ERROR`     | 400         | Input failed schema validation                 |
| `INTERNAL_ERROR`       | 500         | Unexpected server error                        |
| `SERVICE_UNAVAILABLE`  | 503         | Downstream dependency is unavailable           |

### 400 Validation Error

```json
{
  "status": "error",
  "message": "Validation failed",
  "code": 400,
  "errors": {
    "email": ["Invalid email address"],
    "password": ["String must contain at least 8 character(s)"]
  }
}
```

**cURL example:**

```bash
curl -X POST https://api.bluecollar.example.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{ "email": "not-an-email", "password": "123" }'
```

### 401 Unauthorized

```json
{
  "status": "error",
  "message": "Invalid credentials",
  "code": 401,
  "errorCode": "INVALID_CREDENTIALS",
  "traceId": "f3a1b2c4d5e6"
}
```

**cURL example:**

```bash
curl -X POST https://api.bluecollar.example.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{ "email": "user@example.com", "password": "wrongpassword" }'
```

### 404 Not Found

```json
{
  "status": "error",
  "message": "Worker not found",
  "code": 404,
  "errorCode": "NOT_FOUND",
  "traceId": "a1b2c3d4e5f6"
}
```

**cURL example:**

```bash
curl -X GET https://api.bluecollar.example.com/api/workers/nonexistent-id \
  -H "Authorization: Bearer <token>"
```

### 409 Conflict

```json
{
  "status": "error",
  "message": "A record with that value already exists",
  "code": 409,
  "errorCode": "CONFLICT",
  "traceId": "c3d4e5f6a1b2"
}
```

**cURL example:**

```bash
curl -X POST https://api.bluecollar.example.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{ "email": "existing@example.com", "password": "SecurePass123!" }'
```

### 500 Internal Server Error

```json
{
  "status": "error",
  "message": "Internal Server Error",
  "code": 500,
  "errorCode": "INTERNAL_ERROR",
  "traceId": "e5f6a1b2c3d4"
}
```

> In development, the response also includes `stack` and `originalMessage` fields to aid debugging.

---

## Paginated Responses

The API supports two pagination strategies depending on the endpoint.

### Offset Pagination

Used by endpoints that accept `page` and `limit` query parameters (e.g. `GET /api/workers`, `GET /api/jobs`).

```json
{
  "status": "success",
  "code": 200,
  "data": [],
  "meta": {
    "total": 142,
    "page": 2,
    "limit": 20,
    "pages": 8
  }
}
```

| `meta` Field | Type     | Description                                   |
| ------------ | -------- | --------------------------------------------- |
| `total`      | `number` | Total records matching the applied filter     |
| `page`       | `number` | Current page number (1-based)                 |
| `limit`      | `number` | Maximum records returned per page             |
| `pages`      | `number` | Total number of pages (`ceil(total / limit)`) |

**cURL example — page 2 of workers:**

```bash
curl -X GET "https://api.bluecollar.example.com/api/workers?page=2&limit=20" \
  -H "Authorization: Bearer <token>"
```

**Example response:**

```json
{
  "status": "success",
  "code": 200,
  "data": [
    {
      "id": "clx9abc111",
      "name": "Alice Kamau",
      "bio": "Carpenter with expertise in furniture making.",
      "isActive": true,
      "isVerified": true,
      "categoryId": "cat_03",
      "createdAt": "2024-01-10T09:00:00.000Z",
      "updatedAt": "2024-05-20T14:00:00.000Z",
      "category": { "id": "cat_03", "name": "Carpentry" }
    },
    {
      "id": "clx9abc222",
      "name": "Brian Otieno",
      "bio": "Mason with 10 years in stone and brick construction.",
      "isActive": true,
      "isVerified": false,
      "categoryId": "cat_04",
      "createdAt": "2024-02-05T11:00:00.000Z",
      "updatedAt": "2024-05-18T10:30:00.000Z",
      "category": { "id": "cat_04", "name": "Masonry" }
    }
  ],
  "meta": {
    "total": 142,
    "page": 2,
    "limit": 20,
    "pages": 8
  }
}
```

**cURL example — filtering jobs by category, page 1:**

```bash
curl -X GET "https://api.bluecollar.example.com/api/jobs?page=1&limit=10&categoryId=cat_01" \
  -H "Authorization: Bearer <token>"
```

**Example response:**

```json
{
  "status": "success",
  "code": 200,
  "data": [
    {
      "id": "job_abc123",
      "title": "Rewire residential property",
      "description": "Full rewire of a 3-bedroom house.",
      "status": "open",
      "categoryId": "cat_01",
      "createdAt": "2024-06-01T08:00:00.000Z"
    }
  ],
  "meta": {
    "total": 55,
    "page": 1,
    "limit": 10,
    "pages": 6
  }
}
```

### Cursor Pagination

Used by the workers list endpoint when no `page` parameter is supplied. The client passes the `nextCursor` value from the previous response to fetch the next page.

```json
{
  "status": "success",
  "code": 200,
  "data": [],
  "nextCursor": "clx9abc123",
  "limit": 20
}
```

| Field        | Type               | Description                                                             |
| ------------ | ------------------ | ----------------------------------------------------------------------- |
| `data`       | `array`            | The current page of results                                             |
| `nextCursor` | `string` \| `null` | ID of the last item in this page; `null` when there are no more results |
| `limit`      | `number`           | Number of records requested                                             |

**cURL example — first page:**

```bash
curl -X GET "https://api.bluecollar.example.com/api/workers?limit=20" \
  -H "Authorization: Bearer <token>"
```

**Example response:**

```json
{
  "status": "success",
  "code": 200,
  "data": [
    {
      "id": "clx9abc001",
      "name": "Grace Njeri",
      "bio": "Tailor with 5 years in bespoke garments.",
      "isActive": true,
      "isVerified": true,
      "categoryId": "cat_05",
      "createdAt": "2024-03-01T07:00:00.000Z"
    }
  ],
  "nextCursor": "clx9abc001",
  "limit": 20
}
```

**cURL example — next page using cursor:**

```bash
curl -X GET "https://api.bluecollar.example.com/api/workers?limit=20&cursor=clx9abc001" \
  -H "Authorization: Bearer <token>"
```

When `nextCursor` is `null`, the last page has been reached:

```json
{
  "status": "success",
  "code": 200,
  "data": [],
  "nextCursor": null,
  "limit": 20
}
```

---

## Authentication Responses

### Login — 202 Accepted

The login endpoint returns both an access token and a refresh token alongside the user resource.

```json
{
  "status": "success",
  "message": "Login successful",
  "code": 202,
  "token": "<jwt-access-token>",
  "refreshToken": "<jwt-refresh-token>",
  "data": {
    "id": "usr_abc123",
    "email": "user@example.com",
    "firstName": "Jane",
    "lastName": "Muthoni",
    "role": "user",
    "isVerified": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-06-01T00:00:00.000Z"
  }
}
```

> The `password` field is never included in user objects returned by the API.

**cURL example:**

```bash
curl -X POST https://api.bluecollar.example.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{ "email": "user@example.com", "password": "SecurePass123!" }'
```

### Register — 201 Created

```json
{
  "status": "success",
  "code": 201,
  "data": {
    "id": "usr_new456",
    "email": "newuser@example.com",
    "firstName": "Peter",
    "lastName": "Omondi",
    "role": "user",
    "isVerified": false,
    "createdAt": "2024-06-02T12:00:00.000Z",
    "updatedAt": "2024-06-02T12:00:00.000Z"
  }
}
```

**cURL example:**

```bash
curl -X POST https://api.bluecollar.example.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "password": "SecurePass123!",
    "firstName": "Peter",
    "lastName": "Omondi"
  }'
```
