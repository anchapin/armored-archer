# Anti-Cheat & RPC Input Validation Implementation

**Issue #141**: Harden RPC input validation and implement anti-cheat detection for malicious requests

## Overview

This document describes the comprehensive anti-cheat and input validation system implemented to protect the Armored Archer game from malicious requests and cheating attempts.

## Architecture

### Three-Layer Defense System

1. **Input Validation Layer** (`validation.ts`)
   - Zod schema validation for all RPC payloads
   - Type-safe payload parsing
   - Range checking on game parameters

2. **Anti-Cheat Layer** (`anti_cheat.ts`)
   - HMAC-SHA256 request signing
   - Replay attack detection
   - Timing attack detection
   - Clock skew validation
   - Combat parameter validation

3. **Audit & Forensics Layer** (`anti_cheat_audit.ts`)
   - Comprehensive violation logging
   - User risk profiling
   - Automatic account flagging/suspension
   - Compliance reporting

## Features Implemented

### 1. HMAC-SHA256 Request Signing

**Purpose**: Detect tampered or forged requests

```typescript
// Client generates request ID and nonce
const { requestId, nonce } = generateRequestIdAndNonce();

// Client computes signature
const signature = computeSignature(payload, timestamp, nonce);

// Client sends payload with: { requestId, timestamp, signature, nonce }

// Server verifies signature
const result = verifyRequestSignature(ctx, payload, signatureData, 'rpc_name');
```

**Implementation Details**:
- Uses Node.js crypto HMAC-SHA256
- Message format: `payload:timestamp:nonce`
- Signatures are case-sensitive hex strings
- Optional feature (configurable via `ENABLE_HMAC_VERIFICATION`)

### 2. Replay Attack Protection

**Purpose**: Prevent attackers from resubmitting valid captured requests

**Mechanism**:
- Tracks processed `requestId` values in memory
- Rejects any duplicate `requestId` within 5-minute replay window
- Automatic cleanup of old entries
- Memory-efficient with configured retention periods

```typescript
// First request with requestId "abc123" succeeds
verifyRequestSignature(ctx, payload, { requestId: "abc123", ... });

// Same requestId reused fails with replay_attack violation
verifyRequestSignature(ctx, payload, { requestId: "abc123", ... }); // BLOCKED
```

### 3. Clock Skew Detection

**Purpose**: Detect requests from devices with incorrect system clocks (timing attacks)

**Thresholds**:
- Default: ±5 seconds allowed
- Configurable via `maxClockSkewMs`

**Implementation**:
- Compares server timestamp with client `timestamp` field
- Logs violations for analysis
- Severity: MEDIUM (device misconfiguration vs. intent to cheat)

### 4. Combat Parameter Validation

**Scope**: `submit_combat_action` RPC

**Validated Parameters**:

| Parameter | Valid Range | Reason |
|-----------|------------|--------|
| `angle` | 0.0 to 2π radians (0° to 360°) | Physical aiming constraint |
| `power` | 0.0 to 1.0 | Normalized attack power |
| Turn order | Current user matches expected player | Protocol enforcement |

**Violations Detected**:
- Angle < 0 or > 2π (impossible aim direction)
- Power < 0 or > 1.0 (invalid intensity)
- Out-of-turn actions (player acting when not their turn)

### 5. Timing Attack Detection

**Purpose**: Identify automated bot activity and frame-perfect exploits

**Mechanism**:
- Tracks request arrival times per user+RPC
- Analyzes inter-request intervals
- Flags if average interval < 100ms (human-impossible)
- Remembers patterns across requests in 1-hour window

**Detection Logic**:
```
If user makes 4+ requests to same RPC:
  Calculate average interval between requests
  If average < 100ms: TIMING ATTACK DETECTED
```

**Why 100ms**:
- Human reaction time: ~150-300ms
- Cannot consistently achieve <100ms
- Bots/macros can achieve microsecond precision

### 6. Out-of-Turn Detection

**Purpose**: Prevent players from taking actions during opponent's turn

**Implementation**:
- Compares `matchState.current_turn_user_id` with `ctx.userId`
- Enforced at RPC layer before any game logic
- Severity: HIGH (definitive protocol violation)

## Integration with Combat System

### Modified RPC: `submit_combat_action`

**Validation Sequence**:
```
1. Parse & validate payload (schema)
2. Verify HMAC signature (if provided)
3. Load match from storage
4. Check match status
5. Load match state
6. Check turn timeout
7. Verify player's turn ✓ ANTI-CHEAT
8. Validate combat parameters ✓ ANTI-CHEAT
9. Detect timing attacks ✓ ANTI-CHEAT
10. Process action
11. Save state with requestId
```

### Updated Schema

```typescript
submit_combat_action: z.object({
  match_id: z.string().min(1).max(100),
  action_type: z.enum(['shoot']),
  angle: z.number().min(0).max(6.28318530718),      // ✓ Fixed range
  power: z.number().min(0).max(1).optional(),        // ✓ Normalized 0-1
  
  // Anti-cheat fields (optional for backward compat)
  requestId: z.string().min(32).max(32).optional(),
  timestamp: z.number().int().min(0).optional(),
  signature: z.string().min(64).max(64).optional(),
  nonce: z.string().min(32).max(32).optional(),
})
```

### Error Responses

New error codes returned by RPC:
- `ANTI_CHEAT_VIOLATION` - Signature invalid or request replayed
- `INVALID_PARAMETERS` - Combat parameters out of range
- `OUT_OF_TURN` - Player acting during opponent's turn
- `TIMING_ANOMALY` - Suspicious request pattern detected

## Audit Logging & Forensics

### Violation Types Tracked

| Violation Type | Severity | Action |
|---|---|---|
| `replay_attack` | CRITICAL | Flag + Audit |
| `invalid_signature` | CRITICAL | Flag + Audit |
| `timing_attack` | HIGH | Log + Monitor |
| `out_of_turn` | HIGH | Log + Monitor |
| `clock_skew` | MEDIUM | Log only |

### User Risk Scoring

Risk score formula (0-100):
```
score = 0
score += replay_attack * 20
score += invalid_signature * 18
score += timing_attack * 12
score += out_of_turn * 8
score += clock_skew * 3

if (violations_in_last_hour > 0): score += 10
```

**Auto-Actions**:
- Risk ≥ 50: Flag for manual review (collection: `high_risk_users`)
- Violations ≥ 15: Auto-suspend 7 days (collection: `player_suspensions`)

### Audit Trail Storage

Violations stored in Nakama storage:
- Collection: `anti_cheat_violations`
- Key: `{userId}:{timestamp}:{requestId}`
- Access: Private (user only)
- Retention: 30 days (configurable)

### Generated Reports

```typescript
// Get user violation summary
const summary = getUserViolationSummary(userId);
// Returns: { totalViolations, violationsByType, riskScore, isHighRisk }

// Get top violators
const topViolators = getTopViolators(10);

// Generate compliance report
const report = generateAuditReport(startTime, endTime);
// Returns: violations by type, unique users, period stats
```

## Testing

### Test Coverage

**Anti-Cheat Module** (`anti_cheat.test.ts`):
- ✅ Request ID/nonce generation (uniqueness, format)
- ✅ HMAC signature computation (deterministic, varied)
- ✅ Signature verification (valid/invalid/replayed)
- ✅ Clock skew detection
- ✅ Combat parameter validation (angle, power, turn order)
- ✅ Timing attack detection
- ✅ Full integration flows (legitimate + malicious)

**Combat System** (`combat_system.test.ts`):
- ✅ All existing tests still pass
- ✅ Integration with anti-cheat validation

### Running Tests

```bash
cd backend
npm test -- src/modules/__tests__/anti_cheat.test.ts

# Expected: 15 tests passing
```

## Configuration

### Environment Variables

```bash
# HMAC secret for signing (MUST change in production)
HMAC_SECRET="change-this-in-production"

# Enable HMAC signature verification
ENABLE_HMAC_VERIFICATION="true"

# Optional: Configure thresholds
ANTI_CHEAT_REPLAY_WINDOW_MS=300000    # 5 minutes
ANTI_CHEAT_MAX_CLOCK_SKEW_MS=5000     # 5 seconds
ANTI_CHEAT_TIMING_THRESHOLD_MS=100    # Microsecond precision = bot
```

### Initialization

In backend initialization (e.g., `index.ts`):

```typescript
import { initializeAntiCheat, recordViolation } from './modules/anti_cheat';
import { initializeAuditLogging } from './modules/anti_cheat_audit';

// Initialize anti-cheat system
initializeAntiCheat(
  {
    enableSignatureVerification: process.env.ENABLE_HMAC_VERIFICATION === 'true',
    replayWindowMs: 300000,
    maxClockSkewMs: 5000,
  },
  (violation) => {
    recordViolation(violation); // Log to audit system
  }
);

// Initialize audit logging
initializeAuditLogging(
  {
    enablePersistence: true,
    highRiskThreshold: 50,
    suspensionThreshold: 15,
  },
  nk,
  logger
);
```

## Client-Side Integration

### For Game Client (Godot/GDScript)

```gdscript
# Generate request signature before sending RPC
var request_data = {
  "match_id": match_id,
  "action_type": "shoot",
  "angle": angle_radians,
  "power": power_normalized  # 0.0 to 1.0
}

var request_id = generate_request_id()  # 32 hex chars
var nonce = generate_nonce()            # 32 hex chars
var timestamp = Time.get_ticks_msec()
var payload_json = JSON.stringify(request_data)
var signature = compute_hmac_sha256(payload_json, timestamp, nonce, shared_secret)

var final_payload = {
  "match_id": match_id,
  "action_type": "shoot",
  "angle": angle_radians,
  "power": power_normalized,
  "requestId": request_id,
  "timestamp": timestamp,
  "signature": signature,
  "nonce": nonce
}

# Send to RPC
yield(nakama_client.rpc_async("armored_archer/submit_combat_action", final_payload), "completed")
```

## Monitoring & Operations

### Dashboard Metrics

Recommended monitoring:
- Active users with violations (last 24h)
- Top violation types (pie chart)
- Users approaching suspension threshold
- False positive rate (clock skew violations)

### Maintenance Tasks

```bash
# Clean up old violations (daily)
cleanupOldViolations(30); // 30-day retention

# Generate audit reports (weekly)
const report = generateAuditReport(startTime, endTime);

# Review high-risk users
const topViolators = getTopViolators(10);
```

### Key Metrics to Track

- **False Positive Rate**: Clock skew violations from legitimate players
  - Expected: < 1% of player base
  - Action: Increase `maxClockSkewMs` if > 2%

- **Detection Rate**: Replay attacks detected
  - Expected: Varies (0-10 per million requests)
  - Action: Review if spike > 10x normal

- **Suspension Rate**: Auto-suspended accounts
  - Expected: < 0.1% of player base
  - Action: Review patterns if > 1%

## Security Considerations

### Attack Vectors Mitigated

| Attack | Detection | Mitigation |
|---|---|---|
| Request replay | Replay detection | requestId uniqueness |
| MITM tampering | HMAC signature | Request signing |
| Frame-perfect exploits | Timing analysis | Inter-request intervals |
| Out-of-turn actions | Protocol validation | Turn order checks |
| Invalid parameters | Range validation | Schema + custom logic |
| Device clock attacks | Clock skew detection | Timestamp validation |

### Remaining Considerations

1. **Server-Side RNG**: Damage calculations use `Math.random()`. Server must compute damage, not client.
2. **Network Latency**: Clock skew threshold should account for typical network delay (~50-100ms)
3. **Bot Sophistication**: Timing attack detection assumes <100ms is impossible. Human-like delays (150-300ms) bypass this.
4. **HMAC Secret**: Must be different per environment and rotated quarterly.

## Files Created/Modified

### New Files

1. **`backend/src/modules/anti_cheat.ts`** (380 lines)
   - Core anti-cheat detection logic
   - HMAC signing, replay protection, timing analysis

2. **`backend/src/modules/anti_cheat_audit.ts`** (280 lines)
   - Violation tracking and auditing
   - User risk profiling
   - Account flagging/suspension

3. **`backend/src/modules/__tests__/anti_cheat.test.ts`** (260 lines)
   - Comprehensive test suite (15 tests)
   - 100% pass rate

### Modified Files

1. **`backend/src/modules/validation.ts`**
   - Updated `submit_combat_action` schema
   - Added anti-cheat fields (requestId, timestamp, signature, nonce)
   - Fixed angle range: `-6.28...` → `0` to `6.28...`
   - Fixed power range: `0-100` → `0.0-1.0`

2. **`backend/src/modules/combat_system.ts`**
   - Imported anti-cheat functions
   - Added signature verification check
   - Added parameter validation
   - Added timing attack detection
   - Returns requestId in responses

## Performance Impact

### Memory Usage

- Processed requests: O(N) where N = requests in replay window
  - Default: 5 min window × ~10,000 active users = ~50K entries
  - Each entry: ~40 bytes → ~2 MB

- Request timing log: O(M) where M = requests in 1-hour window
  - Per-user tracking: ~100 req/hour = moderate memory
  - Auto-cleanup every 60 seconds

**Total**: < 10 MB for 10,000 concurrent users

### CPU Impact

- Per-request overhead: ~1-2ms
  - HMAC-SHA256 computation: ~0.5ms
  - Set lookups: < 0.1ms
  - Timing analysis: < 0.5ms

- Auto-cleanup job: 60s interval
  - Minimal impact (< 1ms every minute)

## Future Enhancements

1. **Machine Learning Detection**
   - Pattern recognition for bot-like behavior
   - Anomaly detection in play styles

2. **Distributed Replay Protection**
   - Redis cache for request IDs (multi-server)
   - Distributed timing analysis

3. **Client-Side Verification**
   - Verify game logic calculations locally
   - Flag impossible damage values

4. **Behavioral Biometrics**
   - Learn player's typical response times
   - Flag statistically impossible improvements

## References

- **OWASP**: https://owasp.org/www-community/attacks/Replay_attack
- **Timing Attacks**: https://en.wikipedia.org/wiki/Timing_attack
- **HMAC**: https://tools.ietf.org/html/rfc2104
- **Nakama**: https://heroiclabs.com/docs/

## Support

For questions or issues regarding anti-cheat implementation:
- Review `COMBAT_SYSTEM.md` for game design
- Check test cases in `anti_cheat.test.ts`
- Enable debug logging: set `LOG_LEVEL=debug`
