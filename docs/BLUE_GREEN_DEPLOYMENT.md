# Blue-Green Deployment Guide for BlueCollar

This guide covers implementing zero-downtime deployments using the blue-green deployment strategy.

## Overview

Blue-green deployment maintains two identical production environments:

- **Blue**: Current production environment
- **Green**: New version being deployed

Traffic is switched from blue to green after validation, enabling instant rollback if needed.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Load Balancer / Router                    │
│                  (Routes 100% to Blue/Green)                 │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
    ┌───▼────┐              ┌────▼───┐
    │  Blue  │              │ Green  │
    │ (Live) │              │ (New)  │
    └────────┘              └────────┘
    - API v1                - API v2
    - App v1                - App v2
    - DB (shared)           - DB (shared)
```

## Prerequisites

- Docker and Docker Compose
- AWS ECS/ELB or similar orchestration platform
- Health check endpoints configured
- Automated test suite
- Monitoring and alerting setup

## Step 1: Infrastructure Setup

### Docker Compose Configuration

Create `docker-compose.blue-green.yml`:

```yaml
version: '3.8'

services:
  # Blue environment
  api-blue:
    image: bluecollar-api:${BLUE_VERSION}
    container_name: api-blue
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - PORT=3000
    ports:
      - '3001:3000'
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:3000/health']
      interval: 10s
      timeout: 5s
      retries: 3
    networks:
      - bluecollar

  app-blue:
    image: bluecollar-app:${BLUE_VERSION}
    container_name: app-blue
    environment:
      - NEXT_PUBLIC_API_URL=http://api-blue:3000
    ports:
      - '3011:3000'
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:3000/health']
      interval: 10s
      timeout: 5s
      retries: 3
    networks:
      - bluecollar

  # Green environment
  api-green:
    image: bluecollar-api:${GREEN_VERSION}
    container_name: api-green
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - PORT=3000
    ports:
      - '3002:3000'
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:3000/health']
      interval: 10s
      timeout: 5s
      retries: 3
    networks:
      - bluecollar
    profiles:
      - green

  app-green:
    image: bluecollar-app:${GREEN_VERSION}
    container_name: app-green
    environment:
      - NEXT_PUBLIC_API_URL=http://api-green:3000
    ports:
      - '3012:3000'
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:3000/health']
      interval: 10s
      timeout: 5s
      retries: 3
    networks:
      - bluecollar
    profiles:
      - green

  # Load balancer
  nginx:
    image: nginx:alpine
    container_name: nginx-lb
    ports:
      - '80:80'
      - '443:443'
    volumes:
      - ./deploy/nginx/bluecollar.conf:/etc/nginx/conf.d/default.conf
      - ./deploy/nginx/ssl:/etc/nginx/ssl
    depends_on:
      - api-blue
      - app-blue
    networks:
      - bluecollar

networks:
  bluecollar:
    driver: bridge
```

### Nginx Load Balancer Configuration

Create `deploy/nginx/bluecollar-blue-green.conf`:

```nginx
upstream api_blue {
    server api-blue:3000;
}

upstream api_green {
    server api-green:3000;
}

upstream app_blue {
    server app-blue:3000;
}

upstream app_green {
    server app-green:3000;
}

# Variable to track active environment
map $http_x_deployment_target $api_upstream {
    default api_blue;
    green   api_green;
}

map $http_x_deployment_target $app_upstream {
    default app_blue;
    green   app_green;
}

server {
    listen 80;
    server_name api.bluecollar.local;

    location / {
        proxy_pass http://$api_upstream;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /health {
        access_log off;
        proxy_pass http://$api_upstream;
    }
}

server {
    listen 80;
    server_name app.bluecollar.local;

    location / {
        proxy_pass http://$app_upstream;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /health {
        access_log off;
        proxy_pass http://$app_upstream;
    }
}
```

## Step 2: Deployment Scripts

### Deploy Script

Create `deploy/scripts/deploy-blue-green.sh`:

```bash
#!/bin/bash
set -e

ENVIRONMENT=${1:-production}
BLUE_VERSION=$(git describe --tags --always)
GREEN_VERSION=$(git rev-parse --short HEAD)

echo "🚀 Starting blue-green deployment"
echo "Environment: $ENVIRONMENT"
echo "Blue version: $BLUE_VERSION"
echo "Green version: $GREEN_VERSION"

# Step 1: Build new images
echo "📦 Building Docker images..."
docker build -t bluecollar-api:$GREEN_VERSION packages/api/
docker build -t bluecollar-app:$GREEN_VERSION packages/app/

# Step 2: Start green environment
echo "🟢 Starting green environment..."
docker-compose -f docker-compose.blue-green.yml --profile green up -d api-green app-green

# Step 3: Run smoke tests
echo "🧪 Running smoke tests..."
./deploy/scripts/smoke-tests.sh green

# Step 4: Run integration tests
echo "🔗 Running integration tests..."
./deploy/scripts/integration-tests.sh green

# Step 5: Switch traffic
echo "🔄 Switching traffic to green..."
./deploy/scripts/switch-traffic.sh green

# Step 6: Monitor for errors
echo "📊 Monitoring green environment..."
./deploy/scripts/monitor-deployment.sh green 300  # Monitor for 5 minutes

# Step 7: Cleanup blue environment
echo "🧹 Cleaning up blue environment..."
docker-compose -f docker-compose.blue-green.yml down

echo "✅ Deployment completed successfully!"
```

### Smoke Tests Script

Create `deploy/scripts/smoke-tests.sh`:

```bash
#!/bin/bash
set -e

ENVIRONMENT=$1
API_URL="http://localhost:3002"  # Green API
APP_URL="http://localhost:3012"  # Green App

if [ "$ENVIRONMENT" = "blue" ]; then
    API_URL="http://localhost:3001"
    APP_URL="http://localhost:3011"
fi

echo "🧪 Running smoke tests on $ENVIRONMENT environment..."

# Test API health
echo "Testing API health..."
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" $API_URL/health)
if [ "$HEALTH" != "200" ]; then
    echo "❌ API health check failed: $HEALTH"
    exit 1
fi
echo "✅ API health check passed"

# Test API endpoints
echo "Testing API endpoints..."
CATEGORIES=$(curl -s -o /dev/null -w "%{http_code}" $API_URL/api/categories)
if [ "$CATEGORIES" != "200" ]; then
    echo "❌ Categories endpoint failed: $CATEGORIES"
    exit 1
fi
echo "✅ Categories endpoint passed"

# Test App health
echo "Testing App health..."
APP_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" $APP_URL/health)
if [ "$APP_HEALTH" != "200" ]; then
    echo "❌ App health check failed: $APP_HEALTH"
    exit 1
fi
echo "✅ App health check passed"

# Test App homepage
echo "Testing App homepage..."
HOMEPAGE=$(curl -s -o /dev/null -w "%{http_code}" $APP_URL/)
if [ "$HOMEPAGE" != "200" ]; then
    echo "❌ App homepage failed: $HOMEPAGE"
    exit 1
fi
echo "✅ App homepage passed"

echo "✅ All smoke tests passed!"
```

### Traffic Switch Script

Create `deploy/scripts/switch-traffic.sh`:

```bash
#!/bin/bash
set -e

TARGET=$1

echo "🔄 Switching traffic to $TARGET environment..."

# Update Nginx configuration
if [ "$TARGET" = "green" ]; then
    echo "Routing traffic to green..."
    # Update load balancer to route to green
    docker exec nginx-lb nginx -s reload

    # Update environment variable
    export ACTIVE_ENVIRONMENT=green
else
    echo "Routing traffic to blue..."
    docker exec nginx-lb nginx -s reload
    export ACTIVE_ENVIRONMENT=blue
fi

echo "✅ Traffic switched to $TARGET"

# Verify traffic is flowing
sleep 2
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/health)
if [ "$HEALTH" != "200" ]; then
    echo "❌ Health check failed after traffic switch"
    exit 1
fi

echo "✅ Traffic switch verified"
```

### Rollback Script

Create `deploy/scripts/rollback.sh`:

```bash
#!/bin/bash
set -e

echo "⏮️  Rolling back to previous environment..."

CURRENT=$(echo $ACTIVE_ENVIRONMENT)

if [ "$CURRENT" = "green" ]; then
    echo "Rolling back from green to blue..."
    ./deploy/scripts/switch-traffic.sh blue
    docker-compose -f docker-compose.blue-green.yml --profile green down
else
    echo "Rolling back from blue to green..."
    ./deploy/scripts/switch-traffic.sh green
    docker-compose -f docker-compose.blue-green.yml down
fi

echo "✅ Rollback completed"
```

### Monitoring Script

Create `deploy/scripts/monitor-deployment.sh`:

```bash
#!/bin/bash

ENVIRONMENT=$1
DURATION=${2:-300}  # Default 5 minutes

API_URL="http://localhost:3002"
if [ "$ENVIRONMENT" = "blue" ]; then
    API_URL="http://localhost:3001"
fi

echo "📊 Monitoring $ENVIRONMENT environment for ${DURATION}s..."

START_TIME=$(date +%s)
ERROR_COUNT=0
SUCCESS_COUNT=0

while true; do
    CURRENT_TIME=$(date +%s)
    ELAPSED=$((CURRENT_TIME - START_TIME))

    if [ $ELAPSED -gt $DURATION ]; then
        break
    fi

    # Check API health
    HEALTH=$(curl -s -o /dev/null -w "%{http_code}" $API_URL/health)

    if [ "$HEALTH" = "200" ]; then
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    else
        ERROR_COUNT=$((ERROR_COUNT + 1))
        echo "⚠️  Health check failed: $HEALTH"
    fi

    # Check error rate
    if [ $ERROR_COUNT -gt 5 ]; then
        echo "❌ Too many errors detected, initiating rollback..."
        ./deploy/scripts/rollback.sh
        exit 1
    fi

    sleep 5
done

echo "✅ Monitoring completed: $SUCCESS_COUNT successes, $ERROR_COUNT errors"
```

## Step 3: GitHub Actions Workflow

Create `.github/workflows/blue-green-deploy.yml`:

```yaml
name: Blue-Green Deployment

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Build Docker images
        run: |
          docker build -t bluecollar-api:${{ github.sha }} packages/api/
          docker build -t bluecollar-app:${{ github.sha }} packages/app/

      - name: Push to registry
        run: |
          echo ${{ secrets.DOCKER_PASSWORD }} | docker login -u ${{ secrets.DOCKER_USERNAME }} --password-stdin
          docker tag bluecollar-api:${{ github.sha }} ${{ secrets.DOCKER_REGISTRY }}/bluecollar-api:${{ github.sha }}
          docker tag bluecollar-app:${{ github.sha }} ${{ secrets.DOCKER_REGISTRY }}/bluecollar-app:${{ github.sha }}
          docker push ${{ secrets.DOCKER_REGISTRY }}/bluecollar-api:${{ github.sha }}
          docker push ${{ secrets.DOCKER_REGISTRY }}/bluecollar-app:${{ github.sha }}

      - name: Deploy to production
        run: |
          chmod +x deploy/scripts/deploy-blue-green.sh
          ./deploy/scripts/deploy-blue-green.sh production
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          DOCKER_REGISTRY: ${{ secrets.DOCKER_REGISTRY }}

      - name: Notify deployment
        if: success()
        run: |
          echo "✅ Deployment successful"
          # Send notification to Slack, email, etc.

      - name: Rollback on failure
        if: failure()
        run: |
          chmod +x deploy/scripts/rollback.sh
          ./deploy/scripts/rollback.sh
```

## Step 4: Monitoring and Alerting

### CloudWatch Metrics

Monitor these key metrics:

- API response time
- Error rate (4xx, 5xx)
- Request count
- Database connection pool
- Memory usage
- CPU usage

### Alerting Rules

```yaml
Alerts:
  - name: HighErrorRate
    condition: error_rate > 5%
    action: trigger_rollback

  - name: HighLatency
    condition: p99_latency > 2000ms
    action: notify_team

  - name: DatabaseConnectionPoolExhausted
    condition: db_connections > 90%
    action: trigger_rollback
```

## Step 5: Rollback Procedure

### Automatic Rollback

Triggered when:

- Health checks fail
- Error rate exceeds threshold
- Performance degrades significantly

### Manual Rollback

```bash
./deploy/scripts/rollback.sh
```

## Best Practices

1. **Always run smoke tests** before switching traffic
2. **Monitor for at least 5 minutes** after deployment
3. **Keep both environments identical** except for code version
4. **Use feature flags** for gradual rollout
5. **Maintain database compatibility** between versions
6. **Document all deployments** in deployment log
7. **Test rollback procedure** regularly
8. **Use canary deployments** for high-risk changes

## Troubleshooting

### Deployment Stuck

```bash
# Check container status
docker ps -a

# View logs
docker logs api-green
docker logs app-green

# Force cleanup
docker-compose -f docker-compose.blue-green.yml down -v
```

### Traffic Not Switching

```bash
# Check Nginx configuration
docker exec nginx-lb nginx -t

# Reload Nginx
docker exec nginx-lb nginx -s reload

# Check upstream health
curl -v http://localhost/health
```

### Database Migration Issues

```bash
# Run migrations on green before switching
docker exec api-green npm run migrate

# Verify migration status
docker exec api-green npm run migrate:status
```

## References

- [Blue-Green Deployment Pattern](https://martinfowler.com/bliki/BlueGreenDeployment.html)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Nginx Load Balancing](https://nginx.org/en/docs/http/load_balancing.html)
