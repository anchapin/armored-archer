# Character Leveling and Stat Allocation System

## Overview

This system implements server-authoritative RPG progression with XP, leveling, and manual stat point allocation in Armored Archer.

## Features

### XP System
- **XP Gain:** Earn XP from PvE (stage completion, boss defeats) and PvP (winning matches)
- **Leveling:** XP curve with increasing requirements (base 100 XP, 1.5x growth factor)
- **Ability Points:** 1 ability point awarded per level gained

### Stat System
Four primary stats that can be allocated manually:
- **Attack:** Increases damage output
- **Defense:** Reduces incoming damage
- **Dodge:** Chance to avoid attacks
- **Crit Rate:** Chance for critical hits (default 5%)

## Server-Side Implementation (Nakama RPCs)

### RPC: `armored_archer/gain_xp`
Gains XP for the current player and handles level-ups.

**Request:**
```json
{
  "xp_amount": 100,
  "source": "pve"  // or "pvp"
}
```

**Response:**
```json
{
  "success": true,
  "player_stats": {
    "user_id": "uuid",
    "level": 2,
    "xp": 150,
    "ability_points": 1,
    "stats": {
      "attack": 10,
      "defense": 10,
      "dodge": 10,
      "crit_rate": 5
    }
  },
  "xp_gained": 100,
  "levels_gained": 1
}
```

### RPC: `armored_archer/allocate_stats`
Allocates ability points to a specific stat.

**Request:**
```json
{
  "stat_name": "attack",  // "attack", "defense", "dodge", "crit_rate"
  "points": 1
}
```

**Response:**
```json
{
  "success": true,
  "player_stats": {
    "user_id": "uuid",
    "level": 2,
    "xp": 150,
    "ability_points": 0,  // Decreased by points spent
    "stats": {
      "attack": 11,  // Increased
      "defense": 10,
      "dodge": 10,
      "crit_rate": 5
    }
  }
}
```

### RPC: `armored_archer/get_player_stats`
Retrieves current player stats.

**Request:**
```json
{}
```

**Response:**
```json
{
  "user_id": "uuid",
  "level": 2,
  "xp": 150,
  "ability_points": 1,
  "stats": {
    "attack": 11,
    "defense": 10,
    "dodge": 10,
    "crit_rate": 5
  }
}
```

## Client-Side Implementation (Godot)

### PlayerStatsManager Autoload
Singleton that manages RPG progression and communicates with Nakama.

**Key Methods:**
```gdscript
# Get current player stats
var stats = await PlayerStatsManager.get_player_stats()

# Gain XP (after PvE stage or PvP match)
PlayerStatsManager.gain_xp(100, "pve")

# Allocate ability points to a stat
PlayerStatsManager.allocate_stat("attack", 1)

# Get individual stats
var attack = PlayerStatsManager.get_attack()
var level = PlayerStatsManager.get_level()
var ability_points = PlayerStatsManager.get_ability_points()
```

**Signals:**
- `stats_updated(stats: Dictionary)` - Emitted when stats change
- `level_up(new_level: int, ability_points_gained: int)` - Emitted on level up
- `xp_gained(amount: int, total_xp: int)` - Emitted when XP is gained
- `stat_allocated(stat_name: String, amount: int)` - Emitted when points are spent

### Stat Allocation UI
Scene: `scenes/ui/stat_allocation.tscn`

Displays current stats and allows allocating ability points:
- Level and XP display with progress bar
- Ability points counter
- Individual stat rows with "+" buttons
- Visual feedback for level-ups and XP gain

## XP Curve Formula

```
XP required for level N:
Base XP = 100
Growth factor = 1.5

Total XP for level 1: 0
Total XP for level 2: 100
Total XP for level 3: 100 + 150 = 250
Total XP for level 4: 250 + 225 = 475
...
```

## Usage Examples

### After Completing a PvE Stage
```gdscript
func on_stage_completed(stage_data: Dictionary):
    var xp_reward = stage_data.xp_reward
    PlayerStatsManager.gain_xp(xp_reward, "pve")
```

### After Winning a PvP Match
```gdscript
func on_pvp_victory():
    var xp_reward = 150
    PlayerStatsManager.gain_xp(xp_reward, "pvp")
```

### Opening Stat Allocation UI
```gdscript
func open_stats_menu():
    var stats_scene = load("res://scenes/ui/stat_allocation.tscn")
    var stats_ui = stats_scene.instantiate()
    get_tree().current_scene.add_child(stats_ui)
```

## Server-Authoritative Design

All XP gain and stat allocation happens server-side via Nakama RPCs to prevent cheating:
- Client cannot modify XP or stats directly
- All calculations happen on the server
- Database is the single source of truth
- Client only displays server-validated data

## Database Storage

Player stats are stored in Nakama's storage system:
- Collection: `player_stats`
- Key: User ID
- User ID: Current user

Schema:
```sql
user_id: text (primary key)
level: integer
xp: integer
ability_points: integer
stats: jsonb {
  attack: integer
  defense: integer
  dodge: integer
  crit_rate: integer
}
```

## Integration with Combat System

Stats affect combat calculations:

**Attack:**
- Base damage formula includes attack stat
- Higher attack = more damage dealt

**Defense:**
- Reduces incoming damage
- Damage = base_damage - (defense * defense_multiplier)

**Dodge:**
- Percentage chance to avoid an attack
- Roll random(0-100) against dodge stat

**Crit Rate:**
- Percentage chance for critical hit
- Roll random(0-100) against crit_rate
- Crit deals 2x damage

## Future Enhancements

- Stat caps or diminishing returns
- Special abilities unlocked at certain stat levels
- Respec system (reset stat allocation)
- Equipment stat bonuses
- Temporary buffs/debuffs
- Stat synergies (e.g., high defense unlocks shield skills)
