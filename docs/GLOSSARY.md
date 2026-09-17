# Armored Archer — Plain-Language Glossary

> **Reconciled with [`CONTEXT.md`](../../CONTEXT.md)** (the ratified source of domain vocabulary; this glossary is a plain-language companion). For canonical definitions, anti-terms, and concept relationships, defer to **CONTEXT.md**; when the two disagree, CONTEXT.md wins. **Naming reconciliation (issue #1103):** `gold`, `transmog`, `premium coins`, standalone `skin`/`rank`, and player-facing `Elo` have been replaced with the canonical terms below; see [Deprecated Aliases](#deprecated-aliases).

## Table of Contents

- [Economy](#economy) — Coins, Gems
- [Base Gear & Cosmetics](#base-gear--cosmetics) — Base Gear, Cosmetic Skin, Rarity, Loadout
- [Progression & PvE](#progression--pve) — XP, Level, Ability Points, Stats
- [PvP & Duels](#pvp--duels) — Power Rating, Ladder Rating, Standing, Punch-Up, Ranked Duel, Casual PvP
- [Seasons](#seasons) — Season, Season Rewards, Leaderboard
- [Gear Mechanics](#gear-mechanics) — Gear Modifiers, Gear Slots
- [Deprecated Aliases](#deprecated-aliases)

---

## Economy

### Coins

The earnable soft currency paid by gameplay (matches, season tiers). Never purchasable. **Canonical** — [CONTEXT](../../CONTEXT.md#economy). **Backend:** `player_stats.coins` (legacy `gold` field retired — see [Deprecated Aliases](#deprecated-aliases)). **Frontend:** `PlayerStatsManager.gd` → `get_coins()`, `spend_coins()`. **Sink:** reroll vendor, Season 1 mid-season (deferred).

### Gems

The premium currency bought with real money via RevenueCat IAP, with small earnable amounts from punch-up wins and season tiers. Buys **Cosmetic Skins** and nothing with stats. **Canonical** — [CONTEXT](../../CONTEXT.md#economy). **Backend:** RPC `armored_archer/grant_gems`; storage `player_stats.gems`. **Frontend:** `PlayerStatsManager.gd` → `get_gems()`. **Anti-term:** "premium coins" → **Gems**.

---

## Base Gear & Cosmetics

### Base Gear

The stat-bearing equipment (Helm / Armor / Bow / Arrow / Amulet) earned strictly by playing. Carries all gameplay stats and modifiers. **Canonical** — [CONTEXT](../../CONTEXT.md#economy). **Backend:** RPC `armored_archer/generate_gear`, `armored_archer/equip_gear`; storage `inventory`. **Frontend:** `GearManager.gd`, `GearRegistry.gd`; class `GearData.gd`. **Anti-term:** "gear" (when contrasted with skins) → **Base Gear**.

### Cosmetic Skin

A visual-only override applied over **Base Gear**; carries no stats or modifiers. The underlying Base Gear still provides all combat math. **Canonical** — [CONTEXT](../../CONTEXT.md#economy). **Properties:** `id`, `name`, `slot`, `base_gear_required`, `skin_texture`. **Purchased with:** **Gems** only (no Coins path). **Backend (planned):** storage `cosmetic_skins`, ownership `owned_skins`. **Frontend:** `CosmeticSkinData.gd`, `GearRegistry.gd`. **Anti-terms:** "skin" alone (collides with Base Gear's default appearance) → **Cosmetic Skin**; "transmog item" → **Cosmetic Skin**.

> **Legacy alias note.** The historical implementation name for the *system that applies Cosmetic Skins* was "transmog" (`TransmogManager.gd`, `transmog_system.ts`, signal `transmog_applied`). The visible-to-player concept is **Cosmetic Skin**; the in-code identifiers stay for compatibility and are not renamed by this doc.

### Gear Rarity (Rarity)

The four-tier earned-only classification of **Base Gear** — **Common**, **Rare**, **Epic**, **Legendary** — scaling stat power and modifier count. Never purchasable; Cosmetic Skins carry no rarity. **Canonical** — [CONTEXT](../../CONTEXT.md#economy).

| Tier       | Multiplier | Modifiers | UI Color |
|------------|------------|-----------|----------|
| Common     | 1.0×       | 0         | Gray     |
| Rare       | 1.2×       | 1         | Blue     |
| Epic       | 1.5×       | 2         | Magenta  |
| Legendary  | 2.0×       | 3         | Gold (UI color label only — see [Deprecated Aliases](#deprecated-aliases)) |

**Backend:** storage `catalog.gear_rarity`; enum `gear_rarity`. **Frontend:** const `RARITY_COLORS` in `GearRegistry.gd`; `rarity_pillar.gd`. **Anti-term:** "uncommon" (orphaned fifth tier — DB enum has no such value) → use the four tiers above. **Distinct concept:** **Rank Tier** (see [Seasons](#seasons)) reuses these color words for *leaderboard reward bands* and must never imply gear-drop rates.

### Loadout

The currently equipped set of Base Gear items across all five gear slots. Server-authoritative for stats; displayed appearance is Base Gear's default texture plus any applied Cosmetic Skin.

```json
{ "helm": "helm_id", "armor": "armor_id", "bow": "bow_id",
  "arrow": "arrow_id", "amulet": "" }
```

**Backend:** RPC `armored_archer/equip_gear`; storage `loadout`. **Frontend:** `GearManager.gd` → `equip_gear(gear_id, slot)`; scene `scenes/player/gear/gear_slot.tscn`.

---

## Progression & PvE

### XP (Experience Points)

Points earned from PvE stage completion and PvP wins that drive Level progression. Server-authoritative. **Curve:** `XP(N) = XP(N-1) + (100 × 1.5^(N-1))` (base 100, growth 1.5). **Backend:** RPC `armored_archer/gain_xp`; storage `player_stats.xp`. **Frontend:** `PlayerStatsManager.gd` → `gain_xp(amount, source)`.

### Level

A progression milestone from accumulated XP. Each level grants **1 ability point**; contributes to **Power Rating**. **Backend:** storage `player_stats.level`. **Frontend:** `PlayerStatsManager.gd` → `get_level()`.

### Ability Points

Points awarded per level, spent on the four primary **Stats** below. **Backend:** RPC `armored_archer/allocate_stats`; storage `player_stats.ability_points`. **Frontend:** `PlayerStatsManager.gd` → `allocate_stat(stat_name, points)`; scene `scenes/ui/stat_allocation.tscn`.

### Stats

Four primary attributes improved by **Ability Points** and **Base Gear** bonuses:

| Stat       | Effect                                  | Default |
|------------|-----------------------------------------|---------|
| Attack     | Damage dealt                            | 10      |
| Defense    | Damage taken                            | 10      |
| Dodge      | Chance to avoid attacks (%)             | 10      |
| Crit Rate  | Critical-hit chance (%)                 | 5       |

**Damage:** `Final = (Attack + Weapon Base) − (Defense × Defense Multiplier)`; crit: `if roll ≤ Crit Rate: Damage × 2`. **Backend:** RPC `armored_archer/allocate_stats`, `armored_archer/get_player_stats`; module `combat_system.ts`. **Frontend:** `PlayerStatsManager.gd`, `CombatManager.gd`.

---

## PvP & Duels

### Power Rating

A player's build-strength score: `Power Rating = (level × 10) + (atk + def + dodge + crit) ÷ 4`. Gates **Punch-Up** eligibility and matchmaking brackets. **Canonical** — [CONTEXT](../../CONTEXT.md#pvp). **Backend:** module `matchmaker.ts` → `calculatePowerRating(playerStats)`. **Frontend:** `MatchmakerManager.gd`. **Anti-terms:** standalone "rank", "combat rating" → **Power Rating**.

### Ladder Rating

The Elo score (seeded 1000) wagered in ranked duels and ranked on the seasonal leaderboard. **Canonical** — [CONTEXT](../../CONTEXT.md#pvp). **Adjustment:** `New Ladder = Old Ladder + K × (Actual − Expected)`; `K = 32` normal, `K = 60` Punch-Up. **Backend:** RPC `armored_archer/update_ladder_rating`; Nakama leaderboard (`authoritative: true`). **Frontend:** `SeasonManager.gd`, `MatchmakerManager.gd`. **Anti-terms:** "rank" (when meaning rating), "Elo" (when player-facing), "MMR" → **Ladder Rating**.

### Standing

A player's leaderboard position (1st, 2nd, …) within a **Season**; determines **Rank Tier** and **Season Rewards**. **Canonical** — [CONTEXT](../../CONTEXT.md#pvp). **Anti-term:** "rank" (when meaning position) → **Standing**.

### Punch-Up

A ranked duel wager against a significantly more powerful opponent (Power Rating ≥ 20, gap 5–15). Amplified **Ladder Rating** upside on win, amplified downside on loss. XP/levels are never wagered. **Canonical** — [CONTEXT](../../CONTEXT.md#pvp). **Visual:** matches highlighted red with "Punch-Up Challenge!" badge. **Backend:** RPC `armored_archer/create_match` (param `is_punch_up: bool`); storage `pvp_matches.is_punch_up`. **Frontend:** `MatchmakerManager.gd` matchmaking menu toggle. **Anti-term:** "upset challenge", "punch up" (two-word) → **Punch-Up** (hyphenated).

### Ranked Duel

A competitive PvP **Duel** that affects **Ladder Rating** and seasonal leaderboard position. Matched within ±3 **Power Rating**. **Backend:** RPC `armored_archer/create_match` (param `match_type: "ranked"`); RPC `armored_archer/update_ladder_rating`. **Frontend:** `MatchmakerManager.gd`, `SeasonManager.gd`.

### Casual PvP

Practice duels with 50% rewards and no rank/season effect; rewards reduced, never negative; **Punch-Up** unavailable. **Canonical** — [CONTEXT](../../CONTEXT.md#pvp). **Backend:** RPC `armored_archer/create_match` (param `match_type: "casual"`); storage `pvp_matches.match_type`. **Frontend:** `MatchmakerManager.gd`. **Anti-term:** "unranked" (when precision needed) → **Casual PvP**.

### Duel & Duel Matchmaking

A **Duel** is a live, turn-based combat session (5-minute turn timers, reconnect grace). **Duel Matchmaking** is the asynchronous pairing phase (challenge or queue, 24-hour acceptance window) that precedes the Duel. **Canonical** — [CONTEXT](../../CONTEXT.md#duels) and [Match Settlement](../../CONTEXT.md#authority). **Settlement:** **Match Settlement** (server-only) — winner declared on health-zero, **Forfeit**, or timeout. **Forfeit:** server-declared loss on consecutive turn timeouts (reconnect grace ≈ 10 min covers app interruptions). **Anti-terms:** "async match" / "correspondence game" → **Duel Matchmaking**; "match completion" → **Match Settlement**; "disconnect loss" → **Forfeit**.

---

## Seasons

### Season

A 4-week ranked ladder cycle ending in tiered rewards and a **Soft Reset** into the next season. **Canonical** — [CONTEXT](../../CONTEXT.md#seasons). **Lifecycle:** season start (Ladder 1000, fresh leaderboard) → ladder updates → season end (rewards distributed, soft reset). **ID format:** `season_<n>` (e.g., `season_1`). **Backend:** RPC `armored_archer/get_season_info`, `armored_archer/end_season`; module `season_system.ts`. **Frontend:** `SeasonManager.gd`. **Anti-term:** "ladder" (when meaning season) → **Season**.

### Season Rewards

Tiered payouts of **Coins + Gems + cosmetic title/aura** by final **Standing**. No XP component (PRD's "massive XP bursts" superseded). **Canonical** — [CONTEXT](../../CONTEXT.md#seasons). **Backend:** RPC `armored_archer/get_season_rewards`, `armored_archer/claim_season_rewards`; storage `season_rewards_claimed`. **Frontend:** `SeasonManager.gd` → `get_season_rewards()`, `claim_season_rewards()`.

### Leaderboard

A ranked list of players sorted by **Ladder Rating** for a specific **Season**. Metadata per player: `wins`, `losses`, `win_rate`, `punch_up_wins`. **Backend:** RPC `armored_archer/get_leaderboard`; Nakama built-in leaderboard (`authoritative: true`). **Frontend:** `SeasonManager.gd`; scene `scenes/ui/leaderboard_menu.tscn`.

---

## Gear Mechanics

### Gear Modifiers

Special properties applied to **Base Gear** that enhance or alter its effects. Generated based on rarity and unlocked modifier pools (boss defeats unlock pools).

```typescript
{ type: string,   // e.g. "damage_boost", "crit_chance"
  value: number,  // magnitude
  stat_name?: string }
```

**Examples:** `damage_boost` (+X% damage), `crit_chance` (+X% crit), `life_steal` (X% heal), `arrow_pierce` (penetrate X). **Backend:** RPC `armored_archer/unlock_modifier_pool`, `armored_archer/get_unlocked_modifiers`; storage `unlocked_modifiers`. **Frontend:** `GearManager.gd`, `CampaignManager.gd` → `unlock_modifier_pool(boss_id)`.

### Gear Slots

The five equipment positions: `helm`, `armor`, `bow`, `arrow`, `amulet`. The `amulet` slot is reserved for future content. **Backend:** RPC `armored_archer/equip_gear`; storage `loadout`. **Frontend:** `GearManager.gd`; scene `scenes/player/gear/gear_slot.tscn`.

---

## Deprecated Aliases

Retired in favor of CONTEXT.md vocabulary. For grep-time migration only — **do not use in new prose**. This document already replaces every running-prose instance; the only surviving occurrences are deliberate alias notes.

| Deprecated alias | Canonical term | Why retired |
|---|---|---|
| `gold` (currency/storage) | **Coins** | Legacy storage field; see CONTEXT.md flagged-ambiguities §2 (P1 coin-ledger split) |
| `Gold` UI color (Legendary rarity) | *(intentional, not currency)* | CSS color label only — unrelated to retired `gold` currency |
| "transmog" / "transmog item" / "skin" (alone) | **Cosmetic Skin** | CONTEXT.md anti-terms; `TransmogManager.gd` / `transmog_system.ts` kept for compat |
| "premium coins" | **Gems** | CONTEXT.md anti-term |
| "gear" (contrasted with skins) | **Base Gear** | CONTEXT.md anti-term |
| "uncommon" (gear rarity) | **Common / Rare / Epic / Legendary** | Orphaned fifth tier; DB enum has no such value |
| Standalone "rank" | **Power Rating** / **Ladder Rating** / **Standing** | Retired — collides with three concepts (CONTEXT.md §1) |
| "Elo" (player-facing), "MMR" | **Ladder Rating** | CONTEXT.md anti-terms |
| "combat rating" | **Power Rating** | CONTEXT.md anti-term |
| "punch up" / "upset challenge" | **Punch-Up** (hyphenated) | CONTEXT.md anti-term |
| "unranked" (precision needed) | **Casual PvP** | CONTEXT.md anti-term |
| "async match" / "correspondence game" | **Duel Matchmaking** | CONTEXT.md anti-terms |
| "match completion" | **Match Settlement** | CONTEXT.md anti-term (implies client completes anything) |
| "disconnect loss" | **Forfeit** | A disconnect alone never settles a match |
| "ladder" (meaning season) | **Season** | The ladder is the ranking *inside* a season |
| "rarity tier" (conflated) | **Gear Rarity** vs **Rank Tier** | CONTEXT.md anti-term |
| "difficulty scaling" / "adaptive difficulty" | **Dynamic Difficulty** | CONTEXT.md anti-terms; `difficulty_scaling.ts` is a different module |

---

## Version History

| Version | Date       | Changes |
|---|---|---|
| 1.0 | 2026-04-15 | Initial glossary created |
| 1.1 | 2026-09-17 | Reconciled with CONTEXT.md (issue #1103): replaced anti-terms, added cross-refs, added deprecated-aliases table |

For canonical domain vocabulary and concept relationships, see [`CONTEXT.md`](../../CONTEXT.md). New terminology proposals follow the **Ratification** process defined there — do not amend this file alone.

