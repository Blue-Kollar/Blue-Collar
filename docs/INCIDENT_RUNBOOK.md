# Incident Runbook

## Overview
This runbook provides step-by-step procedures for common incidents.

## Table of Contents
1. [API High Error Rate](#api-high-error-rate)
2. [API High Latency](#api-high-latency)
3. [Indexer Lag](#indexer-lag)
4. [Queue Backlog](#queue-backlog)
5. [Contract Failures](#contract-failures)

---

## API High Error Rate

### Alert
kubectl exec -it deployment/blue-collar-api --namespace blue-collar -- curl http://postgresql:5432
kubectl top pods --namespace blue-collar
APIHighLatency - API p95 latency exceeds 2s
kubectl exec -it deployment/postgresql -- namespace blue-collar -- psql -c "SELECT * FROM pg_stat_activity;"
kubectl exec -it deployment/postgresql -- namespace blue-collar -- psql -c "SELECT query, duration FROM pg_stat_statements ORDER BY duration DESC LIMIT 10;"
kubectl scale deployment/blue-collar-api --namespace blue-collar --replicas=5
curl -s -w "%{time_total}\n" -o /dev/null https://external-api.example.com
kubectl logs deployment/blue-collar-indexer --namespace blue-collar --tail=100
curl -X POST https://rpc.stellar.org -d '{"jsonrpc":"2.0","method":"getHealth"}'
kubectl rollout restart deployment/blue-collar-indexer --namespace blue-collar
kubectl exec -it deployment/blue-collar-indexer --namespace blue-collar -- pg_isready -h postgresql
