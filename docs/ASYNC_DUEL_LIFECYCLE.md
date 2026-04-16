# Async Duel Lifecycle

## Overview

Armored Archer implements an asynchronous turn-based PvP system where two players take turns submitting combat actions. The match is server-authoritative, ensuring fair gameplay and preventing cheating. Players can disconnect and reconnect without losing their match progress.

## Architecture

The async duel system consists of the following components:

- **Server (Nakama/TypeScript)**: RPC endpoints for match management, turn submission, and state retrieval
- **Client (Godot/GDScript)**: MatchmakerManager and NetworkManager for client-side logic
- **Storage**: Match data stored in Nakama storage with expiration timestamps

## Match States

A match can be in one of the following states:

| State | Description | Duration |
|-------|-------------|----------|
| `pending` | Match created, waiting for opponent to accept | 24 hours |
| `active` | Both players joined, turns can be submitted | 7 days of inactivity |
| `completed` | Match finished with a winner | Permanent |
| `expired` | Match abandoned due to timeout | Permanent |

## Lifecycle States Diagram

```
┌─────────────┐
│  pending    │ ──[opponent accepts]──> active
└─────────────┘
      │
      └──[24h timeout]──> expired

┌─────────────┐
│   active    │
└─────────────┘
      │
      ├─[both submit turns]──> calculate results
      │                              │
      │                              ├─[HP <= 0]──> completed
      │                              ├─[max turns]──> completed (draw or score compare)
      │                              └─[continue]──> back to active
      │
      ├─[7d inactivity]──> expired
      ├─[player forfeits]──> completed
      └─[turn timeout]──> auto-forfeit → completed
```

## Match Data Structure

Matches are stored in Nakama storage with the following structure:

```typescript
interface PvPMatch {
  // Identification
  match_id: string;           // Unique match identifier
  creator_id: string;         // User ID of the match creator
  opponent_id: string;        // User ID of the opponent

  // Rankings
  creator_rank: number;       // Creator's rank at match creation
  opponent_rank: number;      // Opponent's rank at match acceptance

  // Match Settings
  match_type: 'ranked' | 'casual';
  is_punch_up: boolean;       // High risk/reward match

  // Status
  status: 'pending' | 'active' | 'completed' | 'expired';
  winner?: string;            // User ID of the winner (if completed)

  // Timestamps
  created_at: number;         // Match creation timestamp (ms)
  updated_at: number;         // Last update timestamp (ms)
  expires_at: number;         // Match expiration timestamp (ms)
  last_turn_timestamp: number; // Last turn action timestamp (ms)

  // Turn Data
  current_turn: number;       // Current turn number (1-based)
  current_player: string;     // User ID of player whose turn it is
  turn_time_limit_ms: number; // Time limit per turn in milliseconds
  creator_turn_data?: TurnData;  // Creator's turn data for current round
  opponent_turn_data?: TurnData; // Opponent's turn data for current round

  // Game State (server-calculated, read-only to client)
  creator_health: number;     // Creator's current HP
  opponent_health: number;    // Opponent's current HP
  max_turns: number;          // Maximum number of turns before forced end

  // Forfeit tracking
  creator_consecutive_timeouts: number;
  opponent_consecutive_timeouts: number;
}

interface TurnData {
  action_type: 'shoot';       // Action type (expandable)
  angle: number;              // Shot angle in radians (0-2π)
  power?: number;             // Shot power (0-1, optional, defaults to 1.0)
  // Future: Additional action types and parameters
}
```

## RPC Endpoints

### 1. Create Match

**Endpoint**: `armored_archer/create_match`

**Purpose**: Creates a new async PvP match waiting for an opponent.

**Request**:
```json
{
  "match_type": "ranked",          // "ranked" or "casual"
  "is_punch_up": false,            // Optional: enable high risk/reward
  "target_opponent_id": "user-uuid" // Optional: challenge specific player
}
```

**Response** (Success):
```json
{
  "success": true,
  "match": {
    "match_id": "match_1234567890_abc123",
    "creator_id": "user-uuid",
    "opponent_id": "",
    "status": "pending",
    "created_at": 1234567890000,
    "expires_at": 1256967890000
  }
}
```

**Validation Rules**:
- `match_type` must be "ranked" or "casual"
- If `target_opponent_id` is specified and not a punch-up, rank difference must be ≤ 3
- Player must have valid stats (level ≥ 1)

### 2. Accept Match

**Endpoint**: `armored_archer/accept_match`

**Purpose**: Joins a pending match and initializes turn-based combat.

**Request**:
```json
{
  "match_id": "match_1234567890_abc123"
}
```

**Response** (Success):
```json
{
  "success": true,
  "match": {
    "match_id": "match_1234567890_abc123",
    "creator_id": "user-uuid",
    "opponent_id": "opponent-uuid",
    "status": "active",
    "current_turn": 1,
    "current_player": "creator_id",  // Creator always goes first
    "turn_time_limit_ms": 86400000,   // 24 hours per turn
    "creator_health": 100,
    "opponent_health": 100,
    "max_turns": 10
  }
}
```

**Validation Rules**:
- Match must exist and be in "pending" status
- Player cannot accept their own match
- Player must have valid stats

**Side Effects**:
- Match status changes to "active"
- `expires_at` is updated to 7 days from now
- `current_turn` is set to 1
- `current_player` is set to creator (creator always goes first)
- Health is initialized to 100 for both players
- Turn time limit is set (default: 24 hours)

### 3. Submit Turn

**Endpoint**: `armored_archer/submit_turn`

**Purpose**: Submits a player's turn action for the current round.

**Request**:
```json
{
  "match_id": "match_1234567890_abc123",
  "action_type": "shoot",
  "angle": 1.57,
  "power": 0.9
}
```

**Response** (Success, waiting for opponent):
```json
{
  "success": true,
  "match": {
    "match_id": "match_1234567890_abc123",
    "status": "active",
    "current_turn": 1,
    "current_player": "opponent_id",  // Opponent's turn now
    "creator_turn_data": {
      "action_type": "shoot",
      "angle": 1.57,
      "power": 0.9
    },
    "opponent_turn_data": null,
    "updated_at": 1234567895000,
    "last_turn_timestamp": 1234567895000
  }
}
```

**Response** (Success, both turns submitted, results calculated):
```json
{
  "success": true,
  "match": {
    "match_id": "match_1234567890_abc123",
    "status": "active",
    "current_turn": 2,  // Advanced to next turn
    "current_player": "creator_id",
    "creator_turn_data": null,
    "opponent_turn_data": null,
    "creator_health": 85,   // Damage calculated
    "opponent_health": 92,
    "turn_result": {
      "creator_hit": true,
      "opponent_hit": true,
      "creator_damage": 8,
      "opponent_damage": 15
    },
    "updated_at": 1234567896000,
    "last_turn_timestamp": 1234567896000
  }
}
```

**Response** (Success, match completed):
```json
{
  "success": true,
  "match": {
    "match_id": "match_1234567890_abc123",
    "status": "completed",
    "winner": "creator_id",
    "creator_health": 0,
    "opponent_health": 45
  },
  "completion_data": {
    "winner_id": "creator_id",
    "loser_id": "opponent_id",
    "total_turns": 5,
    "duration_ms": 432000,
    "rewards": {
      "winner": { "xp": 100, "coins": 50, "rank_change": 20 },
      "loser": { "xp": 25, "coins": 10, "rank_change": -20 }
    }
  }
}
```

**Validation Rules**:
- Match must exist and be in "active" status
- Player must be a participant in the match
- It must be the player's turn (`current_player` must equal user's ID)
- Turn must be submitted before timeout (`now < last_turn_timestamp + turn_time_limit_ms`)
- Action type must be valid
- Angle must be between 0 and 2π (6.28318530718)
- Power must be between 0 and 1 (if provided)

**Server-Side Logic**:
1. Validate turn submission
2. Store turn data in appropriate field (`creator_turn_data` or `opponent_turn_data`)
3. Check if both players have submitted turns
4. If both turns submitted:
   - Calculate combat results using combat_system.ts
   - Update health values
   - Check for winner (HP ≤ 0 or max turns reached)
   - If winner found, call `complete_match` RPC
   - Otherwise, advance to next turn
5. Update `last_turn_timestamp`
6. Send match state to both players (via notifications)

### 4. Get Match State

**Endpoint**: `armored_archer/get_match_state`

**Purpose**: Retrieves the current state of an active match.

**Request**:
```json
{
  "match_id": "match_1234567890_abc123"
}
```

**Response** (Success):
```json
{
  "success": true,
  "match": {
    "match_id": "match_1234567890_abc123",
    "creator_id": "user-uuid",
    "opponent_id": "opponent-uuid",
    "status": "active",
    "current_turn": 3,
    "current_player": "opponent_id",
    "creator_health": 70,
    "opponent_health": 85,
    "turn_time_limit_ms": 86400000,
    "last_turn_timestamp": 1234567890000,
    "time_remaining_ms": 82800000,
    "creator_turn_data": null,
    "opponent_turn_data": null,
    "max_turns": 10,
    "created_at": 1234567800000,
    "updated_at": 1234567890000,
    "expires_at": 1256967890000
  },
  "is_my_turn": false,
  "my_health": 85,
  "opponent_health": 70,
  "time_until_timeout": 82800000
}
```

**Validation Rules**:
- Match must exist
- Player must be a participant in the match

**Use Cases**:
- Initial match state load after accepting a match
- Reconnecting after a disconnect
- Periodic polling for match updates (backup to notifications)
- Refreshing UI after background/foreground app state changes

### 5. Complete Match

**Endpoint**: `armored_archer/complete_match`

**Purpose**: Manually completes a match (called automatically when HP reaches 0 or max turns reached).

**Request**:
```json
{
  "match_id": "match_1234567890_abc123",
  "winner_id": "user-uuid",
  "loser_id": "opponent-uuid",
  "is_punch_up": false
}
```

**Response** (Success):
```json
{
  "success": true,
  "match": {
    "match_id": "match_1234567890_abc123",
    "status": "completed",
    "winner": "user-uuid"
  },
  "winner": {
    "user_id": "user-uuid",
    "old_rank": 1200,
    "new_rank": 1220,
    "rank_change": 20,
    "xp_gained": 150,
    "old_season_position": 42,
    "new_season_position": 40,
    "rewards": [
      { "name": "XP", "quantity": 150, "type": "xp" },
      { "name": "Coins", "quantity": 50, "type": "coin" }
    ]
  },
  "loser": {
    "user_id": "opponent-uuid",
    "old_rank": 1200,
    "new_rank": 1180,
    "rank_change": -20,
    "xp_gained": 50,
    "old_season_position": 43,
    "new_season_position": 44,
    "rewards": [
      { "name": "XP", "quantity": 50, "type": "xp" },
      { "name": "Coins", "quantity": 10, "type": "coin" }
    ]
  }
}
```

### 6. Forfeit Match

**Endpoint**: `armored_archer/forfeit_match`

**Purpose**: Player voluntarily forfeits the match.

**Request**:
```json
{
  "match_id": "match_1234567890_abc123"
}
```

**Response** (Success):
```json
{
  "success": true,
  "match": {
    "match_id": "match_1234567890_abc123",
    "status": "completed",
    "winner": "opponent-uuid",  // Opponent wins by forfeit
    "forfeited_by": "user-uuid"
  },
  "completion_data": {
    "winner_id": "opponent-uuid",
    "loser_id": "user-uuid",
    "reason": "forfeit",
    "rewards": { /* ... */ }
  }
}
```

**Validation Rules**:
- Match must exist and be in "active" status
- Player must be a participant in the match
- Player cannot forfeit if both turns for current round are already submitted

## Turn Timeout Handling

### Timeout Configuration

```typescript
const TURN_TIMEOUT_MS = 24 * 60 * 60 * 1000;  // 24 hours per turn
const MAX_CONSECUTIVE_TIMEOUTS = 2;          // Auto-forfeit after 2 timeouts
```

### Timeout Flow

1. **First Timeout**:
   - Player fails to submit turn within `turn_time_limit_ms`
   - Server detects timeout on next `submit_turn` or `get_match_state` call
   - Player's consecutive timeout counter increments
   - A "random" default turn is generated (e.g., straight shot, full power)
   - Match continues normally
   - Both players receive a timeout notification

2. **Second Consecutive Timeout**:
   - Player times out again consecutively
   - Player's consecutive timeout counter reaches `MAX_CONSECUTIVE_TIMEOUTS`
   - Match is auto-forfeited
   - Opponent wins by default
   - Forfeiting player receives reduced XP/coins (25% of normal loss reward)

3. **Timeout Reset**:
   - Consecutive timeout counter resets to 0 when player successfully submits a turn

### Timeout Detection

Timeouts are detected lazily - when either player makes a request (`submit_turn` or `get_match_state`), the server checks if the other player's turn has timed out:

```typescript
function checkTurnTimeout(match: PvPMatch, now: number): {
  hasTimedOut: boolean;
  shouldForfeit: boolean;
} {
  const timeSinceLastTurn = now - match.last_turn_timestamp;
  const hasTimedOut = timeSinceLastTurn > match.turn_time_limit_ms;

  if (!hasTimedOut) {
    return { hasTimedOut: false, shouldForfeit: false };
  }

  const playerWhoTimedOut = match.current_player;
  const consecutiveTimeouts = playerWhoTimedOut === match.creator_id
    ? match.creator_consecutive_timeouts
    : match.opponent_consecutive_timeouts;

  const shouldForfeit = consecutiveTimeouts + 1 >= MAX_CONSECUTIVE_TIMEOUTS;

  return { hasTimedOut, shouldForfeit };
}
```

## Reconnect Flow

### When to Reconnect

A client should attempt to reconnect to a match in these scenarios:

1. Network connection lost and restored
2. App backgrounded and foregrounded
3. App crashed and restarted (while match is active)
4. Device lost and regained internet connectivity

### Reconnect Procedure

1. **Check Network Connection**:
   ```gdscript
   if not NetworkManager.is_connected:
       await NetworkManager.session_created
   ```

2. **Get Current Match State**:
   ```gdscript
   var match_id = MatchmakerManager.get_current_match().get("match_id", "")
   var response = await MatchmakerManager.get_match_state(match_id)
   ```

3. **Handle Response**:
   - If match is `active`: Update UI with current state
   - If match is `completed`: Show match results screen
   - If match is `expired`: Show match expired message
   - If error: Player was removed, return to main menu

4. **Sync Local State**:
   - Update local variables with server state
   - Display current turn information
   - Show health values
   - Enable/disable submit button based on `is_my_turn`

### Reconnect Edge Cases

| Scenario | Handling |
|----------|----------|
| Match completed while offline | Show results screen with winner/rewards |
| Match expired while offline | Show "match expired" message, return to menu |
| Opponent submitted turn while offline | Show opponent's turn result, allow new turn |
| Both turns submitted while offline | Show round results, update to next turn |
| Player timed out while offline | Show timeout notification, continue if first, forfeit if second |

## Client-Side Implementation

### MatchmakerManager Extensions

```gdscript
# --- Turn Submission ---
func submit_turn(action_type: String, angle: float, power: float = 1.0) -> void:
    """Submits a turn action for the current match."""
    if not is_in_match():
        push_error("Not in an active match")
        return

    var match_id = current_match.get("match_id", "")
    var payload = {
        "match_id": match_id,
        "action_type": action_type,
        "angle": angle,
        "power": power
    }

    var json = JSON.new()
    var response = await network_manager.send_rpc(
        RPC_SUBMIT_TURN,
        json.stringify(payload)
    )

    if response.has("error"):
        push_error("Failed to submit turn: %s" % response.error)
        return

    if response.get("success", false):
        current_match = response.get("match", {})
        turn_submitted.emit(current_match)

        # Check if match completed
        if current_match.get("status") == "completed":
            _handle_match_completion(response)

# --- Match State ---
func get_match_state(match_id: String) -> Dictionary:
    """Retrieves the current state of a match."""
    var payload = { "match_id": match_id }
    var json = JSON.new()
    return await network_manager.send_rpc(
        RPC_GET_MATCH_STATE,
        json.stringify(payload)
    )

# --- Reconnect ---
async func reconnect_to_match() -> void:
    """Attempts to reconnect to the current match."""
    if current_match.is_empty():
        push_warning("No match to reconnect to")
        return

    # Wait for network connection
    if not network_manager.is_connected:
        await network_manager.session_created

    var match_id = current_match.get("match_id", "")
    var response = await get_match_state(match_id)

    if response.has("error"):
        push_error("Failed to reconnect: %s" % response.error)
        # Clear current match and return to menu
        current_match = {}
        match_reconnect_failed.emit(response.error)
        return

    if response.get("success", false):
        current_match = response.get("match", {})
        match_reconnected.emit(current_match)

        # Handle different match states
        match current_match.get("status"):
            "active":
                # Update UI with match state
                pass
            "completed":
                # Show results
                _handle_match_completion(response)
            "expired":
                # Show expired message
                match_expired.emit(current_match)

# --- Forfeit ---
func forfeit_match() -> void:
    """Forfeits the current match."""
    if not is_in_match():
        push_error("Not in an active match")
        return

    var match_id = current_match.get("match_id", "")
    var payload = { "match_id": match_id }

    var json = JSON.new()
    var response = await network_manager.send_rpc(
        RPC_FORFEIT_MATCH,
        json.stringify(payload)
    )

    if response.has("error"):
        push_error("Failed to forfeit: %s" % response.error)
        return

    if response.get("success", false):
        current_match = response.get("match", {})
        match_forfeited.emit(current_match)

# --- Timeout Monitoring ---
func _check_turn_timeout() -> void:
    """Checks if the current turn has timed out."""
    if not is_in_match():
        return

    var last_turn = current_match.get("last_turn_timestamp", 0)
    var time_limit = current_match.get("turn_time_limit_ms", 86400000)
    var elapsed = Time.get_ticks_msec() - last_turn
    var remaining = time_limit - elapsed

    if remaining <= 0:
        turn_timeout.emit(current_match)
```

### UI Flow Example

```gdscript
extends Control

@onready var matchmaker = $/root/MatchmakerManager

func _ready():
    # Connect signals
    matchmaker.turn_submitted.connect(_on_turn_submitted)
    matchmaker.match_reconnected.connect(_on_match_reconnected)
    matchmaker.turn_timeout.connect(_on_turn_timeout)
    matchmaker.match_expired.connect(_on_match_expired)

    # Check if we have an active match
    if matchmaker.is_in_match():
        await reconnect_to_match()
    else:
        # Show no active match UI
        _show_no_match_ui()

    # Start timeout polling
    _start_timeout_polling()

func reconnect_to_match() -> void:
    show_loading("Reconnecting to match...")
    await matchmaker.reconnect_to_match()
    hide_loading()
    _update_match_ui()

func submit_turn():
    var angle = get_shot_angle()
    var power = get_shot_power()
    submit_button.disabled = true
    await matchmaker.submit_turn("shoot", angle, power)
    submit_button.disabled = false
    _update_match_ui()

func _on_turn_submitted(match_data: Dictionary):
    _update_match_ui()
    if match_data.get("status") == "completed":
        show_results(match_data)

func _on_match_reconnected(match_data: Dictionary):
    _update_match_ui()

func _on_turn_timeout(match_data: Dictionary):
    show_warning("Your turn timed out! Reconnect to continue.")

func _on_match_expired(match_data: Dictionary):
    show_error("Match has expired.")
    return_to_main_menu()

func _update_match_ui():
    var match_data = matchmaker.get_current_match()
    my_health_bar.value = match_data.get("my_health", 100)
    opponent_health_bar.value = match_data.get("opponent_health", 100)
    turn_label.text = "Turn %d" % match_data.get("current_turn", 1)

    var is_my_turn = match_data.get("is_my_turn", false)
    submit_button.disabled = not is_my_turn
    turn_indicator.text = "Your Turn" if is_my_turn else "Opponent's Turn"

func _start_timeout_polling():
    while matchmaker.is_in_match():
        matchmaker._check_turn_timeout()
        await get_tree().create_timer(1.0).timeout
```

## Server-Side Implementation Details

### Turn Calculation

When both players submit turns, the server calculates combat results:

```typescript
function calculateTurnResults(
  creatorTurn: TurnData,
  opponentTurn: TurnData,
  creatorStats: PlayerStats,
  opponentStats: PlayerStats
): TurnResult {
  // Use the combat_system to calculate damage
  const creatorDamage = calculateDamage(
    creatorTurn,
    opponentStats,
    creatorStats
  );

  const opponentDamage = calculateDamage(
    opponentTurn,
    creatorStats,
    opponentStats
  );

  // Determine if shots hit based on angle/distance calculations
  const creatorHit = calculateHit(creatorTurn, opponentTurn, creatorStats);
  const opponentHit = calculateHit(opponentTurn, creatorTurn, opponentStats);

  return {
    creator_hit: creatorHit,
    opponent_hit: opponentHit,
    creator_damage: creatorHit ? creatorDamage : 0,
    opponent_damage: opponentHit ? opponentDamage : 0,
  };
}
```

### Match Completion Triggers

A match is completed when any of these conditions are met:

1. **Player HP reaches 0**:
   ```typescript
   if (match.creator_health <= 0) {
     winner = match.opponent_id;
   } else if (match.opponent_health <= 0) {
     winner = match.creator_id;
   }
   ```

2. **Maximum turns reached**:
   ```typescript
   if (match.current_turn > match.max_turns) {
     // Compare remaining HP
     if (match.creator_health > match.opponent_health) {
       winner = match.creator_id;
     } else if (match.opponent_health > match.creator_health) {
       winner = match.opponent_id;
     } else {
       // Draw - both get reduced rewards
     }
   }
   ```

3. **Forfeit**:
   - Player voluntarily forfeits
   - Player times out consecutively (max limit reached)

4. **Expiration**:
   - 7 days of inactivity on an active match

### Notifications

The server sends notifications to both players on key events:

- **Match Started**: When opponent accepts the match
- **Turn Submitted**: When opponent submits their turn
- **Turn Result**: When both turns are processed
- **Match Completed**: When match ends
- **Timeout Warning**: When player is close to timeout (12h remaining)
- **Timeout Occurred**: When player's turn times out

Notifications use Nakama's notification system:

```typescript
nk.notificationsSend(userId, [{
  code: 1,  // Match event
  subject: "Your turn in match " + match.match_id,
  content: JSON.stringify({
    match_id: match.match_id,
    event: "your_turn",
    time_remaining_ms: match.turn_time_limit_ms
  }),
  sender_id: SYSTEM_USER_ID,
  persistent: true
}]);
```

## Testing

### Unit Tests

Test each RPC endpoint with various scenarios:

- Valid submissions
- Invalid inputs (wrong match ID, not player's turn, timeout)
- Edge cases (max turns, HP at 0)
- Timeout detection and handling

### Integration Tests

Test the full lifecycle:

1. Create match
2. Accept match
3. Submit turns for multiple rounds
4. Test timeout scenarios
5. Test reconnect flow
6. Complete match and verify rewards

### Manual Testing

1. **Normal Flow**:
   - Player A creates match
   - Player B accepts
   - Both submit turns
   - Verify results and HP updates
   - Continue until match ends

2. **Timeout Flow**:
   - Player A submits turn
   - Player B waits >24 hours
   - Player A submits another turn
   - Verify timeout detection
   - Verify default turn generated

3. **Reconnect Flow**:
   - Start a match
   - Player B disconnects (network off)
   - Player A submits turn
   - Player B reconnects
   - Verify state is synced

## Security Considerations

1. **Server-Authoritative**: All combat calculations happen server-side
2. **Turn Validation**: Server validates all turn submissions
3. **Anti-Cheat**: Turn submissions are logged for suspicious pattern detection
4. **Rate Limiting**: Prevent rapid turn submission spam
5. **Timestamp Validation**: Reject turns submitted after timeout
6. **Match State Verification**: Server is the source of truth for all match state

## Performance Considerations

1. **Storage Efficiency**: Only store current turn data, not full history
2. **Lazy Timeout Detection**: Check timeouts on player actions, not cron
3. **Notification Batching**: Batch notifications to reduce API calls
4. **Match Cleanup**: Archive completed matches after a period (30 days)
5. **Indexing**: Ensure `match_id` and `user_id` fields are indexed

## Future Enhancements

- **More Action Types**: Charge shots, special abilities, items
- **Spectator Mode**: Allow others to watch live matches
- **Match Replays**: Save and replay matches
- **Tournament Mode**: Bracket-style async tournaments
- **Team PvP**: 2v2 or larger team matches
- **Custom Time Limits**: Allow players to agree on custom turn times
- **Draft System**: Draft gear/abilities before match starts
- **Seasonal Events**: Special match types during events
