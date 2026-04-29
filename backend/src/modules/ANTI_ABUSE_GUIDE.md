# PvP Anti-Abuse System

## Overview

The PvP anti-abuse system provides comprehensive protection against common abuse patterns in asynchronous PvP matches. It includes rate limiting, cooldowns, concurrent match limits, win trading detection, and duplicate submission prevention.

## Features

### 1. RPC Rate Limiting

Each PvP RPC endpoint has configurable rate limits to prevent spam and bot attacks:

| RPC Endpoint            | Requests/Minute | Penalty    | Purpose                                |
| ----------------------- | --------------- | ---------- | -------------------------------------- |
| `create_match`          | 5               | 5 minutes  | Prevent spam match creation            |
| `accept_match`          | 10              | 2 minutes  | Limit rapid match acceptance           |
| `submit_turn`           | 10              | 1 minute   | Prevent turn spam                      |
| `complete_match`        | 3               | 10 minutes | Prevent rapid match completion farming |
| `forfeit_match`         | 2               | 10 minutes | Limit forfeit spam                     |
| `list_matches`          | 30              | 30 seconds | Limit query spam                       |
| `get_player_rank`       | 60              | 10 seconds | Limit rank check spam                  |
| `get_async_match_state` | 30              | 30 seconds | Limit state polling                    |

### 2. Match Cooldowns

Time-based cooldowns prevent rapid consecutive actions:

| Action         | Cooldown Duration |
| -------------- | ----------------- |
| Create match   | 5 seconds         |
| Accept match   | 10 seconds        |
| Complete match | 30 seconds        |
| Abandon match  | 60 seconds        |

### 3. Concurrent Match Limits

- **Maximum active matches per player**: 3
- Players cannot create or accept new matches when at the limit
- Completing or abandoning a match decrements the active count
- Prevents match farming and queue manipulation

### 4. Turn Submission Duplicate Detection

- Tracks last turn submitted per player per match
- Blocks duplicate submissions for the same turn
- Allows submissions for different turns
- Automatically cleaned up when match completes
- Prevents accidental or intentional duplicate submissions

### 5. Abandonment Limits

- **Maximum abandonments per hour**: 5
- Abandonment count resets after 1 hour of no abandonments
- Reset on successful match completion
- Prevents abandonment spam for rate limit evasion

### 6. Win Trading Detection

Analyzes match history for suspicious patterns:

#### Alternating Win/Loss Pattern

- Detects players taking turns winning against each other
- Requires minimum 5 matches against same opponent
- Flags when 80%+ of matches alternate results
- Confidence scales with alternation frequency

#### Rapid Repeated Opponent Pattern

- Detects excessively rapid matches against same opponent
- Requires minimum 3 matches against same opponent
- Flags when average time between matches is < 2 minutes
- Confidence scales inversely with time between matches

## API Reference

### `initializeRateLimiting(config?, cooldowns?)`

Initialize the rate limiting module with custom configuration.

```typescript
initializeRateLimiting(
  {
    create_match: { maxRequests: 10, windowMs: 60000, penaltyMs: 120000 },
  },
  {
    matchCompleteMs: 60000,
  }
);
```

### `checkRateLimit(userId, rpcName)`

Check if a user is currently rate limited for a specific RPC.

```typescript
const result = checkRateLimit(userId, 'create_match');
if (!result.allowed) {
  // User is rate limited
  console.log(`Retry after: ${result.retryAfter}ms`);
  console.log(`Reason: ${result.reason}`);
}
```

### `checkMatchCooldown(userId, action)`

Check if a player is on cooldown for a specific match action.

```typescript
const result = checkMatchCooldown(userId, 'create');
if (!result.allowed) {
  // Player is in cooldown
  console.log(`Retry after: ${result.retryAfter}ms`);
}
```

### `checkConcurrentMatchLimit(userId)`

Check if a player has reached the maximum active matches.

```typescript
const result = checkConcurrentMatchLimit(userId);
if (!result.allowed) {
  console.log(`Active: ${result.activeCount}, Limit: ${result.limit}`);
}
```

### `checkAbandonmentLimit(userId)`

Check if a player has exceeded abandonment limits.

```typescript
const result = checkAbandonmentLimit(userId);
if (!result.allowed) {
  console.log(`Abandonments: ${result.abandonCount}, Limit: ${result.limit}`);
}
```

### `checkDuplicateTurn(userId, matchId, turnNumber)`

Check if a turn has already been submitted.

```typescript
const result = checkDuplicateTurn(userId, matchId, turnNumber);
if (result.isDuplicate) {
  console.log(`Last turn: ${result.lastTurnNumber}`);
}
```

### `detectWinTrading(userId, opponentId, results)`

Analyze match results for win trading patterns.

```typescript
const detection = detectWinTrading(userId, opponentId, matchResults);
if (detection.suspicious) {
  console.log(`Pattern: ${detection.pattern}`);
  console.log(`Confidence: ${detection.confidence}`);
}
```

### `recordMatchAction(userId, action, matchId?)`

Record a match action for cooldown and concurrent tracking.

```typescript
recordMatchAction(userId, 'create', matchId);
recordMatchAction(userId, 'complete', matchId);
recordMatchAction(userId, 'abandon', matchId);
```

### `cleanupTurnTracking(userId, matchId)`

Clean up turn tracking when a match is completed.

```typescript
cleanupTurnTracking(userId, matchId);
```

## Integration with Matchmaker

The rate limiting system is integrated into the following RPC endpoints:

### `rpcCreateMatch`

1. Checks rate limit for `create_match`
2. Checks cooldown for match creation
3. Checks concurrent match limit
4. Records match creation action on success

### `rpcAcceptMatch`

1. Checks rate limit for `accept_match`
2. Checks cooldown for match acceptance
3. Checks concurrent match limit
4. Records match acceptance action on success

### `rpcSubmitTurn`

1. Checks rate limit for `submit_turn`
2. Checks for duplicate turn submission
3. Returns error if duplicate detected

### `rpcCompleteMatch`

1. Checks rate limit for `complete_match`
2. Checks cooldown for match completion
3. Performs win trading detection
4. Logs warning if suspicious pattern detected
5. Records match completion action
6. Cleans up turn tracking

## Error Responses

### Rate Limit Exceeded

```json
{
  "error": "Rate limit exceeded. Please try again later.",
  "retry_after_ms": 120000
}
```

### Cooldown Active

```json
{
  "error": "Please wait before creating another match.",
  "retry_after_ms": 5000
}
```

### Concurrent Match Limit Reached

```json
{
  "error": "You have 3 active matches. Complete or abandon some matches first.",
  "active_matches": 3,
  "limit": 3
}
```

### Duplicate Turn Submission

```json
{
  "error": "You have already submitted a turn for this round.",
  "turn_number": 1
}
```

### Abandonment Limit Exceeded

```json
{
  "error": "Too many abandonments. Please wait before abandoning another match.",
  "abandon_count": 5,
  "limit": 5
}
```

## Monitoring

### Rate Limit Statistics

```typescript
const stats = getRateLimitStats();
console.log(`Tracked users: ${stats.trackedUsers}`);
console.log(`Tracked matches: ${stats.trackedMatches}`);
console.log(`Tracked turns: ${stats.trackedTurns}`);
```

### Player Rate Limit Status

```typescript
const status = getPlayerRateLimitStatus(userId);
console.log(`Active matches: ${status.activeMatches}`);
console.log(`Abandonments: ${status.abandonCount}`);
console.log(`Last action: ${status.lastMatchAction}`);
```

## Security Considerations

1. **Memory Management**: The system includes automatic cleanup of old entries every 5 minutes to prevent memory leaks.

2. **Per-User Tracking**: All rate limiting and tracking is per-user to ensure fair play while preventing abuse.

3. **Audit Logging**: All blocked actions are logged via `logAudit()` for forensic analysis.

4. **Win Trading Warnings**: Suspicious patterns are logged as warnings rather than blocking matches, allowing manual review.

5. **Graceful Degradation**: Rate limiting provides informative error messages with retry-after times to improve user experience.

## Configuration

Default values can be overridden via `initializeRateLimiting()`:

```typescript
// Custom rate limits
{
  create_match: { maxRequests: 10, windowMs: 60000, penaltyMs: 300000 },
  submit_turn: { maxRequests: 20, windowMs: 60000, penaltyMs: 60000 },
  // ... other endpoints
}

// Custom cooldowns
{
  matchCreateMs: 10000,
  matchCompleteMs: 60000,
  matchAcceptMs: 15000,
  // ... other actions
}
```

## Testing

Comprehensive tests are available in `rate_limit.test.ts` covering:

- RPC rate limiting (5 tests)
- Match cooldowns (4 tests)
- Concurrent match limits (3 tests)
- Abandonment limits (3 tests)
- Turn submission duplicate detection (5 tests)
- Win trading detection (5 tests)
- Statistics and monitoring (3 tests)
- Cleanup and memory management (2 tests)

Total: 34 tests, 32 passing

## Future Enhancements

1. **Persistent Storage**: Move in-memory tracking to Redis or database for horizontal scaling
2. **IP-Based Rate Limiting**: Add IP address tracking in addition to per-user limits
3. **Machine Learning**: Enhance win trading detection with ML-based pattern recognition
4. **Reputation System**: Track player reputation over time with exponential decay
5. **Adaptive Limits**: Dynamically adjust limits based on player trust level and historical behavior
