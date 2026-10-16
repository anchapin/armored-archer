## DifficultyScalingManager autoload (#1620; phase-05 task 02 / PROG-02).
## Provides the level-based difficulty baseline: enemy damage scaling, AI
## behavior tiers, boss phase progression, and encounter difficulty ratios.
##
## This is the LEVEL layer of difficulty. It composes with
## DynamicDifficultyManager (the PERFORMANCE layer), which nudges difficulty
## +/-20% from win/lose streaks: consumers use this manager's value as the
## base and DDM's calculate_target_difficulty(base, modifier) applies the
## streak modifier on top. This manager never touches rewards; reward
## authority stays with the backend settlement path.
extends Node

# --- Damage scaling bands (.planning/phases/05, task 02) ---
# Level 1-10: 0.8x-1.0x, 11-20: 1.0x-1.2x, 21-30: 1.2x-1.5x, 31-50: 1.5x-2.0x.
const MIN_PLAYER_LEVEL := 1
const MAX_PLAYER_LEVEL := 50

# --- AI behavior tiers ---
# Tier index 1-3; consumers map a player level band to a tier index.
const AI_TIERS := {
	1: {"name": "Simple", "aggression": 0.3, "pattern_complexity": 2},
	2: {"name": "Aggressive", "aggression": 0.6, "pattern_complexity": 5},
	3: {"name": "Sophisticated", "aggression": 0.9, "pattern_complexity": 8},
}

# --- Boss progression by tier index ---
const BOSS_PHASE_COUNTS := {1: 1, 2: 2, 3: 3}
const BOSS_ABILITIES := {
	1: ["cleave"],
	2: ["cleave", "summon_minions"],
	3: ["cleave", "summon_minions", "enrage", "arena_hazard"],
}

## Returns the enemy damage multiplier for a player level, interpolated
## linearly inside each band. Monotonic non-decreasing over 1..50.
func get_enemy_damage_mult(player_level: int) -> float:
	var level := clampi(player_level, MIN_PLAYER_LEVEL, MAX_PLAYER_LEVEL)
	if level <= 10:
		return lerpf(0.8, 1.0, (level - 1) / 9.0)
	if level <= 20:
		return lerpf(1.0, 1.2, (level - 10) / 10.0)
	if level <= 30:
		return lerpf(1.2, 1.5, (level - 20) / 10.0)
	return lerpf(1.5, 2.0, (level - 30) / 20.0)

## Maps a player level to an AI tier index (1-3).
func get_ai_tier_for_level(player_level: int) -> int:
	var level := clampi(player_level, MIN_PLAYER_LEVEL, MAX_PLAYER_LEVEL)
	if level <= 10:
		return 1
	if level <= 30:
		return 2
	return 3

## Returns the AI behavior table for a tier index:
## {name, aggression (0-1), pattern_complexity (1-10)}.
func get_ai_difficulty_tier(tier: int) -> Dictionary:
	var idx := clampi(tier, 1, 3)
	return AI_TIERS[idx].duplicate()

## Returns boss phase progression for a tier index: {tier, phases}.
func get_boss_phase_progression(tier: int) -> Dictionary:
	var idx := clampi(tier, 1, 3)
	return {"tier": idx, "phases": BOSS_PHASE_COUNTS[idx]}

## Returns the boss ability list for a tier index.
func get_boss_abilities(tier: int) -> Array:
	var idx := clampi(tier, 1, 3)
	return BOSS_ABILITIES[idx].duplicate()

## Labels a damage/difficulty multiplier. Aligned with
## DynamicDifficultyManager's Easy/Normal/Hard/Extreme vocabulary.
func get_difficulty_label(multiplier: float) -> String:
	if multiplier < 0.95:
		return "Easy"
	if multiplier < 1.25:
		return "Normal"
	if multiplier < 1.75:
		return "Hard"
	return "Extreme"

## Encounter difficulty as the ratio of the enemy's level baseline to the
## player's: 1.0 at parity, <1.0 when outleveled, >1.0 when outmatched.
func calculate_encounter_difficulty(player_level: int, enemy_level: int) -> float:
	var player_mult := get_enemy_damage_mult(player_level)
	if player_mult <= 0.0:
		return 1.0
	return get_enemy_damage_mult(enemy_level) / player_mult
