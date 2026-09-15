# Metrics Collection & Observability

This document describes the metrics collection infrastructure for Armored Archer and provides guidance for monitoring application performance and health.

## Overview

The project implements metrics collection using Prometheus and DataDog for observability. This enables monitoring application performance, tracking key business metrics, and setting up visualization dashboards.

## Requirements Addressed

- [x] Implement metrics collection (e.g., Prometheus, DataDog)
- [x] Define key performance metrics
- [x] Set up metrics visualization and dashboards

## Metrics Collection Infrastructure

### Prometheus

Prometheus metrics are exposed via the `/metrics` RPC endpoint and collected by Prometheus servers.

**Configuration File:** `backend/prometheus.yml`

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'armored-archer'
    metrics_path: '/rpc/armored_archer/metrics'
    static_configs:
      - targets: ['localhost:8080']
    metric_relabel_configs:
      - source_labels: [__name__]
        regex: 'armored_archer_.*'
        action: keep
    labels:
      cluster: 'armored-archer'
      environment: 'development'
```

**Key Features:**
- 15s scrape intervals for near real-time monitoring
- Cluster and environment labels for multi-environment support
- Metric relabeling to filter relevant metrics

### DataDog Integration

DataDog integration is available for advanced monitoring and APM.

**Configuration File:** `backend/src/modules/datadog_integration.ts`

```typescript
import { createMetricsLogger, MetricsLogger, DDAgent } from 'datadog-metrics';

// Initialize DataDog metrics
const metricsLogger: MetricsLogger = createMetricsLogger({
  host: 'armored-archer',
  prefix: 'armored_archer.',
  flushIntervalSeconds: 10,
});
```

## Key Performance Metrics

### RPC Metrics

| Metric Name | Type | Description |
|-------------|------|-------------|
| `armored_archer_rpc_requests_total` | Counter | Total RPC requests |
| `armored_archer_rpc_request_duration_seconds` | Histogram | RPC request duration |
| `armored_archer_rpc_errors_total` | Counter | Total RPC errors |

### Business Metrics

| Metric Name | Type | Description |
|-------------|------|-------------|
| `armored_archer_purchases_total` | Counter | Total purchase transactions |
| `armored_archer_revenue_cents_total` | Counter | Total revenue in cents |
| `armored_archer_active_users` | Gauge | Current active users |
| `armored_archer_session_duration_seconds` | Histogram | User session duration |

### RPG System Metrics

| Metric Name | Type | Description |
|-------------|------|-------------|
| `armored_archer_xp_gained_total` | Counter | Total XP gained |
| `armored_archer_level_ups_total` | Counter | Total level ups |
| `armored_archer_items_purchased_total` | Counter | Items purchased |
| `armored_archer_gold_balance` | Gauge | Current gold balance |

### Security Metrics (issue #1141)

Emitted by the admin gate ([ADR-0006](../docs/adr/0006-admin-gate-allowlist-policy.md)).

| Metric Name | Type | Description |
|-------------|------|-------------|
| `armored_archer_admin_rpc_access_denied_total` | Counter | Admin RPC rejections by the `withAdminGuard` allowlist gate; labels `rpc_id`, `reason` (`caller_not_in_admin_allowlist` / `caller_id_missing`) |
| `armored_archer_admin_allowlist_size` | Gauge | Entries in the `ADMIN_USER_IDS` allowlist; 0 = fail-closed (every admin RPC rejects every caller). Set on startup and on every allowlist (re)resolution |

## Metrics Implementation

### Source Files

| File | Description |
|------|-------------|
| `backend/src/modules/metrics.ts` | Core metrics implementation with Counter, Histogram, Gauge |
| `backend/src/modules/datadog_integration.ts` | DataDog integration module |
| `backend/prometheus.yml` | Prometheus scrape configuration |
| `backend/grafana/provisioning/dashboards/armed-archer-dashboard.json` | Grafana dashboard |

### Usage Examples

#### Recording RPC Metrics

```typescript
import { registerRpcWithMetrics } from './modules/metrics';

// Wrap an RPC handler with automatic metrics collection
registerRpcWithMetrics(
  initializer,
  'armored_archer/get_player_data',
  'getPlayerData',
  async (ctx, request) => {
    // RPC handler implementation
    return playerData;
  }
);
```

#### Recording Custom Metrics

```typescript
import { recordPurchase, recordRevenue } from './modules/metrics';

// Record a purchase event
recordPurchase(playerId, itemId, 100); // 100 cents

// Record revenue
recordRevenue(5000); // $50.00 in cents
```

## Visualization Dashboards

### Grafana Dashboard

The project includes a provisioned Grafana dashboard for visualizing metrics.

**Dashboard File:** `backend/grafana/provisioning/dashboards/armed-archer-dashboard.json`

**Features:**
- RPC request rate and latency
- Error rates
- Active users over time
- Revenue and purchase metrics
- Player progression stats

### Dashboard Setup

1. Start Grafana:
   ```bash
   docker-compose up -d grafana
   ```

2. Access Grafana at `http://localhost:3000`

3. The dashboard is automatically provisioned via `dashboards.yml`

### Prometheus Queries

Example PromQL queries for custom dashboards:

```promql
# RPC request rate
rate(armored_archer_rpc_requests_total[5m])

# 95th percentile latency
histogram_quantile(0.95, rate(armored_archer_rpc_request_duration_seconds_bucket[5m]))

# Error rate
rate(armored_archer_rpc_errors_total[5m]) / rate(armored_archer_rpc_requests_total[5m])

# Active users
armored_archer_active_users

# Revenue per hour
rate(armored_archer_revenue_cents_total[1h])
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ENABLE_PROMETHEUS` | Enable Prometheus metrics | `true` |
| `ENABLE_DATADOG` | Enable DataDog integration | `false` |
| `DATADOG_API_KEY` | DataDog API key | - |
| `DATADOG_APP_KEY` | DataDog application key | - |

## Related Documentation

- [DEPLOYMENT_READINESS.md](./DEPLOYMENT_READINESS.md) - Deployment readiness criteria
- [Grafana Documentation](https://grafana.com/docs/grafana/latest/)
- [Prometheus Documentation](https://prometheus.io/docs/introduction/overview/)
- [DataDog Documentation](https://docs.datadoghq.com/)
