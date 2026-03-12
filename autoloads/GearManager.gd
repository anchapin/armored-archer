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

var http_request: HTTPRequest
var network_manager: NetworkManager

var player_inventory: Dictionary = {}
var equipped_gear: Dictionary = {}
var unlocked_modifier_pools: Array = []

func _ready() -> void:
	"""Initializes HTTP request and loads inventory if session is valid."""
	network_manager = get_node_or_null("/root/NetworkManager")

	http_request = HTTPRequest.new()
	add_child(http_request)
	http_request.request_completed.connect(_on_http_request_completed)

	if network_manager and network_manager.is_session_valid():
		_load_inventory()

func generate_gear(stage_id: String, boss_defeated: bool) -> void:
	"""Requests gear generation from the server after stage completion.

	Parameters:
		stage_id: ID of the completed stage
		boss_defeated: True if boss was defeated (better loot)
	"""
	if not network_manager or not network_manager.is_session_valid():
		push_error("Cannot generate gear: not connected to server")
		return

	var url: String = "%s/v2/rpc/armored_archer/generate_gear" % network_manager.base_url
	var headers: PackedStringArray = network_manager.get_auth_headers()

	var body: Dictionary = {
		"stage_id": stage_id,
		"boss_defeated": boss_defeated
	}

	var json: JSON = JSON.new()
	var json_string: String = json.stringify(body)

	var error: Error = http_request.request(url, headers, HTTPClient.METHOD_POST, json_string)
	if error != OK:
		push_error("Failed to generate gear request")

func equip_gear(gear_id: String, slot: String) -> void:
	"""Requests to equip gear to a specific slot.

	Parameters:
		gear_id: Unique identifier of the gear item
		slot: Equipment slot name (e.g., "helm", "armor", "bow", "arrow")
	"""
	if not network_manager or not network_manager.is_session_valid():
		push_error("Cannot equip gear: not connected to server")
		return

	var url: String = "%s/v2/rpc/armored_archer/equip_gear" % network_manager.base_url
	var headers: PackedStringArray = network_manager.get_auth_headers()

	var body: Dictionary = {
		"gear_id": gear_id,
		"slot": slot
	}

	var json: JSON = JSON.new()
	var json_string: String = json.stringify(body)

	var error: Error = http_request.request(url, headers, HTTPClient.METHOD_POST, json_string)
	if error != OK:
		push_error("Failed to equip gear request")

func unequip_gear(slot: String) -> void:
	"""Requests to unequip gear from a specific slot.

	Parameters:
		slot: Equipment slot to unequip
	"""
	if not network_manager or not network_manager.is_session_valid():
		push_error("Cannot unequip gear: not connected to server")
		return

	var url: String = "%s/v2/rpc/armored_archer/unequip_gear" % network_manager.base_url
	var headers: PackedStringArray = network_manager.get_auth_headers()

	var body: Dictionary = {
		"slot": slot
	}

	var json: JSON = JSON.new()
	var json_string: String = json.stringify(body)

	var error: Error = http_request.request(url, headers, HTTPClient.METHOD_POST, json_string)
	if error != OK:
		push_error("Failed to unequip gear request")

func _load_inventory() -> void:
	"""Loads player inventory from the server."""
	if not network_manager or not network_manager.is_session_valid():
		return

	var url: String = "%s/v2/rpc/armored_archer/get_inventory" % network_manager.base_url
	var headers: PackedStringArray = network_manager.get_auth_headers()

	var error: Error = http_request.request(url, headers, HTTPClient.METHOD_POST, "{}")
	if error != OK:
		push_error("Failed to load inventory")

func unlock_modifier_pool(modifier_id: String) -> void:
	"""Unlocks a modifier pool for gear generation.

	Parameters:
		modifier_id: Identifier of the modifier pool to unlock
	"""
	if not network_manager or not network_manager.is_session_valid():
		push_error("Cannot unlock modifier pool: not connected to server")
		return

	var url: String = "%s/v2/rpc/armored_archer/unlock_modifier_pool" % network_manager.base_url
	var headers: PackedStringArray = network_manager.get_auth_headers()

	var body: Dictionary = {
		"modifier_id": modifier_id
	}

	var json: JSON = JSON.new()
	var json_string: String = json.stringify(body)

	var error: Error = http_request.request(url, headers, HTTPClient.METHOD_POST, json_string)
	if error != OK:
		push_error("Failed to unlock modifier pool request")

func _on_http_request_completed(_result: int, response_code: int, _headers: PackedStringArray, body: PackedByteArray) -> void:
	"""Handles HTTP responses for gear-related requests."""
	var response_text: String = body.get_string_from_utf8()

	if response_code >= 200 and response_code < 300:
		var json: JSON = JSON.new()
		var parse_result: Error = json.parse(response_text)

		if parse_result == OK:
			var response_data: Dictionary = json.data

			if response_data.has("payload"):
				var payload_string: String = response_data.payload
				var payload_json: JSON = JSON.new()
				if payload_json.parse(payload_string) == OK:
					var payload: Dictionary = payload_json.data
					_process_payload(payload, response_data)
			else:
				_process_payload(response_data, response_data)
	else:
		push_error("Gear system request failed with code: %d" % response_code)

func _process_payload(payload: Dictionary, _response_data: Dictionary) -> void:
	"""Processes server response payload and emits appropriate signals."""
	if payload.has("gear"):
		var gear_data: Dictionary = payload.gear
		player_inventory.gear = payload.inventory.gear
		equipped_gear = payload.inventory.equipped_gear
		unlocked_modifier_pools = payload.inventory.get("unlocked_modifier_pools", [])
		gear_generated.emit(gear_data)
		inventory_updated.emit(_get_full_inventory())

	if payload.has("success") and payload.success:
		if payload.has("equipped_gear"):
			equipped_gear = payload.equipped_gear
			if payload.has("gear"):
				var slot: String = payload.gear.type
				var gear_id: String = payload.gear.id
				gear_equipped.emit(slot, gear_id)
			inventory_updated.emit(_get_full_inventory())

		if payload.has("unlocked_modifier_pools"):
			unlocked_modifier_pools = payload.unlocked_modifier_pools
			inventory_updated.emit(_get_full_inventory())

	if payload.has("gear"):
		player_inventory.gear = payload.gear
		equipped_gear = payload.get("equipped_gear", {})
		unlocked_modifier_pools = payload.get("unlocked_modifier_pools", [])
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
		"rare": "#0070DD",
		"legendary": "#FF8000"
	}

	var rarity: String = gear_data.get("rarity", "common")
	var color: String = rarity_colors.get(rarity, "#FFFFFF")

	summary += "[color=%s][b]%s[/b][/color] (%s)\n" % [color, gear_data.get("name", ""), rarity.capitalize()]

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
	var all_stats: Array = []
	all_stats.append_array(stats1.keys())
	all_stats.append_array(stats2.keys())
	all_stats = all_stats.unique()

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
		var name: String = stat.get("name", "")
		var value: int = stat.get("value", 0)
		result[name] = value
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
	"""Calculates total stats from all equipped gear.

	Returns:
		Dictionary: Total stats from equipped gear (attack, defense, health, dodge, crit_rate)
	"""
	var total_stats: Dictionary = {
		"attack": 0,
		"defense": 0,
		"health": 0,
		"dodge": 0,
		"crit_rate": 0
	}

	for slot in equipped_gear.keys():
		var gear_id: String = equipped_gear[slot]
		if gear_id.is_empty():
			continue

		var gear_data: Dictionary = get_gear_by_id(gear_id)
		if gear_data.is_empty():
			continue

		for stat in gear_data.get("stats", []):
			var stat_name: String = stat.get("name", "")
			var stat_value: int = stat.get("value", 0)

			if total_stats.has(stat_name):
				total_stats[stat_name] += stat_value

	return total_stats
