# Async Duel Lifecycle Documentation

## Overview

This document describes the complete lifecycle of an asynchronous PvP match in Armored Archer. Async duels allow players to take turns at their own pace with configurable time limits, making PvP more accessible to mobile players.

## Lifecycle States

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│   Created   │ -> │    Pending   │ -> │   Active    │ -> │  Complete   │ -> │  Archived   │
└─────────────┘    └──────────────┘    └─────────────┘    └──────────────┘    └─────────────┘
       │                  │                  │                  │                  │
       │                  │                  │                  │                  │
       ▼                  ▼                  ▼                  ▼                  ▼
   Creation         Match Finding       Turn-based        Match            Data
   Flow            & Acceptance        Gameplay          Resolution       Cleanup
```

## State Definitions

### 1. Created

- **Trigger**: Player calls `create_match` RPC
- **Duration**: Immediate (transient state)
- **Characteristics**:
  - Match entry created in `pvp_matches` collection
  - Status: `pending`
  - No opponent assigned yet
- **Valid Transitions**: Pending

### 2. Pending

- **Trigger**: Opponent calls `accept_match` RPC
- **Duration**: Until first turn submission
- **Characteristics**:
  - Both players assigned
  - Status: `active`
  - `current_player` set to match creator
  - `current_turn` initialized to 1
- **Valid Transitions**: Active, Expired (timeout)

### 3. Active

- **Trigger**: Both players accepted
- **Duration**: Until match completion or timeout
- **Characteristics**:
  - Turn-based gameplay in progress
  - Players alternate turns
  - Status: `active`
  - Health tracking for both players
- **Valid Transitions**: Complete, Expired, Forfeited

### 4. Complete

- **Trigger**: Health reaches 0 for one player or max turns reached
- **Duration**: Until rewards processed
- **Characteristics**:
  - Status: `completed`
  - Winner/loser determined
  - Rewards calculated
  - Rankings updated
- **Valid Transitions**: Archived

### 5. Archived

- **Trigger**: Match completion + cleanup (typically 7 days after completion)
- **Duration**: Permanent
- **Characteristics**:
  - Match stored in history
  - No longer modifiable
  - Available for match history queries

## Turn Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Active Turn Sequence                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Player A's Turn                 Player B's Turn                         │
│  ┌───────────────┐             ┌───────────────┐                   │
│  │  Check Turn   │             │  Check Turn   │                   │
│  │  Eligibility   │             │  Eligibility   │                   │
│  └───────┬───────┘             └───────┬───────┘                   │
│          │                             │                               │
│          ▼                             ▼                               │
│  ┌───────────────┐             ┌───────────────┐                   │
│  │ Submit Action  │             │ Submit Action  │                   │
│  │ (angle, power)│             │ (angle, power)│                   │
│  └───────┬───────┘             └───────┬───────┘                   │
│          │                             │                               │
│          ▼                             ▼                               │
│  ┌───────────────┐             ┌───────────────┐                   │
│  │  Server       │             │  Server       │                   │
│  │  Validates    │             │  Validates    │                   │
│  └───────┬───────┘             └───────┬───────┘                   │
│          │                             │                               │
│          ▼                             ▼                               │
│  ┌───────────────┐             ┌───────────────┐                   │
│  │ Store Turn    │◄──────────►│ Store Turn    │                   │
│  │ Data          │             │ Data          │                   │
│  └───────┬───────┘             └───────┬───────┘                   │
│          │                             │                               │
│          ▼                             ▼                               │
│  ┌─────────────────────────────────────────────────────┐                   │
│  │  Both Turns Received?                            │                   │
│  │  Yes: Process Turn Result & Damage            │                   │
│  │  No: Wait for Opponent                      │                   │
│  └──────────────────────┬──────────────────────────┘                   │
│                         │                                              │
│                         ▼                                              │
│              ┌────────────────┐                                       │
│              │ Update Health  │                                       │
│              │ & Match State │                                       │
│              └──────┬───────┘                                       │
│                     │                                               │
│                     ▼                                               │
│              ┌────────────────┐                                       │
│              │ Match Ended?  │──No──► Next Turn                       │
│              └──────┬───────┘                                       │
│                     │Yes                                            │
│                     ▼                                               │
│              ┌────────────────┐                                       │
│              │ Complete Match│                                       │
│              └────────────────┘                                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

## RPC Endpoints

### Match Creation

#### `armored_archer/create_match`

Creates a new PvP match.

**Parameters:**

```typescript
{
  match_type: "ranked" | "casual",
  is_punch_up?: boolean,
  target_opponent_id?: string
}
```

**Response (Success):**

```json
{
  "success": true,
  "match": {
    "match_id": "match_123",
    "creator_id": "user_1",
    "creator_rank": 15,
    "match_type": "ranked",
    "is_punch_up": false,
    "status": "pending",
    "created_at": 1713321600000
  }
}
```

**Anti-Abuse Checks:**

- Rate limiting: 5 requests/minute
- Cooldown: 5 seconds between matches
- Concurrent match limit: 3 active matches maximum

### Match Acceptance

#### `armored_archer/accept_match`

Accepts a pending match.

**Parameters:**

```typescript
{
  match_id: string;
}
```

**Response (Success):**

```json
{
  "success": true,
  "match": {
    "match_id": "match_123",
    "creator_id": "user_1",
    "opponent_id": "user_2",
    "creator_rank": 15,
    "opponent_rank": 12,
    "match_type": "ranked",
    "status": "active",
    "current_player": "user_1",
    "current_turn": 1,
    "turn_time_limit_ms": 300000
  }
}
```

**Anti-Abuse Checks:**

- Rate limiting: 10 requests/minute
- Cooldown: 10 seconds between accepts
- Verify user is a participant

### Turn Submission

#### `armored_archer/submit_turn`

Submits a turn action for the current match.

**Parameters:**

```typescript
{
  match_id: string,
  action_type: "shoot",
  angle: number,
  power?: number
}
```

**Response (Success - Turn Pending):**

```json
{
  "success": true,
  "match": {
    /* updated match state */
  },
  "turn_submitted": true
}
```

**Response (Success - Both Turns Received):**

```json
{
  "success": true,
  "match": {
    /* updated match state */
  },
  "turn_result": {
    "creator_damage": 15,
    "opponent_damage": 22,
    "creator_health": 85,
    "opponent_health": 78,
    "turn_number": 1
  },
  "turn_completed": true
}
```

**Anti-Abuse Checks:**

- Rate limiting: 10 requests/minute
- Verify it's the player's turn
- Duplicate turn submission prevention
- Turn timeout validation

### Match State Query

#### `armored_archer/get_async_match_state`

Retrieves the current state of an async match.

**Parameters:**

```typescript
{
  match_id: string;
}
```

**Response:**

```json
{
  "success": true,
  "match": {
    "match_id": "match_123",
    "status": "active",
    "current_player": "user_1",
    "current_turn": 3,
    "creator_health": 70,
    "opponent_health": 55,
    "last_turn_timestamp": 1713323400000,
    "turn_time_limit_ms": 300000,
    "time_remaining_ms": 180000
  },
  "is_my_turn": true,
  "my_health": 70,
  "opponent_health": 55,
  "time_remaining_ms": 180000
}
```

### Match Completion

#### `armored_archer/complete_match`

Completes a match (usually called after health reaches 0).

**Parameters:**

```typescript
{
  match_id: string,
  winner_id: string,
  loser_id: string,
  is_punch_up?: boolean
}
```

**Response:**

```json
{
  "success": true,
  "match": {
    "match_id": "match_123",
    "status": "completed",
    "winner": "user_1",
    "loser": "user_2"
  },
  "rewards": [
    {
      "user_id": "user_1",
      "xp_gain": 150,
      "rank_change": 25,
      "gem_bonus": 5
    },
    {
      "user_id": "user_2",
      "xp_gain": 50,
      "rank_change": -15,
      "gem_bonus": 0
    }
  ]
}
```

**Anti-Abuse Checks:**

- Rate limiting: 3 requests/minute
- Cooldown: 30 seconds between completions
- Win trading pattern detection
- Verify participants

### Match Forfeit

#### `armored_archer/forfeit_match`

Forfeits the current match.

**Parameters:**

```typescript
{
  match_id: string;
}
```

**Response:**

```json
{
  "success": true,
  "match": {
    "match_id": "match_123",
    "status": "completed",
    "winner": "user_2",
    "loser": "user_1",
    "forfeited": true
  }
}
```

### Match History

#### `armored_archer/get_match_history`

Retrieves a player's match history.

**Parameters:**

```typescript
{
  limit?: number,
  match_type?: "ranked" | "casual",
  result?: "win" | "loss",
  is_punch_up?: boolean,
  offset?: number
}
```

**Response:**

```json
{
  "success": true,
  "matches": [
    {
      "match_id": "match_123",
      "match_type": "ranked",
      "is_punch_up": false,
      "result": "win",
      "opponent_id": "user_2",
      "opponent_rank": 12,
      "timestamp": 1713321600000
    }
  ],
  "total": 25,
  "stats": {
    "total_matches": 25,
    "wins": 18,
    "losses": 7,
    "win_rate": 0.72,
    "punch_up_wins": 5,
    "punch_up_losses": 2
  }
}
```

### Debug/Dispute Info (QA Only)

#### `armored_archer/get_match_debug_info`

Retrieves comprehensive match information for debugging and dispute resolution.

**Parameters:**

```typescript
{
  match_id: string;
}
```

**Response:**

```json
{
  "success": true,
  "match": { /* full match object */ },
  "turn_history": [
    {
      "turn_number": 1,
      "creator_action": { "action_type": "shoot", "angle": 1.5, "power": 0.9 },
      "opponent_action": { "action_type": "shoot", "angle": 1.8, "power": 1.0 },
      "damage": { "creator": 15, "opponent": 22 },
      "health_after": { "creator": 85, "opponent": 78 }
    }
  ],
  "server_timestamps": {
    "created_at": 1713321600000,
    "accepted_at": 1713321650000,
    "completed_at": 1713322500000,
    "turn_submissions": [...]
  },
  "anti_abuse_flags": {
    "win_trading_detected": false,
    "timeout_count": { "creator": 1, "opponent": 0 },
    "consecutive_timeouts": { "creator": 0, "opponent": 0 }
  }
}
```

## Timeout Handling

### Turn Timeout

When a player fails to submit a turn within the time limit:

1. **First Timeout (per player)**
   - Default turn generated (straight shot, full power)
   - Warning sent to player
   - Consecutive timeout counter incremented

2. **Consecutive Timeout Forfeit**
   - After 2 consecutive timeouts
   - Match automatically forfeited
   - Opponent declared winner
   - Loss rewards applied to timed-out player

**Constants:**

- `TURN_TIME_LIMIT_MS`: 5 minutes (300,000ms)
- `MAX_CONSECUTIVE_TIMEOUTS`: 2

## Reconnect Flow

When a player reconnects to an active match:

1. Client calls `get_async_match_state` with match_id
2. Server returns:
   - Current match state
   - Current turn number
   - Player health values
   - Time remaining in current turn
   - Whether it's the player's turn
3. Client synchronizes UI and resumes gameplay

**Reconnect Scenarios:**

- **Network drop during own turn**: Player can still submit before timeout
- **Network drop during opponent's turn**: Player waits, gets update when opponent submits
- **Extended offline**: Match may timeout if player doesn't return in time

## Anti-Abuse Measures

### 1. Rate Limiting

Per-RPC request limits to prevent spam:

- `create_match`: 5/minute
- `accept_match`: 10/minute
- `submit_turn`: 10/minute
- `complete_match`: 3/minute

### 2. Cooldowns

Minimum time between actions:

- Create match: 5 seconds
- Accept match: 10 seconds
- Complete match: 30 seconds

### 3. Duplicate Turn Detection

- Tracks last turn number submitted per player per match
- Blocks duplicate submissions for same turn
- Cleared on match completion

### 4. Win Trading Detection

- Analyzes match history for patterns:
  - Alternating win/loss against same opponent
  - Rapid repeated matches (< 2 minutes apart)
- Flags suspicious patterns for review

### 5. Concurrent Match Limit

- Maximum 3 active matches per player
- Prevents match farming and queue manipulation

## Reward Calculation

### Casual vs Ranked

**Casual Matches:**

- Base XP: 50-75 (regardless of outcome)
- No ranking changes
- No gem bonuses
- Focus on practice and fun

**Ranked Matches:**

- Win XP: 100-150 + punch-up bonus
- Loss XP: 25-50
- Ranking changes: ±10-30 (Elo-based)
- Punch-up gem bonuses: 3-10 gems
- Leaderboard eligibility

### Punch-Up Multipliers

Punch-up matches (lower-ranked vs higher-ranked):

| Rank Difference | XP Multiplier | Gem Bonus |
| --------------- | ------------- | --------- |
| 5-7 (Low)       | 1.2x          | 3-4 gems  |
| 8-11 (Medium)   | 1.5x          | 5-7 gems  |
| 12-15 (High)    | 2.0x          | 8-10 gems |

**Requirements:**

- Minimum rank: 20
- Maximum rank difference: 15

**Favorite Penalties:**
If higher-ranked player (favorite) loses:

- XP reduced to 50-70% of normal
- No gem bonus
- Larger rank penalty (-15 to -25)

## Data Schema

### PvPMatch (Storage)

```typescript
interface PvPMatch {
  // Identification
  match_id: string;
  creator_id: string;
  opponent_id: string;

  // Match Settings
  match_type: 'ranked' | 'casual';
  is_punch_up: boolean;

  // Status & Progress
  status: 'pending' | 'active' | 'completed';
  current_turn: number;
  current_player: string;

  // Health
  creator_health: number;
  opponent_health: number;
  max_health: number;

  // Turn Data
  creator_turn_data?: TurnData;
  opponent_turn_data?: TurnData;

  // Timing
  created_at: number;
  updated_at: number;
  last_turn_timestamp: number;
  turn_time_limit_ms: number;

  // Timeout Tracking
  creator_consecutive_timeouts: number;
  opponent_consecutive_timeouts: number;

  // Ranking
  creator_rank: number;
  opponent_rank: number;

  // Result (when completed)
  winner?: string;
  loser?: string;
  forfeited?: boolean;

  // Punch-Up Details
  underdog_id?: string;
  underdog_rank?: number;
  favorite_rank?: number;
  reward_multiplier?: number;
  punch_up_description?: string;
}

interface TurnData {
  action_type: string;
  angle: number;
  power: number;
}
```

## Client Integration

### MatchmakerManager (GDScript)

The client-side `MatchmakerManager` autoload provides:

**Signals:**

```gdscript
signal matches_loaded(matches: Array, player_rank: int)
signal match_created(match: Dictionary)
signal match_accepted(match: Dictionary)
signal turn_submitted(match: Dictionary, turn_result: Dictionary)
signal match_state_loaded(match: Dictionary, is_my_turn: bool, ...)
signal match_completed(match_result: Dictionary)
signal match_forfeited(match: Dictionary)
signal match_reconnected(match: Dictionary)
```

**Key Methods:**

- `create_match(match_type, is_punch_up)`
- `accept_match(match_id)`
- `submit_turn(action_type, angle, power)`
- `get_async_match_state(match_id)`
- `complete_match(winner_id, loser_id, is_punch_up)`
- `forfeit_match(match_id)`

## Troubleshooting

### Common Issues

**Issue**: "It is not your turn"

- **Cause**: Opponent hasn't submitted their turn yet
- **Solution**: Wait for `match_state_updated` signal or poll state

**Issue**: "Duplicate turn submission"

- **Cause**: Already submitted turn for this round
- **Solution**: Don't resubmit; wait for opponent's turn

**Issue**: Match times out unexpectedly

- **Cause**: Network connectivity or client crash
- **Solution**: Reconnect and call `get_async_match_state`

**Issue**: Win trading flag

- **Cause**: Suspicious match patterns detected
- **Solution**: Legitimate play won't trigger false positives; review patterns

## Testing

### Unit Tests

- `matchmaker.test.ts`: 74 tests covering all RPCs and lifecycle
- `rate_limit.test.ts`: 34 tests covering anti-abuse measures

### Integration Tests

- Full match creation → acceptance → turn submission → completion flow
- Timeout scenarios and auto-forfeit
- Reconnect and state synchronization
- Punch-up reward calculations

### Manual QA Checklist

- [ ] Create and accept a ranked match
- [ ] Create and accept a casual match
- [ ] Submit multiple turns in a match
- [ ] Verify turn timeout generates default action
- [ ] Verify consecutive timeout triggers forfeit
- [ ] Create a punch-up match and verify rewards
- [ ] Reconnect to an active match
- [ ] Verify match history displays correctly
- [ ] Verify anti-abuse blocks invalid actions

## References

- **Backend**: `backend/src/modules/matchmaker.ts`
- **Rate Limiting**: `backend/src/modules/rate_limit.ts`
- **Anti-Abuse Guide**: `backend/src/modules/ANTI_ABUSE_GUIDE.md`
- **Client**: `autoloads/MatchmakerManager.gd`
- **UI**: `scenes/ui/punch_up_warning_dialog.gd`
