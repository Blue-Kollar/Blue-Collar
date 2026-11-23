# Monitoring, Logging, and Alerting Infrastructure

This guide covers the production-ready monitoring setup for BlueCollar using Prometheus, Grafana, AlertManager, Jaeger, and Logstash.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       Observability Stack                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Metrics Collection                                              │
│  ├── Prometheus (time-series database & scraper)               │
│  ├── Node Exporter (host metrics)                              │
│  ├── PostgreSQL Exporter (database metrics)                    │
│  ├── Redis Exporter (cache metrics)                            │
│  └── prom-client (application metrics)                         │
│                                                                   │
│  Alerting                                                         │
│  ├── Prometheus Alert Rules (conditions & evaluation)           │
│  ├── AlertManager (alert aggregation & routing)                │
│  │   ├── Slack notifications                                    │
│  │   ├── Email alerts                                            │
│  │   └── PagerDuty for critical incidents                       │
│  └── Inhibit Rules (suppress duplicates/cascades)              │
│                                                                   │
│  Visualization                                                    │
│  ├── Grafana Dashboards                                         │
│  │   ├── System Overview (CPU, memory, disk, network)          │
│  │   ├── API Performance (latency, error rate, throughput)     │
│  │   └── Business Metrics (registrations, payments, users)     │
│  └── Prometheus Web UI (PromQL ad-hoc queries)                 │
│                                                                   │
│  Tracing                                                          │
│  ├── OpenTelemetry SDK (auto-instrumentation)                  │
│  ├── OpenTelemetry Collector (OTLP ingestion)                  │
│  └── Jaeger UI (trace visualization & search)                  │
│                                                                   │
│  Logging                                                          │
│  ├── Pino (structured logging in Node.js)                      │
│  ├── Logstash (log aggregation & processing)                   │
│  └── Elasticsearch (log storage & search)                      │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 1. Prometheus Setup

### Configuration

Update `deploy/prometheus/prometheus.yml`:

- **Scrape Targets**: API, PostgreSQL, Redis, Node Exporter
- **Scrape Intervals**: 10s for API (fast feedback), 15s for others
- **Alert Rules**: Loaded from `alerts.yml` and `business-metrics.yml`

### Alert Rules

- **Infrastructure**: API uptime, database connectivity, resource utilization
- **Performance**: High error rates, latency above SLO, database query slow-down
- **Business**: Worker registration trends, payment throughput, user growth anomalies
- **SLA Monitoring**: Monthly uptime tracking with 99.5% target

### Recording Rules

Pre-computed metrics for efficient querying:

- `api:uptime:month` - Monthly uptime percentage
- `api:response_time:p99` - 99th percentile response time
- `bluecollar:worker:registrations:rate` - Registrations per hour
- `bluecollar:tips:average_value` - Average tip amount

## 2. AlertManager Setup

### Configuration

Update `deploy/alertmanager/alertmanager.yml`:

- **Routing**: Critical alerts → PagerDuty + email + Slack; warnings → Slack
- **Grouping**: Group by alertname, cluster, service
- **Deduplication**: Repeat intervals vary by severity (1h critical, 12h warning)
- **Inhibition**: Suppress cascading alerts (e.g., warnings if critical firing)

### Notification Channels

1. **Slack** (development/staging alerts)
   - Set `SLACK_WEBHOOK_URL` environment variable

2. **Email** (critical + SLA violations)
   - Set `ALERT_EMAIL_CRITICAL` and `ALERT_EMAIL_SLA`
   - Configure SMTP: `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`

3. **PagerDuty** (critical incidents)
   - Set `PAGERDUTY_SERVICE_KEY` for on-call escalation

## 3. Grafana Dashboards

### Pre-built Dashboards

#### System Overview

- API uptime
- Database health
- Redis cache status
- CPU, memory, disk usage
- Network and disk I/O

#### API Performance

- Request rate and error rate
- Response time percentiles (P50, P95, P99)
- Response sizes distribution
- Database query performance
- Cache hit rate

#### Business Metrics

- Worker registrations (daily, weekly, monthly)
- Worker distribution by category
- Tips/payments (count and value in USD)
- User growth and verification rate
- Reviews and ratings
- Contract success rates and gas usage

### Customizing Dashboards

Dashboards are JSON-based and stored in `deploy/grafana/dashboards/`. Edit directly in Grafana UI or modify JSON and reload.

## 4. OpenTelemetry & Jaeger Tracing

### Configuration

`deploy/otel/otel-collector-config.yml`:

- **Receivers**: OTLP over gRPC (4317) and HTTP (4318)
- **Processors**: Memory limiter, batch exporter
- **Exporters**: Jaeger (primary), debug (console for testing)

### Instrumentation

Auto-instrumentation via `@opentelemetry/auto-instrumentations-node`:

- Express HTTP requests
- Database queries (Prisma)
- Outbound HTTP calls
- Redis operations

### Trace Sampling

By default, 100% of traces are exported. For production, reduce via environment:

```bash
OTEL_TRACES_SAMPLER=parentbased_traceidratio
OTEL_TRACES_SAMPLER_ARG=0.1  # Sample 10%
```

### Jaeger UI

Access at `http://localhost:16686` (development) or `https://jaeger.your-domain.com` (production).

Features:

- Search traces by service, operation, tag
- View distributed tracing across services
- Analyze trace timing and dependencies
- Correlate errors and latency spikes

## 5. Logstash Log Aggregation

### Configuration

`deploy/logstash/logstash.conf`:

- **Input**: TCP (5000) and HTTP (8080) for log shipping
- **Filter**: JSON parsing, error tagging, request extraction
- **Output**: Elasticsearch index per day (`bluecollar-logs-YYYY.MM.dd`)

### Shipping Logs

Configure Node.js to send logs to Logstash:

```javascript
// Option 1: Direct TCP
const logstash = require('pino-logstash-http');
logger.transport(
  logstash.httpTransport({
    host: 'logstash-host',
    port: 8080,
  }),
);

// Option 2: Filebeat (recommended)
// Ship logs from `/var/log/bluecollar-api.log` to Logstash via Filebeat
```

### Searching Logs

Use Kibana (Elasticsearch UI) or Grafana's Elasticsearch data source:

- Filter by timestamp, service, log level
- Search for error traces, stack traces
- Correlate logs with metrics and traces

## 6. Integration with Application

### Recording Business Metrics

Use `metricsRecorder` to emit business events:

```typescript
import { metricsRecorder } from './monitoring/business-metrics.js';

// When a worker is created
metricsRecorder.recordWorkerCreated('plumber');

// When a payment is made
metricsRecorder.recordPayment(50, 'XLM', 10.5);

// When a review is created
metricsRecorder.recordReviewCreated(5, 'plumber');
```

### Automatic Syncs

Gauge metrics (e.g., active workers, total users) are synced every 5 minutes:

```typescript
metricsRecorder.startPeriodicSync();
```

Start in `index.ts` during app initialization.

## 7. SLA Monitoring

### Uptime SLA

- **Target**: 99.5% monthly uptime
- **Recorded**: `api:uptime:month = avg(up{job="api"}) * 100`
- **Alert**: Fires if uptime drops below 99.5% for 10 minutes

### Response Time SLA

- **Target**: P99 < 1 second
- **Recorded**: `api:response_time:p99 = histogram_quantile(0.99, ...)`
- **Alert**: Fires if P99 > 1s for 5 minutes

## 8. Deployment

### Docker Compose (Development)

```bash
docker-compose -f deploy/docker-compose.yml \
  -f deploy/prometheus/docker-compose.prometheus.yml \
  -f deploy/alertmanager/docker-compose.alertmanager.yml \
  -f deploy/grafana/docker-compose.grafana.yml \
  -f deploy/jaeger/docker-compose.jaeger.yml \
  up -d
```

### Kubernetes (Production)

Use Helm charts or raw manifests:

```bash
# Prometheus Operator
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install prometheus prometheus-community/kube-prometheus-stack

# Alertmanager
kubectl apply -f deploy/k8s/alertmanager.yaml

# Grafana
helm repo add grafana https://grafana.github.io/helm-charts
helm install grafana grafana/grafana

# Jaeger
helm repo add jaegertracing https://jaegertracing.github.io/helm-charts
helm install jaeger jaegertracing/jaeger
```

## 9. Troubleshooting

### Prometheus not scraping targets

1. Check `curl http://prometheus:9090/api/v1/targets` to see scrape status
2. Verify target endpoints are reachable: `curl http://api:3000/metrics`
3. Check Prometheus logs: `docker logs prometheus`

### Alerts not firing

1. Verify alert rules: `curl http://prometheus:9090/api/v1/rules`
2. Check AlertManager config: `curl http://alertmanager:9093/api/v1/alerts`
3. Test notification channels: Use AlertManager "Test Notification"

### Missing traces in Jaeger

1. Verify OTEL_EXPORTER_OTLP_ENDPOINT is set and reachable
2. Check OTEL collector logs for errors
3. Increase OTEL_TRACES_SAMPLER_ARG to sample more traces

### Logstash not receiving logs

1. Check Logstash connectivity: `telnet logstash 5000`
2. Verify log shipping configuration in app
3. Check Logstash logs: `docker logs logstash`

## 10. Best Practices

- **Retention**: Keep metrics for 30 days, logs for 90 days, traces for 7 days
- **Alerting**: Avoid alert fatigue—set thresholds based on historical baseline
- **Dashboarding**: Create role-based dashboards (ops, product, engineers)
- **Documentation**: Link runbooks to alerts (e.g., "High Error Rate" → runbook.md)
- **Gradual Rollout**: Test alerting in staging before enabling in production
- **Regular Reviews**: Audit alert effectiveness and adjust thresholds monthly
