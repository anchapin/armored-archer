# Alpha Analytics Guide

**Version**: 2.1.0-alpha  
**Last Updated**: 2026-03-16  
**Audience**: Developers, QA, Product Managers  

---

## 📊 Overview

This guide provides comprehensive documentation for the Armored Archer alpha analytics system. It covers event tracking, dashboard usage, data analysis, and best practices for leveraging analytics during the alpha testing phase.

---

## 🎯 What is Alpha Analytics?

Alpha analytics is the system we use to track how players interact with Armored Archer during alpha testing. It helps us:

- **Understand Player Behavior**: See which features players use most
- **Identify Problems**: Catch errors and performance issues quickly
- **Measure Engagement**: Track how long players stay and return
- **Improve the Game**: Make data-driven decisions about what to fix or enhance

---

## 📐 Analytics Architecture

### How It Works

```
Player Action → Game Client → Analytics Event → Game Server → Logs & Metrics → Dashboards
```

1. **Event Generation**: When a player performs an action (starts a match, opens store, etc.), the game creates an analytics event
2. **Event Transmission**: The event is sent to the game server via Nakama RPC
3. **Event Processing**: The server logs the event and updates metrics
4. **Data Visualization**: Grafana dashboards display the data in real-time
5. **Alerting**: Automatic alerts trigger if something goes wrong

### Components

| Component | Purpose | Location |
|-----------|---------|----------|
| **Analytics Manager** | Go code that processes events | `backend/internal/analytics/` |
| **Prometheus** | Metrics collection and storage | Docker container |
| **Grafana** | Dashboards and visualization | `backend/grafana/dashboards/` |
| **Loki** | Log aggregation | Docker container |

---

## 🏷️ Event Types

### Event Categories

Alpha analytics events are organized into categories:

#### 1. User Lifecycle Events
Track player journey from registration to active play.

| Event | Description | When It Fires |
|-------|-------------|---------------|
| `alpha_registration` | Player registers for alpha | When alpha access is granted |
| `alpha_access_granted` | Access key redeemed | When player enters valid alpha key |
| `alpha_onboarding_started` | Onboarding begins | When player starts tutorial |
| `alpha_onboarding_completed` | Onboarding finished | When tutorial completes |

#### 2. Session Events
Track play sessions and retention.

| Event | Description | When It Fires |
|-------|-------------|---------------|
| `alpha_session_start` | Session begins | When player logs in |
| `alpha_session_end` | Session ends | When player logs out |
| `alpha_day1_return` | D1 retention | When player returns on day 1 |
| `alpha_day7_return` | D7 retention | When player returns on day 7 |
| `alpha_day30_return` | D30 retention | When player returns on day 30 |

#### 3. Combat Events
Track combat feature usage.

| Event | Description | When It Fires |
|-------|-------------|---------------|
| `alpha_combat_match_started` | Combat match begins | When match loads |
| `alpha_combat_match_completed` | Match ends normally | When match result is determined |
| `alpha_combat_match_abandoned` | Player leaves match early | When player disconnects during match |
| `alpha_combat_action_performed` | Combat action taken | When player attacks or uses ability |

#### 4. Gear Events
Track gear system usage.

| Event | Description | When It Fires |
|-------|-------------|---------------|
| `alpha_gear_equipped` | Gear equipped | When player equips an item |
| `alpha_gear_obtained` | New gear acquired | When player receives gear |
| `alpha_transmog_applied` | Transmog skin applied | When player changes gear appearance |

#### 5. Matchmaking Events
Track matchmaking flow.

| Event | Description | When It Fires |
|-------|-------------|---------------|
| `alpha_matchmaking_queue_joined` | Queue entered | When player clicks "Find Match" |
| `alpha_matchmaking_match_found` | Match found | When system finds a match |
| `alpha_matchmaking_match_accepted` | Player accepts match | When player clicks "Accept" |
| `alpha_matchmaking_match_declined` | Player declines match | When player clicks "Decline" |
| `alpha_matchmaking_queue_timeout` | Queue times out | When no match found after timeout |

#### 6. Store Events
Track store interactions.

| Event | Description | When It Fires |
|-------|-------------|---------------|
| `alpha_store_opened` | Store opened | When player opens store UI |
| `alpha_store_item_purchased` | Purchase successful | When transaction completes |
| `alpha_store_purchase_failed` | Purchase failed | When transaction fails |

#### 7. Progression Events
Track player progression.

| Event | Description | When It Fires |
|-------|-------------|---------------|
| `alpha_player_level_up` | Player levels up | When XP threshold reached |
| `alpha_player_xp_granted` | XP awarded | When player earns XP |
| `alpha_player_ability_unlocked` | New ability | When ability is unlocked |
| `alpha_player_achievement_unlocked` | Achievement earned | When achievement criteria met |

#### 8. Error Events
Track errors and performance issues.

| Event | Description | When It Fires |
|-------|-------------|---------------|
| `alpha_client_error` | Client-side error | When game encounters error |
| `alpha_rpc_error` | Server RPC error | When RPC call fails |
| `alpha_connection_lost` | Connection dropped | When network disconnects |
| `alpha_frame_rate_drop` | Low FPS detected | When frame rate drops below threshold |

---

## 📊 Event Structure

### Base Event Format

All analytics events follow this structure:

```json
{
  "id": "alpha_evt_1710604800000_abc123",
  "user_id": "usr_player123",
  "event_name": "alpha_session_start",
  "timestamp": 1710604800000,
  "platform": "ios",
  "session_id": "sess_xyz789",
  "sequence_num": 1,
  "properties": {
    "game_version": "2.1.0-alpha.1",
    "device_model": "iPhone 15 Pro",
    "os_version": "17.3.1",
    "is_first_session": true
  }
}
```

### Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique event identifier |
| `user_id` | string | Player's user ID |
| `event_name` | string | Event type (e.g., `alpha_session_start`) |
| `timestamp` | int64 | Unix timestamp in milliseconds |
| `platform` | string | Platform: `ios`, `android`, `pc` |
| `session_id` | string | Current session identifier |
| `sequence_num` | int64 | Event order within session |
| `properties` | object | Event-specific data |

---

## 📈 Using the Dashboards

### Accessing Dashboards

1. Open Grafana: `http://localhost:3000` (local development)
2. Navigate to **Dashboards** → **Armored Archer**
3. Select **05 - Alpha Analytics**

### Dashboard Sections

#### 🎯 Alpha Overview

**Purpose**: Quick snapshot of alpha health

**Key Metrics**:
- Total Alpha Registrations
- Registrations (Last 24h)
- Active Alpha Sessions
- Average Session Duration

**When to Use**: Daily check-ins, standup updates

---

#### 📈 Registration Trends

**Purpose**: Track alpha sign-up velocity

**Panels**:
- Registration Rate (per hour)
- Registration Rate (per day)

**Insights**:
- Spike in registrations? Check marketing campaigns
- Drop in registrations? Investigate potential issues

---

#### ⚔️ Combat Feature Usage

**Purpose**: Monitor combat system engagement

**Panels**:
- Combat Matches by Type (PvE, PvP, Tutorial)
- Match Completion vs Abandonment Rate
- Combat Match Duration Percentiles

**Insights**:
- High abandonment rate? Combat may be too difficult or buggy
- Long queue times? May need more players or better matchmaking

---

#### ⚙️ Gear & Matchmaking Usage

**Purpose**: Track gear system and matchmaking health

**Panels**:
- Gear System Activity (Equipped, Obtained, Transmog)
- Matchmaking Flow (Queues Joined, Matches Found/Accepted)
- Queue Time Percentiles (P50, P95)

**Insights**:
- Low gear usage? Players may not understand gear system
- High queue decline rate? Matchmaking balance issues

---

#### 💰 Store & Monetization

**Purpose**: Monitor store engagement and revenue

**Panels**:
- Alpha Revenue (Last 24h)
- Store Opens (24h)
- Store Purchases (24h)
- Purchase Success Rate
- Store Transactions (1h rate)
- Revenue by Product Type

**Insights**:
- Low store opens? Players may not know about store
- High failure rate? Payment processing issues

---

#### ⚠️ Error Tracking & Performance

**Purpose**: Identify and troubleshoot issues

**Panels**:
- Alpha Error Rate (5m)
- Users with Errors (1h)
- RPC Latency Percentiles (P50, P95, P99)
- Top 5 RPCs by Error Count
- Top 5 Error Codes

**Insights**:
- Error rate > 5%? Immediate investigation needed
- High latency? Performance optimization required

---

#### 🔄 Conversion Funnel

**Purpose**: Track player progression through key milestones

**Funnel Stages**:
1. Registration
2. Onboarding Completed
3. FTUE Completed
4. First Combat
5. First Gear Equip
6. Store Opened

**Panels**:
- Conversion Funnel (Cumulative)
- Funnel Conversion Rates

**Insights**:
- Drop-off at onboarding? Tutorial may be too long or confusing
- Drop-off before first combat? Combat tutorial may have issues

---

## 🔍 Analyzing Data

### Retention Analysis

**D1 Retention**: Percentage of players who return the day after registering

```
D1 Retention = (Players who return on Day 1) / (Players on Day 0) × 100
```

**D7 Retention**: Percentage of players who return after one week

**D30 Retention**: Percentage of players who return after one month

**Good Benchmarks**:
- D1: 40-60%
- D7: 20-30%
- D30: 10-20%

### Conversion Funnel Analysis

**Identify Drop-off Points**:
- Look for stages with largest percentage drops
- Investigate why players leave at those points
- A/B test improvements

**Example Analysis**:
```
Registration → Onboarding: 80% conversion (good)
Onboarding → FTUE: 70% conversion (okay)
FTUE → First Combat: 40% conversion (PROBLEM!)
```

In this example, investigate why 60% of players don't reach first combat after completing FTUE.

### Error Analysis

**Error Rate Calculation**:
```
Error Rate = (Failed RPCs) / (Total RPCs) × 100
```

**Investigation Steps**:
1. Check error rate trend (increasing?)
2. Identify top error codes
3. Check which RPCs are failing
4. Review recent deployments
5. Check server logs for details

---

## 🛠️ Developer Guide

### Logging Events from Go Code

#### Basic Event Logging

```go
import "github.com/anchapin/armored-archer/backend/internal/analytics"

// Create analytics manager
analyticsManager := analytics.NewAlphaAnalyticsManager(logger)

// Log session start
analyticsManager.LogAlphaSessionStart(
    userID,
    sessionID,
    platform,
    gameVersion,
    isReturning,
)
```

#### Combat Match Example

```go
// Log combat match start
analyticsManager.LogAlphaCombatMatchStarted(
    userID,
    sessionID,
    matchID,
    "pve", // match type
)

// Log combat match completion
analyticsManager.LogAlphaCombatMatchCompleted(
    userID,
    sessionID,
    matchID,
    "pve",
    "win", // result: win, loss, draw
    durationMs,
)
```

#### Error Logging Example

```go
// Log RPC error
analyticsManager.LogAlphaRPCError(
    userID,
    sessionID,
    "matchmake", // RPC name
    "MATCHMAKING_TIMEOUT",
    err.Error(),
    true, // is retryable
    0,    // retry count
)
```

### Adding New Events

1. **Define Event Type** in `alpha_events.go`:
```go
const (
    EventAlphaNewFeature AlphaEventType = "alpha_new_feature"
)
```

2. **Add Properties** to `AlphaEventProperties` struct:
```go
type AlphaEventProperties struct {
    // ... existing properties ...
    NewFeatureID string `json:"new_feature_id,omitempty"`
}
```

3. **Create Logging Method**:
```go
func (m *AlphaAnalyticsManager) LogAlphaNewFeature(
    userID, sessionID, featureID string,
) {
    event := &AlphaAnalyticsEvent{
        UserID:    userID,
        EventName: EventAlphaNewFeature,
        SessionID: sessionID,
        Properties: AlphaEventProperties{
            NewFeatureID: featureID,
        },
    }
    m.LogAlphaEvent(event)
}
```

4. **Add Prometheus Metric** (optional):
```go
var alphaNewFeatureTotal = promauto.NewCounter(prometheus.CounterOpts{
    Name: "armored_archer_alpha_new_feature_total",
    Help: "Total new feature uses",
})
```

5. **Update Dashboard** to visualize new metric

---

## 🧪 Testing & Validation

### Validating Events

Use the validation script to ensure events are properly configured:

```bash
# Run validation
cd backend
./scripts/validate-analytics.sh

# Verbose mode
./scripts/validate-analytics.sh --verbose

# CI mode (fails on errors)
./scripts/validate-analytics.sh --ci

# Validate specific event
./scripts/validate-analytics.sh --event alpha_session_start
```

### Manual Testing

1. **Start Local Environment**:
```bash
cd backend
docker-compose up -d
```

2. **Trigger Events**: Play through game flows manually

3. **Check Logs**:
```bash
# View analytics logs
docker-compose logs -f nakama | grep "Analytics event"
```

4. **Verify in Grafana**:
- Open dashboard
- Check that metrics are updating
- Verify panels show expected data

---

## 🔒 Privacy & Compliance

### What We Collect

✅ **Allowed**:
- User ID (internal game ID)
- Session ID
- Platform and device info
- Game version
- Feature usage data
- Performance metrics
- Error data

❌ **Not Allowed**:
- Personal identifiable information (PII)
- Payment information
- Chat message content
- Location data
- Contacts or social graph

### Data Retention

| Data Type | Retention Period |
|-----------|------------------|
| Raw event logs | 90 days |
| Prometheus metrics | 1 year |
| User-level analytics | 30 days |

### User Rights

Alpha users have the right to:
- Access their data
- Request data deletion
- Export their data

**Process**: Contact development team with user ID

---

## 🚨 Troubleshooting

### Common Issues

#### Events Not Appearing in Dashboard

**Symptoms**: Events logged but not showing in Grafana

**Possible Causes**:
1. Prometheus scrape interval not reached (default: 15s)
2. Metric name mismatch
3. Dashboard query filter too restrictive

**Solutions**:
1. Wait 30-60 seconds for metrics to appear
2. Check metric names match exactly
3. Remove dashboard filters temporarily

#### High Error Rate

**Symptoms**: Error rate panel shows > 5%

**Investigation Steps**:
1. Check "Top 5 RPCs by Error Count" panel
2. Check "Top 5 Error Codes" panel
3. Review server logs for specific errors
4. Check recent deployments
5. Verify database connectivity

#### Dashboard Not Loading

**Symptoms**: Grafana dashboard shows "No Data"

**Possible Causes**:
1. Prometheus not running
2. No alpha users active
3. Time range too narrow

**Solutions**:
1. Check Prometheus: `docker-compose ps`
2. Verify alpha users are active
3. Expand time range (try "Last 6 hours")

---

## 📚 Additional Resources

### Related Documentation

- [Analytics Design Document](../.planning/phases/03-user-onboarding/03-05-analytics.md)
- [Prometheus Metrics Guide](../metrics/PROMETHEUS_METRICS.md)
- [Grafana Dashboard Guide](../grafana/README.md)
- [Phase 3.5 Summary](../.planning/phases/03-user-onboarding/03-05-SUMMARY.md)

### External Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Nakama Analytics Best Practices](https://heroiclabs.com/docs/)

---

## 📞 Support

**Questions or Issues?**

- **Development Team**: Check `#alpha-analytics` in Discord
- **Documentation Issues**: Create GitHub issue with label `documentation`
- **Bug Reports**: Create GitHub issue with label `bug` and `analytics`

---

**Last Updated**: 2026-03-16  
**Version**: 2.1.0-alpha  
**Maintained By**: Development Team
