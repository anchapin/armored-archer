# Turn-Based PvP Combat System

## Overview

This implementation provides server-authoritative turn-based PvP combat for Armored Archer using Nakama RPCs. All combat calculations happen server-side to prevent cheating.

## Components

### Server-Side (TypeScript - Nakama)

**File:** `backend/src/modules/combat_system.ts`

#### RPC Endpoints

**1. `armored_archer/submit_combat_action`**
Submits a combat action (shoot) for the current turn.

**Request:**
```json
{
  "match_id": "match_1234567890_abc123",
  "action_type": "shoot",
  "angle": 0.785398,  // in radians
  "power": 1.0
}
```

**Response:**
```json
{
  "success": true,
  "result": {
    "success": true,
    "hit": true,
    "damage": 15,
    "is_crit": false,
    "attacker_stats": {
      "level": 5,
      "stats": {
        "attack": 20,
        "defense": 15,
        "dodge": 10,
        "crit_rate": 10
      }
    },
    "defender_stats": {
      "level": 4,
      "stats": {
        "attack": 15,
        "defense": 12,
        "dodge": 15,
        "crit_rate": 5
      }
    },
    "match_status": "active",
    "winner": null
  }
}
```

**2. `armored_archer/get_match_state`**
Retrieves the current state of an active match.

**Request:**
```json
{
  "match_id": "match_1234567890_abc123"
}
```

**Response:**
```json
{
  "match_id": "match_1234567890_abc123",
  "turn": 3,
  "current_turn_user_id": "user-uuid-1",
  "creator_id": "user-uuid-1",
  "opponent_id": "user-uuid-2",
  "creator_health": 85,
  "opponent_health": 70,
  "creator_stats": {
    "level": 5,
    "stats": { "attack": 20, "defense": 15, "dodge": 10, "crit_rate": 10 }
  },
  "opponent_stats": {
    "level": 4,
    "stats": { "attack": 15, "defense": 12, "dodge": 15, "crit_rate": 5 }
  },
  "status": "active",
  "log": [
    {
      "turn": 1,
      "attacker_id": "user-uuid-1",
      "action": "shoot",
      "hit": true,
      "damage": 15,
      "is_crit": false,
      "timestamp": 1234567890000
    },
    {
      "turn": 2,
      "attacker_id": "user-uuid-2",
      "action": "shoot",
      "hit": false,
      "damage": 0,
      "is_crit": false,
      "timestamp": 1234567890500
    }
  ]
}
```

### Client-Side (Godot GDScript)

**File:** `autoloads/CombatManager.gd`

Singleton that manages combat operations:

**Key Methods:**
```gdscript
# Submit a shoot action
CombatManager.submit_combat_action(match_id, "shoot", angle, power)

# Get current match state
CombatManager.get_match_state(match_id)

# Check if it's your turn
if CombatManager.is_my_turn_sync():
    print("Your turn!")

# Get health values
var my_health = CombatManager.get_my_health()
var opponent_health = CombatManager.get_opponent_health()

# Get combat log
var log = CombatManager.get_combat_log()
```

**Signals:**
- `combat_action_submitted(result: Dictionary)` - Emitted when action is submitted
- `match_state_updated(match_state: Dictionary)` - Emitted when match state changes
- `turn_changed(is_my_turn: bool)` - Emitted when turn changes
- `combat_ended(winner: String)` - Emitted when combat ends

### Combat UI

**File:** `scenes/ui/combat_menu.tscn`

The combat interface provides:

**Features:**
- Health bars for both players
- Turn indicator
- Combat log showing all actions
- Aim angle slider (0-360 degrees)
- Shoot button (only enabled on your turn)
- Victory/Defeat dialog when match ends

**UI Layout:**
1. **Stats Panel:** Health bars for you and opponent
2. **Turn Panel:** Shows whose turn it is
3. **Log Panel:** Scrollable combat log
4. **Action Panel:** Angle slider and shoot button
5. **Bottom Panel:** Back button

## Architecture

### Combat Flow

1. **Match starts:**
   - Matchmaker creates match and both players accept
   - Server initializes match state with full health
   - Creator gets first turn

2. **Turn cycle:**
   - Client checks if it's their turn
   - Client selects aim angle and shoots
   - Server validates turn and calculates results
   - Server updates match state and saves to storage
   - Server increments turn counter
   - Turn passes to opponent

3. **Combat calculations:**
   - **Hit calculation:** Roll against dodge stat
   - **Damage calculation:** Base damage - defense reduction
   - **Crit calculation:** Roll against crit rate

4. **Match ends:**
   - When a player's health reaches 0
   - Winner is declared
   - Both clients notified

### Damage Formula

```
Base Damage = 10 + (Attack × 0.5)
Defense Reduction = Defense × 0.3
Final Damage = max(1, Base Damage - Defense Reduction)

Crit Damage = Final Damage × 2
```

Example:
- Attacker: Attack 20
- Defender: Defense 12

Base Damage = 10 + (20 × 0.5) = 20
Defense Reduction = 12 × 0.3 = 3.6
Final Damage = max(1, 20 - 3.6) = 16

If crit: 16 × 2 = 32 damage

### Hit Calculation

```
Hit Chance = 1.0 - (Dodge / 100)

Roll random(0, 1)
If roll ≤ Hit Chance: HIT
Else: MISS
```

Example:
- Defender: Dodge 15
- Hit Chance = 1.0 - 0.15 = 0.85 (85%)

If roll is 0.75: HIT
If roll is 0.90: MISS

### Crit Calculation

```
Crit Chance = Crit Rate / 100

Roll random(0, 1)
If roll ≤ Crit Chance: CRIT
Else: Normal hit
```

Example:
- Attacker: Crit Rate 10
- Crit Chance = 0.10 (10%)

If roll is 0.08: CRIT!
If roll is 0.25: Normal hit

### Match States

- **active:** Combat in progress
- **completed:** Match finished, winner determined

### Health System

```
Max Health = 100 + (Level × 10)

Level 1: 110 HP
Level 5: 150 HP
Level 10: 200 HP
```

## Database Storage

Match states stored in Nakama's storage system:
- Collection: `pvp_match_states`
- Key: Match ID
- User ID: Match creator

Schema:
```sql
collection: text = "pvp_match_states"
key: text = match_id
user_id: text = creator_id
value: jsonb {
  match_id: text,
  turn: integer,
  current_turn_user_id: text,
  creator_id: text,
  opponent_id: text,
  creator_health: integer,
  opponent_health: integer,
  creator_stats: jsonb,
  opponent_stats: jsonb,
  status: text,                    -- "active" or "completed"
  winner: text,                    -- user_id of winner
  log: jsonb array {                -- combat log entries
    turn: integer,
    attacker_id: text,
    action: text,
    hit: boolean,
    damage: integer,
    is_crit: boolean,
    timestamp: timestamp
  }
}
```

## Server-Authoritative Design

All combat calculations happen server-side:
- Client cannot modify damage or hit results
- Turn validation server-side
- Combat state stored server-side
- Client only displays server-validated data
- Prevents speed hacks and stat manipulation

## Usage Examples

### Starting Combat

```gdscript
# From matchmaking menu
func _on_match_accepted_dialog_confirmed(match: Dictionary):
    var combat_scene = load("res://scenes/ui/combat_menu.tscn")
    var combat_ui = combat_scene.instantiate()
    combat_ui.set_match_id(match.get("match_id", ""))
    get_tree().current_scene.add_child(combat_ui)
```

### Shooting

```gdscript
func _on_shoot_pressed():
    if not CombatManager.is_my_turn_sync():
        return
    
    var angle: float = deg_to_rad(angle_slider.value)
    CombatManager.submit_combat_action(match_id, "shoot", angle)
```

### Handling Combat End

```gdscript
func _on_combat_ended(winner: String):
    var dialog: AcceptDialog = AcceptDialog.new()
    
    if winner == NetworkManager.user_id:
        dialog.title = "Victory!"
        dialog.dialog_text = "You won the match!"
    else:
        dialog.title = "Defeat"
        dialog.dialog_text = "You lost the match."
    
    dialog.show()
```

## Integration with Existing Systems

### Matchmaker

Combat system integrates with Matchmaker:
- Matchmaker creates active matches
- Combat loads match state from match ID
- Combat navigates back to matchmaker on end

### PlayerStatsManager

Combat uses player stats for calculations:
- Attack affects damage output
- Defense reduces incoming damage
- Dodge affects hit chance
- Crit Rate affects critical hit chance

### NetworkManager

Combat uses NetworkManager's RPC method:
```gdscript
var response = await NetworkManager.send_rpc(
    "armored_archer/submit_combat_action", 
    payload
)
```

## Testing

### Start Nakama Backend

```bash
cd backend
docker-compose up -d
```

### Test Combat

1. Run game in Godot (F5)
2. Login and navigate to PvP menu
3. Create a match with Player A
4. Accept match with Player B
5. Combat scene loads for both players
6. Player A aims and shoots
7. Verify damage calculation
8. Player B takes turn
9. Repeat until health reaches 0
10. Verify winner is declared correctly

### Test Calculations

**Test hit chance:**
- Player A: Dodge 10
- Player B: Attack multiple times
- Verify ~90% hit rate

**Test damage:**
- Player A: Attack 20
- Player B: Defense 10
- Expected damage: ~17 (10 + 10 - 3)

**Test crit:**
- Player A: Crit Rate 20
- Attack multiple times
- Verify ~20% crit rate

## Future Enhancements

- **More action types:** Special abilities, dodge, defend
- **Equipment bonuses:** Weapons and armor affect stats
- **Team combat:** 2v2 matches
- **Tournament mode:** Bracket-style tournaments
- **Replay system:** Record and replay matches
- **Spectator mode:** Watch ongoing matches
- **Power shot:** Charge up shots with power meter
- **Turn timer:** Auto-forfeit after timeout
- **Ranked adjustments:** Update ranks after match

## Combat Balancing Notes

### Current Balance
- Base damage: 10
- Attack multiplier: 0.5
- Defense reduction: 0.3 (30%)
- Crit multiplier: 2x
- Max health scales with level

### Tuning Parameters
Edit in `backend/src/modules/combat_system.ts`:

```typescript
// Damage formula
const baseDamage = 10 + (attackerStats.stats.attack * 0.5);
const defenseReduction = defenderStats.stats.defense * 0.3;

// Health formula
const baseHealth = 100;
const maxHealth = baseHealth + (creatorStats.level * 10);
```

## Troubleshooting

**"Not your turn"**
- Wait for opponent to complete their turn
- Refresh match state to check turn status
- Check combat log to see if opponent already acted

**"Match not found"**
- Verify match_id is correct
- Ensure match status is "active" (not "pending" or "completed")
- Check if match was canceled

**Damage seems wrong**
- Verify player stats are loaded correctly
- Check if equipment/modifiers are applied
- Review damage formula in combat_system.ts

**Opponent not responding**
- Opponent may have disconnected
- Future: Implement turn timeout and auto-forfeit
- Future: Handle disconnects gracefully

**Match state out of sync**
- Call `CombatManager.get_match_state(match_id)` to refresh
- Server is the single source of truth
- Client state should always reflect server state
