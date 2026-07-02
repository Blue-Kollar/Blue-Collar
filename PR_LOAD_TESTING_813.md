# Load Testing Implementation - Issue #813

## Overview
This PR implements comprehensive k6 load and stress testing infrastructure for the BlueCollar API, addressing issue #813: "[Testing] Load & Stress Testing with k6".

## 📋 Acceptance Criteria Met

### ✅ k6 scripts cover key endpoints
- **Search & Discovery**: `packages/api/load/search.js`
  - `GET /api/workers` - Worker listing (paginated, filtered)
  - `GET /api/workers/:id` - Single worker lookup  
  - `GET /api/categories` - Category listing
- **Worker CRUD**: `packages/api/load/workers.js`
  - `POST /api/workers` - Create worker
  - `POST /api/workers/:id + X-HTTP-Method: PUT` - Update worker
  - `DELETE /api/workers/:id` - Delete worker
- **Authentication**: `packages/api/load/auth.js`
  - `POST /api/auth/login` - User authentication

### ✅ Thresholds fail the run on regression
All scripts include SLO-based thresholds that automatically fail CI on performance regression:

#### Search & Discovery SLOs:
- `p(95) < 500ms` for worker list endpoint
- `p(95) < 300ms` for categories endpoint  
- `p(99) < 1500ms` globally
- `error rate < 2%`

#### Worker CRUD SLOs:
- `p(95) < 1000ms` for write operations
- `p(99) < 2000ms` globally
- `error rate < 5%`

#### Authentication SLOs:
- `p(95) < 800ms` for login endpoint
- `error rate < 5%`

### ✅ Nightly results published
- **GitHub Actions workflow**: `.github/workflows/load.yml`
- **Schedule**: Runs nightly at 02:00 UTC via cron
- **Manual triggers**: Supports workflow_dispatch with custom scenarios
- **Results storage**: Uploads test results as artifacts with 30-day retention
- **Reporting**: Generates performance summary in GitHub Actions

## 🚀 Implementation Details

### Load Test Scenarios

#### 1. Search & Discovery (`search.js`)
```javascript
// Scenario profiles: smoke, load, stress, soak
export const options = {
  scenarios: {
    [SCENARIO]: PROFILES[SCENARIO] ?? PROFILES.load,
  },
  thresholds: {
    http_req_duration: ['p(99)<1500'],
    http_req_failed: ['rate<0.02'],
    worker_list_duration: ['p(95)<500'],
    category_duration: ['p(95)<300'],
  },
};
```

**Load Profile**: Ramps to 100 VUs over 2min, sustains for 5min, then scales to 200 VUs
**Stress Profile**: Ramps to 300 VUs to test breaking points
**Soak Profile**: 50 VUs for 30min to test memory leaks

#### 2. Worker CRUD (`workers.js`)
Tests curator-gated write operations with proper authentication:
- Creates test workers with realistic data
- Updates using method-override pattern (`X-HTTP-Method: PUT`)
- Cleans up by deleting created records
- Requires `AUTH_TOKEN` environment variable for curator access

#### 3. Authentication (`auth.js`)
Tests login endpoint performance without side effects:
- Uses invalid credentials to measure response time
- Validates proper error responses (400/401/422)
- Measures authentication latency under load

### CI/CD Integration

The load testing workflow (`.github/workflows/load.yml`) provides:

```yaml
# Nightly execution
on:
  schedule:
    - cron: "0 2 * * *"
  workflow_dispatch:
    inputs:
      scenario: # smoke | load | stress | soak
      base_url: # Custom API endpoint
```

**Features**:
- Multi-scenario support (smoke, load, stress, soak)
- Configurable base URL for different environments
- JSON output for trend analysis
- Artifact upload for result persistence
- Performance summary generation

### Usage Examples

#### Local Development
```bash
# Install k6
brew install k6  # macOS
# or
sudo apt-get install k6  # Linux

# Run search load test
k6 run --env SCENARIO=load packages/api/load/search.js

# Run against staging
k6 run --env BASE_URL=https://staging.bluecollar.app/api packages/api/load/search.js

# Run worker CRUD with auth
k6 run --env AUTH_TOKEN=<jwt> packages/api/load/workers.js
```

#### CI Environment Variables
- `BASE_URL`: API endpoint (defaults to staging)
- `SCENARIO`: Test scenario (smoke/load/stress/soak)
- `AUTH_TOKEN`: Curator JWT for write operations

## 📊 Performance Baselines

### Expected Performance Targets
- **Worker List**: p95 < 500ms (handles pagination, filtering)
- **Categories**: p95 < 300ms (lightweight endpoint)
- **Single Worker**: p95 < 400ms (database lookup)
- **Login**: p95 < 800ms (includes password hashing)
- **Worker CRUD**: p95 < 1000ms (database writes)

### Load Capacity
- **Normal Load**: 100 concurrent users
- **Peak Load**: 200 concurrent users  
- **Stress Test**: 300+ concurrent users (breaking point identification)
- **Soak Test**: 50 users for 30 minutes (stability validation)

## 🔧 Technical Implementation

### Custom Metrics
```javascript
// Endpoint-specific performance tracking
const workerListP95 = new Trend('worker_list_duration', true);
const categoryP95 = new Trend('category_duration', true);
const errorRate = new Rate('error_rate');
```

### Smart Setup Phase
```javascript
export function setup() {
  // Fetches real worker ID for single-worker tests
  const res = http.get(`${BASE}/workers?limit=1`);
  return { workerId: workers[0]?.id };
}
```

### Method Override Support
Properly handles BlueCollar's method-override pattern for file uploads:
```javascript
http.post(`${BASE}/workers/${workerId}`, payload, {
  headers: { ...auth, 'X-HTTP-Method': 'PUT' }
});
```

## 🛡️ Safety Measures

1. **Non-destructive by default**: Auth tests use invalid credentials
2. **Cleanup**: Worker CRUD tests delete created records
3. **Rate limiting awareness**: Includes proper sleep intervals
4. **Error handling**: Graceful degradation on setup failures
5. **Environment isolation**: Configurable base URLs

## 📈 Monitoring & Alerting

### Key Metrics Tracked
- Response time percentiles (p95, p99)
- Error rates by endpoint
- Throughput (requests/second)
- Virtual user concurrency

### Failure Conditions
- Response time regression (>20% increase)
- Error rate spikes (>threshold)
- Timeout increases
- Memory/resource exhaustion

## 🚦 Next Steps

1. **Baseline establishment**: Run initial load tests to establish performance baselines
2. **Alerting setup**: Configure notifications for performance regressions
3. **Trend analysis**: Implement historical performance tracking
4. **Capacity planning**: Use results to guide infrastructure scaling
5. **SLO refinement**: Adjust thresholds based on production requirements

## 📚 Documentation

- **Load Testing Guide**: `docs/LOAD_TESTING_GUIDE.md`
- **k6 Scripts**: `packages/api/load/`
- **CI Workflow**: `.github/workflows/load.yml`
- **API Documentation**: `packages/api/DOCUMENTATION.json`

## 🎯 Resolves

Closes #813 - [Testing] Load & Stress Testing with k6

**All acceptance criteria have been implemented:**
- ✅ k6 scripts cover key endpoints
- ✅ Thresholds fail the run on regression  
- ✅ Nightly results published

This implementation provides a robust foundation for continuous performance monitoring and regression detection in the BlueCollar API.