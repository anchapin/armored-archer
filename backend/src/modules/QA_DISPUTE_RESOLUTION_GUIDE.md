# QA and Dispute Resolution Guide

## Overview

This document describes the tools and endpoints available for QA testing and dispute resolution in async PvP matches.

## Debug/Dispute Endpoints

### 1. Match Details Endpoint

**RPC**: `armored_archer/get_match_details`

**Purpose**: Retrieves comprehensive match information including combat logs, player stats, and Elo changes.

**Registration**: `registerRpcGetMatchDetails()` in `src/index.ts` (line 90, 468)

**Request:**

```json
{
  "match_id": "match_abc123"
}
```

**Response:**

```json
{
  "success": true,
  "match": {
    "match_id": "match_abc123",
    "result_id": "result_xyz789",
    "creator_id": "user_1",
    "opponent_id": "user_2",
    "creator_username": "PlayerOne",
    "opponent_username": "PlayerTwo",
    "winner_id": "user_1",
    "loser_id": "user_2",
    "match_type": "ranked",
    "is_punch_up": false,
    "creator_rank": 15,
    "opponent_rank": 12,
    "creator_old_elo": 1450,
    "creator_new_elo": 1475,
    "opponent_old_elo": 1280,
    "opponent_new_elo": 1265,
    "total_turns": 8,
    "duration_seconds": 245,
    "end_reason": "health_depleted",
    "combat_log": [
      {
        "turn_number": 1,
        "creator_action": { "action_type": "shoot", "angle": 1.5, "power": 0.9 },
        "opponent_action": { "action_type": "shoot", "angle": 1.8, "power": 1.0 },
        "damage": { "creator": 15, "opponent": 22 },
        "health_after": { "creator": 85, "opponent": 78 }
      }
    ],
    "creator_health_remaining": 20,
    "opponent_health_remaining": 0,
    "creator_stats_at_match": {
      "level": 5,
      "xp": 500,
      "stats": {
        "attack": 20,
        "defense": 15,
        "dodge": 10,
        "crit_rate": 8
      }
    },
    "opponent_stats_at_match": {
      "level": 6,
      "xp": 620,
      "stats": {
        "attack": 22,
        "defense": 17,
        "dodge": 12,
        "crit_rate": 10
      }
    },
    "season_id": "season_2024_04",
    "created_at": "2024-04-17T09:00:00.000Z",
    "updated_at": "2024-04-17T09:04:05.000Z"
  }
}
```

**Use Cases:**

- Investigate specific match disputes
- Verify turn-by-turn gameplay
- Check player stats at match time
- Validate Elo calculations
- Review match completion reasons

### 2. Admin Query Matches Endpoint

**RPC**: `armored_archer/admin_query_matches`

**Purpose**: Advanced match search with filtering for debugging and bulk dispute review.

**Registration**: `registerRpcAdminQueryMatches()` in `src/index.ts` (line 91, 469)

**Request:**

```json
{
  "user_id": "player123", // Filter by creator or opponent (optional)
  "match_type": "ranked", // "ranked" or "casual" (optional)
  "end_reason": "forfeit", // Filter by end reason (optional)
  "season_id": "season_2024_04", // Filter by season (optional)
  "is_punch_up": true, // Filter punch-up matches (optional)
  "start_date": "2024-04-01", // ISO date string (optional)
  "end_date": "2024-04-30", // ISO date string (optional)
  "limit": 50, // Max 200 (optional, default 50)
  "offset": 0 // For pagination (optional, default 0)
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
      "creator_id": "user_1",
      "opponent_id": "user_2",
      "creator_username": "PlayerOne",
      "opponent_username": "PlayerTwo",
      "winner_id": "user_1",
      "loser_id": "user_2",
      "creator_rank": 15,
      "opponent_rank": 12,
      "total_turns": 8,
      "duration_seconds": 245,
      "end_reason": "health_depleted",
      "creator_health_remaining": 20,
      "opponent_health_remaining": 0,
      "season_id": "season_2024_04",
      "created_at": "2024-04-17T09:00:00.000Z",
      "updated_at": "2024-04-17T09:04:05.000Z"
    }
  ],
  "total": 25,
  "page": 1,
  "per_page": 50,
  "total_pages": 1
}
```

**Filter Options:**

- **user_id**: Search by either creator or opponent
- **match_type**: "ranked" or "casual"
- **end_reason**: "health_depleted", "forfeit", "timeout", "abandoned"
- **season_id**: Filter by specific season
- **is_punch_up**: true/false
- **start_date/end_date**: ISO date range
- **limit/offset**: Pagination (max limit: 200)

**Use Cases:**

- Bulk review of player matches
- Find matches with specific end reasons
- Season-based dispute analysis
- Punch-up match investigation
- Time-based match history review

### 3. Player Match History Endpoint

**RPC**: `armored_archer/get_match_history`

**Purpose**: Retrieve a player's match history with filtering options.

**Request:**

```json
{
  "limit": 20, // Max matches to return (optional)
  "match_type": "ranked", // "ranked" or "casual" (optional)
  "result": "win", // "win" or "loss" (optional)
  "is_punch_up": false, // Filter punch-up matches (optional)
  "offset": 0 // For pagination (optional)
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

## Match End Reasons

| End Reason          | Description                          | When Triggered                             |
| ------------------- | ------------------------------------ | ------------------------------------------ |
| `health_depleted`   | Player health reached 0              | Normal match completion                    |
| `forfeit`           | Player explicitly forfeited          | Player clicked forfeit                     |
| `timeout`           | Player timed out 2 consecutive turns | Auto-forfeit after timeout                 |
| `abandoned`         | Match abandoned without completion   | Creator abandoned before opponent accepted |
| `max_turns_reached` | Match reached maximum turn limit     | Forced end after 10 turns                  |

## Audit Trail

All admin and debug queries are logged with:

- **User ID**: Who made the request
- **Match ID**: Which match was accessed
- **Filters**: What filters were applied
- **Timestamp**: When the query was made

This provides a complete audit trail for dispute resolution.

## Dispute Resolution Workflow

### Step 1: Gather Context

1. Collect player report with match ID
2. Verify player is a participant in the match
3. Check report timestamp against match creation time

### Step 2: Retrieve Match Data

```bash
# Using get_match_details RPC
curl -X POST https://nakama.server/rpc \
  -H "Authorization: Bearer <admin-token>" \
  -d '{"match_id": "match_abc123"}'
```

### Step 3: Analyze Match Evidence

1. Review combat log for each turn
2. Verify damage calculations
3. Check player stats at match time
4. Validate Elo/rank changes
5. Check for timeout or forfeit patterns

### Step 4: Cross-Reference Player History

```bash
# Using admin_query_matches RPC
curl -X POST https://nakama.server/rpc \
  -H "Authorization: Bearer <admin-token>" \
  -d '{
    "user_id": "player123",
    "start_date": "2024-04-01",
    "end_date": "2024-04-30",
    "limit": 100
  }'
```

Look for:

- Repeated patterns (win trading)
- Abnormal match durations
- Frequent timeouts
- Suspicious punch-up patterns

### Step 5: Document Findings

Create dispute resolution record with:

- Match ID and participants
- Issue reported by player
- Evidence found in match data
- Cross-reference analysis
- Resolution decision
- Compensation applied (if any)

## QA Testing Checklist

### Match Creation Flow

- [ ] Verify match created successfully
- [ ] Check match status transitions from pending → active
- [ ] Verify both players can access match
- [ ] Test timeout handling

### Turn Submission Flow

- [ ] Verify turn validation (valid angles, power)
- [ ] Test duplicate turn submission blocking
- [ ] Verify turn order enforcement
- [ ] Check turn result calculation

### Match Completion Flow

- [ ] Verify health depletion ends match
- [ ] Check max turns forced end
- [ ] Verify reward calculations
- [ ] Test rank/Elo updates

### Anti-Abuse Tests

- [ ] Test rate limiting for each RPC
- [ ] Verify cooldown enforcement
- [ ] Test concurrent match limit
- [ ] Check win trading detection
- [ ] Verify timeout handling

### Punch-Up Tests

- [ ] Test punch-up eligibility (various rank diffs)
- [ ] Verify minimum rank requirement (20)
- [ ] Check maximum rank difference (15)
- [ ] Test underdog reward calculation
- [ ] Verify favorite penalty application

### Debug Endpoint Tests

- [ ] Test `get_match_details` with valid match ID
- [ ] Test `get_match_details` with invalid match ID
- [ ] Test `admin_query_matches` with various filters
- [ ] Verify pagination works correctly
- [ ] Check audit logging

## Common Dispute Scenarios

### Scenario 1: "I won but match says I lost"

**Investigation Steps:**

1. Retrieve match details
2. Review combat log for final turn
3. Verify health calculations
4. Check if player timed out (2 consecutive timeouts = auto-forfeit)

**Resolution:**

- If health calculation error: Adjust match result
- If timeout: Explain timeout rules
- If valid loss: Uphold result

### Scenario 2: "My opponent cheated"

**Investigation Steps:**

1. Review combat log for suspicious patterns
2. Check if actions are physically possible
3. Look for abnormal damage values
4. Verify turn submission timestamps

**Resolution:**

- If cheating detected: Flag player in anti-cheat system
- If no evidence: Explain that match was fair

### Scenario 3: "I lost more rank than expected"

**Investigation Steps:**

1. Check if it was a punch-up match
2. Verify favorite penalty was applied correctly
3. Review Elo calculation formula
4. Check for any rank decay applied

**Resolution:**

- If error in calculation: Adjust rank
- If correct calculation: Explain punch-up penalty

## Database Schema

### match_results Table

```sql
CREATE TABLE match_results (
  result_id VARCHAR(36) PRIMARY KEY,
  match_id VARCHAR(64) NOT NULL,
  creator_id VARCHAR(36) NOT NULL,
  opponent_id VARCHAR(36) NOT NULL,
  winner_id VARCHAR(36),
  loser_id VARCHAR(36),
  match_type VARCHAR(16) NOT NULL,
  is_punch_up BOOLEAN DEFAULT false,
  creator_rank INTEGER,
  opponent_rank INTEGER,
  creator_old_elo INTEGER,
  creator_new_elo INTEGER,
  opponent_old_elo INTEGER,
  opponent_new_elo INTEGER,
  total_turns INTEGER,
  duration_seconds INTEGER,
  end_reason VARCHAR(32),
  creator_health_remaining INTEGER,
  opponent_health_remaining INTEGER,
  combat_log JSONB,
  creator_stats_at_match JSONB,
  opponent_stats_at_match JSONB,
  season_id VARCHAR(32),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## References

- **Backend**: `backend/src/modules/matchmaker.ts` (lines 1991-2346)
- **Registration**: `src/index.ts` (lines 90-91, 468-469)
- **Audit Module**: `backend/src/modules/audit.ts`
- **Anti-Abuse Guide**: `backend/src/modules/ANTI_ABUSE_GUIDE.md`
