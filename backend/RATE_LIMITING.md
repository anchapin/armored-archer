# Rate Limiting

This document describes the rate limiting implementation for Armored Archer's RPC endpoints.

## Overview

The rate limiting system prevents abuse and protects server resources by limiting the number of requests each user can make to RPC endpoints within a specified time window.

## Features

- **Per-endpoint rate limits**: Each RPC endpoint can have its own rate limit configuration
- **Per-user tracking**: Rate limits are enforced per user ID
- **Configurable limits**: Rate limits can be adjusted via environment variables
- **Prometheus metrics**: Rate limit violations are tracked and exposed as metrics
- **Automatic cleanup**: Expired rate limit entries are automatically cleaned up
- **Proper error responses**: Rate-limited requests return HTTP 429 with Retry-After header

## Configuration

Rate limiting is configured via environment variables in the `.env` file:

### Global Settings

```bash
# Enable or disable rate limiting (default: true)
RATE_LIMIT_ENABLED=true

# Default rate limit settings (used for endpoints without specific config)
RATE_LIMIT_DEFAULT_MAX_REQUESTS=100
RATE_LIMIT_DEFAULT_WINDOW_MS=60000
```

### Per-Endpoint Settings

Each endpoint can be configured with its own limits:

```bash
# Health check endpoint
RATE_LIMIT_HEALTH_CHECK_MAX=300
RATE_LIMIT_HEALTH_CHECK_WINDOW_MS=60000

# Player stats endpoint
RATE_LIMIT_GET_PLAYER_STATS_MAX=60
RATE_LIMIT_GET_PLAYER_STATS_WINDOW_MS=60000

# Combat action endpoint (more restrictive)
RATE_LIMIT_SUBMIT_COMBAT_ACTION_MAX=10
RATE_LIMIT_SUBMIT_COMBAT_ACTION_WINDOW_MS=10000

# Store endpoints
RATE_LIMIT_VALIDATE_PURCHASE_MAX=20
RATE_LIMIT_VALIDATE_PURCHASE_WINDOW_MS=60000
RATE_LIMIT_SPEND_GEMS_MAX=20
RATE_LIMIT_SPEND_GEMS_WINDOW_MS=60000

# Gear system endpoints
RATE_LIMIT_GENERATE_GEAR_MAX=30
RATE_LIMIT_GENERATE_GEAR_WINDOW_MS=60000
RATE_LIMIT_EQUIP_GEAR_MAX=30
RATE_LIMIT_EQUIP_GEAR_WINDOW_MS=60000
```

## Default Rate Limits

The following default limits are configured:

| Endpoint | Max Requests | Time Window | Purpose |
|----------|-------------|-------------|---------|
| health_check | 300 | 60s | Health checks (very permissive) |
| get_player_stats | 60 | 60s | Reading player stats |
| gain_xp | 30 | 60s | XP progression |
| allocate_stats | 30 | 60s | Stat allocation |
| submit_combat_action | 10 | 10s | Combat actions (very restrictive) |
| get_match_state | 60 | 60s | Match state polling |
| create_match | 10 | 60s | Match creation |
| accept_match | 10 | 60s | Match acceptance |
| get_leaderboard | 30 | 60s | Leaderboard queries |
| validate_purchase | 20 | 60s | Purchase validation |
| spend_gems | 20 | 60s | Gem spending |
| generate_gear | 30 | 60s | Gear generation |
| equip_gear | 30 | 60s | Gear equipping |

## Response Format

When a rate limit is exceeded, the RPC returns:

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Please try again later.",
    "retryAfter": 45,
    "resetTime": 1709323200000
  }
}
```

The client should:
1. Display an appropriate error message to the user
2. Use the `retryAfter` value to determine when to retry
3. Implement exponential backoff for subsequent retries

## Monitoring

Rate limiting exposes the following Prometheus metrics:

- `armored_archer_rate_limit_violations_total`: Total number of rate limit violations per endpoint
- `armored_archer_rate_limit_active_users`: Number of users currently being rate limited

View metrics at: `http://localhost:9100/metrics` (or configured `PROMETHEUS_PORT`)

## Implementation Details

### Rate Limit Algorithm

- Uses a sliding window approach with time-based buckets
- Tracks request counts per user ID per endpoint
- Automatic cleanup of expired entries (every 60 seconds)

### Integration

Rate limiting is integrated into the RPC registration system in `src/index.ts`:

```typescript
if (config.rateLimit.enabled) {
  registerRpcWithRateLimit(initializer, "armored_archer/endpoint", "endpoint", handler);
} else {
  registerRpcWithRateLimit(initializer, "armored_archer/endpoint", "endpoint", handler);
}
```

### Logging

Rate limit violations are logged with:

```json
{
  "level": "warn",
  "message": "Rate limit violation",
  "endpoint": "submit_combat_action",
  "userId": "user123",
  "retryAfter": 5,
  "timestamp": 1709323200000
}
```

## Testing

To test rate limiting:

1. Set a low limit for testing:
   ```bash
   RATE_LIMIT_SUBMIT_COMBAT_ACTION_MAX=3
   RATE_LIMIT_SUBMIT_COMBAT_ACTION_WINDOW_MS=60000
   ```

2. Make requests exceeding the limit
3. Verify the 429 error response
4. Check metrics endpoint for violations
5. Wait for the window to expire and retry

## Security Considerations

- Rate limits are enforced on the server side only
- Client cannot bypass rate limits
- User ID is used for tracking (requires authentication)
- Consider IP-based rate limiting for anonymous endpoints
