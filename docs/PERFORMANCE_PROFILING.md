# Performance Profiling Guide

## Overview

This guide covers the Application Performance Monitoring (APM), distributed tracing, and performance profiling setup for Blue-Collar services.

## APM Stack

### Components

- **Prometheus**: Metrics collection and storage
- **Grafana**: Visualization and dashboards
- **Jaeger**: Distributed tracing
- **Node.js APM**: Application-level profiling

## Distributed Tracing with Jaeger

### Architecture

```
API Service → Jaeger Agent → Jaeger Collector → Storage → Jaeger UI
```

### Trace Context Propagation

- Uses OpenTelemetry standards
- Propagates trace IDs across service boundaries
- Captures request flow through microservices

### Key Metrics Tracked

- Request latency (p50, p95, p99)
- Error rates
- Throughput (requests/sec)
- Database query performance
- External API call duration

## Database Query Profiling

### Slow Query Monitoring

- Queries exceeding 100ms are logged
- Automatic EXPLAIN ANALYZE for slow queries
- Query plan analysis and optimization suggestions

### Connection Pool Metrics

- Active connections
- Idle connections
- Wait time for connections
- Connection errors

## Memory and CPU Profiling

### Node.js Profiling

```javascript
// Heap snapshots on demand
const v8 = require('v8');
const heapSnapshot = v8.writeHeapSnapshot();

// CPU profiling
const profiler = require('v8-profiler-next');
profiler.startProfiling('CPU profile');
// ... code to profile
const profile = profiler.stopProfiling();
```

### Metrics Collected

- Heap size and usage
- Garbage collection frequency and duration
- Event loop lag
- CPU usage per endpoint
- Memory leaks detection

## Performance Dashboards

### 1. API Performance Dashboard

**Panels:**

- Request rate (req/sec)
- Response time percentiles (p50, p95, p99)
- Error rate (%)
- Active connections
- Request duration by endpoint

**Queries:**

```promql
# Request rate
rate(http_requests_total[5m])

# Response time p95
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Error rate
rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])
```

### 2. Database Performance Dashboard

**Panels:**

- Query execution time
- Connection pool utilization
- Slow query count
- Transaction rate
- Lock wait time

### 3. System Resources Dashboard

**Panels:**

- CPU usage (%)
- Memory usage (MB)
- Disk I/O
- Network throughput
- Container resource limits

### 4. Business Metrics Dashboard

**Panels:**

- Worker registrations/hour
- Job postings/hour
- Active users
- API calls by endpoint
- Revenue metrics

## Alert Rules

### Performance Alerts

```yaml
# High response time
- alert: HighResponseTime
  expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1
  for: 5m
  annotations:
    summary: 'API response time is high (p95 > 1s)'

# High error rate
- alert: HighErrorRate
  expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.05
  for: 5m
  annotations:
    summary: 'Error rate exceeds 5%'

# Memory leak detection
- alert: MemoryLeakDetected
  expr: rate(nodejs_heap_size_used_bytes[1h]) > 1000000
  for: 2h
  annotations:
    summary: 'Possible memory leak detected'
```

## Profiling Best Practices

### 1. Continuous Profiling

- Always-on lightweight profiling in production
- Detailed profiling on-demand for investigation
- Automatic profiling triggered by performance degradation

### 2. Sampling Strategy

- 1% sampling for traces in production
- 100% sampling in staging
- Adaptive sampling based on error rates

### 3. Data Retention

- Raw traces: 7 days
- Aggregated metrics: 90 days
- Performance baselines: 1 year

### 4. Performance Budgets

- API response time: p95 < 500ms
- Database queries: p95 < 100ms
- Memory usage: < 80% of limit
- CPU usage: < 70% average

## Integration with CI/CD

### Performance Testing in Pipeline

```yaml
performance-test:
  stage: test
  script:
    - npm run load-test
    - npm run analyze-performance
  artifacts:
    reports:
      performance: performance-report.json
```

### Performance Regression Detection

- Compare metrics against baseline
- Fail build if performance degrades > 20%
- Generate performance comparison reports

## Troubleshooting

### High Memory Usage

1. Take heap snapshot
2. Analyze with Chrome DevTools
3. Identify memory leaks
4. Review object retention

### Slow Endpoints

1. Check distributed traces
2. Identify bottleneck (DB, external API, computation)
3. Review query plans
4. Optimize or cache

### High CPU Usage

1. Enable CPU profiling
2. Identify hot functions
3. Review algorithmic complexity
4. Consider caching or optimization

## Tools and Access

- **Grafana**: https://grafana.bluecollar.example.com
- **Jaeger UI**: https://jaeger.bluecollar.example.com
- **Prometheus**: https://prometheus.bluecollar.example.com

## References

- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
- [Jaeger Documentation](https://www.jaegertracing.io/docs/)
- [Node.js Performance Best Practices](https://nodejs.org/en/docs/guides/simple-profiling/)
