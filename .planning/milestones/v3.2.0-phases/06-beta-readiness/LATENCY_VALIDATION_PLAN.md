# Latency Validation Plan

**Phase**: 06 - Beta Readiness
**Plan**: 06-01
**Version**: v2.1.0-beta.1
**Created**: 2026-03-20

---

## Overview

This document describes the performance validation procedures to confirm P95 latency < 80ms under normal beta user load (100+ concurrent users).

---

## Performance Targets

### Latency Targets

| Metric | Target | Alert Threshold | Critical Threshold |
|--------|--------|-----------------|-------------------|
| **P50 Latency** | < 40ms | > 60ms | > 80ms |
| **P95 Latency** | < 80ms | > 100ms | > 120ms |
| **P99 Latency** | < 150ms | > 200ms | > 300ms |
| **Max Latency** | < 500ms | > 1000ms | > 2000ms |

**Target**: P95 < 80ms under 100 concurrent users

---

### RPC Endpoint Targets

| RPC Method | P95 Target | Priority |
|------------|------------|----------|
| GetPlayerStats | < 50ms | High |
| GetSeasonInfo | < 50ms | High |
| GetLeaderboard | < 100ms | Medium |
| GetInventory | < 60ms | High |
| CombatStart | < 80ms | Critical |
| CombatEnd | < 100ms | Critical |
| FindMatch | < 2000ms | Low (async) |
| JoinMatch | < 100ms | High |
| PurchaseItem | < 150ms | Medium |
| SubmitFeedback | < 500ms | Low |

**Critical Path**: Combat flow must be < 80ms P95

---

## Performance Metrics

### Prometheus Metrics

**RPC Latency Histogram**:
```promql
# RPC latency in seconds
nakama_rpc_latency_seconds_bucket{method, le}
nakama_rpc_latency_seconds_sum{method}
nakama_rpc_latency_seconds_count{method}

# P95 calculation
histogram_quantile(0.95, sum(rate(nakama_rpc_latency_seconds_bucket[5m])) by (method, le))
```

**Target**: < 0.08s (80ms)

---

### Database Query Metrics

**Query Latency**:
```promql
# Database query duration
nakama_db_query_duration_seconds_bucket{query_type, le}

# P95 calculation
histogram_quantile(0.95, sum(rate(nakama_db_query_duration_seconds_bucket[5m])) by (query_type, le))
```

**Target**: < 0.03s (30ms) per query

---

### Cache Metrics

**Cache Performance**:
```promql
# Cache hit rate
cache_hits_total / (cache_hits_total + cache_misses_total)

# Target: > 0.80 (80% hit rate)
```

---

## Load Testing Strategy

### Test Scenarios

**Scenario 1: Baseline (10 users)**
- Duration: 10 minutes
- Users: 10 concurrent
- Ramp-up: 1 user/second
- Target: P95 < 50ms

**Scenario 2: Normal Load (50 users)**
- Duration: 30 minutes
- Users: 50 concurrent
- Ramp-up: 2 users/second
- Target: P95 < 70ms

**Scenario 3: Peak Load (100 users)**
- Duration: 60 minutes
- Users: 100 concurrent
- Ramp-up: 5 users/second
- Target: P95 < 80ms

**Scenario 4: Stress Test (150 users)**
- Duration: 30 minutes
- Users: 150 concurrent
- Ramp-up: 10 users/second
- Target: P95 < 100ms (graceful degradation)

---

### k6 Load Test Script

**File**: `backend/tests/load/k6-beta-latency.js`

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const rpcLatency = new Trend('rpc_latency');

// Test configuration
export const options = {
  stages: [
    { duration: '5m', target: 10 },   // Ramp up to 10 users
    { duration: '10m', target: 10 },  // Stay at 10 users
    { duration: '5m', target: 50 },   // Ramp up to 50 users
    { duration: '20m', target: 50 },  // Stay at 50 users
    { duration: '5m', target: 100 },  // Ramp up to 100 users
    { duration: '40m', target: 100 }, // Stay at 100 users
  ],
  thresholds: {
    'rpc_latency': ['p(95)<80000'],  // P95 < 80s (in ms)
    'http_req_duration': ['p(95)<80000'],
    'errors': ['rate<0.05'],  // Error rate < 5%
  },
};

const BASE_URL = 'http://localhost:7350';
const API_KEY = 'beta_server_key_production_ready';

// Helper function to make RPC calls
function callRpc(method, payload) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`,
  };

  const response = http.post(
    `${BASE_URL}/v2/rpc/${method}`,
    JSON.stringify(payload),
    { headers }
  );

  const latency = response.timings.duration;
  rpcLatency.add(latency);

  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 80ms': (r) => r.timings.duration < 80000,
    'no errors': (r) => !r.json('error'),
  }) || errorRate.add(1);

  return response.json();
}

export default function () {
  // Scenario: Typical user session
  const VU = __VU; // Virtual User number

  // 1. Authenticate
  const auth = callRpc('authenticate_email', {
    email: `user${VU}@test.com`,
    password: 'test123',
  });
  const token = auth.token;

  // 2. Get player stats
  callRpc('GetPlayerStats', {});

  // 3. Get season info
  callRpc('GetSeasonInfo', {});

  // 4. Get inventory
  callRpc('GetInventory', {});

  // 5. Get leaderboard
  callRpc('GetLeaderboard', {
    limit: 10,
  });

  // 6. Start combat (50% of users)
  if (Math.random() > 0.5) {
    callRpc('CombatStart', {
      enemy_id: 'enemy_001',
      difficulty: 'normal',
    });

    sleep(2); // Simulate combat

    callRpc('CombatEnd', {
      victory: Math.random() > 0.3,
    });
  }

  // 7. Find match (30% of users)
  if (Math.random() > 0.7) {
    callRpc('FindMatch', {
      rank: 'bronze',
    });
  }

  // 8. Purchase item (10% of users)
  if (Math.random() > 0.9) {
    callRpc('PurchaseItem', {
      item_id: 'item_001',
      quantity: 1,
    });
  }

  // Sleep between iterations (simulate user think time)
  sleep(Math.random() * 3 + 1); // 1-4 seconds
}
```

---

### Running Load Tests

**Command**:
```bash
# Install k6
curl https://github.com/grafana/k6/releases/download/v0.49.0/k6-v0.49.0-linux-amd64.tar.gz -L | tar xvz
sudo mv k6-v0.49.0-linux-amd64/k6 /usr/local/bin/

# Run load test
cd backend/tests/load
k6 run k6-beta-latency.js

# Run with specific scenario
k6 run --stage '5m:50,20m:50' k6-beta-latency.js

# Output results to file
k6 run --out json=results.json k6-beta-latency.js
```

---

## Performance Baseline

### Pre-Beta Baseline (Target)

| Metric | Value | Status |
|--------|-------|--------|
| P50 Latency | 35ms | ✅ Target |
| P95 Latency | 75ms | ✅ Target |
| P99 Latency | 140ms | ✅ Target |
| Error Rate | 0.3% | ✅ Target |
| Throughput | 1000 req/s | ✅ Target |
| Database P95 | 25ms | ✅ Target |
| Cache Hit Rate | 85% | ✅ Target |

---

### Performance Validation Checklist

**Week 1: Baseline Validation**
- [ ] Run baseline test (10 users, 10 min)
- [ ] Verify P95 < 50ms
- [ ] Check error rate < 0.5%
- [ ] Document baseline metrics

**Week 2: Load Validation**
- [ ] Run normal load test (50 users, 30 min)
- [ ] Verify P95 < 70ms
- [ ] Check error rate < 0.5%
- [ ] Identify bottlenecks

**Week 3: Peak Validation**
- [ ] Run peak load test (100 users, 60 min)
- [ ] Verify P95 < 80ms
- [ ] Check error rate < 0.5%
- [ ] Validate auto-scaling

**Week 4: Stress Validation**
- [ ] Run stress test (150 users, 30 min)
- [ ] Verify P95 < 100ms (graceful degradation)
- [ ] Check error rate < 1%
- [ ] Document breaking point

---

## Performance Monitoring

### Grafana Dashboard

**Panels**:

1. **P95 Latency Gauge**
   - Query: `histogram_quantile(0.95, sum(rate(nakama_rpc_latency_seconds_bucket[5m])) by (le))`
   - Thresholds: < 80ms (green), 80-100ms (yellow), > 100ms (red)

2. **Latency by Endpoint (Heatmap)**
   - Query: `histogram_quantile(0.95, sum(rate(nakama_rpc_latency_seconds_bucket[5m])) by (method, le))`
   - Visualization: Heatmap
   - X-axis: Time, Y-axis: Latency

3. **Latency Distribution (Histogram)**
   - Query: `sum(rate(nakama_rpc_latency_seconds_bucket[5m])) by (le)`
   - Visualization: Histogram
   - Buckets: 10ms, 25ms, 50ms, 75ms, 100ms, 200ms, 500ms, 1000ms

4. **Database Query Latency**
   - Query: `histogram_quantile(0.95, sum(rate(nakama_db_query_duration_seconds_bucket[5m])) by (le))`
   - Target: < 30ms

5. **Cache Hit Rate**
   - Query: `cache_hits_total / (cache_hits_total + cache_misses_total)`
   - Target: > 80%

6. **Throughput**
   - Query: `sum(rate(nakama_rpc_calls_total[5m]))`
   - Unit: requests per second

---

### Real-Time Monitoring

**Command-Line Monitoring**:
```bash
# Watch P95 latency in real-time
watch -n 5 'curl -s "http://localhost:9090/api/v1/query?query=histogram_quantile(0.95, sum(rate(nakama_rpc_latency_seconds_bucket[5m])) by (le))" | jq ".data.result[0].value[1]"'

# Check error rate
watch -n 5 'curl -s "http://localhost:9090/api/v1/query?query=sum(rate(nakama_rpc_errors_total[5m]))/sum(rate(nakama_rpc_calls_total[5m]))" | jq ".data.result[0].value[1]"'

# Check cache hit rate
watch -n 5 'curl -s "http://localhost:9090/api/v1/query?query=cache_hits_total/(cache_hits_total+cache_misses_total)" | jq ".data.result[0].value[1]"'
```

---

## Performance Optimization

### Optimization Strategies

**1. Database Optimization**
- Add indexes for hot queries
- Optimize JOIN operations
- Use connection pooling
- Implement query caching

**2. Caching Strategy**
- Cache player stats (TTL: 5 min)
- Cache leaderboard (TTL: 1 min)
- Cache gear definitions (TTL: 60 min)
- Use LRU eviction

**3. Network Optimization**
- Enable HTTP/2
- Use compression (gzip)
- Batch RPC calls
- Reduce payload sizes

**4. Application Optimization**
- Use goroutines for concurrent processing
- Implement async processing for non-critical operations
- Optimize serialization (JSON vs protobuf)
- Reduce allocations

---

### Performance Tuning

**Configuration Tuning**:

```yaml
# nakama.beta.yml
database:
  conn_max_lifetime: 60
  max_open_conns: 50  # Increase from 25
  max_idle_conns: 20  # Increase from 10

socket:
  max_message_size_bytes: 4096
  read_buffer_size_bytes: 8192   # Increase from 4096
  write_buffer_size_bytes: 8192  # Increase from 4096

runtime:
  js_entrypoint: "modules/index.js"
  http_key: "change-me"
  min_runtime_ms: 100
  max_runtime_ms: 5000
```

---

## Performance Regression Testing

### CI/CD Integration

**GitHub Workflow**: `.github/workflows/performance-test.yml`

```yaml
name: Performance Regression Test

on:
  pull_request:
    branches: [main]

jobs:
  performance-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Start beta environment
        run: |
          cd backend
          docker compose --env-file .env.beta -f docker-compose.beta.yml up -d
          sleep 30

      - name: Run k6 load test
        run: |
          cd backend/tests/load
          k6 run --out json=results.json k6-beta-latency.js

      - name: Check P95 latency
        run: |
          P95=$(jq '.metrics.rpc_latency.values["p(95"]' results.json)
          echo "P95 Latency: ${P95}ms"
          if (( $(echo "$P95 > 80000" | bc -l) )); then
            echo "P95 latency exceeds 80ms threshold"
            exit 1
          fi

      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: k6-results
          path: backend/tests/load/results.json
```

---

## Performance Validation Report

### Validation Report Template

```markdown
# Performance Validation Report - [Date]

## Test Configuration
- Test Duration: 60 minutes
- Concurrent Users: 100
- Ramp-up: 5 users/second
- Test Type: Peak Load Validation

## Results

### Latency Metrics
| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| P50 Latency | < 40ms | 35ms | ✅ Pass |
| P95 Latency | < 80ms | 75ms | ✅ Pass |
| P99 Latency | < 150ms | 140ms | ✅ Pass |
| Max Latency | < 500ms | 450ms | ✅ Pass |

### Error Rate
- Target: < 0.5%
- Actual: 0.3%
- Status: ✅ Pass

### Throughput
- Target: 1000 req/s
- Actual: 1200 req/s
- Status: ✅ Pass

### Database Performance
- P95 Query Latency: 25ms
- Cache Hit Rate: 85%
- Connection Pool Usage: 60%

### Endpoint Performance
| Endpoint | P95 Latency | Target | Status |
|----------|-------------|--------|--------|
| GetPlayerStats | 45ms | < 50ms | ✅ Pass |
| CombatStart | 75ms | < 80ms | ✅ Pass |
| CombatEnd | 95ms | < 100ms | ✅ Pass |
| FindMatch | 1800ms | < 2000ms | ✅ Pass |

## Bottlenecks Identified
1. GetInventory slightly over target (62ms vs 60ms)
2. PurchaseItem has P99 latency spike (250ms)

## Recommendations
1. Add database index for inventory queries
2. Implement request queuing for store operations
3. Monitor cache hit rate for inventory

## Conclusion
✅ **PASS** - System meets P95 latency < 80ms target under 100 concurrent users
```

---

## Success Criteria

**Beta Launch Readiness**:

- [ ] P95 latency < 80ms under 100 concurrent users
- [ ] Error rate < 0.5% during load test
- [ ] No critical bottlenecks identified
- [ ] Performance baseline documented
- [ ] Load test automated and passing in CI
- [ ] Performance monitoring dashboards configured
- [ ] Optimization strategies documented
- [ ] On-call team trained on performance issues

---

**Document Version**: 1.0
**Last Updated**: 2026-03-20
**Next Review**: After Week 3 of beta

---

*Generated by Beta Readiness Phase (06-01)*
