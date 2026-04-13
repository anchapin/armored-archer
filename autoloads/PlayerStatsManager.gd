## Manages player statistics including XP, levels, and stat allocation.
## Handles communication with server for stats-related operations.
##
## Signals:
## - stats_updated(stats: Dictionary): Emitted when player stats change
## - level_up(new_level: int, ability_points_gained: int): Emitted when player levels up
## - xp_gained(amount: int, total_xp: int): Emitted when XP is gained
## - stat_allocated(stat_name: String, amount: int): Emitted when stats are allocated
##
extends Node

# --- References ---
var analytics: Node
var network_manager: Node

# --- RPC IDs ---
const RPC_GAIN_XP = "armored_archer/gain_xp"
const RPC_ALLOCATE_STATS = "armored_archer/allocate_stats"
const RPC_GET_PLAYER_STATS = "armored_archer/get_player_stats"
const RPC_RESPEC_STATS = "armored_archer/respec_stats"
const RPC_SAVE_BUILD = "armored_archer/save_build"
const RPC_LOAD_BUILD = "armored_archer/load_build"
const RPC_GET_BUILDS = "armored_archer/get_builds"

# --- Player Stats ---
var player_stats: Dictionary = {}
var is_initialized: bool = false

# --- Signals ---
signal stats_updated(stats: Dictionary)
signal level_up(new_level: int, ability_points_gained: int)
signal xp_gained(amount: int, total_xp: int)
signal stat_allocated(stat_name: String, amount: int)
signal stats_respec(new_stats: Dictionary, cost_paid: int)
signal build_saved(build_slot: int, build_data: Dictionary)
signal build_loaded(build_slot: int, build_data: Dictionary)

# --- Initialization ---
func _ready() -> void:
	"""Sets up signal connections on initialization."""
	if network_manager:
		network_manager.connection_status_changed.connect(_on_connection_status_changed)

func _on_connection_status_changed(is_online: bool) -> void:
	"""Fetches player stats when network connection is established."""
	if is_online:
		await get_player_stats()

# --- Public API ---
func get_player_stats() -> Dictionary:
	"""Retrieves player statistics from the server.

	Returns:
		Dictionary: Player stats data or empty dict on failure
	"""
	if not network_manager or not network_manager.is_connected:
		push_error("Not connected to server")
		return {}

	var payload = JSON.stringify({})
	var response = await network_manager.send_rpc(RPC_GET_PLAYER_STATS, payload)

	if response.has("error"):
		push_error("Failed to get player stats: %s" % response.error)
		# Check if this is an auth error - if so, we may need to reconnect
		if response.get("is_auth_error", false):
			push_error("Authentication error - session may be invalid")
		return {}

	player_stats = response  # Response is already a Dictionary from send_rpc
	is_initialized = true

	stats_updated.emit(player_stats)

	return player_stats

func gain_xp(amount: int, source: String) -> void:
	"""Requests XP gain from the server.

	Parameters:
		amount: Amount of XP to gain (must be positive)
		source: Source of XP gain ("pve" or "pvp")
	"""
	if not network_manager or not network_manager.is_connected:
		push_error("Not connected to server")
		return

	if amount <= 0:
		push_error("Invalid XP amount")
		return

	var payload = JSON.stringify({
		"xp_amount": amount,
		"source": source
	})

	var response = await network_manager.send_rpc(RPC_GAIN_XP, payload)

	if response.has("error"):
		push_error("Failed to gain XP: %s" % response.error)
		return

	var result = response  # Response is already a Dictionary from send_rpc

	if result.get("success", false):
		var amount_gained: int = result.get("xp_gained", 0)
		var levels_gained: int = result.get("levels_gained", 0)
		var previous_level: int = player_stats.get("level", 1)

		xp_gained.emit(amount_gained, player_stats.get("xp", 0))

		if levels_gained > 0:
			var new_level: int = result.player_stats.level
			var ability_points_gained: int = levels_gained
			level_up.emit(new_level, ability_points_gained)

			# Track level up in analytics using dedicated method
			if analytics and analytics.has_method("log_level_up"):
				analytics.log_level_up(new_level, previous_level, source)

		player_stats = result.player_stats
		stats_updated.emit(player_stats)

		# Track XP gain in analytics
		if analytics and analytics.has_method("log_custom_event"):
			analytics.log_custom_event("xp_gained", {
				"amount": amount_gained,
				"total_xp": player_stats.get("xp", 0),
				"level": player_stats.get("level", 1),
				"source": source
			})

func allocate_stat(stat_name: String, points: int) -> void:
	"""Allocates ability points to a specific stat.

	Parameters:
		stat_name: Name of the stat to allocate points to
		points: Number of points to allocate (must be positive)
	"""
	if not network_manager or not network_manager.is_connected:
		push_error("Not connected to server")
		return

	if points <= 0:
		push_error("Invalid points amount")
		return

	var payload = JSON.stringify({
		"stat_name": stat_name,
		"points": points
	})

	var response = await network_manager.send_rpc(RPC_ALLOCATE_STATS, payload)

	if response.has("error"):
		push_error("Failed to allocate stat: %s" % response.error)
		return

	var result = response  # Response is already a Dictionary from send_rpc

	if result.get("success", false):
		stat_allocated.emit(stat_name, points)
		player_stats = result.player_stats
		stats_updated.emit(player_stats)

		# Track stat allocation in analytics
		if analytics and analytics.has_method("log_custom_event"):
			analytics.log_custom_event("stat_allocated", {
				"stat_name": stat_name,
				"points": points,
				"level": player_stats.get("level", 1)
			})

# --- Getters ---
func get_level() -> int:
	"""Returns the current player level.

	Returns:
		int: Current level (minimum 1)
	"""
	return player_stats.get("level", 1)

func get_xp() -> int:
	"""Returns current XP.

	Returns:
		int: Current XP amount
	"""
	return player_stats.get("xp", 0)

func get_ability_points() -> int:
	"""Returns available unallocated ability points.

	Returns:
		int: Number of available points
	"""
	return player_stats.get("ability_points", 0)

func get_stat(stat_name: String) -> int:
	"""Gets the value of a specific stat.

	Parameters:
		stat_name: Name of the stat to retrieve

	Returns:
		int: Current value of the stat (0 if not found)
	"""
	if player_stats.has("stats") and player_stats.stats.has(stat_name):
		return player_stats.stats[stat_name]
	return 0

func get_attack() -> int:
	"""Returns the attack stat value.

	Returns:
		int: Attack value
	"""
	return get_stat("attack")

func get_defense() -> int:
	"""Returns the defense stat value.

	Returns:
		int: Defense value
	"""
	return get_stat("defense")

func get_dodge() -> int:
	"""Returns the dodge stat value.

	Returns:
		int: Dodge value
	"""
	return get_stat("dodge")

func get_crit_rate() -> int:
	"""Returns the critical hit rate stat value.

	Returns:
		int: Critical hit rate percentage
	"""
	return get_stat("crit_rate")

# --- Respec System ---
func respec_stats(new_allocation: Dictionary, use_free_respec: bool = false) -> void:
	"""Respecs player stats with gem cost.

	Parameters:
		new_allocation: New stat allocation {attack: int, defense: int, dodge: int, crit_rate: int}
		use_free_respec: If true, uses free respec if available
	"""
	if not network_manager or not network_manager.is_connected:
		push_error("Not connected to server")
		return

	var payload = JSON.stringify({
		"new_allocation": new_allocation,
		"use_free_respec": use_free_respec
	})

	var response = await network_manager.send_rpc(RPC_RESPEC_STATS, payload)

	if response.has("error"):
		push_error("Failed to respec stats: %s" % response.error)
		return

	var result = response  # Response is already a Dictionary from send_rpc

	if result.get("success", false):
		var cost_paid: int = result.get("cost_paid", 0)
		player_stats = result.player_stats
		stats_updated.emit(player_stats)
		stats_respec.emit(new_allocation, cost_paid)

		# Track respec in analytics
		if analytics and analytics.has_method("log_custom_event"):
			analytics.log_custom_event("stats_respec", {
				"cost_paid": cost_paid,
				"used_free_respec": use_free_respec,
				"level": player_stats.get("level", 1)
			})

# --- Build Save/Load System ---
func save_build(build_slot: int, build_name: String) -> void:
	"""Saves current stat allocation to a build slot.

	Parameters:
		build_slot: Slot number (1-3)
		build_name: Display name for the build
	"""
	if not network_manager or not network_manager.is_connected:
		push_error("Not connected to server")
		return

	var current_stats: Dictionary = player_stats.get("stats", {}).duplicate()
	var current_level: int = player_stats.get("level", 1)

	var payload = JSON.stringify({
		"build_slot": build_slot,
		"build_name": build_name,
		"stats": current_stats,
		"level": current_level
	})

	var response = await network_manager.send_rpc(RPC_SAVE_BUILD, payload)

	if response.has("error"):
		push_error("Failed to save build: %s" % response.error)
		return

	var result = response  # Response is already a Dictionary from send_rpc

	if result.get("success", false):
		var build_data: Dictionary = result.get("build_data", {})
		build_saved.emit(build_slot, build_data)

		# Track build save in analytics
		if analytics and analytics.has_method("log_custom_event"):
			analytics.log_custom_event("build_saved", {
				"build_slot": build_slot,
				"build_name": build_name,
				"level": current_level
			})

func load_build(build_slot: int) -> void:
	"""Loads stat allocation from a build slot.

	Parameters:
		build_slot: Slot number (1-3)
	"""
	if not network_manager or not network_manager.is_connected:
		push_error("Not connected to server")
		return

	var payload = JSON.stringify({
		"build_slot": build_slot
	})

	var response = await network_manager.send_rpc(RPC_LOAD_BUILD, payload)

	if response.has("error"):
		push_error("Failed to load build: %s" % response.error)
		return

	var result = response  # Response is already a Dictionary from send_rpc

	if result.get("success", false):
		var build_data: Dictionary = result.get("build_data", {})
		build_loaded.emit(build_slot, build_data)

		# Track build load in analytics
		if analytics and analytics.has_method("log_custom_event"):
			analytics.log_custom_event("build_loaded", {
				"build_slot": build_slot,
				"build_name": build_data.get("name", "Unknown")
			})

func get_builds() -> void:
	"""Retrieves all saved builds from server."""
	if not network_manager or not network_manager.is_connected:
		push_error("Not connected to server")
		return

	var payload = JSON.stringify({})

	var response = await network_manager.send_rpc(RPC_GET_BUILDS, payload)

	if response.has("error"):
		push_error("Failed to get builds: %s" % response.error)
		return

	var result = response  # Response is already a Dictionary from send_rpc

	if result.get("success", false):
		var builds: Dictionary = result.get("builds", {})
		builds_updated.emit(builds)

# --- Build Update Signal ---
signal builds_updated(builds: Dictionary)
