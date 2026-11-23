# Version Rollout and Gradual Deployment

This document describes the gradual deployment mechanism for BlueCollar API versions.

## Overview

The version rollout system enables safe, gradual rollout of new API versions with:

- **Canary deployments**: Route a percentage of traffic to new version
- **User-based routing**: Consistent routing for the same user
- **Feature flags**: Enable/disable features per version
- **Runtime updates**: Adjust rollout without redeploying

## Configuration

Rollout configuration is stored in `utils/versionRollout.ts`:

```typescript
export const ROLLOUT_CONFIG: Record<string, RolloutConfig> = {
  v1: {
    version: 'v1',
    enabled: true,
    trafficPercentage: 100,
    featureFlags: {},
  },
  v2: {
    version: 'v2',
    enabled: true,
    trafficPercentage: 100,
    featureFlags: {
      verificationStatus: true,
      twoFactorAuth: true,
    },
  },
};
```

## Gradual Rollout Phases

### Phase 1: Canary (10% traffic)

```bash
curl -X PUT https://api.bluecollar.app/api/admin/rollout \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "version": "v2",
    "trafficPercentage": 10,
    "enabled": true
  }'
```

**Monitoring:**

- Track error rates for v2 vs v1
- Monitor latency differences
- Check user feedback

**Duration:** 1-2 days

### Phase 2: Early Adopters (25% traffic)

```bash
curl -X PUT https://api.bluecollar.app/api/admin/rollout \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "version": "v2",
    "trafficPercentage": 25,
    "enabled": true
  }'
```

**Monitoring:**

- Load testing and performance validation
- Integration testing with existing clients
- Security scanning

**Duration:** 3-5 days

### Phase 3: Majority (50% traffic)

```bash
curl -X PUT https://api.bluecollar.app/api/admin/rollout \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "version": "v2",
    "trafficPercentage": 50,
    "enabled": true
  }'
```

**Monitoring:**

- Real-world load testing
- Database performance under load
- Cache effectiveness

**Duration:** 1-2 weeks

### Phase 4: Full Rollout (100% traffic)

```bash
curl -X PUT https://api.bluecollar.app/api/admin/rollout \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "version": "v2",
    "trafficPercentage": 100,
    "enabled": true
  }'
```

**Post-Rollout:**

- Keep v1 available for 12 months as per deprecation policy
- Monitor for any regressions
- Support clients migrating to v2

## API Endpoints

### Check Rollout Status

```bash
# Get current rollout status for all versions
curl https://api.bluecollar.app/api/rollout

# Response
{
  "status": "success",
  "data": {
    "v1": {
      "version": "v1",
      "enabled": true,
      "trafficPercentage": 100,
      "status": "stable",
      "featureFlags": {}
    },
    "v2": {
      "version": "v2",
      "enabled": true,
      "trafficPercentage": 10,
      "status": "canary",
      "featureFlags": {
        "verificationStatus": true,
        "twoFactorAuth": true
      }
    }
  },
  "timestamp": "2026-06-22T00:00:00.000Z"
}
```

### Update Rollout Configuration

```bash
# Update traffic percentage for a version
curl -X PUT https://api.bluecollar.app/api/admin/rollout \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "version": "v2",
    "trafficPercentage": 25,
    "enabled": true,
    "featureFlags": {
      "verificationStatus": true,
      "twoFactorAuth": false
    }
  }'
```

### Enable/Disable a Version

```bash
# Disable v2 temporarily
curl -X PUT https://api.bluecollar.app/api/admin/rollout \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "version": "v2",
    "enabled": false
  }'

# Response
{
  "status": "success",
  "message": "Updated rollout config for v2",
  "data": {
    "version": "v2",
    "enabled": false,
    "trafficPercentage": 25,
    "featureFlags": { ... }
  }
}
```

## Feature Flags

Enable features per version before full rollout:

```bash
# Enable new feature in v2 only
curl -X PUT https://api.bluecollar.app/api/admin/rollout \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "version": "v2",
    "featureFlags": {
      "verificationStatus": true,
      "twoFactorAuth": true
    }
  }'
```

### Using Feature Flags in Code

```typescript
import { isFeatureEnabled } from './utils/versionRollout';

// In API handler
if (isFeatureEnabled(version, 'twoFactorAuth')) {
  // Handle 2FA logic
}
```

## User-Based Routing

The system uses consistent hashing to route the same user to the same version:

```javascript
// User 'user-123' always gets v2 during 10% canary
// Percentage is determined by hash(user-id) % 100

// In 10% canary: hashes 0-9 → v2, 10-99 → v1
// In 50% canary: hashes 0-49 → v2, 50-99 → v1
```

This ensures:

- Same user always gets consistent experience
- Predictable traffic distribution
- Easier debugging of issues

## Rollout Strategies

### Conservative (Low Risk)

```
Day 1:    10% (1 hour)
Day 2:    25% (4 hours)
Day 3:    50% (8 hours)
Day 4:    100%
```

### Moderate (Balanced)

```
Day 1:    5% (2 hours)
Day 2:    10% (8 hours)
Day 3:    25% (1 day)
Day 4:    50% (3 days)
Day 5:    100%
```

### Aggressive (Higher Risk, Faster)

```
Day 1:    50%
Day 2:    100%
```

## Monitoring During Rollout

### Key Metrics

1. **Error Rate**
   - Compare v1 vs v2 error rates
   - Alert if v2 errors > v1 errors + 2%

2. **Response Time**
   - Monitor p50, p95, p99 latencies
   - Alert if v2 latency > v1 + 50ms

3. **User Feedback**
   - Track support tickets by version
   - Monitor version-specific issues

4. **Feature Adoption**
   - Track new feature usage
   - Monitor v2-specific schema fields

### Prometheus Queries

```prometheus
# Request rate by version
rate(api_requests_total{version="v2"}[5m])

# Error rate by version
rate(api_errors_total{version="v2"}[5m]) / rate(api_requests_total{version="v2"}[5m])

# Latency by version
histogram_quantile(0.95, http_request_duration_seconds{version="v2"})
```

## Emergency Rollback

If issues are discovered, immediately reduce traffic:

```bash
# Emergency: revert to v1 only
curl -X PUT https://api.bluecollar.app/api/admin/rollout \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "version": "v2",
    "trafficPercentage": 0,
    "enabled": false
  }'
```

### Rollback Procedure

1. **Identify Issue**
   - Monitor alerts and metrics
   - Get error samples

2. **Reduce Traffic**
   - Set v2 to 0% traffic
   - Monitor error rates normalize

3. **Investigate**
   - Review logs and traces
   - Identify root cause

4. **Fix and Retest**
   - Fix in development
   - Retest in staging

5. **Re-rollout**
   - Start from Phase 1 again
   - Use more conservative steps

## Automated Rollout (Example)

```typescript
import { GradualRollout } from './utils/versionRollout';

const rollout = new GradualRollout('v2', [
  { percentage: 10, durationMs: 60 * 60 * 1000 }, // 1 hour at 10%
  { percentage: 25, durationMs: 4 * 60 * 60 * 1000 }, // 4 hours at 25%
  { percentage: 50, durationMs: 24 * 60 * 60 * 1000 }, // 1 day at 50%
  { percentage: 100, durationMs: 0 }, // Stay at 100%
]);

// Check and advance periodically (e.g., every minute)
setInterval(() => {
  const advanced = rollout.checkAdvance();
  if (advanced) {
    console.log('Advancing to next phase:', rollout.getStatus());
  }
}, 60000);
```

## Documentation

- See `docs/API_VERSIONING.md` for architecture overview
- See `docs/MIGRATION_GUIDE.md` for client migration guidance
- See `packages/api/src/utils/versionRollout.ts` for implementation

## Related Files

- `middleware/versionRateLimit.ts` - Version-specific rate limiting
- `middleware/versionAuth.ts` - Version-specific authentication
- `utils/versionRollout.ts` - Rollout configuration and functions
- `__tests__/versioning.test.ts` - Rollout tests
