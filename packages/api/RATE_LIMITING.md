# Rate Limiting Strategy

## Overview

Blue Collar API implements multi-tier rate limiting to protect public and authenticated endpoints from abuse and resource exhaustion.

## Rate Limit Tiers

### 1. Strict Auth Rate Limit (Authentication Sensitive)

**Window:** 15 minutes  
**Limit:** 5 requests per IP

**Applied to:**
- `POST /api/auth/login` — Login attempts
- `POST /api/auth/forgot-password` — Password reset requests

**Purpose:** Prevent brute force attacks on sensitive authentication endpoints.

### 2. Moderate Auth Rate Limit (Registration)

**Window:** 1 hour  
**Limit:** 20 requests per IP

**Applied to:**
- `POST /api/auth/register` — Account creation
- `POST /api/auth/verify-account` — Email verification
- `POST /api/auth/resend-verification` — Resend verification email

**Purpose:** Prevent account creation spam while allowing legitimate users multiple attempts.

### 3. Public Read Rate Limit (GET Endpoints)

**Window:** 1 hour  
**Limit:** 100 requests per IP

**Applied to:**
- `GET /api/categories` — List categories
- `GET /api/categories/:id` — Get category details
- `GET /api/reviews` — List reviews
- `GET /api/jobs` — Search jobs
- `GET /api/jobs/:id` — Get job details
- `GET /api/jobs/recommendations/:workerId` — Job recommendations
- `GET /api/workers/:id` — Get worker profile
- `GET /api/wallet/account/:publicKey` — Get Stellar account info
- `GET /api/wallet/transactions/:publicKey` — Get transaction history
- `GET /api/payments/fee` — Get protocol fees
- `GET /api/workers/:id/response-stats` — Get response time stats
- `GET /api/indexer/*` — Query on-chain events

**Purpose:** Allow liberal read access while preventing data scraping and enumeration attacks.

### 4. Public Write Rate Limit (Sensitive Operations)

**Window:** 15 minutes  
**Limit:** 10 requests per IP

**Applied to:**
- `POST /api/wallet/testnet-fund` — Fund testnet account
- `POST /api/wallet/broadcast` — Broadcast Stellar transaction

**Purpose:** Prevent abuse of operations with external consequences (blockchain writes, testnet funding).

### 5. User-Specific Rate Limits

**Contact Requests:** 5 per hour per authenticated user  
**General Operations:** Varies by endpoint

See `packages/api/src/middleware/userRateLimit.ts` for user-specific limits applied to authenticated operations.

## Configuration

Rate limiter configuration is centralized in `packages/api/src/config/rateLimiter.ts`:

```typescript
export const strictAuthRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 5,                    // 5 requests
  standardHeaders: true,     // RateLimit-* headers
  legacyHeaders: false,      // X-RateLimit-* headers
  handler: (_req, res) => {
    res.setHeader('Retry-After', '900') // 900 seconds = 15 minutes
    res.status(429).json({
      status: 'error',
      message: 'Too many requests, please try again later.',
      code: 429,
    })
  },
})
```

## Response Format

When rate limit is exceeded, the API returns HTTP 429 with:

```json
{
  "status": "error",
  "message": "Too many requests, please try again later.",
  "code": 429
}
```

**Headers:**
- `RateLimit-Limit`: Maximum requests in window
- `RateLimit-Remaining`: Requests remaining in current window
- `RateLimit-Reset`: UNIX timestamp when limit resets
- `Retry-After`: Seconds until limit resets

## Bypass Rules

### Admin Bypass

The sophisticated Redis-backed rate limiter in `packages/api/src/middleware/rateLimit.ts` includes admin bypass:

- **Authenticated admins** bypass rate limits
- **Admin IPs** (configured via `RATE_LIMIT_ALLOWLIST`) bypass rate limits

### Configuration

```bash
RATE_LIMIT_ALLOWLIST="192.168.1.1,10.0.0.0/8"  # IP addresses/ranges
```

## Monitoring

### Monitoring Metrics

Rate limiting uses Redis to store sliding-window counters. Monitor:

- **Exceeded rate limits:** Check for HTTP 429 responses
- **Redis errors:** Rate limiter falls back gracefully if Redis is unavailable
- **Abuse patterns:** High volume of 429s from specific IPs

### Example Monitoring Query

```bash
# Watch for rate limit violations
tail -f logs/api.log | grep "429\|rate.limit"
```

## Testing

Unit tests for rate limiting can be found in:

- `packages/api/src/__tests__/middleware/` — Middleware tests
- `packages/api/src/__tests__/routes/` — Route-level rate limit tests

### Manual Testing

```bash
# Test strict auth rate limit (should fail on 6th request)
for i in {1..6}; do
  curl -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrong"}' \
    -H "X-Forwarded-For: 192.168.1.100"
  echo "Request $i"
done
# 6th request should return 429
```

## Best Practices

### For Developers

1. **Always use validate middleware:** Fail fast on invalid input to prevent rate limit bypass via error handling
2. **Cache aggressively:** Reduce backend load with appropriate cache headers
3. **Consider user impact:** Public limits should be generous enough for legitimate use

### For Operations

1. **Monitor Redis:** Rate limiting depends on Redis; monitor its health
2. **Scale with traffic:** Adjust rate limits as user base grows
3. **Whitelist CDNs:** If using a CDN, configure X-Forwarded-For properly so rates are tracked per client IP, not CDN IP
4. **Log violations:** Enable detailed logging for rate limit violations to detect abuse patterns

## Customization

### Per-Route Customization

To apply a different rate limiter to a specific route:

```typescript
import { publicReadRateLimiter, publicWriteRateLimiter } from '../config/rateLimiter.js'

// Use public read limit
router.get('/list', publicReadRateLimiter, listHandler)

// Use stricter public write limit
router.post('/fund', publicWriteRateLimiter, fundHandler)

// Create custom limit for specific route
import rateLimit from 'express-rate-limit'
const customLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 2,               // 2 requests
})
router.post('/critical', customLimiter, handler)
```

### Dynamic Rate Limiting

For advanced use cases, implement dynamic rate limiting based on user tier or request context:

```typescript
const dynamicLimiter = (req, res, next) => {
  const user = req.user
  const limit = user?.tier === 'premium' ? 1000 : 100
  // Apply rate limit logic...
  next()
}
```

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| "Too many requests" error | Rate limit exceeded | Wait for reset (Retry-After header) or upgrade to premium tier |
| Rate limits not working | Redis unavailable | Check Redis connectivity; limiter fails open (allows all requests) |
| X-Forwarded-For mismatch | Proxy misconfiguration | Ensure X-Forwarded-For header is properly set by load balancer |
| Legitimate traffic blocked | Limits too strict | Increase limits or implement user-specific higher tiers |

## References

- [IETF Draft: Rate Limit Header Fields](https://tools.ietf.org/html/draft-pokorny-ratelimit-headers-01)
- [express-rate-limit Documentation](https://github.com/nfriedly/express-rate-limit)
