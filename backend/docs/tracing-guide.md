# Distributed Tracing Guide

**Milestone**: v2.1.0 - Alpha Launch & Stabilization
**Phase**: 2.5 - Distributed Tracing (Grafana Tempo)
**Last Updated**: 2026-03-16

---

## Overview

Armored Archer uses **OpenTelemetry** for distributed tracing, with **Grafana Tempo** as the trace storage backend. This guide covers how to instrument code, query traces, and troubleshoot issues using the tracing system.

### Architecture

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

## Quick Start

### 1. Start the Tracing Stack

```bash
cd backend
docker-compose up -d tempo otel-collector grafana
```

### 2. Access Grafana

- **URL**: http://localhost:3000
- **Username**: admin
- **Password**: admin (or from `.env`)

### 3. Open the Tracing Dashboard

Navigate to: **Dashboards** → **Distributed Tracing - Tempo**

---

## Instrumentation

### Go Backend (OpenTelemetry)

The tracing system is implemented in `backend/metrics/tracing.go`.

#### Basic Usage

```go
import "github.com/anchapin/armored-archer/backend/metrics"

// In your RPC handler or service function
func MyRPC(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
    // Wrap with tracing
    result, err := metrics.TraceRPC(ctx, "my_rpc", userID, func(ctx context.Context) (string, error) {
        // Your RPC logic here
        return result, nil
    })
    
    return result, err
}
```

#### Manual Span Creation

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
            attribute.Int("user.id", 123),
        ),
    )
    defer span.End()
    
    // Your operation here
    if err := doSomething(ctx); err != nil {
        span.RecordError(err)
        span.SetStatus(trace.StatusCodeError, err.Error())
        return err
    }
    
    span.SetStatus(trace.StatusCodeOk, "success")
    return nil
}
```

#### Helper Functions

The `metrics` package provides helper functions for common operations:

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

#### Trace Context Propagation

```go
import "github.com/anchapin/armored-archer/backend/metrics"

// For outgoing HTTP/gRPC requests
carrier := metrics.TextMapCarrier{}
metrics.Inject(ctx, carrier)

// Attach carrier headers to your request
req.Header.Set("traceparent", carrier["traceparent"])
req.Header.Set("tracestate", carrier["tracestate"])

// For incoming requests
carrier := metrics.TextMapCarrier{
    "traceparent": req.Header.Get("traceparent"),
    "tracestate": req.Header.Get("tracestate"),
}
ctx = metrics.Extract(ctx, carrier)
```

### Trace Context in Logs

The logger automatically includes trace context when available:

```go
import "github.com/anchapin/armored-archer/backend/internal/logger"

// Create logger with trace context
log := logger.NewStructuredLogger(nakamaLogger, "backend", "v2.1.0")
log.WithTraceContext(ctx)

// Logs will include trace_id and span_id
log.Info("Processing request", logger.LogContext{
    "rpc_name": "create_match",
    "user_id": userID,
})
// Output: [... ] trace_id=abc123 span_id=def456 rpc_name=create_match user_id=user_789
```

---

## Configuration

### Sampling Rates

| Environment | Sampling Rate | Configuration |
|-------------|---------------|---------------|
| Development | 100% (1.0) | Full tracing for debugging |
| Alpha | 10% (0.10) | Balance between visibility and cost |
| Production | 1% (0.01) | Cost-effective sampling |

Configure in `backend/config/tempo.yml`:

```yaml
# In OTel collector config
probabilistic_sampler:
  sampling_percentage: 1.0  # Adjust per environment
```

### Trace Retention

| Environment | Retention | Storage |
|-------------|-----------|---------|
| Development | 24 hours | `/tmp/tempo/blocks` |
| Alpha | 48 hours | Docker volume |
| Production | 7 days | S3/GCS (configured separately) |

---

## Querying Traces

### Grafana Tempo UI

#### Search Traces

1. Open **Grafana** → **Explore** → Select **Tempo** datasource
2. Use the **Search** tab
3. Filter by:
   - Service name: `armored-archer-backend`
   - RPC name: `rpc/create_match`
   - User ID: `user_123`
   - Match ID: `match_456`
   - Error: `true`

#### View Trace Details

1. Click on a trace ID
2. View the waterfall diagram
3. Click on individual spans to see:
   - Operation name
   - Duration
   - Tags/attributes
   - Logs/events
   - Error information

#### Trace to Logs

Click the **Logs** button in a trace view to see correlated logs:
- Uses `trace_id` from the trace
- Queries Loki for matching logs
- Shows logs within the trace time window

#### Trace to Metrics

Click the **Metrics** button to see correlated metrics:
- Request rate during the trace
- Error rate
- Latency percentiles

### TraceQL (Tempo's Query Language)

Tempo supports TraceQL for advanced queries:

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

### API Access

```bash
# Search traces
curl "http://localhost:3200/api/search?tags={.service.name=\"armored-archer-backend\"}"

# Get trace by ID
curl "http://localhost:3200/api/traces/<trace-id>"

# TraceQL query
curl "http://localhost:3200/api/search?q={%20.error%20=%20true%20}"
```

---

## Common Investigation Patterns

### 1. Debugging a Slow RPC

```bash
# 1. Find slow traces for the RPC
# In Grafana Explore (Tempo):
{ .rpc.name = "rpc/generate_gear" && duration > 500ms }

# 2. View the trace waterfall
# Look for spans with long durations

# 3. Check for bottlenecks
# - Database queries (db/query spans)
# - Cache operations (cache/get spans)
# - External API calls

# 4. Correlate with logs
# Click "Logs" button to see related logs

# 5. Check metrics
# Click "Metrics" to see latency trends
```

### 2. Investigating Errors

```bash
# 1. Find error traces
{ .error = true }

# 2. Filter by service
{ .error = true && .service.name = "armored-archer-backend" }

# 3. View error details
# Click on error span to see:
# - Error message
# - Stack trace
# - Error attributes

# 4. Check related logs
# Look for error-level logs with matching trace_id
```

### 3. User Journey Tracking

```bash
# 1. Find all traces for a user
{ .user.id = "user_123" }

# 2. Sort by time
# See the sequence of RPC calls

# 3. Identify patterns
# - Which RPCs did the user call?
# - Were there any errors?
# - What was the total latency?
```

### 4. Match Lifecycle Analysis

```bash
# 1. Find traces for a specific match
{ .match.id = "match_456" }

# 2. View match lifecycle
# - Match creation
# - Player acceptance
# - Combat actions
# - Match completion

# 3. Identify issues
# - Long matchmaking times
# - Failed combat actions
# - Reward distribution errors
```

---

## Best Practices

### Do's

✅ **Always propagate trace context**
```go
// Pass ctx with trace context to all downstream calls
result, err := myFunction(ctx)  // Not context.Background()
```

✅ **Use meaningful span names**
```go
// Good
tracer.Start(ctx, "db/player_lookup")

// Bad
tracer.Start(ctx, "operation1")
```

✅ **Add relevant attributes**
```go
span.SetAttributes(
    attribute.String("user.id", userID),
    attribute.String("match.id", matchID),
    attribute.Int("attempt", attempt),
)
```

✅ **Record errors properly**
```go
if err != nil {
    span.RecordError(err)
    span.SetStatus(trace.StatusCodeError, err.Error())
    return err
}
```

✅ **Use appropriate sampling**
- Development: 100% for full visibility
- Production: 1-10% to control costs

### Don'ts

❌ **Don't trace sensitive data**
```go
// Bad - exposes PII
span.SetAttributes(attribute.String("user.email", email))

// Good - use user ID instead
span.SetAttributes(attribute.String("user.id", userID))
```

❌ **Don't create too many spans**
```go
// Bad - span explosion
for i := 0; i < 1000; i++ {
    _, span := tracer.Start(ctx, "loop_iteration")
    span.End()
}

// Good - span for the loop
_, span := tracer.Start(ctx, "process_batch")
span.SetAttributes(attribute.Int("batch.size", 1000))
// Process items...
span.End()
```

❌ **Don't forget to end spans**
```go
// Bad - span leak
_, span := tracer.Start(ctx, "operation")
// Missing span.End()

// Good
_, span := tracer.Start(ctx, "operation")
defer span.End()
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
   ```

3. **Check tracing is enabled in code**
   ```go
   // In main.go or initialization
   metrics.InitializeTracing(&metrics.TracingConfig{
       Enabled: true,
       OTLPEndpoint: "otel-collector:4317",
   })
   ```

### High Memory Usage

1. **Reduce sampling rate**
   ```yaml
   probabilistic_sampler:
     sampling_percentage: 1.0  # Reduce to 0.1 for 10%
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
   - Ensure trace_id format matches regex

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

### With Prometheus (Metrics)

- **Trace to Metrics**: Click "Metrics" in trace view
- **Metrics to Trace**: Use exemplars (if configured)
- **Correlation**: Via service name and time range

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

- **Development**: No authentication (internal network)
- **Production**: Configure Grafana authentication
- **Trace Data**: Internal network only

### Compliance

- No PII in trace attributes
- User IDs only (not emails or names)
- Trace data encrypted at rest (production)

---

## Migration from Jaeger

If migrating from Jaeger:

1. **Deploy Tempo alongside Jaeger**
2. **Update OTel collector config** to export to both
3. **Update Grafana datasources** to use Tempo
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

## References

- [OpenTelemetry Go Documentation](https://opentelemetry.io/docs/instrumentation/go/)
- [Grafana Tempo Documentation](https://grafana.com/docs/tempo/latest/)
- [TraceQL Reference](https://grafana.com/docs/tempo/latest/traceql/)
- [OTel Collector Configuration](https://opentelemetry.io/docs/collector/configuration/)
- [Phase 2.5 Configuration Guide](.planning/phases/02-monitoring/02-05-tracing.md)

---

**Checkpoint**: Human verify tracing configuration and dashboards
