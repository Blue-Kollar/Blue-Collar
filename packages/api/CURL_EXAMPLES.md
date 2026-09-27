# BlueCollar API cURL Examples

This guide provides practical cURL examples for BlueCollar API endpoints.

Base URL used below:

```bash
export API_BASE_URL="http://localhost:3000/api"
```

Reusable tokens:

```bash
export USER_TOKEN="<user-jwt>"
export CURATOR_TOKEN="<curator-jwt>"
export ADMIN_TOKEN="<admin-jwt>"
```

## 1. Health

```bash
curl -s http://localhost:3000/health
```

## 2. Auth Endpoints

## 2.1 Register

```bash
curl -X POST "$API_BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Ada",
    "lastName": "Lovelace",
    "email": "ada@example.com",
    "password": "Password123!"
  }'
```

## 2.2 Login

```bash
curl -X POST "$API_BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "ada@example.com",
    "password": "Password123!"
  }'
```

## 2.3 Get Current User

```bash
curl "$API_BASE_URL/auth/me" \
  -H "Authorization: Bearer $USER_TOKEN"
```

## 2.4 Verify Account

By token in request body:

```bash
curl -X PUT "$API_BASE_URL/auth/verify-account" \
  -H "Content-Type: application/json" \
  -d '{"token":"<verification-token>"}'
```

By token in query:

```bash
curl -X PUT "$API_BASE_URL/auth/verify-account?token=<verification-token>"
```

## 2.5 Forgot Password

```bash
curl -X POST "$API_BASE_URL/auth/forgot-password" \
  -H "Content-Type: application/json" \
  -d '{"email":"ada@example.com"}'
```

## 2.6 Reset Password

```bash
curl -X PUT "$API_BASE_URL/auth/reset-password" \
  -H "Content-Type: application/json" \
  -d '{
    "token":"<reset-token>",
    "password":"NewPassword123!"
  }'
```

## 2.7 Logout

```bash
curl -X DELETE "$API_BASE_URL/auth/logout" \
  -H "Authorization: Bearer $USER_TOKEN"
```

## 2.8 Google OAuth (redirect flow)

Get redirect response headers:

```bash
curl -i "$API_BASE_URL/auth/google"
```

Callback endpoint (normally invoked by Google):

```bash
curl -i "$API_BASE_URL/auth/google/callback?code=<google-oauth-code>"
```

## 3. Category Endpoints

List categories:

```bash
curl "$API_BASE_URL/categories"
```

Get a category:

```bash
curl "$API_BASE_URL/categories/<category-id>"
```

## 4. Worker Endpoints

## 4.1 Public Listing (Pagination + Filtering)

Basic pagination:

```bash
curl "$API_BASE_URL/workers?page=1&limit=20"
```

Filter by category and search:

```bash
curl "$API_BASE_URL/workers?category=<category-id>&search=plumber"
```

Filter by location:

```bash
curl "$API_BASE_URL/workers?city=Lagos&state=Lagos&country=NG"
```

## 4.2 Get Worker

```bash
curl "$API_BASE_URL/workers/<worker-id>"
```

## 4.3 Curator/Admin: My Workers

```bash
curl "$API_BASE_URL/workers/mine?page=1&limit=10" \
  -H "Authorization: Bearer $CURATOR_TOKEN"
```

## 4.4 Create Worker (Curator role)

```bash
curl -X POST "$API_BASE_URL/workers" \
  -H "Authorization: Bearer $CURATOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name":"Jane Electric",
    "bio":"12 years field experience",
    "phone":"+2348012345678",
    "email":"jane.electric@example.com",
    "walletAddress":"GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    "categoryId":"<category-id>"
  }'
```

## 4.5 Update Worker (Curator role)

JSON update:

```bash
curl -X PUT "$API_BASE_URL/workers/<worker-id>" \
  -H "Authorization: Bearer $CURATOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Jane Electric Pro"}'
```

Multipart update via method override (file upload):

```bash
# Note: This uses the X-HTTP-Method: PUT header to override the POST method.
# HTML forms and multipart/form-data only support GET/POST, so we use POST
# with the X-HTTP-Method header to indicate PUT semantics.
# The API's method-override middleware rewrites this to PUT before routing.
# See API_REFERENCE.md for detailed explanation.

curl -X POST "$API_BASE_URL/workers/<worker-id>" \
  -H "Authorization: Bearer $CURATOR_TOKEN" \
  -H "X-HTTP-Method: PUT" \
  -F "name=Jane Electric Pro" \
  -F "avatar=@/path/to/avatar.jpg"
```

## 4.6 Delete Worker (Curator role)

```bash
curl -X DELETE "$API_BASE_URL/workers/<worker-id>" \
  -H "Authorization: Bearer $CURATOR_TOKEN"
```

## 4.7 Toggle Worker Active State (Curator role)

```bash
curl -X PATCH "$API_BASE_URL/workers/<worker-id>/toggle" \
  -H "Authorization: Bearer $CURATOR_TOKEN"
```

## 4.8 Availability

Get availability:

```bash
curl "$API_BASE_URL/workers/<worker-id>/availability"
```

Upsert availability:

```bash
curl -X PUT "$API_BASE_URL/workers/<worker-id>/availability" \
  -H "Authorization: Bearer $CURATOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "weeklySchedule": {
      "monday": [{"start":"09:00","end":"17:00"}],
      "tuesday": [{"start":"09:00","end":"17:00"}]
    }
  }'
```

## 4.9 On-chain Registration (Curator role)

```bash
curl -X POST "$API_BASE_URL/workers/<worker-id>/register-on-chain" \
  -H "Authorization: Bearer $CURATOR_TOKEN"
```

## 4.10 Contact Requests

Create contact request (authenticated user):

```bash
curl -X POST "$API_BASE_URL/workers/<worker-id>/contact" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message":"Need urgent wiring repair",
    "preferredContact":"email"
  }'
```

List worker contact requests (curator):

```bash
curl "$API_BASE_URL/workers/<worker-id>/contacts" \
  -H "Authorization: Bearer $CURATOR_TOKEN"
```

Update contact request status (curator):

```bash
curl -X PATCH "$API_BASE_URL/workers/<worker-id>/contacts/<request-id>" \
  -H "Authorization: Bearer $CURATOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"accepted"}'
```

## 4.11 Bookmarks

Toggle bookmark:

```bash
curl -X POST "$API_BASE_URL/workers/<worker-id>/bookmark" \
  -H "Authorization: Bearer $USER_TOKEN"
```

List my bookmarks:

```bash
curl "$API_BASE_URL/users/me/bookmarks" \
  -H "Authorization: Bearer $USER_TOKEN"
```

## 4.12 Reviews

List reviews:

```bash
curl "$API_BASE_URL/workers/<worker-id>/reviews"
```

Create review (authenticated user):

```bash
curl -X POST "$API_BASE_URL/workers/<worker-id>/reviews" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rating": 5,
    "body": "Great work and on time"
  }'
```

Update review (review author):

```bash
curl -X PUT "$API_BASE_URL/workers/<worker-id>/reviews/<review-id>" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rating": 4,
    "body": "Good work, minor delays"
  }'
```

Delete review (review author):

```bash
curl -X DELETE "$API_BASE_URL/workers/<worker-id>/reviews/<review-id>" \
  -H "Authorization: Bearer $USER_TOKEN"
```

Flag review for moderation (authenticated user):

```bash
curl -X PATCH "$API_BASE_URL/workers/<worker-id>/reviews/<review-id>/flag" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason":"inappropriate"}'
```

Get moderation queue (admin):

```bash
curl "$API_BASE_URL/workers/<worker-id>/reviews/moderation/queue" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

Moderate review (admin):

```bash
curl -X PATCH "$API_BASE_URL/workers/<worker-id>/reviews/<review-id>/moderate" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"approve"}'
```

## 5. User Endpoints

### 5.1 Notifications

Get notification preferences:

```bash
curl "$API_BASE_URL/users/me/notifications" \
  -H "Authorization: Bearer $USER_TOKEN"
```

Update notification preferences:

```bash
curl -X PUT "$API_BASE_URL/users/me/notifications" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "newWorkerNearby": true,
    "statusChange": false,
    "reviewReply": true,
    "announcements": false
  }'
```

Get notification history:

```bash
curl "$API_BASE_URL/users/me/notifications/history?page=1&limit=20" \
  -H "Authorization: Bearer $USER_TOKEN"
```

Mark notification as read:

```bash
curl -X PATCH "$API_BASE_URL/users/me/notifications/<notification-id>/read" \
  -H "Authorization: Bearer $USER_TOKEN"
```

Mark all notifications as read:

```bash
curl -X PATCH "$API_BASE_URL/users/me/notifications/read-all" \
  -H "Authorization: Bearer $USER_TOKEN"
```

### 5.2 Push Subscriptions

Save push subscription:

```bash
curl -X POST "$API_BASE_URL/users/me/push-subscription" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "endpoint":"https://fcm.googleapis.com/fcm/send/abc",
    "keys": {"p256dh":"<key>", "auth":"<auth>"}
  }'
```

Delete push subscription:

```bash
curl -X DELETE "$API_BASE_URL/users/me/push-subscription" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"endpoint":"https://fcm.googleapis.com/fcm/send/abc"}'
```

## 6. Webhook Endpoints

Create webhook subscription (curator/admin):

```bash
curl -X POST "$API_BASE_URL/webhooks" \
  -H "Authorization: Bearer $CURATOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/webhook",
    "events": ["worker.created", "worker.updated", "review.created"]
  }'
```

List webhook subscriptions (curator/admin):

```bash
curl "$API_BASE_URL/webhooks" \
  -H "Authorization: Bearer $CURATOR_TOKEN"
```

Get webhook details (curator/admin):

```bash
curl "$API_BASE_URL/webhooks/<webhook-id>" \
  -H "Authorization: Bearer $CURATOR_TOKEN"
```

Update webhook subscription (curator/admin):

```bash
curl -X PUT "$API_BASE_URL/webhooks/<webhook-id>" \
  -H "Authorization: Bearer $CURATOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/webhook-v2",
    "events": ["worker.created", "worker.deleted"]
  }'
```

Delete webhook subscription (curator/admin):

```bash
curl -X DELETE "$API_BASE_URL/webhooks/<webhook-id>" \
  -H "Authorization: Bearer $CURATOR_TOKEN"
```

Get webhook delivery logs (curator/admin):

```bash
curl "$API_BASE_URL/webhooks/<webhook-id>/logs?page=1&limit=50" \
  -H "Authorization: Bearer $CURATOR_TOKEN"
```

Retry failed webhook delivery (curator/admin):

```bash
curl -X POST "$API_BASE_URL/webhooks/<webhook-id>/logs/<log-id>/retry" \
  -H "Authorization: Bearer $CURATOR_TOKEN"
```

## 7. Admin Endpoints

### 7.1 Stats and Listings

Admin stats:

```bash
curl "$API_BASE_URL/admin/stats" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

Paginated workers (admin):

```bash
curl "$API_BASE_URL/admin/workers?page=1&limit=25" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

Paginated users (admin):

```bash
curl "$API_BASE_URL/admin/users?page=1&limit=25" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### 7.2 Bulk Operations

Bulk toggle worker active status (admin):

```bash
curl -X POST "$API_BASE_URL/admin/workers/bulk-toggle" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "workerIds": ["<worker-id-1>", "<worker-id-2>"],
    "isActive": true
  }'
```

Bulk delete workers (admin):

```bash
curl -X DELETE "$API_BASE_URL/admin/workers/bulk-delete" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "workerIds": ["<worker-id-1>", "<worker-id-2>"]
  }'
```

Bulk update worker category (admin):

```bash
curl -X PATCH "$API_BASE_URL/admin/workers/bulk-update" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "workerIds": ["<worker-id-1>", "<worker-id-2>"],
    "categoryId": "<new-category-id>"
  }'
```

Bulk verify workers (admin):

```bash
curl -X POST "$API_BASE_URL/admin/workers/bulk-verify" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "workerIds": ["<worker-id-1>", "<worker-id-2>"],
    "isVerified": true
  }'
```

### 7.3 Import/Export

Export workers (CSV):

```bash
curl "$API_BASE_URL/admin/export/workers" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -o workers.csv
```

Export users (CSV):

```bash
curl "$API_BASE_URL/admin/export/users" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -o users.csv
```

Import workers from CSV:

```bash
curl -X POST "$API_BASE_URL/admin/workers/import" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -F "file=@workers.csv"
```

## 8. Role-based Scenario Examples

## 8.1 Plain user attempts worker creation (expected 403)

```bash
curl -i -X POST "$API_BASE_URL/workers" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Unauthorized Worker","categoryId":"<category-id>"}'
```

Expected error envelope:

```json
{
  "status": "error",
  "message": "Forbidden",
  "code": 403
}
```

## 8.2 Missing JWT (expected 401)

```bash
curl -i "$API_BASE_URL/auth/me"
```

Expected:

```json
{
  "status": "error",
  "message": "Unauthorized",
  "code": 401
}
```

## 9. Common Error Response Examples

## 9.1 Validation error (400)

```bash
curl -i -X POST "$API_BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"invalid","password":"short"}'
```

## 9.2 Resource not found (404)

```bash
curl -i "$API_BASE_URL/workers/non-existent-id"
```

Common envelope:

```json
{
  "status": "error",
  "message": "Worker not found",
  "code": 404
}
```

## 9.3 Internal error (500)

All unexpected server failures follow this envelope:

```json
{
  "status": "error",
  "message": "Internal server error",
  "code": 500
}
```

## 10. Rate Limiting Behavior

The project includes an auth rate-limiter configuration in `src/config/rateLimiter.ts` with defaults:

- window: 15 minutes (`900000` ms)
- max: 10 requests per IP
- response code: `429`

Example 429 envelope:

```json
{
  "status": "error",
  "message": "Too many requests from this IP, please try again later.",
  "code": 429
}
```

Load test example (for auth endpoints where limiter is enabled):

```bash
for i in $(seq 1 15); do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST "$API_BASE_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"ada@example.com","password":"wrong-password"}'
done
```

Inspect standard rate-limit headers:

```bash
curl -i -X POST "$API_BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"ada@example.com","password":"wrong-password"}'
```
