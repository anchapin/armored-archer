## Calculates gear balance with diminishing returns and synergy bonuses.
## Prevents power stacking exploits while keeping upgrades valuable.
##
## Features:
## - Diminishing returns curve (70% of max at soft cap)
## - Stat synergy calculations
## - Gear power rating display
## - Balance adjustments per slot
##
extends Node

# Diminishing returns configuration
const SOFT_CAP_RATIO: float = 0.7  # Soft cap is 70% of max stat value
const DIMINISHING_FACTOR: float = 0.5  # Reduces efficiency as stat approaches cap

# Maximum stat values per gear type (used for soft cap calculation)
const MAX_STATS: Dictionary = {
	"helm": {
		"defense": 100,
		"health": 500
	},
	"armor": {
		"defense": 150,
		"health": 600
	},
	"bow": {
		"attack": 150,
		"crit_rate": 30
	},
	"arrow": {
		"attack": 100,
		"crit_rate": 25
	},
	"amulet": {
		"dodge": 30,
		"crit_rate": 20
	}
}

# Synergy groups for set bonuses
const SYNERGY_GROUPS: Dictionary = {
	"dragon_set": {
		"pieces": ["helm_dragon", "armor_plate", "bow_crossbow", "arrow_dragon", "amulet_dragon"],
		"bonuses": {
			2: {"stat": "attack", "value": 5},
			3: {"stat": "crit_rate", "value": 3},
			4: {"stat": "health", "value": 50},
			5: {"stat": "all", "value": 10}  # +10% to all stats
		}
	},
	"iron_set": {
		"pieces": ["helm_iron", "armor_chain", "bow_composite", "arrow_iron", "amulet_power"],
		"bonuses": {
			2: {"stat": "defense", "value": 5},
			3: {"stat": "health", "value": 30},
			4: {"stat": "dodge", "value": 2},
			5: {"stat": "defense", "value": 15}
		}
	}
}

# Power rating multipliers by rarity
const RARITY_MULTIPLIERS: Dictionary = {
	"common": 1.0,
	"rare": 1.5,
	"epic": 1.8,
	"legendary": 2.2
}

# Stat weight for power rating calculation
const STAT_WEIGHTS: Dictionary = {
	"attack": 1.0,
	"defense": 0.8,
	"health": 0.3,  # HP is less impactful than raw stats
	"speed": 0.7,
	"dodge": 1.2,   # Dodge is very valuable
	"crit_rate": 1.5  # Crit rate is highly impactful
}

## Calculates effective stat with diminishing returns applied.
##
## Parameters:
##   base_stat: The base stat value before diminishing returns
##   synergy_bonus: Bonus from gear set synergies (0.0 to 1.0, e.g., 0.1 = +10%)
##   gear_type: Type of gear to determine soft cap
##   stat_name: Name of the stat for max value lookup
##
## Returns:
##   float: The effective stat value after diminishing returns
func calculate_effective_stat(base_stat: float, synergy_bonus: float, gear_type: String, stat_name: String) -> float:
	# Get max stat value for this gear type
	var max_stat: float = MAX_STATS.get(gear_type, {}).get(stat_name, 100.0)

	# Calculate soft cap (70% of max)
	var soft_cap: float = max_stat * SOFT_CAP_RATIO

	# Apply synergy bonus first
	var with_synergy: float = base_stat * (1.0 + synergy_bonus)

	# Apply diminishing returns
	# Effective = Base × (1 - (Stat / SoftCap) × 0.5)
	var ratio: float = min(with_synergy / soft_cap, 1.0)
	var diminishing_factor: float = 1.0 - (ratio * DIMINISHING_FACTOR)

	var effective: float = with_synergy * diminishing_factor

	return max(0.0, effective)

## Calculates overall gear power rating.
##
## Parameters:
##   gear_data: Dictionary containing gear information with stats and rarity
##
## Returns:
##   float: Power rating (0.0 to 100.0 scale)
func get_gear_power_rating(gear_data: Dictionary) -> float:
	var power: float = 0.0

	var rarity: String = gear_data.get("rarity", "common")
	var rarity_mult: float = RARITY_MULTIPLIERS.get(rarity, 1.0)

	# Add weighted stat contributions
	var stats: Dictionary = gear_data.get("stats", {})
	for stat_name in stats.keys():
		var stat_value: float = float(stats[stat_name])
		var weight: float = STAT_WEIGHTS.get(stat_name, 1.0)
		power += stat_value * weight

	# Add modifier contributions
	var modifiers: Array = gear_data.get("modifiers", [])
	for modifier in modifiers:
		var modifier_data: Dictionary = modifier
		var value_range: Array = modifier_data.get("value_range", [0, 0])
		var avg_value: float = (float(value_range[0]) + float(value_range[1])) / 2.0
		power += avg_value * 2.0  # Modifiers are more impactful

	# Apply rarity multiplier
	power *= rarity_mult

	# Normalize to 0-100 scale (assuming ~200 max power for legendary)
	return min(power, 100.0)

## Validates gear power against thresholds to prevent exploits.
##
## Parameters:
##   gear_data: Dictionary containing gear information
##
## Returns:
##   Dictionary: {"valid": bool, "reason": String}
func validate_gear_power(gear_data: Dictionary) -> Dictionary:
	var power: float = get_gear_power_rating(gear_data)
	var rarity: String = gear_data.get("rarity", "common")

	# Max power thresholds per rarity
	var max_power_thresholds: Dictionary = {
		"common": 15.0,
		"rare": 40.0,
		"epic": 60.0,
		"legendary": 100.0
	}

	var threshold: float = max_power_thresholds.get(rarity, 15.0)

	if power > threshold:
		return {
			"valid": false,
			"reason": "Power rating %f exceeds threshold %f for %s rarity" % [power, threshold, rarity]
		}

	# Check individual stats against caps
	var stats: Dictionary = gear_data.get("stats", {})
	for stat_name in stats.keys():
		var stat_value: float = float(stats[stat_name])
		var max_allowed: float = _get_max_stat_for_type(gear_data.get("type", ""), stat_name)
		if stat_value > max_allowed:
			return {
				"valid": false,
				"reason": "Stat %s value %f exceeds maximum %f" % [stat_name, stat_value, max_allowed]
			}

	return {"valid": true, "reason": ""}

## Calculates synergy bonus from equipped gear set.
##
## Parameters:
##   gear_set: Dictionary mapping slot types to gear IDs or names
##
## Returns:
##   Dictionary: Synergy bonuses {"stat": value, ...}
func get_synergy_bonus(gear_set: Dictionary) -> Dictionary:
	var bonuses: Dictionary = {}

	for synergy_name in SYNERGY_GROUPS.keys():
		var synergy_data: Dictionary = SYNERGY_GROUPS[synergy_name]
		var pieces: Array = synergy_data["pieces"]
		var bonus_tiers: Dictionary = synergy_data["bonuses"]

		# Count how many pieces from this set are equipped
		var equipped_count: int = 0
		for gear_id in gear_set.values():
			if gear_id and pieces.has(gear_id):
				equipped_count += 1

		# Apply bonuses based on count
		for tier_count in bonus_tiers.keys():
			if equipped_count >= tier_count:
				var bonus: Dictionary = bonus_tiers[tier_count]
				var stat: String = bonus["stat"]
				var value: float = float(bonus["value"])

				if stat == "all":
					# Apply bonus to all stats
					bonuses["all_multiplier"] = max(bonuses.get("all_multiplier", 0.0), value / 100.0)
				else:
					# Stack with existing bonus
					bonuses[stat] = bonuses.get(stat, 0.0) + value

	return bonuses

## Calculates total effective stats with diminishing returns for all equipped gear.
##
## Parameters:
##   equipped_gear: Dictionary mapping slot names to gear data dictionaries
##
## Returns:
##   Dictionary: Effective stats after diminishing returns
func calculate_total_effective_stats(equipped_gear: Dictionary) -> Dictionary:
	var total_stats: Dictionary = {
		"attack": 0.0,
		"defense": 0.0,
		"health": 0.0,
		"speed": 0.0,
		"dodge": 0.0,
		"crit_rate": 0.0
	}

	# Get synergy bonuses
	var gear_set_ids: Dictionary = {}
	for slot in equipped_gear.keys():
		var gear_data: Dictionary = equipped_gear[slot]
		if not gear_data.is_empty():
			gear_set_ids[slot] = gear_data.get("base_gear_id", "")

	var synergy_bonuses: Dictionary = get_synergy_bonus(gear_set_ids)

	# Calculate effective stats per gear
	for slot in equipped_gear.keys():
		var gear_data: Dictionary = equipped_gear[slot]
		if gear_data.is_empty():
			continue

		var gear_type: String = gear_data.get("type", "")
		var all_multiplier: float = synergy_bonuses.get("all_multiplier", 0.0)

		# Get synergy bonus for this specific stat
		var stats: Dictionary = gear_data.get("stats", {})
		for stat_name in total_stats.keys():
			var stat_value: float = float(stats.get(stat_name, 0.0))
			var stat_synergy_bonus: float = float(synergy_bonuses.get(stat_name, 0.0)) / 100.0

			# Calculate effective stat with diminishing returns
			var synergy: float = stat_synergy_bonus + all_multiplier
			var effective: float = calculate_effective_stat(stat_value, synergy, gear_type, stat_name)
			total_stats[stat_name] += effective

	return total_stats

## Gets the maximum allowed stat value for a gear type.
## Private helper function.
##
## Parameters:
##   gear_type: Type of gear (helm, armor, bow, etc.)
##   stat_name: Name of the stat
##
## Returns:
##   float: Maximum stat value allowed
func _get_max_stat_for_type(gear_type: String, stat_name: String) -> float:
	return MAX_STATS.get(gear_type, {}).get(stat_name, 100.0)

## Formats power rating for UI display.
##
## Parameters:
##   power_rating: The power rating value (0-100)
##
## Returns:
##   String: Formatted rating with color indicator
func format_power_rating(power_rating: float) -> String:
	var color: String = ""
	var rating_int: int = int(power_rating)

	if rating_int < 20:
		color = "#FFFFFF"  # White for low power
	elif rating_int < 40:
		color = "#00FF00"  # Green for medium power
	elif rating_int < 60:
		color = "#0080FF"  # Blue for high power
	elif rating_int < 80:
		color = "#9B30FF"  # Purple for epic power
	else:
		color = "#FFA500"  # Orange for legendary power

	return "[color=%s]%d[/color]" % [color, rating_int]
