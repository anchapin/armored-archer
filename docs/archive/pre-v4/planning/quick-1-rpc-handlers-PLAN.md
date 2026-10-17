---
phase: quick
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/internal/rpc/rpc.go
  - backend/internal/rpc/handlers.go
autonomous: true
requirements: []
must_haves:
  truths:
    - "GetPlayerStats returns player level, experience, and allocated stats from database"
    - "GetSeasonInfo returns current season information and duration"
    - "GetLeaderboard returns ranked player list for specified season"
    - "GetInventory returns player's owned gear items with details"
  artifacts:
    - path: "backend/internal/rpc/rpc.go"
      provides: "Updated RPC handler implementations"
      exports: ["GetPlayerStats", "GetSeasonInfo", "GetLeaderboard", "GetInventory"]
    - path: "backend/internal/rpc/handlers.go"
      provides: "New handler implementations with database queries"
      min_lines: 200
  key_links:
    - from: "GetPlayerStats"
      to: "player_stats table"
      via: "db.QueryRowContext"
      pattern: "SELECT.*FROM player_stats"
    - from: "GetInventory"
      to: "inventory + catalog tables"
      via: "JOIN query"
      pattern: "SELECT.*FROM inventory.*JOIN catalog"
---

## Objective

Implement the four missing hot-path RPC handlers (GetPlayerStats, GetSeasonInfo, GetLeaderboard, GetInventory) with proper database queries to replace placeholder stubs. These handlers are critical for game client functionality and must query the PostgreSQL database efficiently.

**Purpose:** Enable core game features (player progression, seasonal content, leaderboards, inventory) by implementing server-authoritative database queries.

**Output:** Four working RPC handlers with database integration, proper error handling, and response formatting.

## Execution Context

@backend/internal/rpc/rpc.go
@backend/internal/rpc/feedback.go
@backend/DATABASE_SCHEMA.md
@.planning/STATE.md

## Context

### Current State

From STATE.md, Phase 05 Performance Optimization (Plan 05-02) was blocked because:
- GetPlayerStats, GetSeasonInfo, GetLeaderboard handlers are placeholder stubs
- Cannot add caching to functions that don't query database
- Need to implement database queries first, then apply cache-aside pattern

### Database Schema

From DATABASE_SCHEMA.md:
- **player_stats**: user_id (PK), level, experience, ability_points, stats (JSONB)
- **inventory**: inventory_id (PK), user_id (FK), gear_id (FK), acquired_at
- **catalog**: gear_id (PK), gear_type, name, rarity, base_stats, modifiers
- **loadout**: user_id (PK), helm_gear_id, armor_gear_id, bow_gear_id, arrow_gear_id, amulet_gear_id

### Existing Pattern

From feedback.go, follow the established pattern:
1. Extract userID from context using `getUserIDFromContext()`
2. Parse JSON payload
3. Validate request
4. Query database with proper error handling
5. Return JSON response using `jsonResponse()` helper

### Handler Signatures

All handlers follow Nakama RPC signature:
```go
func Handler(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error)
```

## Tasks

### Task 1: Implement GetPlayerStats Handler

**Files:** `backend/internal/rpc/rpc.go`

**Action:**
Replace the GetPlayerStats stub implementation (lines 12-27) with a working database query:

1. Extract userID from context using `getUserIDFromContext(ctx, nk)`
2. Query player_stats table:
   ```go
   query := `SELECT level, experience, ability_points, stats FROM player_stats WHERE user_id = $1`
   ```
3. Handle three cases:
   - **No rows found**: Create default player stats (level=1, experience=0, ability_points=0, stats={}) and insert into database
   - **Error**: Log and return error response
   - **Success**: Return player stats in JSON response
4. Return response structure:
   ```json
   {
     "success": true,
     "data": {
       "user_id": "...",
       "level": 1,
       "experience": 0,
       "ability_points": 0,
       "stats": {}
     }
   }
   ```

**Why:** Player progression is core to the game. New players need auto-created stats. Existing players need their current stats fetched.

**Verify:**
```bash
# Test the handler returns valid JSON structure
cd backend && go test -run TestGetPlayerStats_Handler -v
```

**Done:**
- GetPlayerStats queries player_stats table by user_id
- Creates default stats if none exist (level=1, XP=0, ability_points=0)
- Returns proper JSON response with all stat fields

---

### Task 2: Implement GetSeasonInfo Handler

**Files:** `backend/internal/rpc/rpc.go`

**Action:**
Replace the GetSeasonInfo stub implementation (lines 233-248) with season data retrieval:

1. Parse payload for optional `season_id` field (defaults to current season if not provided)
2. Query season information from Nakama's storage or database:
   - For now, return a hardcoded current season (season 1, starts 2024-01-01, ends 2024-12-31)
   - Future: Query from a seasons table when schema is added
3. Calculate:
   - `days_remaining`: Time until season end
   - `is_active`: Whether season is currently active
4. Return response structure:
   ```json
   {
     "success": true,
     "data": {
       "season_id": 1,
       "name": "Season 1",
       "starts_at": "2024-01-01T00:00:00Z",
       "ends_at": "2024-12-31T23:59:59Z",
       "days_remaining": 256,
       "is_active": true
     }
   }
   ```

**Why:** Seasonal content drives player engagement. Client needs season duration for UI displays and reward eligibility checks.

**Verify:**
```bash
# Test the handler returns valid season structure
cd backend && go test -run TestGetSeasonInfo_Handler -v
```

**Done:**
- GetSeasonInfo returns current season information
- Calculates days_remaining until season end
- Returns proper JSON response with season metadata

---

### Task 3: Implement GetLeaderboard Handler

**Files:** `backend/internal/rpc/rpc.go`

**Action:**
Replace the GetLeaderboard stub implementation (lines 250-265) with ranked player retrieval:

1. Parse payload for:
   - `season_id` (optional, defaults to current)
   - `limit` (optional, defaults to 100, max 1000)
   - `offset` (optional, defaults to 0, for pagination)
2. Query leaderboard by joining player_stats with users:
   ```go
   query := `
     SELECT ps.user_id, u.username, ps.level, ps.experience
     FROM player_stats ps
     JOIN users u ON ps.user_id = u.id
     ORDER BY ps.experience DESC
     LIMIT $1 OFFSET $2
   `
   ```
3. For each entry, calculate rank based on offset + position
4. Return response structure:
   ```json
   {
     "success": true,
     "data": {
       "season_id": 1,
       "leaderboard": [
         {
           "rank": 1,
           "user_id": "...",
           "username": "player1",
           "level": 50,
           "experience": 1000000
         }
       ],
       "total_players": 1000
     }
   }
   ```

**Why:** Leaderboards drive competitive play. Players need to see their ranking and top players.

**Verify:**
```bash
# Test the handler returns valid leaderboard structure
cd backend && go test -run TestGetLeaderboard_Handler -v
```

**Done:**
- GetLeaderboard queries player_stats ordered by experience DESC
- Supports pagination with limit/offset
- Returns ranked list with calculated rank positions

---

### Task 4: Implement GetInventory Handler

**Files:** `backend/internal/rpc/rpc.go`

**Action:**
Replace the GetInventory stub implementation (lines 386-401) with player gear retrieval:

1. Extract userID from context
2. Query inventory with catalog details:
   ```go
   query := `
     SELECT
       i.inventory_id, i.gear_id, i.acquired_at,
       c.gear_type, c.name, c.rarity, c.base_stats, c.modifiers, c.icon_url
     FROM inventory i
     JOIN catalog c ON i.gear_id = c.gear_id
     WHERE i.user_id = $1
     ORDER BY c.gear_type, c.rarity DESC, i.acquired_at DESC
   `
   ```
3. Scan rows into inventory items with full gear details
4. Return response structure:
   ```json
   {
     "success": true,
     "data": {
       "user_id": "...",
       "items": [
         {
           "inventory_id": "...",
           "gear_id": "...",
           "gear_type": "bow",
           "name": "Legendary Bow",
           "rarity": "legendary",
           "base_stats": {"attack_power": 50},
           "modifiers": [],
           "icon_url": "https://...",
           "acquired_at": "2024-03-20T00:00:00Z"
         }
       ],
       "total_items": 25
     }
   }
   ```

**Why:** Inventory display is core to the game. Players need to see their owned gear to equip items and build loadouts.

**Verify:**
```bash
# Test the handler returns valid inventory structure
cd backend && go test -run TestGetInventory_Handler -v
```

**Done:**
- GetInventory queries inventory table joined with catalog
- Returns all owned gear with full details (type, name, rarity, stats)
- Orders by gear_type, then rarity, then acquisition date

## Verification

### Manual Testing

After implementation, test handlers with Nakama CLI or curl:

```bash
# Test GetPlayerStats
nakama rpc GetPlayerStats '{}'

# Test GetSeasonInfo
nakama rpc GetSeasonInfo '{}'

# Test GetLeaderboard
nakama rpc GetLeaderboard '{"limit": 10}'

# Test GetInventory
nakama rpc GetInventory '{}'
```

### Integration Tests

Ensure each handler:
- Returns proper JSON responses
- Handles database errors gracefully
- Validates user authentication
- Returns 404 for missing data appropriately

## Success Criteria

1. All four handlers return valid JSON responses
2. Handlers query the correct database tables with proper joins
3. Error cases (missing data, auth failures) return appropriate error messages
4. Response structures match client expectations
5. Code follows existing patterns from feedback.go (helpers, error handling)
6. No "Not yet implemented" stubs remain in the four handlers

## Output

After completion, no SUMMARY file needed for quick plan. Handlers will be integrated with caching in Phase 05-02 continuation.
