# Armored Archer - Shared Game Terminology Glossary

This glossary defines core game concepts and ensures consistent terminology across backend (Nakama/TypeScript) and frontend (Godot/GDScript) implementations.

## Table of Contents

- [Progression Systems](#progression-systems)
  - [XP (Experience Points)](#xp-experience-points)
  - [Rank](#rank)
  - [Level](#level)
- [PvP Systems](#pvp-systems)
  - [Punch Up Mode](#punch-up-mode)
  - [Ranked Match](#ranked-match)
  - [Casual Match](#casual-match)
  - [Match Types](#match-types)
- [Season System](#season-system)
  - [Season](#season)
  - [Season Rewards](#season-rewards)
  - [Leaderboard](#leaderboard)
- [Gear System](#gear-system)
  - [Gear](#gear)
  - [Gear Modifiers](#gear-modifiers)
  - [Gear Slots](#gear-slots)
  - [Rarity](#rarity)
  - [Loadout](#loadout)
- [Cosmetics](#cosmetics)
  - [Skin / Cosmetic Skin](#skin--cosmetic-skin)
  - [Transmog](#transmog)
  - [Base Gear](#base-gear)
- [Combat](#combat)
  - [Ability Points](#ability-points)
  - [Stats](#stats)

---

## Progression Systems

### XP (Experience Points)

**Definition:** Points earned by completing in-game activities that contribute to character progression.

**How it's earned:**
- PvE: Stage completion, boss defeats
- PvP: Winning matches

**XP Curve Formula:**
```
Base XP = 100
Growth factor = 1.5

Total XP for level N = Previous XP + (Base XP × Growth Factor^(N-1))
```

**Backend References:**
- RPC: `armored_archer/gain_xp`
- Storage: `player_stats` collection
- Module: `player_stats.ts`

**Frontend References:**
- Autoload: `PlayerStatsManager.gd`
- Method: `gain_xp(amount: int, source: String)`
- UI: Stat allocation screen with XP progress bar

**Notes:** XP is server-authoritative. Client cannot modify XP directly.

---

### Rank

**Definition:** A numeric value representing a player's overall power and competitive standing, calculated from level and allocated stat points.

**Rank Calculation:**
```
Rank = (Level × 10) + (Stats Total ÷ 4)

Where Stats Total = Attack + Defense + Dodge + Crit Rate
```

**Example:**
- Level 5, Attack 20, Defense 15, Dodge 10, Crit Rate 10
- Rank = (5 × 10) + ((20 + 15 + 10 + 10) ÷ 4) = 50 + 13 = 63

**Usage:**
- PvP matchmaking: Matched against players with similar rank (±3 for ranked matches)
- Seasonal leaderboard: Sorted by Elo rating (separate from player rank)
- Minimum rank requirements for some content

**Backend References:**
- RPC: `armored_archer/get_player_rank`
- Module: `matchmaker.ts`
- Function: `calculateRank(playerStats)`

**Frontend References:**
- Autoload: `MatchmakerManager.gd`
- Autoload: `SeasonManager.gd`
- Method: `get_player_rank()`

**Related Terms:**
- **Elo Rating:** Separate competitive rating used for seasonal leaderboards
- **Player Rank:** Power rating used for matchmaking

---

### Level

**Definition:** A progression milestone achieved by accumulating XP. Each level grants 1 ability point.

**Level Requirements:**
- Level 1: 0 XP (starting level)
- Level 2: 100 XP
- Level 3: 250 XP
- Level 4: 475 XP
- Level N: Previous XP + (100 × 1.5^(N-1))

**Benefits:**
- 1 ability point per level
- Access to higher-level content (campaign stages, gear tiers)
- Contributes to rank calculation

**Backend References:**
- RPC: `armored_archer/gain_xp`
- Storage: `player_stats.level`

**Frontend References:**
- Autoload: `PlayerStatsManager.gd`
- Method: `get_level()`

---

## PvP Systems

### Punch Up Mode

**Definition:** A high risk/reward matchmaking option in ranked PvP where a player challenges an opponent with a significantly higher rank.

**Key Characteristics:**
- **Only available in Ranked matches**
- **Higher K-factor for Elo calculation:** K = 60 (vs 32 for normal matches)
- **Winning:** Larger Elo gain (underdog bonus)
- **Losing:** Harsher Elo penalty
- **Visual indicator:** Matches highlighted in red with "Punch Up Challenge!" text

**Elo Impact (K = 60):**
```
Normal match (K = 32):
- Equal ranks: Winner gains ~16 Elo, loser loses ~16

Punch Up match (K = 60):
- Equal ranks: Winner gains ~30 Elo, loser loses ~30
- Underdog wins: ~36+ Elo bonus
```

**Backend References:**
- RPC: `armored_archer/create_match` (parameter: `is_punch_up: boolean`)
- RPC: `armored_archer/update_rank`
- Storage: `pvp_matches` collection (field: `is_punch_up`)
- Module: `season_system.ts`

**Frontend References:**
- Autoload: `MatchmakerManager.gd`
- UI: Matchmaking menu with Punch Up checkbox toggle
- UI: Leaderboard metadata includes `punch_up_wins` count

**Related Terms:**
- **Ranked Match:** Required match type for Punch Up
- **Elo Rating:** Affected by Punch Up K-factor
- **Punch Up Wins:** Tracked separately for rewards

---

### Ranked Match

**Definition:** A competitive PvP match that affects player Elo rating and seasonal leaderboard position.

**Characteristics:**
- Updates Elo rating on win/loss
- Contributes to seasonal leaderboard
- Matched against players within ±3 rank
- More stakes than casual matches

**Rank Adjustment:**
```
New Elo = Old Elo + K × (Actual - Expected)

Where K = 32 (normal) or K = 60 (Punch Up)
```

**Backend References:**
- RPC: `armored_archer/create_match` (parameter: `match_type: "ranked"`)
- RPC: `armored_archer/update_rank`
- Storage: `pvp_matches` collection

**Frontend References:**
- Autoload: `MatchmakerManager.gd`
- Autoload: `SeasonManager.gd`
- UI: Matchmaking menu filter

---

### Casual Match

**Definition:** A non-competitive PvP match for practice and fun that does not affect rankings.

**Characteristics:**
- No Elo rating changes
- No leaderboard impact
- Wider rank matching range
- For testing builds and learning

**Backend References:**
- RPC: `armored_archer/create_match` (parameter: `match_type: "casual"`)
- Storage: `pvp_matches` collection

**Frontend References:**
- Autoload: `MatchmakerManager.gd`
- UI: Matchmaking menu filter

---

### Match Types

**Values:** `"ranked"`, `"casual"`

**Definition:** The competitive classification of a PvP match.

**Ranked:**
- Affects Elo and leaderboard
- ±3 rank matching
- Supports Punch Up mode

**Casual:**
- No competitive impact
- Wider matching
- Practice-oriented

**Backend References:**
- Storage: `pvp_matches.match_type`
- Validation: `match_type: createEnum(['ranked', 'casual'])`

---

## Season System

### Season

**Definition:** A time-limited competitive period with a fresh leaderboard, lasting 4 weeks.

**Season Lifecycle:**
1. **Season Start:** New season ID generated, fresh leaderboard, all players start at 1000 Elo
2. **During Season:** Matches update Elo, leaderboard reflects rankings, time remaining displayed
3. **Season End:** Final ranks locked, rewards distributed, new season starts automatically

**Season ID Format:** `season_<number>` (e.g., `season_1`, `season_2`)

**Backend References:**
- RPC: `armored_archer/get_season_info`
- RPC: `armored_archer/end_season`
- Storage: `seasons` collection
- Module: `season_system.ts`

**Frontend References:**
- Autoload: `SeasonManager.gd`
- UI: Leaderboard menu showing season number and time remaining

---

### Season Rewards

**Definition:** Rewards distributed to players based on their final leaderboard position at season end.

**Reward Tiers:**

| Rank Range | Tier      | Rewards                             |
|------------|-----------|-------------------------------------|
| 1-10       | Legendary | 10,000 Coins, 500 Gems, Title      |
| 11-50      | Epic      | 5,000 Coins, 200 Gems, Title       |
| 51-100     | Rare      | 2,000 Coins, 100 Gems, Title       |
| 101-500    | Uncommon  | 500 Coins                          |
| 500+       | Common    | 100 Coins                          |

**Reward Types:**
- **Coins:** Primary currency for gear and upgrades
- **Gems:** Premium currency for cosmetics
- **Cosmetics:** Exclusive titles and auras per season
- **One-time claim:** Rewards can only be claimed once per season

**Backend References:**
- RPC: `armored_archer/get_season_rewards`
- RPC: `armored_archer/claim_season_rewards`
- Storage: `season_rewards_claimed` collection
- Function: `calculateRewards(rank, seasonNumber)`

**Frontend References:**
- Autoload: `SeasonManager.gd`
- Method: `get_season_rewards()`, `claim_season_rewards()`
- UI: Leaderboard menu with claim rewards button

---

### Leaderboard

**Definition:** A ranked list of players sorted by Elo rating for a specific season.

**Leaderboard Metadata:**
```json
{
  "wins": integer,
  "losses": integer,
  "win_rate": float,
  "punch_up_wins": integer
}
```

**Leaderboard ID:** Season ID (e.g., `season_1`)

**Backend References:**
- RPC: `armored_archer/get_leaderboard`
- Nakama: Built-in leaderboard system per season
- Storage: Nakama leaderboard with authoritative: true

**Frontend References:**
- Autoload: `SeasonManager.gd`
- UI: Leaderboard menu (scenes/ui/leaderboard_menu.tscn)

---

## Gear System

### Gear

**Definition:** Equipable items that provide stat bonuses and gameplay modifiers. Gear is earned through PvE gameplay and boss defeats.

**Gear Types:**
- `helm` - Head armor
- `armor` - Body armor
- `bow` - Ranged weapon
- `arrow` - Ammunition
- `amulet` - Accessory (future)

**Gear Properties:**
- `id`: Unique identifier (e.g., `helm_basic`, `armor_leather`)
- `name`: Display name
- `type`: Equipment slot
- `rarity`: Quality tier
- `stats`: Array of stat bonuses
- `modifiers`: Array of gear modifiers

**Backend References:**
- RPC: `armored_archer/generate_gear`
- RPC: `armored_archer/equip_gear`
- Storage: `inventory` collection
- Module: `gear_system.ts`

**Frontend References:**
- Autoload: `GearManager.gd`
- Autoload: `GearRegistry.gd`
- UI: Gear inventory and comparison screens

---

### Gear Modifiers

**Definition:** Special properties or abilities that can be applied to gear, enhancing or altering their effects. Modifiers are generated based on rarity and unlocked modifier pools.

**Modifier Structure:**
```typescript
{
  type: string,      // Modifier type (e.g., "damage_boost", "crit_chance")
  value: number,     // Magnitude of effect
  stat_name?: string // Target stat if applicable
}
```

**Modifier Pools:**
- Unlocked by defeating bosses
- Determines which modifiers can appear on generated gear
- Stored in `unlocked_modifiers` collection

**How Modifiers Work:**
1. Boss defeat unlocks a new modifier pool
2. Gear generation uses unlocked pools
3. Higher rarity gear has more/different modifiers
4. Modifiers apply to gear stats when equipped

**Backend References:**
- RPC: `armored_archer/unlock_modifier_pool`
- RPC: `armored_archer/get_unlocked_modifiers`
- Storage: `unlocked_modifiers` collection
- Module: `gear_system.ts`
- Function: `applyModifiersToGearStats()`

**Frontend References:**
- Autoload: `GearManager.gd`
- Autoload: `CampaignManager.gd`
- Method: `unlock_modifier_pool(boss_id: String)`

**Example Modifiers:**
- `damage_boost`: +X% damage
- `crit_chance`: +X% critical hit chance
- `life_steal`: X% of damage dealt heals player
- `arrow_pierce`: Arrows penetrate X enemies

---

### Gear Slots

**Definition:** The five equipment positions on a character where gear can be equipped.

**Slot Types:**
- `helm` - Head protection
- `armor` - Body protection
- `bow` - Primary weapon
- `arrow` - Ammunition type
- `amulet` - Accessory (not yet implemented)

**Slot Configuration:**
```gdscript
var equipment_slots = ["helm", "armor", "bow", "arrow", "amulet"]
```

**Backend References:**
- RPC: `armored_archer/equip_gear`
- Storage: `loadout` collection

**Frontend References:**
- Autoload: `GearManager.gd`
- Scene: `scenes/player/gear/gear_slot.tscn`
- UI: Loadout screen showing 5 slots

---

### Rarity

**Definition:** Quality tier that determines gear stat values, number of modifiers, and visual appearance.

**Rarity Tiers:**

| Tier    | Stat Multiplier | Modifiers | Color    | Drop Rate |
|---------|-----------------|-----------|----------|-----------|
| Common  | 1.0x            | 0         | Gray     | 60%       |
| Rare    | 1.2x            | 1         | Blue     | 25%       |
| Epic    | 1.5x            | 2         | Magenta  | 12%       |
| Legendary | 2.0x         | 3         | Gold     | 3%        |

**Visual Indicators:**
- Gear icons colored by rarity
- UI elements use rarity colors
- Rank tiers in leaderboard use same colors

**Backend References:**
- Storage: `catalog` collection (field: `gear_rarity`)
- Enum: `gear_rarity` (common, rare, epic, legendary)

**Frontend References:**
- Autoload: `GearRegistry.gd`
- UI: `rarity_pillar.gd` component
- Const: `RARITY_COLORS` dictionary

---

### Loadout

**Definition:** The currently equipped set of gear items across all gear slots.

**Loadout Structure:**
```json
{
  "helm": "helm_id",
  "armor": "armor_id",
  "bow": "bow_id",
  "arrow": "arrow_id",
  "amulet": ""
}
```

**Loadout vs. Skins:**
- **Loadout:** Determines stats and gameplay (server-authoritative)
- **Skins:** Determine visual appearance only (cosmetic, client-side display)

**Backend References:**
- RPC: `armored_archer/equip_gear`
- Storage: `loadout` collection

**Frontend References:**
- Autoload: `GearManager.gd`
- Autoload: `TransmogManager.gd`
- Method: `equip_gear(gear_id: String, slot: String)`

---

## Cosmetics

### Skin / Cosmetic Skin

**Definition:** A purely visual variant of base gear that can be applied over equipped items. Skins do not affect gameplay stats or power.

**Skin Properties:**
- `id`: Unique skin identifier
- `name`: Display name
- `slot`: Equipment slot it applies to
- `base_gear_required`: Which base gear it can overlay
- `skin_texture`: Visual asset (no gameplay effect)

**Important:**
- Skins are **not** pay-to-win
- Purchased with premium currency (gems)
- Applied via transmog system
- No stat bonuses or gameplay effects

**Backend References:**
- Storage: `cosmetic_skins` collection (future)
- Module: `transmog_system.ts` (future)

**Frontend References:**
- Autoload: `TransmogManager.gd`
- Autoload: `GearRegistry.gd`
- Class: `CosmeticSkinData.gd`
- UI: Cosmetic shop screen

**Monetization:**
- Primary revenue source
- Non-consumable purchases
- No competitive advantage

---

### Transmog

**Definition:** Short for "transmogrification," the system that applies cosmetic skins over base gear while preserving the base gear's stats.

**How It Works:**
1. Player equips base gear (determines stats)
2. Player applies skin (determines visuals)
3. Combat uses base gear stats
4. Character displays skin visuals

**Transmog Manager:**
- Singleton that manages visual overrides
- Combines base gear with selected skins
- Independent of loadout (stats)

**Backend References:**
- Storage: Player-owned skins tracked in `owned_skins` collection

**Frontend References:**
- Autoload: `TransmogManager.gd`
- Method: `equip_skin(slot: String, skin_id: String)`
- Signal: `transmog_applied(slot, base_gear_id, skin_id)`

**Example:**
```
Base Gear: Leather Armor (Defense +10)
Applied Skin: Dragon Armor (Visual only)
Result: Defense +10, looks like Dragon Armor
```

---

### Base Gear

**Definition:** The actual equipable gear item that provides stat bonuses and modifiers. This is the "functional" layer of the equipment system.

**Base Gear vs. Skins:**
- **Base Gear:** Earned through gameplay, provides stats, server-authoritative
- **Skins:** Purchased with gems, provides visuals only, cosmetic

**Base Gear Properties:**
- `id`: Unique identifier
- `name`: Display name
- `type`: Equipment slot
- `rarity`: Quality tier
- `stats`: Stat bonuses
- `modifiers`: Gear modifiers
- `base_texture`: Default visual asset

**Backend References:**
- RPC: `armored_archer/generate_gear`
- Storage: `catalog` collection
- Module: `gear_system.ts`

**Frontend References:**
- Autoload: `GearManager.gd`
- Autoload: `GearRegistry.gd`
- Class: `GearData.gd`

---

## Combat

### Ability Points

**Definition:** Points awarded upon leveling up that can be allocated to character stats.

**How Earned:**
- 1 ability point per level gained
- Points accumulate until spent

**Allocatable Stats:**
- Attack: Increases damage output
- Defense: Reduces incoming damage
- Dodge: Chance to avoid attacks
- Crit Rate: Chance for critical hits (default 5%)

**Backend References:**
- RPC: `armored_archer/allocate_stats`
- Storage: `player_stats.ability_points`

**Frontend References:**
- Autoload: `PlayerStatsManager.gd`
- Method: `allocate_stat(stat_name: String, points: int)`
- UI: Stat allocation screen (scenes/ui/stat_allocation.tscn)

---

### Stats

**Definition:** The four primary character attributes that determine combat performance and can be improved through ability point allocation and gear bonuses.

**Primary Stats:**

| Stat       | Effect                                      | Default | Max (?)    |
|------------|---------------------------------------------|---------|------------|
| Attack     | Increases damage dealt                      | 10      | Unbounded  |
| Defense    | Reduces incoming damage                     | 10      | Unbounded  |
| Dodge      | Chance to avoid attacks (percentage)        | 10      | 100%       |
| Crit Rate  | Chance for critical hits (percentage)       | 5       | 100%       |

**Stat Sources:**
1. **Base allocation:** Player spends ability points
2. **Gear bonuses:** Equipped gear provides additional stats
3. **Gear modifiers:** Special modifiers can boost stats
4. **Temporary buffs:** (future implementation)

**Damage Formula:**
```
Base Damage = Attack Stat + Weapon Base Damage
Defense Reduction = (Defense Stat × Defense Multiplier)
Final Damage = Base Damage - Defense Reduction
```

**Critical Hit:**
```
If roll(0-100) <= Crit Rate:
  Damage × 2 (critical hit)
```

**Backend References:**
- RPC: `armored_archer/allocate_stats`
- RPC: `armored_archer/get_player_stats`
- Module: `combat_system.ts`
- Function: `applyGearModifiersToPlayerStats()`

**Frontend References:**
- Autoload: `PlayerStatsManager.gd`
- Autoload: `CombatManager.gd`
- UI: Stat allocation screen, character sheet

---

## Usage Guidelines

### When Adding New Terms

1. **Check existing definitions** - Ensure the term doesn't already exist with a different meaning
2. **Define clearly** - Provide concise definition, backend/frontend references, and examples
3. **Be consistent** - Use the same terminology in code, comments, and documentation
4. **Update both sides** - Add references to both backend (TypeScript) and frontend (GDScript)

### When Modifying Existing Terms

1. **Update this document first** - Define the new meaning before changing code
2. **Update both codebases** - Change backend and frontend simultaneously
3. **Search for old usage** - Use grep to find all references before renaming
4. **Update related docs** - Check other documentation files that may reference the term

### Code Comment Examples

**Good:**
```gdscript
# Apply gear modifiers to base attack stat
# See: docs/GLOSSARY.md - Gear Modifiers
func get_modified_attack() -> int:
    return base_attack + gear_modifier_bonus
```

**Avoid:**
```gdscript
# Apply the stuff that makes numbers bigger
func get_bigger_numbers() -> int:
    return base + stuff
```

---

## Version History

| Version | Date        | Changes                      |
|---------|-------------|------------------------------|
| 1.0     | 2026-04-15  | Initial glossary created     |

---

## Questions or Clarifications?

If you encounter ambiguous terminology or need to add new terms:
1. Check this glossary first
2. Discuss with the team if the meaning is unclear
3. Update this document before implementing changes
4. Reference the glossary in code comments when applicable
