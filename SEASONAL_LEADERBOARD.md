# Seasonal PvP Leaderboard System

## Overview

This implementation provides seasonal PvP leaderboard tracking with Elo-based ranking, season management, and reward distribution for Armored Archer.

## Components

### Server-Side (TypeScript - Nakama)

**File:** `backend/src/modules/season_system.ts`

#### RPC Endpoints

**1. `armored_archer/get_season_info`**
Retrieves current season information and player rank.

**Request:**
```json
{}
```

**Response:**
```json
{
  "success": true,
  "season": {
    "season_id": "season_1",
    "season_number": 1,
    "start_time": 1234567890000,
    "end_time": 1238160000000,
    "status": "active",
    "duration_weeks": 4
  },
  "player_rank": 42,
  "player_score": 1050,
  "time_remaining": 604800000
}
```

**2. `armored_archer/get_leaderboard`**
Retrieves top players on the seasonal leaderboard.

**Request:**
```json
{
  "limit": 50
}
```

**Response:**
```json
{
  "success": true,
  "season": {
    "season_id": "season_1",
    "season_number": 1,
    "start_time": 1234567890000,
    "end_time": 1238160000000,
    "status": "active",
    "duration_weeks": 4
  },
  "leaderboard": [
    {
      "owner_id": "user-uuid-1",
      "username": "Player1",
      "rank": 1,
      "score": 1500,
      "meta": {
        "wins": 45,
        "losses": 5,
        "win_rate": 0.9,
        "punch_up_wins": 10
      }
    }
  ],
  "total": 50
}
```

**3. `armored_archer/update_rank`**
Updates player rankings after a match result.

**Request:**
```json
{
  "winner_id": "user-uuid-1",
  "loser_id": "user-uuid-2",
  "is_punch_up": false
}
```

**Response:**
```json
{
  "success": true,
  "winner": {
    "user_id": "user-uuid-1",
    "old_rank": 1000,
    "new_rank": 1015,
    "rank_change": 15
  },
  "loser": {
    "user_id": "user-uuid-2",
    "loser_id": "user-uuid-2",
    "old_rank": 1000,
    "new_rank": 985,
    "rank_change": -15
  },
  "is_punch_up": false
}
```

**4. `armored_archer/get_season_rewards`**
Retrieves rewards available to player based on their rank.

**Request:**
```json
{}
```

**Response:**
```json
{
  "success": true,
  "rank": 42,
  "rewards": {
    "rank_tier": "rare",
    "coins": 2000,
    "gems": 100,
    "cosmetics": {
      "title": "Season 1 Veteran",
      "aura": "rare_aura"
    }
  }
}
```

**5. `armored_archer/claim_season_rewards`**
Claims season rewards for the player.

**Request:**
```json
{}
```

**Response:**
```json
{
  "success": true,
  "rewards": {
    "rank_tier": "rare",
    "coins": 2000,
    "gems": 100,
    "cosmetics": {
      "title": "Season 1 Veteran",
      "aura": "rare_aura"
    }
  },
  "claimed": true
}
```

**6. `armored_archer/end_season`**
Ends current season and starts new season (admin function).

**Request:**
```json
{}
```

**Response:**
```json
{
  "success": true,
  "old_season": {
    "season_id": "season_1",
    "season_number": 1,
    "start_time": 1234567890000,
    "end_time": 1238160000000,
    "status": "ended",
    "duration_weeks": 4
  },
  "new_season": {
    "season_id": "season_2",
    "season_number": 2,
    "start_time": 1238160000000,
    "end_time": 1240752000000,
    "status": "active",
    "duration_weeks": 4
  }
}
```

### Client-Side (Godot GDScript)

**File:** `autoloads/SeasonManager.gd`

Singleton that manages season operations:

**Key Methods:**
```gdscript
# Get season info
SeasonManager.get_season_info()

# Get leaderboard
SeasonManager.get_leaderboard(50)

# Update rank after match
SeasonManager.update_rank(winner_id, loser_id, is_punch_up)

# Get available rewards
SeasonManager.get_season_rewards()

# Claim rewards
SeasonManager.claim_season_rewards()

# Get formatted time remaining
var time_text = SeasonManager.format_time_remaining()
```

**Signals:**
- `season_info_loaded(season_info: Dictionary)` - Emitted when season info loads
- `leaderboard_loaded(leaderboard: Array)` - Emitted when leaderboard loads
- `rank_updated(rank_change: Dictionary)` - Emitted when rank changes
- `rewards_loaded(rewards: Dictionary)` - Emitted when rewards load
- `rewards_claimed(rewards: Dictionary)` - Emitted when rewards claimed

### Leaderboard UI

**File:** `scenes/ui/leaderboard_menu.tscn`

The leaderboard interface provides:

**Features:**
- Display current season number and time remaining
- Show player's current rank and tier
- Display top 50 players on leaderboard
- Show wins/losses and win rate for each player
- Claim season rewards button
- Color-coded rank tiers (Gold, Silver, Bronze)
- Reward tier display

**UI Layout:**
1. **Season Panel:** Season number and time remaining
2. **Your Rank Panel:** Player's rank and tier
3. **Leaderboard Container:** Scrollable list of top players
4. **Bottom Panel:** Claim rewards and back buttons

## Architecture

### Season Structure

- **Duration:** 4 weeks per season
- **Automatic Reset:** New season starts when current ends
- **Season ID:** `season_<number>` (e.g., `season_1`)
- **Leaderboard:** Separate Nakama leaderboard per season

### Elo Rating System

Matches use the Elo rating system for rank calculation:

```
Expected Score = 1 / (1 + 10^((OpponentRating - YourRating) / 400))

New Rating = Old Rating + K × (Actual Score - Expected Score)
```

**K-Factors:**
- Normal match: K = 32
- Punch Up match: K = 60 (higher volatility)

**Example:**
- Player A: 1000 Elo vs Player B: 1000 Elo
- Expected A: 0.5, Expected B: 0.5
- Player A wins

Normal match:
- Player A: 1000 + 32 × (1 - 0.5) = 1016
- Player B: 1000 + 32 × (0 - 0.5) = 984

Punch Up match:
- Player A: 1000 + 60 × (1 - 0.5) = 1030
- Player B: 1000 + 60 × (0 - 0.5) = 970

### Rank Tiers

Based on leaderboard position:

| Rank Range | Tier      | Color      | Rewards                        |
|------------|-----------|------------|--------------------------------|
| 1-10       | Legendary | Gold       | 10,000 Coins, 500 Gems, Title  |
| 11-50      | Epic      | Magenta    | 5,000 Coins, 200 Gems, Title   |
| 51-100     | Rare      | Blue       | 2,000 Coins, 100 Gems, Title   |
| 101-500    | Uncommon  | Green      | 500 Coins                     |
| 500+       | Common    | Gray       | 100 Coins                     |

### Punch Up System

High risk/reward mechanism:
- **Challenge higher rank:** More Elo on win, harsher penalty on loss
- **Higher K-factor:** K = 60 (vs 32 for normal matches)
- **Visual indicator:** Punch Up matches highlighted in red
- **Rewards:** Punch Up wins tracked separately for future rewards

### Reward Distribution

Rewards based on final season rank:
- **Coins:** Primary currency for gear and upgrades
- **Gems:** Premium currency for cosmetics
- **Cosmetics:** Exclusive titles and auras per season
- **One-time claim:** Rewards can only be claimed once per season

### Season Lifecycle

1. **Season Start:**
   - New season ID generated
   - Fresh leaderboard created
   - Previous season archived
   - All players start at 1000 Elo

2. **During Season:**
   - Matches update Elo ratings
   - Leaderboard reflects current rankings
   - Players can view rewards based on current rank
   - Time remaining displayed

3. **Season End:**
   - Final ranks locked
   - Rewards available based on final position
   - Players can claim rewards
   - New season automatically starts

## Database Storage

**Seasons stored in Nakama storage:**
- Collection: `seasons`
- Key: Season ID
- User ID: Admin user

**Leaderboards stored in Nakama leaderboard system:**
- Leaderboard ID: Season ID
- Authoritative: true
- Sort order: desc (highest score first)

**Reward claims tracked in storage:**
- Collection: `season_rewards_claimed`
- Key: `{season_id}_{user_id}`
- User ID: User

Schema:
```sql
-- Season info
collection: text = "seasons"
key: text = season_id
user_id: text = admin_id
value: jsonb {
  season_id: text,
  season_number: integer,
  start_time: timestamp,
  end_time: timestamp,
  status: text,              -- "active" or "ended"
  duration_weeks: integer
}

-- Reward claims
collection: text = "season_rewards_claimed"
key: text = "{season_id}_{user_id}"
user_id: text = user_id
value: jsonb {
  season_id: text,
  user_id: text,
  claimed_at: timestamp,
  rank: integer,
  rewards: jsonb
}

-- Leaderboard entries (Nakama leaderboard)
leaderboard_id: text = season_id
owner_id: text = user_id
score: integer = elo_rating
metadata: jsonb {
  wins: integer,
  losses: integer,
  win_rate: float,
  punch_up_wins: integer
}
```

## Server-Authoritative Design

All season operations happen server-side:
- Elo calculations server-side
- Leaderboard stored server-side
- Rewards distributed server-side
- Client cannot modify rankings
- Player stats are single source of truth

## Usage Examples

### Loading Season Info

```gdscript
func _ready():
    SeasonManager.get_season_info()

func _on_season_info_loaded(data: Dictionary):
    var season = data.season
    print("Season %d" % season.season_number)
    print("Time remaining: %s" % SeasonManager.format_time_remaining())
```

### Updating Rank After Match

```gdscript
func on_match_ended(winner_id: String, loser_id: String, is_punch_up: bool):
    SeasonManager.update_rank(winner_id, loser_id, is_punch_up)

func _on_rank_updated(rank_change: Dictionary):
    var winner_data = rank_change.winner
    var new_rank = winner_data.new_rank
    var change = winner_data.rank_change
    
    print("New rank: %d (%s%d)" % [new_rank, "+" if change > 0 else "", change])
```

### Displaying Leaderboard

```gdscript
func _ready():
    SeasonManager.get_leaderboard(50)

func _on_leaderboard_loaded(leaderboard: Array):
    for entry in leaderboard:
        var rank = entry.rank
        var username = entry.username
        var score = entry.score
        var meta = entry.meta
        
        print("#%d %s (%d Elo) - %dW-%dL" % [rank, username, score, meta.wins, meta.losses])
```

### Claiming Rewards

```gdscript
func _on_rewards_pressed():
    SeasonManager.claim_season_rewards()

func _on_rewards_claimed(rewards: Dictionary):
    print("Claimed rewards: %s" % rewards)
    
    var coins = rewards.coins
    var gems = rewards.gems
    var cosmetics = rewards.cosmetics
    
    print("Got %d coins and %d gems" % [coins, gems])
```

## Integration with Existing Systems

### Combat System

Season system integrates with combat:
- Combat manager calls `SeasonManager.update_rank()` on match end
- Match winner/loser IDs passed to season system
- Punch Up flag passed if applicable

### Matchmaker

Season system works with matchmaker:
- Ranked matches update Elo
- Casual matches do not affect leaderboard
- Punch Up matches have higher K-factor

### Player Stats

Player stats are tracked alongside Elo:
- Wins and losses tracked separately
- Win rate calculated automatically
- Punch Up wins tracked for future rewards

## Testing

### Start Nakama Backend

```bash
cd backend
docker-compose up -d
```

### Test Season System

1. Run game in Godot (F5)
2. Navigate to PvP menu
3. Click "Leaderboard" button
4. Verify season info displays correctly
5. Complete a ranked match
6. Verify rank updates
7. Check leaderboard for player position
8. Claim season rewards

### Test Elo Calculations

**Normal match (K=32):**
- Player A: 1000 vs Player B: 1000
- Player A wins
- Expected: Player A gains ~16 Elo

**Punch Up match (K=60):**
- Player A: 1000 vs Player B: 1100
- Player A wins
- Expected: Player A gains ~36 Elo (underdog bonus)

### Test Reward Tiers

- Rank 5: Should get Legendary tier
- Rank 30: Should get Epic tier
- Rank 75: Should get Rare tier
- Rank 200: Should get Uncommon tier
- Rank 1000: Should get Common tier

## Future Enhancements

- **Seasonal badges:** Visual badges for achievements
- **Tournament mode:** Special tournament seasons
- **Team seasons:** 2v2 and 3v3 leaderboards
- **Seasonal challenges:** Bonus challenges per season
- **Rank decay:** Inactivity reduces Elo
- **Placement matches:** Initial calibration matches
- **Prestige system:** Reset rank for bonuses
- **Regional leaderboards:** Separate by region
- **Season pass:** Progressive rewards per season
- **Historical stats:** View past season performance

## Troubleshooting

**"Not ranked yet"**
- Play at least one ranked match
- Check match type (casual matches don't count)
- Wait for leaderboard to update

**"Rewards already claimed"**
- Rewards can only be claimed once per season
- Check if season has ended
- Previous season rewards cannot be claimed again

**"Rank not updating"**
- Verify match type is "ranked"
- Check if server received match result
- Refresh leaderboard to see updated rank

**Time remaining incorrect**
- Time based on server clock
- May need to refresh season info
- Check if season has ended

**No leaderboard entries**
- Season may have just started
- No ranked matches played yet
- Check if current season is active

## Season Management

### Manual Season End

Admin function to end season:

```bash
curl -X POST "http://localhost:7350/v2/rpc/armored_archer/end_season" \
  -H "Authorization: Bearer <admin_token>" \
  -d "{}"
```

### Monitoring Season Progress

Monitor Nakama leaderboard:
```bash
curl -X GET "http://localhost:7350/v2/leaderboard/{season_id}" \
  -H "Authorization: Bearer <admin_token>"
```

## Anti-Cheat & Exploitation Prevention

The seasonal leaderboard includes anti-cheat measures to ensure fair competition and prevent rank manipulation, win trading, and other exploitative behaviors.

### Suspicious Win Rate Detection

The system automatically flags players with suspiciously high win rates:

- **Threshold**: >95% win rate
- **Minimum matches**: 100+ matches required
- **Action**: Player is flagged for review

Players meeting these criteria are flagged in the system and marked for administrative review.

### Repeated Opponent Detection

The system monitors for patterns where a player faces the same opponent repeatedly:

- **Threshold**: Same opponent 50+ times
- **Detection**: Tracks opponent encounter frequency per player
- **Action**: Flags potential win trading or match manipulation

### Player Reporting System

Players can report suspicious behavior through the in-game reporting system:

**Report a Player:**
```bash
curl -X POST "http://localhost:7350/v2/rpc/armored_archer/report_player" \
  -H "Authorization: Bearer <user_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "reported_user_id": "<target_user_id>",
    "reason": "win_trading|match_manipulation|suspicious_win_rate|harassment|cheating",
    "match_id": "<optional_match_id>",
    "additional_info": "Optional details about the incident"
  }'
```

**Get Reports for a User (Admin):**
```bash
curl -X POST "http://localhost:7350/v2/rpc/armored_archer/get_player_reports" \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "<target_user_id>"}'
```

**Report Reasons:**
- `win_trading`: Suspected win trading arrangement
- `match_manipulation`: Intentional match throwing or manipulation
- `suspicious_win_rate`: Abnormally high win rate
- `harassment`: Harassment or abusive behavior
- `cheating`: Use of cheats or exploits

### Flagged Players

When a player is flagged (via automatic detection or manual reports):
- Player is marked with a flag in the system
- Leaderboard position may be reviewed by administrators
- Multiple reports trigger increased monitoring
- Extreme cases may result in season disqualification
