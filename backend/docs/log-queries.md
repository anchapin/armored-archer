# LogQL Queries - Armored Archer

**Purpose**: Common LogQL queries for investigating application issues, performance problems, and errors.

**Datasource**: Loki (http://loki:3100)

---

## Quick Reference

### Log Labels

| Label | Values | Description |
|-------|--------|-------------|
| `environment` | `development`, `alpha`, `production` | Deployment environment |
| `service` | `backend`, `nakama`, `system` | Service name |
| `level` | `info`, `warn`, `error`, `debug` | Log level |
| `job` | `armored_archer`, `nakama`, `docker` | Job identifier |
| `rpcName` | RPC endpoint name | RPC handler name |
| `userId` | User ID | User identifier |
| `requestId` | Request UUID | Request correlation ID |
| `container` | Container name | Docker container name |

---

## Error Investigation

### All Errors (Last 15 Minutes)

```logql
{environment="alpha", level="error"} |= ``
| line_format "{{.timestamp}} [{{.service}}] {{.message}}"
```

### Errors by Service

```logql
sum by (service) (
  count_over_time(
    {environment="alpha", level="error"}[15m]
  )
)
```

### Recent Errors with Context

```logql
{environment="alpha", level="error"}
| json
| line_format "{{.timestamp}} [{{.service}}] {{.message}} (requestId={{.requestId}}, userId={{.userId}})"
| __error__=""
```

### Errors for Specific RPC

```logql
{environment="alpha", level="error", rpcName="create_match"}
| json
| line_format "{{.timestamp}} - {{.message}}"
```

### Error Rate Over Time

```logql
sum(rate({environment="alpha", level="error"}[5m])) by (service)
```

---

## Request Tracing

### Trace a Specific Request

```logql
{environment="alpha"} |= "requestId=abc-123-def"
| json
| line_format "{{.timestamp}} [{{.level}}] {{.message}}"
```

### All Logs for a User

```logql
{environment="alpha"} |= "userId=user_12345"
| json
| line_format "{{.timestamp}} [{{.service}}] {{.message}}"
```

### Request Flow Through Services

```logql
{environment="alpha", requestId="abc-123-def"}
| json
| line_format "{{.timestamp}} [{{.service}}] {{.rpcName}} - {{.message}}"
```

---

## Performance Investigation

### Slow RPC Calls

```logql
{environment="alpha", service="backend"}
| json
| durationSec = duration
| durationSec > 1.0
| line_format "{{.timestamp}} SLOW RPC: {{.rpcName}} took {{.durationSec}}s"
```

### RPC Duration Distribution

```logql
sum by (rpcName) (
  rate({environment="alpha", operation="rpc_call"}[5m])
)
| line_format "{{.rpcName}}: {{.value}} calls/sec"
```

### High Latency Periods

```logql
sum(rate({environment="alpha"} |= "duration" [1m])) by (rpcName)
> 0.5
```

---

## User Activity

### User Login Activity

```logql
{environment="alpha", service="backend"}
|= "authenticate"
| json
| line_format "{{.timestamp}} User {{.userId}} - {{.message}}"
```

### User Session Events

```logql
{environment="alpha"}
|~ "session|login|logout"
| json
| line_format "{{.timestamp}} [{{.level}}] {{.userId}}: {{.message}}"
```

### Active Users Count

```logql
count by (userId) (
  {environment="alpha", service="backend"} |= "user_action"
)
```

---

## System Health

### Log Volume by Service

```logql
sum by (service) (
  rate({environment="alpha"}[5m])
)
```

### Log Volume Over Time

```logql
sum(rate({environment="alpha"}[1m]))
```

### Debug Logs (Development Only)

```logql
{environment="development", level="debug"}
| json
| line_format "{{.timestamp}} [{{.rpcName}}] {{.message}}"
```

### Warning Trends

```logql
sum(rate({environment="alpha", level="warn"}[5m]))
```

---

## Database Operations

### Database Errors

```logql
{environment="alpha"}
|~ "(?i)(database|db|postgres|sql).*error"
| json
| line_format "{{.timestamp}} DB ERROR: {{.message}}"
```

### Query Performance

```logql
{environment="alpha", operation=~"db_.*"}
| json
| line_format "{{.timestamp}} [{{.operation}}] {{.message}} ({{.duration}}ms)"
```

### Connection Pool Issues

```logql
{environment="alpha"}
|~ "(?i)(connection|pool|timeout)"
| json
| line_format "{{.timestamp}} {{.message}}"
```

---

## Cache Operations

### Cache Hit/Miss

```logql
{environment="alpha", operation=~"cache_.*"}
| json
| line_format "{{.timestamp}} [{{.operation}}] {{.message}}"
```

### Redis Errors

```logql
{environment="alpha"}
|~ "(?i)(redis|cache).*error"
| json
```

---

## Match & Multiplayer

### Match Creation Issues

```logql
{environment="alpha", rpcName="create_match"}
| json
| line_format "{{.timestamp}} [{{.level}}] Match creation: {{.message}}"
```

### Matchmaking Events

```logql
{environment="alpha"}
|~ "(?i)(matchmaking|match_found|queue)"
| json
```

### Real-time Match Logs

```logql
{environment="alpha", service="nakama"}
|~ "(?i)(match|multiplayer)"
| line_format "{{.timestamp}} {{.msg}}"
```

---

## Payment & IAP

### Purchase Events

```logql
{environment="alpha"}
|~ "(?i)(purchase|payment|iap|transaction)"
| json
| line_format "{{.timestamp}} [{{.userId}}] {{.message}}"
```

### Payment Errors

```logql
{environment="alpha", level="error"}
|~ "(?i)(purchase|payment|transaction)"
| json
```

---

## Security & Authentication

### Authentication Failures

```logql
{environment="alpha"}
|~ "(?i)(auth|login|authentication).*fail"
| json
| line_format "{{.timestamp}} [{{.userId}}] {{.message}}"
```

### Rate Limiting Events

```logql
{environment="alpha"}
|~ "(?i)(rate.?limit|throttl)"
| json
```

### Suspicious Activity

```logql
{environment="alpha", level="error"}
|~ "(?i)(unauthorized|forbidden|invalid.*token|security)"
| json
```

---

## Advanced Queries

### Multi-line Log Context

```logql
{environment="alpha", level="error"}
| line_format "{{.timestamp}}\nService: {{.service}}\nMessage: {{.message}}\nContext: {{.context}}\n---"
```

### Log Pattern Detection

```logql
{environment="alpha"}
| regexp "(?P<error_type>\\w+Error): (?P<error_message>.*)"
| line_format "{{.timestamp}} [{{.error_type}}] {{.error_message}}"
```

### Correlation with Metrics

```logql
// Logs with error rate overlay
{environment="alpha", level="error"}
| line_format "{{.timestamp}} ERROR: {{.message}}"
```

### Time-based Aggregation

```logql
sum by (service) (
  count_over_time(
    {environment="alpha", level="error"}[1h]
  )
)
```

---

## Grafana Explore Tips

### Using Grafana Explore

1. **Select Datasource**: Choose "Loki" from the dropdown
2. **Query Mode**: Use "Builder" for visual queries or "Code" for LogQL
3. **Time Range**: Adjust time range in top-right corner
4. **Line Limit**: Set max lines (default 1000) in datasource settings

### Useful Grafana Features

- **Log Context**: Click on a log line to see surrounding context
- **Filter by Value**: Click on any field value to add filter
- **Extract Fields**: Use JSON parsing to extract structured fields
- **Derived Fields**: Click on traceId/requestId to jump to traces

### Keyboard Shortcuts

- `Ctrl+Enter`: Run query
- `Ctrl+Space`: Autocomplete
- `Esc`: Clear query

---

## Saved Queries (Dashboard Variables)

Create these as dashboard variables for quick filtering:

```json
{
  "name": "environment",
  "type": "query",
  "query": "label_values(environment)"
}

{
  "name": "service",
  "type": "query",
  "query": "label_values(service)"
}

{
  "name": "rpcName",
  "type": "query",
  "query": "label_values(rpcName)"
}
```

---

## Troubleshooting Common Issues

### No Logs Appearing

```logql
// Check if Promtail is scraping
{job="promtail"} |= "scrape"

// Check all logs regardless of level
{environment="alpha"} |= ""
```

### Missing Fields

```logql
// Check raw log format without JSON parsing
{environment="alpha"}
| line_format "{{__line__}}"
```

### High Cardinality Warning

```logql
// Reduce cardinality by removing high-cardinality labels
{environment="alpha"}
| unwrap message
| rate()
```

---

## Log Retention

- **Development**: 7 days
- **Alpha**: 30 days
- **Production**: 90 days

To query older logs, adjust the time range in Grafana or use the Loki API directly.

---

## Resources

- [Loki Documentation](https://grafana.com/docs/loki/latest/)
- [LogQL Reference](https://grafana.com/docs/loki/latest/logql/)
- [Grafana Explore Guide](https://grafana.com/docs/grafana/latest/explore/)
