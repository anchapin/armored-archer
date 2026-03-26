# Phase 2.2 - Grafana Dashboard Configuration Guide

**Milestone**: v2.1.0 - Alpha Launch & Stabilization  
**Phase**: 2.2 - Grafana Dashboard Setup  
**Date**: 2026-03-16  
**Status**: ✅ Complete  

---

## Overview

This document provides comprehensive guidance for configuring and using the 4 Grafana dashboards created for Armored Archer alpha monitoring.

---

## Dashboard Files Location

All dashboard JSON files are located in:
```
backend/grafana/dashboards/
├── 01-overview.json          # System health and key metrics
├── 02-performance.json       # Performance and latency analysis
├── 03-business-metrics.json  # Business and economy metrics
└── 04-errors-alerts.json     # Error tracking and alerting
```

---

## Dashboard 1: Overview

**File**: `01-overview.json`  
**UID**: `armored-archer-overview`  
**Purpose**: High-level system health and key performance indicators

### Panels

| Panel ID | Title | Type | Description |
|----------|-------|------|-------------|
| 1 | Server Health | Stat | Overall health status (Healthy/Unhealthy) |
| 2 | Server Uptime | Stat | Time since server start |
| 3 | Active Players | Stat | Current active player sessions |
| 4 | Error Rate | Stat | Current error rate percentage |
| 5 | RPC Response Times | Time Series | P50, P95, P99 latency percentiles |
| 6 | RPC Call Rate | Time Series | Requests per second |
| 7 | CPU Usage | Gauge | Current CPU utilization |
| 8 | Memory Usage | Gauge | Current memory utilization |
| 9 | Disk Available | Stat | Available disk space percentage |
| 10 | Database Connections | Stat | Active database connections |

### Key Metrics

```promql
# Server Health
armored_archer_health_status{component="overall"}

# Active Players
armored_archer_player_active_sessions

# Error Rate
rate(armored_archer_rpc_errors_total[5m]) / rate(armored_archer_rpc_calls_total[5m]) * 100

# Response Time Percentiles
histogram_quantile(0.50, sum(rate(armored_archer_rpc_duration_seconds_bucket[5m])) by (le))
histogram_quantile(0.95, sum(rate(armored_archer_rpc_duration_seconds_bucket[5m])) by (le))
histogram_quantile(0.99, sum(rate(armored_archer_rpc_duration_seconds_bucket[5m])) by (le))
```

### Variables

| Name | Label | Type | Query |
|------|-------|------|-------|
| datasource | Data Source | Datasource | Prometheus |
| environment | Environment | Query | `label_values(armored_archer_health_status, environment)` |

---

## Dashboard 2: Performance

**File**: `02-performance.json`  
**UID**: `armored-archer-performance`  
**Purpose**: Detailed performance analysis and resource utilization

### Panels

#### RPC Latency Analysis
| Panel ID | Title | Type | Description |
|----------|-------|------|-------------|
| 1 | RPC Latency Histogram | Time Series | P50, P75, P90, P95, P99 percentiles |
| 2 | Average RPC Latency by Endpoint | Time Series | Per-endpoint average latency |

#### Database Performance
| Panel ID | Title | Type | Description |
|----------|-------|------|-------------|
| 3 | Database Query Times | Time Series | P50, P95, P99 query duration |
| 4 | Database Connection Pool | Time Series | Active, idle, max connections |

#### Cache Performance
| Panel ID | Title | Type | Description |
|----------|-------|------|-------------|
| 5 | Cache Hit Rate | Gauge | Cache effectiveness percentage |
| 6 | Cache Operations | Time Series | Hits and misses over time |

#### Memory Usage
| Panel ID | Title | Type | Description |
|----------|-------|------|-------------|
| 7 | Memory Usage Details | Time Series | Process RSS, Go heap metrics |
| 8 | System Memory Usage | Time Series | Overall system memory |

#### CPU Usage
| Panel ID | Title | Type | Description |
|----------|-------|------|-------------|
| 9 | CPU Usage Over Time | Time Series | Total CPU utilization |
| 10 | CPU Usage by Core | Time Series | Per-core CPU breakdown |

#### Request Throughput
| Panel ID | Title | Type | Description |
|----------|-------|------|-------------|
| 11 | Request Throughput | Time Series | Total requests per second |
| 12 | Throughput by RPC Endpoint | Time Series | Per-endpoint request rate |

### Key Metrics

```promql
# Cache Hit Rate
rate(armored_archer_cache_hits_total[5m]) / (rate(armored_archer_cache_hits_total[5m]) + rate(armored_archer_cache_misses_total[5m])) * 100

# Database Query Times
histogram_quantile(0.95, sum(rate(armored_archer_db_query_duration_seconds_bucket[5m])) by (le))

# Go Memory
go_memstats_alloc_bytes{job="nakama"}
process_resident_memory_bytes{job="nakama"}

# CPU Usage
100 - (avg(irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)
```

### Variables

| Name | Label | Type | Query |
|------|-------|------|-------|
| datasource | Data Source | Datasource | Prometheus |
| rpc_endpoint | RPC Endpoint | Query | `label_values(armored_archer_rpc_calls_total, rpc)` |
| instance | Instance | Query | `label_values(node_cpu_seconds_total, instance)` |

---

## Dashboard 3: Business Metrics

**File**: `03-business-metrics.json`  
**UID**: `armored-archer-business`  
**Purpose**: Business KPIs, economy, and player progression

### Panels

#### Player Registrations
| Panel ID | Title | Type | Description |
|----------|-------|------|-------------|
| 1 | Total Player Registrations | Stat | Cumulative registrations |
| 2 | Registrations (Last 24h) | Stat | New players in 24h |
| 3 | Registration Rate | Time Series | Registrations per hour |

#### Match Activity
| Panel ID | Title | Type | Description |
|----------|-------|------|-------------|
| 4 | Match Creation vs Completion | Time Series | Matches created vs completed |
| 5 | Match Queue & Active Matches | Time Series | Queue size and active games |

#### Gear & Economy
| Panel ID | Title | Type | Description |
|----------|-------|------|-------------|
| 6 | Gear Generated (24h) | Stat | Total gear created |
| 7 | Gear Generation by Type & Rarity | Time Series | Gear distribution |

#### Store Transactions
| Panel ID | Title | Type | Description |
|----------|-------|------|-------------|
| 8 | Revenue (Last 24h) | Stat | Total revenue |
| 9 | Store Transactions (24h) | Stat | Transaction count |
| 10 | Store Transactions | Time Series | Successful vs failed |
| 11 | Revenue by Product Type | Time Series | Revenue breakdown |

#### Season Progression
| Panel ID | Title | Type | Description |
|----------|-------|------|-------------|
| 12 | Current Season ID | Stat | Active season number |
| 13 | Season Active Players | Stat | Players in current season |
| 14 | Season Progression Events | Time Series | Level ups, rewards, etc. |

#### Leaderboard Activity
| Panel ID | Title | Type | Description |
|----------|-------|------|-------------|
| 15 | Leaderboard Queries | Time Series | Leaderboard lookups |
| 16 | Leaderboard Score Submissions | Time Series | Score updates |

### Key Metrics

```promql
# Player Registrations
armored_archer_player_registrations_total
rate(armored_archer_player_registrations_total[24h])

# Match Activity
rate(armored_archer_matches_created_total[5m])
rate(armored_archer_matches_completed_total[5m])
armored_archer_match_queue_size

# Revenue
rate(armored_archer_purchase_revenue_total[24h])
rate(armored_archer_purchases_total{status="success"}[1h])

# Gear Generation
rate(armored_archer_gear_generated_total[1h])

# Season
armored_archer_season_current_id
armored_archer_season_active_players

# Leaderboards
rate(armored_archer_leaderboard_queries_total[1h])
rate(armored_archer_leaderboard_submissions_total[1h])
```

### Variables

| Name | Label | Type | Query |
|------|-------|------|-------|
| datasource | Data Source | Datasource | Prometheus |
| match_type | Match Type | Query | `label_values(armored_archer_matches_created_total, match_type)` |
| gear_type | Gear Type | Query | `label_values(armored_archer_gear_generated_total, gear_type)` |
| product_type | Product Type | Query | `label_values(armored_archer_purchases_total, product_type)` |

---

## Dashboard 4: Errors & Alerts

**File**: `04-errors-alerts.json`  
**UID**: `armored-archer-errors-alerts`  
**Purpose**: Error tracking, alert management, and health monitoring

### Panels

#### Error Rate Overview
| Panel ID | Title | Type | Description |
|----------|-------|------|-------------|
| 1 | Overall Error Rate | Stat | Current error percentage |
| 2 | Total Errors (5min) | Stat | Error count in window |
| 3 | Active Alerts | Stat | Currently firing alerts |
| 4 | Pending Alerts | Stat | Alerts in pending state |

#### Error Rate by Endpoint
| Panel ID | Title | Type | Description |
|----------|-------|------|-------------|
| 5 | Error Rate by RPC Endpoint | Time Series | Error % per endpoint |
| 6 | Error Count by Endpoint | Time Series | Absolute error counts |

#### Error Types Breakdown
| Panel ID | Title | Type | Description |
|----------|-------|------|-------------|
| 7 | Error Types (24h) | Pie Chart | Error distribution |
| 8 | Error Rate by Type | Time Series | Error rate over time |

#### Alert History
| Panel ID | Title | Type | Description |
|----------|-------|------|-------------|
| 9 | Alert State Changes | Time Series | Alert transitions |
| 10 | Currently Firing Alerts | Table | Active alert details |

#### Circuit Breaker Status
| Panel ID | Title | Type | Description |
|----------|-------|------|-------------|
| 11 | Circuit Breaker State | Stat | Current state per breaker |
| 12 | Circuit Breaker Trips | Time Series | Trip frequency |

#### Health Check Status
| Panel ID | Title | Type | Description |
|----------|-------|------|-------------|
| 13-18 | Component Health | Stat | Per-component health status |
| 19 | Health Check Response Times | Time Series | Health check latency |

### Key Metrics

```promql
# Error Rate
rate(armored_archer_rpc_errors_total[5m]) / rate(armored_archer_rpc_calls_total[5m]) * 100

# Active Alerts
sum(ALERTS{alertstate="firing"})

# Error by Type
sum by (error_type) (increase(armored_archer_rpc_errors_total[24h]))

# Circuit Breaker
armored_archer_circuit_breaker_state
rate(armored_archer_circuit_breaker_trips_total[1h])

# Health Status
armored_archer_health_status{component="database"}
armored_archer_health_status{component="cache"}
armored_archer_health_check_duration_seconds
```

### Variables

| Name | Label | Type | Query |
|------|-------|------|-------|
| datasource | Data Source | Datasource | Prometheus |
| rpc_endpoint | RPC Endpoint | Query | `label_values(armored_archer_rpc_errors_total, rpc)` |
| error_type | Error Type | Query | `label_values(armored_archer_rpc_errors_total, error_type)` |
| component | Component | Query | `label_values(armored_archer_health_status, component)` |

---

## Auto-Provisioning Configuration

The dashboards are auto-provisioned via the configuration in:

### Dashboard Provider
**File**: `backend/grafana/provisioning/dashboards/dashboards.yml`

```yaml
apiVersion: 1

providers:
  - name: 'Armored Archer Dashboards'
    orgId: 1
    folder: 'Armored Archer'
    type: file
    disableDeletion: false
    updateIntervalSeconds: 30
    allowUiUpdates: true
    options:
      path: /etc/grafana/provisioning/dashboards
      foldersFromFilesStructure: true
```

### Data Source
**File**: `backend/grafana/provisioning/datasources/datasources.yml`

```yaml
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: false
    jsonData:
      timeInterval: "15s"
      httpMethod: GET
```

---

## Import Instructions

### Method 1: Auto-Provisioning (Recommended)

1. Copy dashboard JSON files to provisioning directory:
```bash
cp backend/grafana/dashboards/*.json backend/grafana/provisioning/dashboards/
```

2. Restart Grafana:
```bash
docker-compose restart grafana
```

3. Dashboards will appear automatically in the "Armored Archer" folder

### Method 2: Manual Import via UI

1. Open Grafana UI at `http://localhost:3000`
2. Login with admin credentials (default: `admin`/`admin`)
3. Navigate to **Dashboards** → **Import**
4. Upload each JSON file or paste dashboard JSON
5. Select Prometheus as the data source
6. Click **Import**

### Method 3: Using Grafana API

```bash
# Import dashboard via API
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d @backend/grafana/dashboards/01-overview.json \
  http://localhost:3000/api/dashboards/db
```

---

## Dashboard Best Practices

### Time Range Selection
- **Overview**: Last 1 hour with 10s refresh
- **Performance**: Last 1 hour with 10s refresh
- **Business Metrics**: Last 6 hours with 30s refresh
- **Errors & Alerts**: Last 1 hour with 5s refresh

### Using Variables
1. Select data source if multiple Prometheus instances exist
2. Filter by environment (development, alpha, production)
3. Filter by specific RPC endpoints, error types, or components

### Creating Alerts from Dashboards
1. Click on any panel
2. Select **Alert** → **Create Alert**
3. Configure threshold and notification channel
4. Save alert rule

### Exporting Dashboard Data
1. Click panel title → **Inspect** → **Data**
2. Click **Export to CSV**
3. Or use Prometheus Query Browser for raw data

---

## Troubleshooting

### Dashboard Not Loading
1. Verify Prometheus data source is configured
2. Check Grafana logs: `docker logs armored_archer_grafana`
3. Verify dashboard JSON is valid

### No Data Showing
1. Check time range selection
2. Verify metrics are being exported by backend
3. Test queries directly in Prometheus: `http://localhost:9090`

### Variables Not Populating
1. Ensure backend is exporting metrics with correct labels
2. Check Prometheus connectivity
3. Refresh dashboard

---

## Next Steps

After dashboard setup:
1. ✅ Verify all dashboards display data correctly
2. ⏳ Configure alert notifications (Phase 2.3)
3. ⏳ Set up Loki for log aggregation (Phase 2.4)
4. ⏳ Configure distributed tracing (Phase 2.5)

---

## Checkpoint

**Status**: 🛑 **HUMAN VERIFY REQUIRED**

Please verify:
- [ ] All 4 dashboards are visible in Grafana
- [ ] Data is populating correctly on all panels
- [ ] Variables are working as expected
- [ ] Dashboard refresh rates are appropriate
- [ ] No errors in Grafana logs

**Next Action**: Human verification before proceeding to Phase 2.3 (Alert Configuration)

---

**Created**: 2026-03-16  
**Author**: AI Agent (Phase 2.2 Execution)  
**Review Status**: Pending Human Verification
