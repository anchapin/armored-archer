## Manages gear inventory, equipment slots, and gear generation.
## Handles server communication for gear-related operations and provides gear statistics.
##
## Signals:
## - gear_generated(gear_data: Dictionary): Emitted when new gear is created
## - gear_equipped(slot: String, gear_id: String): Emitted when gear is equipped
## - gear_unequipped(slot: String): Emitted when gear is removed from a slot
## - inventory_updated(inventory: Dictionary): Emitted when inventory data changes
##
extends Node

signal gear_generated(gear_data: Dictionary)
signal gear_equipped(slot: String, gear_id: String)
signal gear_unequipped(slot: String)
signal inventory_updated(inventory: Dictionary)

# Analytics reference
@onready var analytics: Node = get_node_or_null("/root/AnalyticsManager")

var network_manager: Node
var gear_balance_calculator: Node

var player_inventory: Dictionary = {}
var equipped_gear: Dictionary = {}
var unlocked_modifier_pools: Array = []

func _ready() -> void:
	"""Initializes network reference and loads inventory if session is valid."""
	network_manager = get_node_or_null("/root/NetworkManager")
	gear_balance_calculator = get_node_or_null("/root/GearBalanceCalculator")

func generate_gear(stage_id: String, boss_defeated: bool) -> void:
	"""Requests gear generation from the server after stage completion.

	Parameters:
		stage_id: ID of the completed stage
		boss_defeated: True if boss was defeated (better loot)
	"""
	if not network_manager or not network_manager.is_session_valid():
		push_error("Cannot generate gear: not connected to server")
		return

	var payload: Dictionary = {
		"stage_id": stage_id,
		"boss_defeated": boss_defeated
	}

	var json: JSON = JSON.new()
	var response: Dictionary = await network_manager.send_rpc("armored_archer/generate_gear", json.stringify(payload))

	if response.has("error"):
		push_error("Failed to generate gear: %s" % response.error)
		return

	if response.has("gear"):
		var gear_data: Dictionary = response.gear
		player_inventory.gear = response.get("inventory", {}).get("gear", player_inventory.get("gear", []))
		equipped_gear = response.get("inventory", {}).get("equipped_gear", equipped_gear)
		unlocked_modifier_pools = response.get("inventory", {}).get("unlocked_modifier_pools", unlocked_modifier_pools)
		gear_generated.emit(gear_data)
		inventory_updated.emit(_get_full_inventory())

		if analytics and analytics.has_method("log_gear_obtained"):
			var gear_id: String = gear_data.get("id", "")
			var gear_name: String = gear_data.get("name", "")
			var gear_type: String = gear_data.get("type", "")
			var rarity: String = gear_data.get("rarity", "common")
			var source: String = response.get("source", "stage_drop")
			analytics.log_gear_obtained(gear_id, gear_name, gear_type, rarity, source)

func equip_gear(gear_id: String, slot: String) -> void:
	"""Requests to equip gear to a specific slot.

	Parameters:
		gear_id: Unique identifier of the gear item
		slot: Equipment slot name (e.g., "helm", "armor", "bow", "arrow")
	"""
	if not network_manager or not network_manager.is_session_valid():
		push_error("Cannot equip gear: not connected to server")
		return

	var payload: Dictionary = {
		"gear_id": gear_id,
		"slot": slot
	}

	var json: JSON = JSON.new()
	var response: Dictionary = await network_manager.send_rpc("armored_archer/equip_gear", json.stringify(payload))

	if response.has("error"):
		push_error("Failed to equip gear: %s" % response.error)
		return

	if response.get("success", false):
		var old_equipped_gear: Dictionary = equipped_gear.duplicate()
		equipped_gear = response.get("equipped_gear", equipped_gear)
		if response.has("gear"):
			var equip_slot: String = response.gear.get("type", slot)
			var equip_gear_id: String = response.gear.get("id", gear_id)
			var gear_name: String = response.gear.get("name", "")
			gear_equipped.emit(equip_slot, equip_gear_id)

			if analytics and analytics.has_method("log_gear_equipped"):
				analytics.log_gear_equipped(equip_gear_id, gear_name, response.gear.get("type", ""), equip_slot)
		else:
			for old_slot in old_equipped_gear.keys():
				if not equipped_gear.has(old_slot) or equipped_gear[old_slot].is_empty():
					gear_unequipped.emit(old_slot)
		inventory_updated.emit(_get_full_inventory())

func unequip_gear(slot: String) -> void:
	"""Requests to unequip gear from a specific slot.

	Parameters:
		slot: Equipment slot to unequip
	"""
	if not network_manager or not network_manager.is_session_valid():
		push_error("Cannot unequip gear: not connected to server")
		return

	var payload: Dictionary = {
		"slot": slot
	}

	var json: JSON = JSON.new()
	var response: Dictionary = await network_manager.send_rpc("armored_archer/unequip_gear", json.stringify(payload))

	if response.has("error"):
		push_error("Failed to unequip gear: %s" % response.error)
		return

	if response.get("success", false):
		# Track gear unequipped in analytics before emitting signal
		var old_gear_id: String = old_equipped_gear.get(slot, "")
		if not old_gear_id.is_empty() and analytics and analytics.has_method("log_gear_unequipped"):
			var old_gear_data: Dictionary = get_gear_by_id(old_gear_id)
			if not old_gear_data.is_empty():
				analytics.log_gear_unequipped(
					old_gear_id,
					old_gear_data.get("name", ""),
					old_gear_data.get("type", ""),
					slot
				)
		equipped_gear = response.get("equipped_gear", equipped_gear)
		gear_unequipped.emit(slot)
		inventory_updated.emit(_get_full_inventory())

func _load_inventory() -> void:
	"""Loads player inventory from the server."""
	if not network_manager or not network_manager.is_session_valid():
		return

	var json: JSON = JSON.new()
	var response: Dictionary = await network_manager.send_rpc("armored_archer/get_inventory", json.stringify({}))

	if response.has("error"):
		push_error("Failed to load inventory: %s" % response.error)
		return

	player_inventory.gear = response.get("gear", [])
	equipped_gear = response.get("equipped_gear", {})
	unlocked_modifier_pools = response.get("unlocked_modifier_pools", [])
	inventory_updated.emit(_get_full_inventory())

func unlock_modifier_pool(modifier_id: String) -> void:
	"""Unlocks a modifier pool for gear generation.

	Parameters:
		modifier_id: Identifier of the modifier pool to unlock
	"""
	if not network_manager or not network_manager.is_session_valid():
		push_error("Cannot unlock modifier pool: not connected to server")
		return

	var payload: Dictionary = {
		"modifier_id": modifier_id
	}

	var json: JSON = JSON.new()
	var response: Dictionary = await network_manager.send_rpc("armored_archer/unlock_modifier_pool", json.stringify(payload))

	if response.has("error"):
		push_error("Failed to unlock modifier pool: %s" % response.error)
		return

	if response.get("success", false):
		unlocked_modifier_pools = response.get("unlocked_modifier_pools", unlocked_modifier_pools)
		inventory_updated.emit(_get_full_inventory())

func _get_full_inventory() -> Dictionary:
	"""Returns complete inventory state including equipped gear.

	Returns:
		Dictionary: Full inventory data structure
	"""
	return {
		"gear": player_inventory.get("gear", []),
		"equipped_gear": equipped_gear,
		"unlocked_modifier_pools": unlocked_modifier_pools
	}

func get_full_inventory() -> Dictionary:
	"""Public method to get the full inventory state.

	Returns:
		Dictionary: Full inventory data structure including gear, equipped gear, and unlocked modifier pools
	"""
	return _get_full_inventory()

func get_gear_by_id(gear_id: String) -> Dictionary:
	"""Retrieves gear data by ID.

	Parameters:
		gear_id: Unique identifier of the gear

	Returns:
		Dictionary: Gear data or empty dict if not found
	"""
	for gear in player_inventory.get("gear", []):
		if gear.id == gear_id:
			return gear
	return {}

func get_equipped_gear(slot: String) -> Dictionary:
	"""Gets the gear equipped in the specified slot.

	Parameters:
		slot: Equipment slot name

	Returns:
		Dictionary: Equipped gear data or empty dict if slot is empty
	"""
	if equipped_gear.has(slot):
		return get_gear_by_id(equipped_gear[slot])
	return {}

func get_gear_stats_summary(gear_data: Dictionary) -> String:
	"""Generates a formatted string showing gear statistics.

	Parameters:
		gear_data: Gear item dictionary

	Returns:
		String: Formatted stats summary with color coding
	"""
	var summary: String = ""
	var rarity_colors: Dictionary = {
		"common": "#FFFFFF",
		"rare": "#00FF00",
		"epic": "#9B30FF",
		"legendary": "#FFA500"
	}

	var rarity: String = gear_data.get("rarity", "common")
	var color: String = rarity_colors.get(rarity, "#FFFFFF")

	summary += "[color=%s][b]%s[/b][/color] (%s)\n" % [color, gear_data.get("name", ""), rarity.capitalize()]

	# Add power rating
	if gear_balance_calculator and gear_balance_calculator.has_method("get_gear_power_rating"):
		var power: float = gear_balance_calculator.get_gear_power_rating(gear_data)
		summary += "Power: %s\n" % gear_balance_calculator.format_power_rating(power)

	for stat in gear_data.get("stats", []):
		summary += "%s: %d\n" % [stat.name, stat.value]

	for modifier in gear_data.get("modifiers", []):
		summary += "[i]%s[/i]: %s\n" % [modifier.name, modifier.description]

	return summary

func compare_gear(gear1: Dictionary, gear2: Dictionary) -> Dictionary:
	"""Compares two gear items and determines which is better.

	Parameters:
		gear1: First gear item to compare
		gear2: Second gear item to compare

	Returns:
		Dictionary: Comparison result with "better" ("gear1", "gear2", or "equal") and "differences" array
	"""
	var comparison: Dictionary = {
		"better": null,
		"differences": []
	}

	var score1: int = _calculate_gear_score(gear1)
	var score2: int = _calculate_gear_score(gear2)

	if score1 > score2:
		comparison.better = "gear1"
	elif score2 > score1:
		comparison.better = "gear2"
	else:
		comparison.better = "equal"

	# Calculate stat differences
	var stats1: Dictionary = _get_stat_map(gear1.get("stats", []))
	var stats2: Dictionary = _get_stat_map(gear2.get("stats", []))

	# Get all unique stat names
	var all_stats_dict: Dictionary = {}
	for s in stats1.keys():
		all_stats_dict[s] = true
	for s in stats2.keys():
		all_stats_dict[s] = true
	var all_stats: Array = all_stats_dict.keys()

	for stat_name in all_stats:
		var val1: int = stats1.get(stat_name, 0)
		var val2: int = stats2.get(stat_name, 0)
		var diff: int = val1 - val2

		comparison.differences.append({
			"stat": stat_name,
			"gear1_value": val1,
			"gear2_value": val2,
			"difference": diff,
			"better": "gear1" if diff > 0 else ("gear2" if diff < 0 else "equal")
		})

	return comparison

func _get_stat_map(stats: Array) -> Dictionary:
	"""Converts an array of stats to a dictionary for easier comparison.

	Parameters:
		stats: Array of stat dictionaries

	Returns:
		Dictionary mapping stat names to values
	"""
	var result: Dictionary = {}
	for stat in stats:
		var stat_name: String = stat.get("name", "")
		var value: int = stat.get("value", 0)
		result[stat_name] = value
	return result

func _calculate_gear_score(gear_data: Dictionary) -> int:
	"""Calculates a numeric score for gear comparison (internal).

	Parameters:
		gear_data: Gear item to score

	Returns:
		int: Calculated score based on rarity and stats
	"""
	var score: int = 0

	var rarity_multipliers: Dictionary = {
		"common": 1,
		"rare": 2,
		"epic": 3,
		"legendary": 4
	}

	var rarity: String = gear_data.get("rarity", "common")
	var rarity_mult: int = rarity_multipliers.get(rarity, 1)

	for stat in gear_data.get("stats", []):
		score += stat.value * rarity_mult

	for modifier in gear_data.get("modifiers", []):
		var modifier_value: int = (modifier.value_range[0] + modifier.value_range[1]) / 2
		score += modifier_value * 2

	return score

func get_total_equipped_stats() -> Dictionary:
	"""Calculates total stats from all equipped gear with diminishing returns.

	Returns:
		Dictionary: Total effective stats from equipped gear (attack, defense, health, dodge, crit_rate)
	"""
	var total_stats: Dictionary = {
		"attack": 0,
		"defense": 0,
		"health": 0,
		"dodge": 0,
		"crit_rate": 0
	}

	# Build equipped gear dictionary for synergy calculation
	var equipped_gear_data: Dictionary = {}
	for slot in equipped_gear.keys():
		var gear_id: String = equipped_gear[slot]
		if not gear_id.is_empty():
			var gear_data: Dictionary = get_gear_by_id(gear_id)
			if not gear_data.is_empty():
				equipped_gear_data[slot] = gear_data

	# If we have the balance calculator, use it for proper diminishing returns
	if gear_balance_calculator and gear_balance_calculator.has_method("calculate_total_effective_stats"):
		var effective_stats: Dictionary = gear_balance_calculator.calculate_total_effective_stats(equipped_gear_data)
		return effective_stats

	# Fallback: simple summation without diminishing returns
	for gear_data in equipped_gear_data.values():
		for stat in gear_data.get("stats", []):
			var stat_name: String = stat.get("name", "")
			var stat_value: int = stat.get("value", 0)

			if total_stats.has(stat_name):
				total_stats[stat_name] += stat_value

	return total_stats

func get_equipped_gear_data() -> Dictionary:
	"""Returns all equipped gear data as a dictionary for balance calculations.

	Returns:
		Dictionary: Mapping of slot names to gear data dictionaries
	"""
	var result: Dictionary = {}
	for slot in equipped_gear.keys():
		var gear_id: String = equipped_gear[slot]
		if not gear_id.is_empty():
			var gear_data: Dictionary = get_gear_by_id(gear_id)
			if not gear_data.is_empty():
				result[slot] = gear_data
	return result

func get_synergy_bonuses() -> Dictionary:
	"""Gets current synergy bonuses from equipped gear.

	Returns:
		Dictionary: Synergy bonuses by stat name
	"""
	if not gear_balance_calculator or not gear_balance_calculator.has_method("get_synergy_bonus"):
		return {}

	var gear_set_ids: Dictionary = {}
	for slot in equipped_gear.keys():
		var gear_id: String = equipped_gear[slot]
		if not gear_id.is_empty():
			var gear_data: Dictionary = get_gear_by_id(gear_id)
			if not gear_data.is_empty():
				gear_set_ids[slot] = gear_data.get("base_gear_id", "")

	return gear_balance_calculator.get_synergy_bonus(gear_set_ids)
