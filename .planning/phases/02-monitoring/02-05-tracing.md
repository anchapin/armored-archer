# Phase 2.5: Distributed Tracing (Grafana Tempo) Configuration Guide

**Milestone**: v2.1.0 - Alpha Launch & Stabilization
**Phase**: 2.5 - Distributed Tracing (Grafana Tempo)
**Status**: ✅ Complete
**Created**: 2026-03-16

---

## Overview

This document provides comprehensive guidance for configuring and operating the Grafana Tempo-based distributed tracing system for Armored Archer. The system uses OpenTelemetry for instrumentation and provides end-to-end trace visibility across RPC calls, database queries, cache operations, and business logic.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                  Distributed Tracing Stack                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Go Backend  │  │   Nakama     │  │   Client     │          │
│  │  (OpenTel)   │  │   Server     │  │   (Godot)    │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                 │                   │
│         └─────────────────┼─────────────────┘                   │
│                           │                                     │
│                  ┌────────▼────────┐                            │
│                  │  OTel Collector │                            │
│                  │  (batch, sample)│                            │
│                  └────────┬────────┘                            │
│                           │                                     │
│                           │ OTLP                                │
│                           ▼                                     │
│                  ┌────────────────┐                             │
│                  │  Grafana Tempo │                             │
│                  │  (Trace Store) │                             │
│                  └────────┬────────┘                            │
│                           │                                     │
│                           │ Query                               │
│                           ▼                                     │
│                  ┌────────────────┐                             │
│                  │    Grafana     │                             │
│                  │  (Visualization)│                            │
│                  └────────────────┘                             │
│                           │                                     │
│         ┌─────────────────┼─────────────────┐                  │
│         │                 │                 │                   │
│         ▼                 ▼                 ▼                   │
│  ┌────────────┐   ┌────────────┐   ┌────────────┐              │
│  │   Tempo    │   │   Loki     │   │ Prometheus │              │
│  │  Traces    │   │   Logs     │   │  Metrics   │              │
│  └────────────┘   └────────────┘   └────────────┘              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Components

### 1. OpenTelemetry SDK (Go Backend)

**Purpose**: Application instrumentation
**Package**: `go.opentelemetry.io/otel`
**Location**: `backend/metrics/tracing.go`

**Key Features**:
- Automatic span creation for RPC calls
- Trace context propagation
- Configurable sampling (1% production, 100% development)
- Integration with structured logging

### 2. OpenTelemetry Collector

**Purpose**: Trace collection, processing, and export
**Image**: `otel/opentelemetry-collector-contrib:0.92.0`
**Port**: 4317 (gRPC), 4318 (HTTP)
**Configuration**: `backend/otel-collector-config.yaml`

**Key Features**:
- OTLP, Jaeger, and Zipkin receivers
- Batch processing for efficiency
- Probabilistic sampling
- Resource attribute enrichment
- Export to Tempo and Prometheus

### 3. Grafana Tempo

**Purpose**: Distributed tracing backend and storage
**Image**: `grafana/tempo:2.3.1`
**Port**: 3200 (HTTP API), 9095 (gRPC)
**Configuration**: `backend/config/tempo.yml`

**Key Features**:
- OTLP native support
- TraceQL query language
- Trace-to-logs correlation
- Trace-to-metrics correlation
- Service map generation
- 48-hour retention (configurable)

### 4. Grafana

**Purpose**: Trace visualization and correlation
**Image**: `grafana/grafana:10.1.0`
**Port**: 3000
**Configuration**: Auto-provisioned datasources and dashboards

**Key Features**:
- Tempo datasource integration
- Pre-built tracing dashboard
- Trace-log correlation (via Loki)
- Trace-metric correlation (via Prometheus)

---

## Configuration Files

### Tempo Configuration (`backend/config/tempo.yml`)

```yaml
# Key settings
server:
  http_listen_port: 3200

distributor:
  receivers:
    otlp:
      protocols:
        http: { endpoint: 0.0.0.0:4318 }
        grpc: { endpoint: 0.0.0.0:4317 }

ingester:
  max_block_duration: 5m
  max_live_traces: 100000

storage:
  trace:
    backend: local
    local:
      path: /tmp/tempo/blocks

metrics_generator:
  processors:
    - service-graphs
    - span-metrics
```

### OTel Collector Configuration (`backend/otel-collector-config.yaml`)

```yaml
# Key pipeline configuration
service:
  pipelines:
    traces:
      receivers: [otlp, jaeger, zipkin]
      processors:
        - memory_limiter
        - resource
        - span
        - probabilistic_sampler  # 1% sampling
        - attributes
        - batch
      exporters:
        - otlphttp/tempo
        - logging
```

### Docker Compose Services

```yaml
# Tempo service
tempo:
  image: grafana/tempo:2.3.1
  ports:
    - "3200:3200"
  volumes:
    - ./config/tempo.yml:/etc/tempo/config.yml
    - tempo_data:/tmp/tempo

# OTel Collector service
otel-collector:
  image: otel/opentelemetry-collector-contrib:0.92.0
  ports:
    - "4317:4317"  # OTLP gRPC
    - "4318:4318"  # OTLP HTTP
  volumes:
    - ./otel-collector-config.yaml:/etc/otel-collector/config.yaml
```

---

## Sampling Configuration

### Sampling Rates by Environment

| Environment | Sampling Rate | Rationale |
|-------------|---------------|-----------|
| Development | 100% (1.0) | Full visibility for debugging |
| Alpha | 10% (0.10) | Balance visibility and cost |
| Production | 1% (0.01) | Cost-effective for high traffic |

### Configure Sampling

In `otel-collector-config.yaml`:

```yaml
processors:
  probabilistic_sampler:
    sampling_percentage: 1.0  # Adjust per environment
    hash_seed: 42
```

### Trace Retention

| Environment | Retention | Storage Location |
|-------------|-----------|------------------|
| Development | 24 hours | `/tmp/tempo/blocks` |
| Alpha | 48 hours | `tempo_data` volume |
| Production | 7 days | S3/GCS (configured separately) |

---

## Instrumentation Guide

### Basic RPC Tracing

```go
import "github.com/anchapin/armored-archer/backend/metrics"

func MyRPC(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
    return metrics.TraceRPC(ctx, "my_rpc", userID, func(ctx context.Context) (string, error) {
        // Your RPC logic here
        return result, nil
    })
}
```

### Manual Span Creation

```go
import (
    "go.opentelemetry.io/otel"
    "go.opentelemetry.io/otel/attribute"
    "go.opentelemetry.io/otel/trace"
)

func MyFunction(ctx context.Context) error {
    tracer := otel.GetTracerProvider().Tracer("my-service")
    
    ctx, span := tracer.Start(ctx, "my-operation",
        trace.WithAttributes(
            attribute.String("custom.attribute", "value"),
        ),
    )
    defer span.End()
    
    // Your operation here
    return nil
}
```

### Helper Functions

```go
// Database operations
metrics.TraceDatabase(ctx, "SELECT * FROM players", func(ctx context.Context) error {
    // Database query
    return nil
})

// Cache operations
metrics.TraceCache(ctx, "get", "player:123", true, func(ctx context.Context) error {
    // Cache lookup
    return nil
})

// Match operations
metrics.TraceMatch(ctx, "ranked", "match_456", func(ctx context.Context) error {
    // Match logic
    return nil
})

// Combat operations
metrics.TraceCombat(ctx, "attack", func(ctx context.Context) error {
    // Combat action
    return nil
})

// Gear operations
metrics.TraceGear(ctx, "generate", "bow", "legendary", func(ctx context.Context) error {
    // Gear generation
    return nil
})

// Season operations
metrics.TraceSeason(ctx, "claim_rewards", "season_5", func(ctx context.Context) error {
    // Season rewards
    return nil
})
```

### Trace Context in Logs

```go
import "github.com/anchapin/armored-archer/backend/internal/logger"

log := logger.NewStructuredLogger(nakamaLogger, "backend", "v2.1.0")
log.WithTraceContext(ctx)

// Logs will include trace_id and span_id
log.Info("Processing request", logger.LogContext{
    "rpc_name": "create_match",
    "user_id": userID,
})
```

---

## Deployment

### Starting the Stack

```bash
cd backend

# Start all services including tracing
docker-compose up -d

# Start only tracing components
docker-compose up -d tempo otel-collector

# View logs
docker-compose logs -f tempo
docker-compose logs -f otel-collector
```

### Health Checks

```bash
# Check Tempo health
curl http://localhost:3200/ready

# Check OTel Collector health
curl http://localhost:13133/health

# Check Grafana health
curl http://localhost:3000/api/health
```

### Verification Script

```bash
# Run verification
cd backend
python3 scripts/verify-tracing.py

# JSON output
python3 scripts/verify-tracing.py --json

# With auto-fix suggestions
python3 scripts/verify-tracing.py --fix
```

---

## Using Grafana for Tracing

### Accessing Traces

1. Open Grafana: http://localhost:3000
2. Navigate to **Dashboards** → **Distributed Tracing - Tempo**
3. Or use **Explore** → Select **Tempo** datasource

### Search Traces

**Basic Search**:
- Service name: `armored-archer-backend`
- RPC name: `rpc/create_match`
- User ID: `user_123`
- Match ID: `match_456`
- Error: `true`

**TraceQL Queries**:
```traceql
// Find all traces with errors
{ .error = true }

// Find traces for a specific RPC
{ .rpc.name = "rpc/create_match" }

// Find slow traces (> 500ms)
{ duration > 500ms }

// Find traces for a specific user
{ .user.id = "user_123" }

// Combine conditions
{ .error = true && duration > 1s && .rpc.name =~ "rpc/.*" }
```

### Trace to Logs

1. Open a trace in Grafana
2. Click the **Logs** button
3. See correlated logs from Loki using `trace_id`

### Trace to Metrics

1. Open a trace in Grafana
2. Click the **Metrics** button
3. See correlated metrics from Prometheus

---

## Trace Investigation Procedures

### 1. Debugging a Slow RPC

```bash
# Step 1: Find slow traces
# In Grafana Explore (Tempo), use TraceQL:
{ .rpc.name = "rpc/generate_gear" && duration > 500ms }

# Step 2: View the trace waterfall
# Look for spans with long durations

# Step 3: Identify bottlenecks
# - Database queries (db/query spans)
# - Cache operations (cache/get spans)
# - External API calls

# Step 4: Correlate with logs
# Click "Logs" button to see related logs

# Step 5: Check metrics
# Click "Metrics" to see latency trends
```

### 2. Investigating Errors

```bash
# Step 1: Find error traces
{ .error = true }

# Step 2: Filter by service
{ .error = true && .service.name = "armored-archer-backend" }

# Step 3: View error details
# Click on error span to see:
# - Error message
# - Stack trace
# - Error attributes

# Step 4: Check related logs
# Look for error-level logs with matching trace_id
```

### 3. User Journey Tracking

```bash
# Step 1: Find all traces for a user
{ .user.id = "user_123" }

# Step 2: Sort by time
# See the sequence of RPC calls

# Step 3: Identify patterns
# - Which RPCs did the user call?
# - Were there any errors?
# - What was the total latency?
```

### 4. Match Lifecycle Analysis

```bash
# Step 1: Find traces for a specific match
{ .match.id = "match_456" }

# Step 2: View match lifecycle
# - Match creation
# - Player acceptance
# - Combat actions
# - Match completion

# Step 3: Identify issues
# - Long matchmaking times
# - Failed combat actions
# - Reward distribution errors
```

---

## Troubleshooting

### No Traces Appearing

1. **Check OTel Collector status**
   ```bash
   docker-compose ps otel-collector
   docker-compose logs otel-collector
   ```

2. **Verify Tempo is running**
   ```bash
   curl http://localhost:3200/ready
   # Should return "ready" or HTTP 200
   ```

3. **Check tracing is enabled in code**
   ```go
   metrics.InitializeTracing(&metrics.TracingConfig{
       Enabled: true,
       OTLPEndpoint: "otel-collector:4317",
   })
   ```

4. **Verify OTel Collector config**
   ```bash
   docker-compose exec otel-collector cat /etc/otel-collector/config.yaml
   ```

### High Memory Usage

1. **Reduce sampling rate**
   ```yaml
   probabilistic_sampler:
     sampling_percentage: 0.1  # 10% instead of 100%
   ```

2. **Reduce batch size**
   ```yaml
   batch:
     send_batch_size: 256  # Reduce from 512
   ```

3. **Reduce retention**
   ```yaml
   compactor:
     block_retention: 24h  # Reduce from 48h
   ```

### Missing Trace Context in Logs

1. **Verify logger is using trace context**
   ```go
   log.WithTraceContext(ctx)
   ```

2. **Check trace context extraction**
   ```go
   tc := tracecontext.ExtractFromContext(ctx)
   fmt.Printf("Trace ID: %s\n", tc.TraceID)
   ```

3. **Verify Loki derived fields**
   - Check `datasources.yml` for correct regex
   - Ensure trace_id format matches: `trace_id=([a-f0-9]+)`

### Slow Trace Queries

1. **Add more selective filters**
   ```traceql
   // Slow - searches all traces
   {}
   
   // Fast - filters by service and time
   { .service.name = "armored-archer-backend" } && duration > 100ms
   ```

2. **Reduce time range**
   - Use last 15 minutes instead of 24 hours
   - Narrow down to specific incident window

3. **Use trace ID directly**
   ```bash
   # Fastest - direct trace lookup
   curl "http://localhost:3200/api/traces/<trace-id>"
   ```

---

## Integration Points

### With Loki (Logs)

- **Trace to Logs**: Click "Logs" in trace view
- **Logs to Trace**: Click trace_id link in logs
- **Correlation**: Automatic via `trace_id` field
- **Configuration**: Derived fields in `datasources.yml`

### With Prometheus (Metrics)

- **Trace to Metrics**: Click "Metrics" in trace view
- **Metrics to Trace**: Use exemplars (if configured)
- **Correlation**: Via service name and time range
- **Configuration**: `tracesToMetrics` in Tempo datasource

### With Grafana Dashboards

- **Templated Dashboards**: Use `$trace_id` variable
- **Alerts**: Link to traces in alert annotations
- **Panels**: Embed trace view in dashboards

---

## Performance Considerations

### Overhead

| Metric | Overhead |
|--------|----------|
| CPU | < 5% |
| Memory | < 50 MB |
| Network | < 1 MB/s (at 1% sampling) |
| Latency | < 1ms per span |

### Optimization Tips

1. **Use async exporting** (enabled by default)
2. **Batch spans** (configured in OTel collector)
3. **Sample appropriately** (1% for production)
4. **Limit span attributes** (only essential data)
5. **Use compression** (enabled in Tempo)

---

## Security Considerations

### Data Scrubbing

The tracing system automatically scrubs:
- Passwords
- API keys
- Token values
- Full credit card numbers

### Access Control

- **Development**: No authentication (internal network only)
- **Production**: Configure Grafana authentication
- **Trace Data**: Internal network only

### Compliance

- No PII in trace attributes
- User IDs only (not emails or names)
- Trace data encrypted at rest (production)

---

## Monitoring the Tracing System

### Key Tempo Metrics

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `tempo_ingester_memory_traces` | In-memory traces | > 100K |
| `tempo_request_duration_seconds` | Request latency | P99 > 5s |
| `tempo_blocks_flushed_total` | Blocks flushed to storage | Rate drop > 50% |

### Key OTel Collector Metrics

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `otelcol_exporter_sent_spans` | Spans exported | Rate drop > 50% |
| `otelcol_processor_batch_batch_send_size` | Batch sizes | < 100 |
| `otelcol_receiver_accepted_spans` | Spans received | Rate drop > 50% |

### Grafana Dashboard

A tracing dashboard is available at:
- **URL**: http://localhost:3000/d/tempo-tracing
- **Panels**: Service map, recent traces, slow traces, error traces

---

## Cost Optimization

### Storage Optimization

1. Use appropriate retention periods
2. Sample aggressively in production (1%)
3. Drop debug spans
4. Aggregate old traces

### Query Optimization

1. Use selective label filters
2. Avoid broad time ranges
3. Use TraceQL efficiently
4. Cache frequent queries

---

## Migration from Jaeger

If migrating from Jaeger:

1. **Deploy Tempo alongside Jaeger**
   ```bash
   docker-compose up -d tempo
   ```

2. **Update OTel collector config** to export to both
   ```yaml
   exporters:
     otlphttp/tempo:
       endpoint: http://tempo:4318
     jaeger:
       endpoint: jaeger:14250
   ```

3. **Update Grafana datasources** to use Tempo
   - Add Tempo datasource
   - Update dashboards

4. **Update documentation** and runbooks

5. **Decommission Jaeger** after validation

### Compatibility

Tempo supports:
- OTLP (native)
- Jaeger Thrift HTTP
- Jaeger gRPC
- Zipkin

Existing Jaeger clients will work without changes.

---

## Next Steps

After completing this phase:

1. ✅ Verify all traces are being collected
2. ✅ Create saved TraceQL queries for common investigations
3. ✅ Set up trace-based alerts
4. ✅ Integrate with incident response runbooks
5. ✅ Document common investigation patterns

---

## References

- [OpenTelemetry Go Documentation](https://opentelemetry.io/docs/instrumentation/go/)
- [Grafana Tempo Documentation](https://grafana.com/docs/tempo/latest/)
- [TraceQL Reference](https://grafana.com/docs/tempo/latest/traceql/)
- [OTel Collector Configuration](https://opentelemetry.io/docs/collector/configuration/)
- [Tracing Guide](backend/docs/tracing-guide.md)
- [Phase 2.5 Summary](.planning/phases/02-monitoring/02-05-SUMMARY.md)

---

**Checkpoint**: Human verify tracing configuration and dashboards
