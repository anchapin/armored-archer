# Load Testing

## Prerequisites

1. Backend server running: `make backend-start`
2. k6 installed: `go install go.k6.io/k6@latest`
3. Test users exist in database

## Running Tests

### Smoke Test (1 user)
```bash
cd backend/tests/load
k6 run scenarios/smoke.js
```

### Full Load Test (500 users)
```bash
cd backend/tests/load
NAKAMA_URL=http://localhost:7350 k6 run k6.conf.js
```

### Custom Load Level
```bash
k6 run --vus 100 --duration 5m k6.conf.js
```

## Metrics

- P95 latency: Should be < 100ms
- Error rate: Should be < 1%
- Throughput: Requests per second
- Cache hit rate: Check Prometheus metrics

## Interpreting Results

Green checkmarks: Test passed thresholds
Red X: Test failed - check logs for details
