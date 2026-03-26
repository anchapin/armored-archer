# Phase 2.1 - Prometheus Metrics Validation

**Phase**: 2.1  
**Milestone**: v2.1.0 - Alpha Launch & Stabilization  
**Status**: Complete  
**Created**: 2026-03-16  
**Last Updated**: 2026-03-16  

---

## 📋 Overview

This phase establishes complete Prometheus metrics collection for the Armored Archer Go backend. The implementation includes 27 custom metrics across 7 categories, providing comprehensive visibility into application performance, player behavior, and system health.

---

## 🎯 Objectives

1. ✅ Define 10+ custom Prometheus metrics for the Go backend
2. ✅ Create Go metrics collection module with proper types
3. ✅ Configure Prometheus scrape endpoints
4. ✅ Create metrics verification scripts
5. ✅ Document metrics usage and integration
6. ✅ Establish metrics collection best practices

---

## 📊 Metrics Definitions

### 1. RPC Metrics (3 metrics)

Monitor RPC call performance and error rates.

| Metric Name | Type | Description | Labels |
|-------------|------|-------------|--------|
| `armored_archer_rpc_requests_total` | Counter | Total number of RPC requests | `rpc_name`, `method` |
| `armored_archer_rpc_errors_total` | Counter | Total number of RPC errors | `rpc_name`, `error_code` |
| `armored_archer_rpc_request_duration_seconds` | Histogram | RPC request duration in seconds | `rpc_name` |

**Usage Example**:
```go
import "github.com/anchapin/armored-archer/backend/metrics"

// Record RPC request
metrics.RecordRPCRequest("get_player_stats", "GET")

// Record RPC error
metrics.RecordRPCError("get_player_stats", "NOT_FOUND")

// Record RPC duration using timer
timer := metrics.ObserveRPCDuration("get_player_stats")
defer timer.Stop()
```

**PromQL Queries**:
```promql
# RPC request rate (requests per second)
rate(armored_archer_rpc_requests_total[5m])

# 95th percentile latency
histogram_quantile(0.95, rate(armored_archer_rpc_request_duration_seconds_bucket[5m]))

# Error rate percentage
rate(armored_archer_rpc_errors_total[5m]) / rate(armored_archer_rpc_requests_total[5m]) * 100
```

---

### 2. Player Metrics (3 metrics)

Track player activity and session information.

| Metric Name | Type | Description | Labels |
|-------------|------|-------------|--------|
| `armored_archer_active_players` | Gauge | Number of currently active players | `region` |
| `armored_archer_sessions_created_total` | Counter | Total number of player sessions created | `method` |
| `armored_archer_session_duration_seconds` | Histogram | Player session duration in seconds | - |

**Usage Example**:
```go
// Set active players count
metrics.SetActivePlayers(150.0, "us-east")

// Record session creation
metrics.RecordSessionCreated("authentication")

// Record session duration
metrics.RecordSessionDuration(1800 * time.Second) // 30 minutes
```

**PromQL Queries**:
```promql
# Current active players by region
armored_archer_active_players

# Session creation rate
rate(armored_archer_sessions_created_total[1h])

# Average session duration
avg(armored_archer_session_duration_seconds_bucket)
```

---

### 3. Match Metrics (4 metrics)

Monitor matchmaking and match lifecycle.

| Metric Name | Type | Description | Labels |
|-------------|------|-------------|--------|
| `armored_archer_matches_created_total` | Counter | Total number of matches created | `match_type` |
| `armored_archer_matches_completed_total` | Counter | Total number of matches completed | `match_type`, `status` |
| `armored_archer_matchmaking_queue_size` | Gauge | Current size of matchmaking queue | `match_type` |
| `armored_archer_match_duration_seconds` | Histogram | Match duration in seconds | `match_type` |

**Usage Example**:
```go
// Record match creation
metrics.RecordMatchCreated("ranked_1v1")

// Record match completion
metrics.RecordMatchCompleted("ranked_1v1", "completed")

// Set matchmaking queue size
metrics.SetMatchmakingQueueSize(25.0, "ranked_1v1")

// Record match duration
metrics.RecordMatchDuration("ranked_1v1", 600*time.Second)
```

**PromQL Queries**:
```promql
# Match creation rate
rate(armored_archer_matches_created_total[5m])

# Current queue size
armored_archer_matchmaking_queue_size

# Match success rate
rate(armored_archer_matches_completed_total{status="completed"}[5m]) / 
rate(armored_archer_matches_created_total[5m]) * 100
```

---

### 4. Database Metrics (3 metrics)

Track database performance and health.

| Metric Name | Type | Description | Labels |
|-------------|------|-------------|--------|
| `armored_archer_database_query_duration_seconds` | Histogram | Database query duration in seconds | `endpoint`, `database` |
| `armored_archer_database_connections` | Gauge | Current number of database connections | `database`, `status` |
| `armored_archer_database_errors_total` | Counter | Total number of database errors | `endpoint`, `error_code` |

**Usage Example**:
```go
// Record database query duration using timer
timer := metrics.ObserveDBQueryDuration("get_player", "postgres")
defer timer.Stop()

// Set database connections
metrics.SetDBConnections(10.0, "postgres", "active")

// Record database error
metrics.RecordDBError("get_player", "CONNECTION_TIMEOUT")
```

**PromQL Queries**:
```promql
# Database query P95 latency
histogram_quantile(0.95, rate(armored_archer_database_query_duration_seconds_bucket[5m]))

# Connection pool utilization
armored_archer_database_connections{status="active"} / 
armored_archer_database_connections{status="max"} * 100

# Database error rate
rate(armored_archer_database_errors_total[5m])
```

---

### 5. Cache Metrics (3 metrics)

Monitor cache performance and efficiency.

| Metric Name | Type | Description | Labels |
|-------------|------|-------------|--------|
| `armored_archer_cache_hits_total` | Counter | Total number of cache hits | `cache` |
| `armored_archer_cache_misses_total` | Counter | Total number of cache misses | `cache` |
| `armored_archer_cache_size_bytes` | Gauge | Current cache size in bytes | `cache` |

**Usage Example**:
```go
// Record cache hit
metrics.RecordCacheHit("player_stats")

// Record cache miss
metrics.RecordCacheMiss("player_stats")

// Set cache size
metrics.SetCacheSize(1048576.0, "player_stats") // 1MB
```

**PromQL Queries**:
```promql
# Cache hit ratio
rate(armored_archer_cache_hits_total[5m]) / 
(rate(armored_archer_cache_hits_total[5m]) + rate(armored_archer_cache_misses_total[5m])) * 100

# Cache size over time
armored_archer_cache_size_bytes
```

---

### 6. System Metrics (4 metrics)

Monitor system resource usage.

| Metric Name | Type | Description | Labels |
|-------------|------|-------------|--------|
| `armored_archer_memory_usage_bytes` | Gauge | Current memory usage in bytes | - |
| `armored_archer_cpu_usage_percent` | Gauge | Current CPU usage percentage | - |
| `armored_archer_goroutine_count` | Gauge | Current number of goroutines | - |
| `armored_archer_request_queue_depth` | Gauge | Current request queue depth | `endpoint` |

**Usage Example**:
```go
// Update all system metrics (call periodically)
metrics.UpdateSystemMetrics()

// Set request queue depth
metrics.SetRequestQueueDepth(50.0, "submit_combat_action")
```

**PromQL Queries**:
```promql
# Memory usage in MB
armored_archer_memory_usage_bytes / 1024 / 1024

# Goroutine growth rate
rate(armored_archer_goroutine_count[5m])

# Request queue depth trend
delta(armored_archer_request_queue_depth[5m])
```

---

### 7. Business Metrics (8 metrics)

Track business-critical events and revenue.

| Metric Name | Type | Description | Labels |
|-------------|------|-------------|--------|
| `armored_archer_purchases_total` | Counter | Total number of purchases | `status`, `currency_type` |
| `armored_archer_revenue_cents_total` | Counter | Total revenue in cents | `currency_type` |
| `armored_archer_currency_spent_total` | Counter | Total currency spent | `currency_type`, `action_type` |
| `armored_archer_currency_earned_total` | Counter | Total currency earned | `currency_type`, `action_type` |
| `armored_archer_gear_generated_total` | Counter | Total gear items generated | `gear_type`, `gear_rarity` |
| `armored_archer_combat_actions_total` | Counter | Total combat actions performed | `action_type`, `status` |
| `armored_archer_xp_gained_total` | Counter | Total XP gained by players | `action_type` |
| `armored_archer_level_ups_total` | Counter | Total player level ups | `season` |

**Usage Example**:
```go
// Record purchase
metrics.RecordPurchase("success", "USD")

// Record revenue
metrics.RecordRevenue(999.0, "USD") // $9.99

// Record currency operations
metrics.RecordCurrencySpent("gems", "shop_purchase", 500.0)
metrics.RecordCurrencyEarned("gold", "match_reward", 100.0)

// Record gear generation
metrics.RecordGearGenerated("bow", "legendary")

// Record combat action
metrics.RecordCombatAction("shoot_arrow", "hit")

// Record XP gain
metrics.RecordXPGained("match_completion", 150.0)

// Record level up
metrics.RecordLevelUp("season_3")
```

**PromQL Queries**:
```promql
# Revenue per hour
rate(armored_archer_revenue_cents_total[1h]) / 100

# Purchase success rate
rate(armored_archer_purchases_total{status="success"}[5m]) / 
rate(armored_archer_purchases_total[5m]) * 100

# Gear generation by rarity
sum by (gear_rarity) (rate(armored_archer_gear_generated_total[24h]))

# XP gain rate
rate(armored_archer_xp_gained_total[5m])
```

---

### 8. Error Rate Metrics (1 metric)

Track error rates across endpoints.

| Metric Name | Type | Description | Labels |
|-------------|------|-------------|--------|
| `armored_archer_error_rate_percent` | Gauge | Current error rate percentage | `rpc_name` |

**Usage Example**:
```go
// Calculate and set error rate (call periodically)
errorRate := calculateErrorRate("get_player_stats") // Your implementation
metrics.SetErrorRate(errorRate, "get_player_stats")
```

**PromQL Queries**:
```promql
# Error rate by endpoint
armored_archer_error_rate_percent

# High error rate alert
armored_archer_error_rate_percent > 5
```

---

## 📁 File Structure

```
backend/
├── metrics/
│   └── prometheus_metrics.go      # Go metrics definitions (27 metrics)
├── config/
│   └── prometheus.yml             # Prometheus scrape configuration
├── scripts/
│   └── verify-metrics.sh          # Metrics verification script
├── alerts.yml                     # Alert rules (existing)
└── prometheus.yml                 # Alternative config location (existing)

.planning/
└── milestones/v2.1.0/phases/02-monitoring/
    ├── 02-01-metrics-setup.md     # This file
    └── 02-01-SUMMARY.md           # Phase summary
```

---

## 🔧 Configuration

### Prometheus Scrape Configuration

The Prometheus configuration (`backend/config/prometheus.yml`) defines the following scrape jobs:

| Job Name | Metrics Path | Interval | Description |
|----------|-------------|----------|-------------|
| `prometheus` | `/metrics` | 30s | Prometheus self-monitoring |
| `node_exporter` | `/metrics` | 30s | System metrics |
| `nakama` | `/metrics` | 30s | Nakama server metrics |
| `armored_archer_app` | `/api/nakama/rpc/armored_archer/metrics` | 30s | Custom app metrics |
| `armored_archer_rpc` | `/api/nakama/rpc/armored_archer/rpc_metrics` | 15s | RPC-specific metrics |
| `armored_archer_business` | `/api/nakama/rpc/armored_archer/business_metrics` | 60s | Business metrics |
| `armored_archer_system` | `/api/nakama/rpc/armored_archer/system_metrics` | 30s | System metrics |
| `armored_archer_health` | `/api/nakama/rpc/armored_archer/health` | 30s | Health endpoint |

### Environment Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `PROMETHEUS_URL` | Prometheus server URL | `http://localhost:9090` | `http://prometheus:9090` |
| `NAKAMA_URL` | Nakama server URL | `http://localhost:7350` | `http://nakama:7350` |
| `METRICS_ENABLED` | Enable metrics collection | `true` | `true` |
| `METRICS_PORT` | Metrics endpoint port | `7350` | `7350` |

---

## 🚀 Usage

### 1. Initialize Metrics Collector

The metrics collector is automatically initialized when the Go module loads:

```go
// In InitModule (automatically called by Nakama)
import "github.com/anchapin/armored-archer/backend/metrics"

func InitModule(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, initializer runtime.Initializer) error {
    // Metrics collector is auto-initialized via sync.Once
    collector := metrics.GetCollector()
    logger.Info("Metrics collector initialized")
    
    // ... rest of initialization
}
```

### 2. Record Metrics in RPC Handlers

```go
func GetPlayerStats(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
    // Start timing
    timer := metrics.ObserveRPCDuration("get_player_stats")
    defer timer.Stop()
    
    // Record request
    metrics.RecordRPCRequest("get_player_stats", "GET")
    
    // ... handler logic ...
    
    if err != nil {
        // Record error
        metrics.RecordRPCError("get_player_stats", "INTERNAL_ERROR")
        return "", err
    }
    
    return result, nil
}
```

### 3. Update System Metrics Periodically

```go
// Start a goroutine to update system metrics
go func() {
    ticker := time.NewTicker(30 * time.Second)
    defer ticker.Stop()
    
    for range ticker.C {
        metrics.UpdateSystemMetrics()
    }
}()
```

### 4. Expose Metrics Endpoint

Add an RPC endpoint to expose metrics in Prometheus format:

```go
func MetricsHandler(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
    collector := metrics.GetCollector()
    
    // Gather metrics
    metricFamilies, err := collector.Registry().Gather()
    if err != nil {
        return "", err
    }
    
    // Format as Prometheus text
    var sb strings.Builder
    for _, mf := range metricFamilies {
        // Format metric...
    }
    
    return sb.String(), nil
}
```

---

## ✅ Verification

### Run Verification Script

```bash
cd backend

# Basic verification
./scripts/verify-metrics.sh

# Verbose output
./scripts/verify-metrics.sh -v

# Check alpha environment
./scripts/verify-metrics.sh -e alpha

# Custom timeout
./scripts/verify-metrics.sh -t 30
```

### Manual Verification

1. **Check Prometheus Targets**:
   - Open Prometheus UI: `http://localhost:9090/targets`
   - Verify all Armored Archer targets show as "UP"

2. **Query Metrics**:
   - Open Prometheus Graph: `http://localhost:9090/graph`
   - Query: `armored_archer_rpc_requests_total`
   - Verify metrics are being collected

3. **Check Grafana Dashboards**:
   - Open Grafana: `http://localhost:3000`
   - Navigate to Armored Archer dashboard
   - Verify panels show data

---

## 📊 Grafana Dashboard Integration

### Recommended Dashboards

1. **RPC Performance Dashboard**
   - Request rate by endpoint
   - P95/P99 latency
   - Error rate
   - Success rate

2. **Player Analytics Dashboard**
   - Active players over time
   - Session duration distribution
   - Player retention
   - Regional distribution

3. **Match Analytics Dashboard**
   - Matches created/completed
   - Queue size over time
   - Match duration
   - Match success rate

4. **System Health Dashboard**
   - Memory usage
   - CPU usage
   - Goroutine count
   - Request queue depth

5. **Business Metrics Dashboard**
   - Revenue over time
   - Purchase conversion
   - Currency flow
   - Gear distribution

### Dashboard JSON Import

Dashboard configurations are located in:
- `backend/grafana/provisioning/dashboards/`

---

## 🔔 Alert Integration

Metrics integrate with existing alert rules in `backend/alerts.yml`:

| Alert Name | Metric | Threshold | Severity |
|------------|--------|-----------|----------|
| HighErrorRate | `armored_archer_rpc_errors_total` | > 5% | Critical |
| HighLatency | `armored_archer_rpc_request_duration_seconds` | P95 > 2s | Warning |
| HighMemoryUsage | `armored_archer_memory_usage_bytes` | > 85% | Warning |
| MatchmakingQueueBuilding | `armored_archer_matchmaking_queue_size` | > 100 | Warning |
| DatabaseConnectionPoolExhausted | `armored_archer_database_connections` | > 90% | Critical |

---

## 📝 Best Practices

### 1. Metric Naming

- Use `armored_archer_` prefix for all custom metrics
- Use snake_case for metric names
- Use descriptive names (e.g., `rpc_requests_total` not `rpc_total`)
- Include units in metric names (e.g., `_seconds`, `_bytes`, `_cents`)

### 2. Label Usage

- Keep label cardinality low (avoid high-cardinality labels like `player_id`)
- Use consistent label names across metrics
- Document all labels in this file
- Avoid labels with unbounded values

### 3. Metric Types

- **Counter**: For cumulative counts (requests, errors, purchases)
- **Gauge**: For point-in-time values (active players, queue size)
- **Histogram**: For distributions (latency, duration)

### 4. Performance

- Use timers (`ObserveRPCDuration`) instead of manual timing
- Batch metric updates when possible
- Update system metrics periodically, not on every request
- Use the global collector for convenience

### 5. Error Handling

- Always record errors with appropriate error codes
- Include error context in labels
- Set error rates periodically for alerting

---

## 🔍 Troubleshooting

### Metrics Not Appearing

1. **Check if metrics endpoint is accessible**:
   ```bash
   curl http://localhost:7350/api/nakama/rpc/armored_archer/metrics
   ```

2. **Verify Prometheus configuration**:
   ```bash
   ./scripts/verify-metrics.sh
   ```

3. **Check Prometheus logs**:
   ```bash
   docker logs armored_archer_prometheus
   ```

### High Cardinality Warnings

If Prometheus reports high cardinality:

1. Review label usage
2. Remove high-cardinality labels (e.g., `player_id`, `session_id`)
3. Aggregate metrics before exposing

### Memory Issues

If the Go module uses excessive memory:

1. Reduce metric update frequency
2. Limit histogram buckets
3. Use `UpdateSystemMetrics()` less frequently

---

## 📚 Related Documentation

- [METRICS.md](../../METRICS.md) - General metrics documentation
- [alerts.yml](../../alerts.yml) - Alert rules configuration
- [prometheus.yml](../../prometheus.yml) - Prometheus scrape configuration
- [GRAFANA_SETUP.md](./02-02-grafana-setup.md) - Grafana dashboard setup
- [ALERTING.md](../../ALERTING.md) - Alert configuration guide

---

## ✅ Checklist

- [x] Go metrics module created (`metrics/prometheus_metrics.go`)
- [x] 27 custom metrics defined (exceeds 10+ requirement)
- [x] Prometheus scrape configuration created (`config/prometheus.yml`)
- [x] Verification script created (`scripts/verify-metrics.sh`)
- [x] Metrics documentation complete
- [x] Integration examples provided
- [x] Best practices documented
- [x] Troubleshooting guide included

---

## 🎯 Success Criteria

| Criteria | Status | Measurement |
|----------|--------|-------------|
| 10+ custom metrics defined | ✅ | 27 metrics implemented |
| Metrics module in Go | ✅ | `metrics/prometheus_metrics.go` |
| Prometheus configuration | ✅ | `config/prometheus.yml` |
| Verification script | ✅ | `scripts/verify-metrics.sh` |
| Documentation complete | ✅ | This file |
| Integration examples | ✅ | Usage examples provided |

---

**Phase Status**: ✅ **COMPLETE**  
**Next Phase**: 2.2 - Grafana Dashboard Setup  
**Checkpoint**: Human verify metrics collection and documentation
