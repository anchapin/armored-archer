# PvP Matchmaker System

## Overview

This implementation provides an asynchronous PvP matchmaking system for Armored Archer using Nakama server-authoritative RPCs.

## Components

### Server-Side (TypeScript - Nakama)

**File:** `backend/src/modules/matchmaker.ts`

#### RPC Endpoints

**1. `armored_archer/list_matches`**
Lists available PvP matches filtered by rank and match type.

**Request:**
```json
{
  "match_type": "ranked",  // optional: "ranked" or "casual"
  "min_rank": 100,         // optional: minimum opponent rank
  "max_rank": 200,         // optional: maximum opponent rank
  "limit": 20              // optional: max results (default 20)
}
```

**Response:**
```json
{
  "success": true,
  "matches": [
    {
      "match_id": "match_1234567890_abc123",
      "creator_id": "user-uuid",
      "opponent_id": "",
      "creator_rank": 150,
      "opponent_rank": 0,
      "match_type": "ranked",
      "is_punch_up": false,
      "status": "pending",
      "created_at": 1234567890000,
      "updated_at": 1234567890000
    }
  ],
  "player_rank": 150,
  "total": 1
}
```

**2. `armored_archer/create_match`**
Creates a new PvP match for other players to join.

**Request:**
```json
{
  "match_type": "ranked",          // "ranked" or "casual"
  "is_punch_up": false,            // optional: enable high risk/reward
  "target_opponent_id": "user-uuid" // optional: challenge specific player
}
```

**Response:**
```json
{
  "success": true,
  "match": {
    "match_id": "match_1234567890_abc123",
    "creator_id": "user-uuid",
    "opponent_id": "",
    "creator_rank": 150,
    "opponent_rank": 0,
    "match_type": "ranked",
    "is_punch_up": false,
    "status": "pending",
    "created_at": 1234567890000,
    "updated_at": 1234567890000
  }
}
```

**3. `armored_archer/accept_match`**
Accepts a pending match and becomes the opponent.

**Request:**
```json
{
  "match_id": "match_1234567890_abc123"
}
```

**Response:**
```json
{
  "success": true,
  "match": {
    "match_id": "match_1234567890_abc123",
    "creator_id": "user-uuid",
    "opponent_id": "opponent-uuid",
    "creator_rank": 150,
    "opponent_rank": 145,
    "match_type": "ranked",
    "is_punch_up": false,
    "status": "active",
    "created_at": 1234567890000,
    "updated_at": 1234567890500
  }
}
```

**4. `armored_archer/get_player_rank`**
Retrieves the player's current PvP rank.

**Request:**
```json
{}
```

**Response:**
```json
{
  "success": true,
  "rank": 150,
  "level": 5,
  "xp": 475
}
```

#### Rank Calculation

```
Rank = (Level × 10) + (Stats Total ÷ 4)

Where Stats Total = Attack + Defense + Dodge + Crit Rate
```

Example:
- Level 5, Attack 20, Defense 15, Dodge 10, Crit Rate 10
- Rank = (5 × 10) + ((20 + 15 + 10 + 10) ÷ 4) = 50 + 13 = 63

### Client-Side (Godot GDScript)

**File:** `autoloads/MatchmakerManager.gd`

Singleton that manages all matchmaking operations:

**Key Methods:**
```gdscript
# List available matches
MatchmakerManager.list_matches("ranked", 0, 0, 20)

# Create a new match
MatchmakerManager.create_match("ranked", false)

# Accept a match
MatchmakerManager.accept_match("match_id")

# Get player rank
MatchmakerManager.get_player_rank()

# Check if in a match
if MatchmakerManager.is_in_match():
    print("Currently in a match")
```

**Signals:**
- `matches_loaded(matches: Array, player_rank: int)` - Emitted when match list is retrieved
- `match_created(match: Dictionary)` - Emitted when a new match is created
- `match_accepted(match: Dictionary)` - Emitted when a match is joined
- `rank_retrieved(rank: int)` - Emitted when player rank is retrieved

### Matchmaking UI

**File:** `scenes/ui/matchmaking_menu.tscn`

The matchmaking interface provides:

**Features:**
- Display current player rank
- Filter matches by type (Ranked/Casual/All)
- List available matches with opponent rank
- Create new matches (Ranked or Casual)
- Punch Up option for high risk/reward challenges
- Accept matches with one click
- Real-time refresh of match list

**UI Layout:**
1. **Top Panel:** Player rank display
2. **Filter Panel:** Match type filter and refresh button
3. **Match List:** Scrollable list of available matches
4. **Create Panel:** Buttons to create Ranked/Casual matches with Punch Up option
5. **Bottom Panel:** Back button to main menu

## Architecture

### Match Flow

1. **Player A creates a match:**
   - Client calls `MatchmakerManager.create_match("ranked")`
   - Server stores match in Nakama storage with status "pending"
   - Server returns match ID to player A

2. **Player B lists matches:**
   - Client calls `MatchmakerManager.list_matches()`
   - Server queries Nakama storage for pending matches
   - Server filters by rank and match type
   - Client displays matches in UI

3. **Player B accepts a match:**
   - Client calls `MatchmakerManager.accept_match(match_id)`
   - Server validates match is still pending
   - Server updates match status to "active" and adds player B as opponent
   - Server notifies both players (match is ready)

4. **Turn-based combat (future implementation):**
   - Each player submits turns via RPC
   - Server validates and calculates results
   - Server updates match state
   - Winner declared and ranks adjusted

### Match States

- **pending:** Match created, waiting for opponent
- **active:** Both players joined, combat in progress
- **completed:** Match finished, winner determined

### Match Types

**Ranked:**
- Affects player rank on win/loss
- Higher stakes and competition
- Matched based on similar ranks (±3 ranks)

**Casual:**
- No rank impact
- For practice and fun
- Wider rank matching range

### Punch Up System

High risk/reward challenge system:
- **Challenge higher rank:** More XP/Rank on win, harsher penalty on loss
- **Punch Up matches:** Highlighted in UI with red text
- **Can be toggled when creating matches**
- **Only available in Ranked mode**

## Database Storage

Matches stored in Nakama's storage system:
- Collection: `pvp_matches`
- Key: Match ID
- User ID: Match creator

Schema:
```sql
collection: text = "pvp_matches"
key: text = match_id
user_id: text = creator_id
value: jsonb {
  match_id: text,
  creator_id: text,
  opponent_id: text,
  creator_rank: integer,
  opponent_rank: integer,
  match_type: text,           -- "ranked" or "casual"
  is_punch_up: boolean,
  status: text,               -- "pending", "active", "completed"
  created_at: timestamp,
  updated_at: timestamp,
  creator_turn_data: jsonb,   -- future: turn submission
  opponent_turn_data: jsonb,  -- future: turn submission
  winner: text                 -- future: winner user_id
}
```

## Server-Authoritative Design

All matchmaking operations happen server-side to prevent cheating:
- Client cannot modify match data directly
- Rank calculations server-side
- Match validation server-side
- Storage is the single source of truth
- Client only displays server-validated data

## Usage Examples

### From Main Menu

```gdscript
# User clicks "PvP" button
get_tree().change_scene_to_file("res://scenes/ui/matchmaking_menu.tscn")
```

### Creating a Ranked Match

```gdscript
func _on_create_ranked_pressed():
    var is_punch_up = punch_up_check.button_pressed
    MatchmakerManager.create_match("ranked", is_punch_up)
```

### Listing Ranked Matches Only

```gdscript
func refresh_matches():
    MatchmakerManager.list_matches("ranked", 0, 0, 20)
```

### Handling Match Creation

```gdscript
func _ready():
    MatchmakerManager.match_created.connect(_on_match_created)

func _on_match_created(match: Dictionary):
    print("Match created: %s" % match.match_id)
    show_waiting_dialog()
```

## Integration with Existing Systems

### NetworkManager

Added `send_rpc()` method to communicate with Nakama:
```gdscript
var response = await NetworkManager.send_rpc("armored_archer/list_matches", payload)
```

### PlayerStatsManager

Rank calculation uses player stats from PlayerStatsManager:
```gdscript
var stats = await PlayerStatsManager.get_player_stats()
var rank = calculate_rank(stats.level, stats.stats)
```

## Testing

### Start Nakama Backend

```bash
cd backend
docker-compose up -d
```

### Test Matchmaking

1. Run game in Godot (F5)
2. Login (automatic device auth)
3. Click "PvP" button in main menu
4. Create a ranked match
5. In a second game instance, list matches and accept
6. Verify match becomes "active"

### Test Punch Up

1. Create a ranked match with Punch Up enabled
2. Verify match displays "Punch Up Challenge!" in red
3. Accept the match
4. Future: verify higher rewards on win

## Future Enhancements

- **Turn-based combat RPCs:** Submit turns, calculate damage
- **Rank adjustment:** Update ranks after match completion
- **Match history:** List past matches and results
- **Friend challenges:** Challenge specific players directly
- **Tournament mode:** Bracket-style PvP events
- **Spectator mode:** Watch ongoing matches
- **Time limits:** Auto-forfeit after turn timeout
- **Seasonal rewards:** Special rewards for top ranks
- **Match replays:** Save and review matches

## Nakama Configuration

Matchmaker requires Nakama storage enabled (already configured in `backend/nakama.yml`):

```yaml
runtime:
  path: /nakama/data

database:
  address: postgres:localdbpassword@postgres:5432/nakama
```

## Troubleshooting

**"No matches available"**
- Check Nakama server is running: `docker ps`
- Verify backend code is compiled and running
- Check player has stats (level up at least once)

**"Failed to create match"**
- Verify player stats exist in Nakama storage
- Check Nakama logs: `docker logs armored_archer_server`
- Ensure player is authenticated (NetworkManager.is_connected)

**"Match not found"**
- Verify match_id is correct
- Check if match was already accepted by another player
- Ensure match hasn't expired (server-side cleanup future feature)

**"Rank difference too large"**
- For direct challenges, rank diff must be ≤3
- Use Punch Up to challenge higher ranks
- List matches to find closer opponents
