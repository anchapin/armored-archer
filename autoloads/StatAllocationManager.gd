## Manages stat allocation system including respec costs, build save/load, and validation.
## Handles stat redistribution with gem costs and provides build slot management.
##
## Signals:
## - respec_completed(new_stats: Dictionary, cost_paid: int): Emitted when respec completes
## - build_saved(build_slot: int, build_data: Dictionary): Emitted when build is saved
## - build_loaded(build_slot: int, build_data: Dictionary): Emitted when build is loaded
## - respec_cooldown_remaining(seconds: int): Emitted with cooldown time remaining
##
extends Node

# --- References ---
var network_manager: Node
var store_manager: Node
var player_stats_manager: Node
var season_manager: Node

# --- RPC IDs ---
const RPC_GET_RESPEC_COST = "armored_archer/get_respec_cost"
const RPC_RESPEC_STATS = "armored_archer/respec_stats"
const RPC_SAVE_BUILD = "armored_archer/save_build"
const RPC_LOAD_BUILD = "armored_archer/load_build"
const RPC_GET_BUILDS = "armored_archer/get_builds"

# --- Respec Configuration ---
const RESPEC_COST_PERCENT: float = 0.05  # 5% of current gems
const RESPEC_MIN_COST: int = 100  # Minimum gem cost
const RESPEC_MAX_COST: int = 1000  # Maximum gem cost
const RESPEC_COOLDOWN_SECONDS: int = 86400  # 24 hours in seconds
const FREE_RESPEC_PER_SEASON: int = 1

# --- Build Slots Configuration ---
const MAX_BUILD_SLOTS: int = 3  # Number of build slots per player

# --- Respec State ---
var last_respec_time: int = 0  # Unix timestamp of last respec
var free_respecs_used_this_season: int = 0
var current_season_id: String = ""

# --- Build Storage ---
var saved_builds: Dictionary = {}  # {slot: {name: String, stats: Dictionary, timestamp: int}}

# --- Signals ---
signal respec_completed(new_stats: Dictionary, cost_paid: int)
signal build_saved(build_slot: int, build_data: Dictionary)
signal build_loaded(build_slot: int, build_data: Dictionary)
signal respec_cooldown_remaining(seconds: int)
signal builds_updated(builds: Dictionary)

# --- Initialization ---
func _ready() -> void:
	"""Sets up manager references and loads saved data."""
	network_manager = get_node_or_null("/root/NetworkManager")
	store_manager = get_node_or_null("/root/StoreManager")
	player_stats_manager = get_node_or_null("/root/PlayerStatsManager")
	season_manager = get_node_or_null("/root/SeasonManager")

	load_data()

	if OS.get_environment("E2E_TEST") == "1":
		return

	if season_manager:
		season_manager.season_info_loaded.connect(_on_season_info_loaded)
		if season_manager.season_info_loaded.is_connected(_on_season_info_loaded):
			season_manager.get_season_info()

# --- Public API ---

func get_respec_cost(use_free_respec: bool = false) -> int:
	"""Calculates the current respec cost in gems.

	Parameters:
		use_free_respec: If true, checks if free respec is available

	Returns:
		int: Cost in gems (0 if free respec available)
	"""
	if use_free_respec and has_free_respec():
		return 0

	var gem_balance: int = 0
	if store_manager:
		gem_balance = store_manager.get_gems()

	# Calculate 5% of current gems
	var calculated_cost: int = int(gem_balance * RESPEC_COST_PERCENT)

	# Clamp between min and max
	return clamp(calculated_cost, RESPEC_MIN_COST, RESPEC_MAX_COST)

func has_free_respec() -> bool:
	"""Checks if player has a free respec available this season.

	Returns:
		bool: True if free respec available
	"""
	return free_respecs_used_this_season < FREE_RESPEC_PER_SEASON

func get_respec_cooldown_remaining() -> int:
	"""Gets remaining cooldown time in seconds.

	Returns:
		int: Seconds remaining (0 if no cooldown)
	"""
	var current_time: int = int(Time.get_unix_time_from_system())
	var time_since_respec: int = current_time - last_respec_time
	var remaining: int = RESPEC_COOLDOWN_SECONDS - time_since_respec
	return max(0, remaining)

func is_respec_on_cooldown() -> bool:
	"""Checks if respec is currently on cooldown.

	Returns:
		bool: True if on cooldown
	"""
	return get_respec_cooldown_remaining() > 0

func validate_allocation(new_allocation: Dictionary) -> Dictionary:
	"""Validates a stat allocation against available points.

	Parameters:
		new_allocation: Dictionary with stat names and values
			{attack: int, defense: int, dodge: int, crit_rate: int}

	Returns:
		Dictionary: {valid: bool, error: String, total_points: int}
	"""
	var result: Dictionary = {"valid": false, "error": "", "total_points": 0}

	var valid_stats: Array = ["attack", "defense", "dodge", "crit_rate"]
	var total_points: int = 0

	# Validate all stats are valid
	for stat_name in new_allocation:
		if not stat_name in valid_stats:
			result.error = "Invalid stat name: %s" % stat_name
			return result

		var value: int = int(new_allocation[stat_name])
		if value < 0:
			result.error = "Stat value cannot be negative: %s" % stat_name
			return result

		total_points += value

	result.total_points = total_points

	# Check against available points
	var available_points: int = 0
	if player_stats_manager:
		available_points = player_stats_manager.get_ability_points()

	var total_spent_points: int = 0
	if player_stats_manager:
		var current_stats: Dictionary = player_stats_manager.player_stats.get("stats", {})
		for stat_name in valid_stats:
			total_spent_points += current_stats.get(stat_name, 0)

	# Total points should equal previously spent plus available
	var total_allowed: int = total_spent_points + available_points
	if total_points != total_allowed:
		result.error = "Invalid allocation: %d points spent, %d points available" % [total_points, total_allowed]
		return result

	result.valid = true
	return result

func save_build(build_slot: int, build_name: String) -> void:
	"""Saves current stat allocation to a build slot.

	Parameters:
		build_slot: Slot number (1-3)
		build_name: Display name for the build
	"""
	if build_slot < 1 or build_slot > MAX_BUILD_SLOTS:
		push_error("Invalid build slot: %d (must be 1-%d)" % [build_slot, MAX_BUILD_SLOTS])
		return

	if not player_stats_manager:
		push_error("PlayerStatsManager not available")
		return

	var current_stats: Dictionary = player_stats_manager.player_stats.get("stats", {}).duplicate()
	var current_level: int = player_stats_manager.get_level()

	var build_data: Dictionary = {
		"name": build_name,
		"stats": current_stats,
		"level": current_level,
		"timestamp": int(Time.get_unix_time_from_system())
	}

	saved_builds[build_slot] = build_data
	build_saved.emit(build_slot, build_data)
	builds_updated.emit(saved_builds)

	save_data()

func load_build(build_slot: int) -> void:
	"""Loads stat allocation from a build slot.

	Parameters:
		build_slot: Slot number (1-3)
	"""
	if build_slot < 1 or build_slot > MAX_BUILD_SLOTS:
		push_error("Invalid build slot: %d (must be 1-%d)" % [build_slot, MAX_BUILD_SLOTS])
		return

	if not saved_builds.has(build_slot):
		push_error("No build saved in slot %d" % build_slot)
		return

	var build_data: Dictionary = saved_builds[build_slot]
	build_loaded.emit(build_slot, build_data)

func get_build(build_slot: int) -> Dictionary:
	"""Gets build data from a slot.

	Parameters:
		build_slot: Slot number (1-3)

	Returns:
		Dictionary: Build data or empty dict if not found
	"""
	if build_slot < 1 or build_slot > MAX_BUILD_SLOTS:
		push_error("Invalid build slot: %d (must be 1-%d)" % [build_slot, MAX_BUILD_SLOTS])
		return {}

	return saved_builds.get(build_slot, {})

func get_all_builds() -> Dictionary:
	"""Gets all saved builds.

	Returns:
		Dictionary: All saved builds keyed by slot number
	"""
	return saved_builds.duplicate()

func delete_build(build_slot: int) -> void:
	"""Deletes a build from a slot.

	Parameters:
		build_slot: Slot number (1-3)
	"""
	if build_slot < 1 or build_slot > MAX_BUILD_SLOTS:
		push_error("Invalid build slot: %d (must be 1-%d)" % [build_slot, MAX_BUILD_SLOTS])
		return

	if saved_builds.has(build_slot):
		saved_builds.erase(build_slot)
		builds_updated.emit(saved_builds)
		save_data()

# --- Server-Side Respec (with validation) ---
func respec_stats_server_side(new_allocation: Dictionary) -> void:
	"""Requests stat respec from server with validation.

	Parameters:
		new_allocation: New stat allocation dictionary
	"""
	if not network_manager or not network_manager.is_connected:
		push_error("Not connected to server")
		return

	var validation: Dictionary = validate_allocation(new_allocation)
	if not validation.valid:
		push_error("Invalid allocation: %s" % validation.error)
		return

	if is_respec_on_cooldown():
		push_error("Respec is on cooldown. %d seconds remaining" % get_respec_cooldown_remaining())
		return

	var cost: int = get_respec_cost(has_free_respec())

	if cost > 0:
		var gem_balance: int = 0
		if store_manager:
			gem_balance = store_manager.get_gems()

		if gem_balance < cost:
			push_error("Not enough gems for respec. Cost: %d, Balance: %d" % [cost, gem_balance])
			return

	var payload = JSON.stringify({
		"new_allocation": new_allocation,
		"use_free_respec": has_free_respec(),
		"cost": cost
	})

	network_manager.send_rpc(RPC_RESPEC_STATS, payload)

# --- Save/Load Data ---
func save_data() -> void:
	"""Saves stat allocation data to disk."""
	var config = ConfigFile.new()

	config.set_value("respec", "last_respec_time", last_respec_time)
	config.set_value("respec", "free_respecs_used", free_respecs_used_this_season)
	config.set_value("respec", "current_season", current_season_id)

	# Save each build slot
	for slot in saved_builds:
		config.set_value("builds", "slot_%d" % slot, saved_builds[slot])

	var error = config.save("user://stat_allocation_data.save")
	if error != OK:
		push_error("Failed to save stat allocation data: %s" % error)

func load_data() -> void:
	"""Loads stat allocation data from disk."""
	var config = ConfigFile.new()
	var error = config.load("user://stat_allocation_data.save")

	if error == OK:
		last_respec_time = config.get_value("respec", "last_respec_time", 0)
		free_respecs_used_this_season = config.get_value("respec", "free_respecs_used", 0)
		current_season_id = config.get_value("respec", "current_season", "")

		# Load build slots
		saved_builds = {}
		for slot in range(1, MAX_BUILD_SLOTS + 1):
			var slot_key = "slot_%d" % slot
			if config.has_section_key("builds", slot_key):
				saved_builds[slot] = config.get_value("builds", slot_key, {})

		builds_updated.emit(saved_builds)
	else:
		initialize_default_data()

func initialize_default_data() -> void:
	"""Initializes with default empty data."""
	last_respec_time = 0
	free_respecs_used_this_season = 0
	current_season_id = ""
	saved_builds = {}
	save_data()

# --- Signal Handlers ---
func _on_season_info_loaded(season_info: Dictionary) -> void:
	"""Handles season info loaded, resets free respecs on new season."""
	var season = season_info.get("season", {})
	var new_season_id: String = str(season.get("id", ""))

	if new_season_id != current_season_id:
		# New season detected, reset free respecs
		current_season_id = new_season_id
		free_respecs_used_this_season = 0
		save_data()

# --- Utility ---
func format_cooldown_time(seconds: int) -> String:
	"""Formats cooldown time into human-readable string.

	Parameters:
		seconds: Time in seconds

	Returns:
		String: Formatted time string
	"""
	if seconds <= 0:
		return "Available"

	var hours: int = seconds / 3600
	var minutes: int = (seconds % 3600) / 60

	if hours > 0:
		return "%dh %dm" % [hours, minutes]
	else:
		return "%dm" % minutes
