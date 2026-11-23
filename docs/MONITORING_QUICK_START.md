# Monitoring Quick Start

Get the production monitoring stack up and running in minutes.

## 1. Environment Setup

```bash
cd deploy/monitoring

# Copy and configure environment variables
cp .env.example .env

# Edit .env with your settings:
# - SLACK_WEBHOOK_URL (for Slack alerts)
# - PAGERDUTY_SERVICE_KEY (for on-call escalation)
# - SMTP credentials (for email alerts)
# - Database credentials
# - Grafana admin password
nano .env
```

## 2. Start the Monitoring Stack

### Docker Compose (Development/Single Node)

```bash
# Start all monitoring services
docker-compose -f ../docker-compose.monitoring.yml up -d

# Verify services are running
docker-compose -f ../docker-compose.monitoring.yml ps

# View logs
docker-compose -f ../docker-compose.monitoring.yml logs -f prometheus
docker-compose -f ../docker-compose.monitoring.yml logs -f alertmanager
docker-compose -f ../docker-compose.monitoring.yml logs -f grafana
```

### Kubernetes (Production)

```bash
# Set up namespace
kubectl create namespace bluecollar-monitoring

# Apply secrets
kubectl create secret generic monitoring-secrets \
  --from-env-file=.env \
  -n bluecollar-monitoring

# Deploy Prometheus
kubectl apply -f ../k8s/prometheus/ -n bluecollar-monitoring

# Deploy AlertManager
kubectl apply -f ../k8s/alertmanager/ -n bluecollar-monitoring

# Deploy Grafana
kubectl apply -f ../k8s/grafana/ -n bluecollar-monitoring

# Deploy Jaeger
kubectl apply -f ../k8s/jaeger/ -n bluecollar-monitoring

# Verify deployments
kubectl get pods -n bluecollar-monitoring
```

## 3. Access Monitoring UIs

### Local Development

| Service      | URL                    | Credentials   |
| ------------ | ---------------------- | ------------- |
| Prometheus   | http://localhost:9090  | No auth       |
| AlertManager | http://localhost:9093  | No auth       |
| Grafana      | http://localhost:3001  | admin / admin |
| Jaeger       | http://localhost:16686 | No auth       |

### Production (Kubernetes)

```bash
# Port-forward services
kubectl port-forward -n bluecollar-monitoring svc/prometheus 9090:9090
kubectl port-forward -n bluecollar-monitoring svc/alertmanager 9093:9093
kubectl port-forward -n bluecollar-monitoring svc/grafana 3000:3000
kubectl port-forward -n bluecollar-monitoring svc/jaeger 16686:16686
```

Or set up Ingress:

```bash
kubectl apply -f ../k8s/ingress-monitoring.yaml
# Access at https://prometheus.your-domain.com, etc.
```

## 4. Configure Grafana

### First Login

1. Navigate to http://localhost:3001
2. Login with `admin` / `admin`
3. Change password (⚙️ Admin > Users > Change Password)

### Auto-provisioned Dashboards

Dashboards are auto-loaded from `deploy/grafana/dashboards/`:

- System Overview
- API Performance
- Business Metrics

Data sources (Prometheus, Jaeger, Elasticsearch) are auto-provisioned.

### Create Custom Dashboard

1. Click "+" → "Dashboard"
2. Add panels with PromQL queries
3. Save with descriptive name and tag

### Dashboard Sharing

```bash
# Export dashboard as JSON
# In Grafana: Dashboard settings → JSON model
# Save to deploy/grafana/dashboards/my-dashboard.json

# Commit to Git for version control
git add deploy/grafana/dashboards/my-dashboard.json
git commit -m "Add custom dashboard"
```

## 5. Test Alerting

### Send Test Alert

```bash
# Test via AlertManager API
curl -X POST http://localhost:9093/api/v1/alerts \
  -H 'Content-Type: application/json' \
  -d '[{
    "status": "firing",
    "labels": {
      "alertname": "TestAlert",
      "severity": "critical"
    },
    "annotations": {
      "summary": "This is a test alert",
      "description": "Verify Slack/email notifications work"
    }
  }]'
```

### Check Alert Status

```bash
# View all alerts
curl http://localhost:9090/api/v1/alerts

# View alert rules
curl http://localhost:9090/api/v1/rules

# View AlertManager alerts
curl http://localhost:9093/api/v1/alerts
```

## 6. API Integration

### Enable Metrics Endpoint

The API exposes metrics at `/metrics`:

```bash
# Verify metrics endpoint
curl http://localhost:3000/metrics | head -20

# Example output:
# # HELP http_requests_total Total number of HTTP requests
# # TYPE http_requests_total counter
# http_requests_total{method="GET",route="/api/workers",status_code="200"} 1542
```

### Record Business Events

In your service code:

```typescript
import { metricsRecorder } from './monitoring/business-metrics.js';

// Worker created
metricsRecorder.recordWorkerCreated('plumber');

// Payment processed
metricsRecorder.recordPayment(50, 'XLM', 12.5);

// Contract interaction
metricsRecorder.recordContractTx('register', true, 145000);
```

## 7. Troubleshooting

### Prometheus Not Scraping

```bash
# Check target status
curl http://localhost:9090/api/v1/targets

# Expected output shows all jobs as "up": "true"
```

**Fix:**

- Verify API is running: `curl http://localhost:3000/health`
- Check network: `docker network ls` & `docker network inspect bluecollar-network`
- View Prometheus logs: `docker logs bluecollar-prometheus`

### Alerts Not Firing

```bash
# Check alert evaluation
curl http://localhost:9090/api/v1/rules | jq '.data.groups[].rules[] | select(.alert)'

# Check AlertManager route config
curl http://localhost:9093/api/v2/status
```

**Fix:**

- Verify metrics exist: `curl http://localhost:9090/api/v1/query?query=up`
- Review alert thresholds (e.g., high error rate > 0.05)
- Test notification channels: AlertManager UI → Test Notification

### Traces Not Showing in Jaeger

```bash
# Check OTEL endpoint
curl http://localhost:4318/v1/traces -X POST \
  -H 'Content-Type: application/json' \
  -d '{"resourceSpans":[]}'

# Check API configuration
echo $OTEL_EXPORTER_OTLP_ENDPOINT
```

**Fix:**

- Restart API: `docker restart bluecollar-api`
- Check OTEL collector logs: `docker logs bluecollar-otel-collector`
- Increase trace sampling: `OTEL_TRACES_SAMPLER_ARG=1.0`

### High Disk Usage

```bash
# Check Prometheus data size
du -sh prometheus-data/

# Check Elasticsearch data size
du -sh elasticsearch-data/

# Reduce retention
# Prometheus: Edit prometheus.yml → storage.tsdb.retention.time=7d
# Elasticsearch: Implement index lifecycle policies
```

## 8. Next Steps

- Set up Slack channel webhooks for alerts
- Configure email alerts for SLA violations
- Add PagerDuty for on-call escalation
- Create role-based dashboard access in Grafana
- Set up log aggregation ingestion from other services
- Implement custom metrics for business KPIs
- Configure automated backups of Prometheus data

## 9. Production Checklist

- [ ] Change Grafana default password
- [ ] Enable SSL/TLS for all endpoints (reverse proxy)
- [ ] Configure persistent storage for all volumes
- [ ] Set up log rotation for Logstash
- [ ] Enable authentication for /metrics endpoint
- [ ] Configure AlertManager SMTP with TLS
- [ ] Set up monitoring for the monitoring stack itself
- [ ] Establish runbooks for common alerts
- [ ] Test disaster recovery procedures
- [ ] Document alert escalation policies

## 10. Documentation

Full documentation: See [docs/MONITORING_SETUP.md](../MONITORING_SETUP.md)
