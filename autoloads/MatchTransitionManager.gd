## Match Transition Manager autoload
##
## Handles transitioning player state from PvE combat to PvP matchmaking.
## Captures and stores player state to ensure progression carries between game modes.
##
## Signals:
## - pvp_state_stored(state: Dictionary): Emitted when PvP state is stored
## - pvp_state_cleared(): Emitted when stored PvP state is cleared

extends Node

# --- Signals ---
signal pvp_state_stored(state: Dictionary)
signal pvp_state_cleared()

# --- State ---
var _pending_pvp_state: Dictionary = {}
var _network_manager: Node
var _player_stats_manager: Node
var _gear_manager: Node

# --- Constants ---
const STORAGE_KEY: String = "pending_pvp_state"

## Initialize manager and dependencies
func _ready() -> void:
	_network_manager = get_node_or_null("/root/NetworkManager")
	_player_stats_manager = get_node_or_null("/root/PlayerStatsManager")
	_gear_manager = get_node_or_null("/root/GearManager")

	# Load any existing pending state from storage
	_load_from_storage()

## Store player state for transition to PvP
##
## Captures current player stats, health, level, XP, gear, and other progression data
## to be used when entering PvP matchmaking.
##
## @param post_pve_stats: Dictionary containing PvE end state (health, xp, level, etc.)
## @return: Boolean indicating success
func transition_to_pvp(post_pve_stats: Dictionary = {}) -> bool:
	print("MatchTransitionManager: Storing PvP state from post-PvE state")

	# Get current player stats
	var player_stats: Dictionary = {}
	if _player_stats_manager:
		player_stats = _player_stats_manager.get_player_stats_sync() if _player_stats_manager.has_method("get_player_stats_sync") else {}

	# Get current gear loadout
	var equipped_gear: Dictionary = {}
	if _gear_manager:
		equipped_gear = _gear_manager.get_equipped_gear_data() if _gear_manager.has_method("get_equipped_gear_data") else {}

	# Build comprehensive state dictionary
	_pending_pvp_state = {
		"timestamp": Time.get_unix_time_from_system(),
		"health": post_pve_stats.get("health", 100),
		"max_health": post_pve_stats.get("max_health", 100),
		"level": player_stats.get("level", 1),
		"xp": player_stats.get("xp", 0),
		"stats": player_stats.get("stats", {}),
		"equipped_gear": equipped_gear,
		"pve_encounter_id": post_pve_stats.get("encounter_id", ""),
		"pve_result": post_pve_stats.get("result", "unknown"),
	}

	# Store to persistent storage
	_save_to_storage()

	# Emit signal
	pvp_state_stored.emit(_pending_pvp_state)

	print("MatchTransitionManager: PvP state stored successfully: ", _pending_pvp_state)
	return true

## Get pending PvP state
##
## Returns the stored state for use in PvP matchmaking.
##
## @return: Dictionary containing pending PvP state, or empty dict if none exists
func get_pending_pvp_state() -> Dictionary:
	return _pending_pvp_state.duplicate(true)

## Get specific value from pending PvP state
##
## @param key: The key to retrieve (e.g., "health", "level", "equipped_gear")
## @return: The value associated with key, or default_value if not found
func get_pvp_state_value(key: String, default_value = null):
	return _pending_pvp_state.get(key, default_value)

## Check if there is a pending PvP state
##
## @return: Boolean indicating whether a state is stored
func has_pending_state() -> bool:
	return not _pending_pvp_state.is_empty()

## Clear pending PvP state
##
## Should be called after match completion to prevent stale state from being reused.
func clear_pending_state() -> void:
	print("MatchTransitionManager: Clearing pending PvP state")
	_pending_pvp_state.clear()

	# Clear from storage
	if _network_manager and _network_manager.has_method("get_storage_sync"):
		var storage = _network_manager.get_storage_sync()
		if storage and storage.has_method("erase"):
			storage.erase(STORAGE_KEY)

	# Emit signal
	pvp_state_cleared.emit()

## Refresh PvP state with current game state
##
## Updates the stored state with current in-game values without requiring a full transition.
## Useful for refreshing state during long PvE sessions.
##
## @return: Boolean indicating success
func refresh_pvp_state() -> bool:
	var current_health: float = 100.0
	var current_max_health: float = 100.0

	# Try to get health from GameManager if available
	var game_manager = get_node_or_null("/root/GameManager")
	if game_manager and game_manager.has_method("get_player_health"):
		current_health = game_manager.get_player_health()
	if game_manager and game_manager.has_method("get_max_player_health"):
		current_max_health = game_manager.get_max_player_health()

	var update_data = {
		"health": current_health,
		"max_health": current_max_health,
	}

	return _update_state_with(update_data)

## Get state age in seconds
##
## Returns how long ago the state was stored. Useful for detecting stale state.
##
## @return: Float seconds since state was stored, or -1 if no state exists
func get_state_age() -> float:
	if not has_pending_state():
		return -1.0

	var timestamp = _pending_pvp_state.get("timestamp", 0)
	var current_time = Time.get_unix_time_from_system()
	return float(current_time - timestamp)

## Check if state is stale (older than threshold)
##
## @param threshold_seconds: Maximum age in seconds before state is considered stale (default: 1 hour)
## @return: Boolean indicating if state is stale
func is_state_stale(threshold_seconds: float = 3600.0) -> bool:
	var age = get_state_age()
	return age >= 0.0 and age > threshold_seconds

## Get debug summary of pending state
##
## Returns a formatted string for debugging purposes.
##
## @return: String containing state summary
func get_state_summary() -> String:
	if not has_pending_state():
		return "No pending PvP state"

	var summary = "Pending PvP State:\n"
	summary += "  Level: %d\n" % _pending_pvp_state.get("level", 1)
	summary += "  XP: %d\n" % _pending_pvp_state.get("xp", 0)
	summary += "  Health: %.1f/%.1f\n" % [_pending_pvp_state.get("health", 100), _pending_pvp_state.get("max_health", 100)]
	summary += "  Gear Slots: %d\n" % _pending_pvp_state.get("equipped_gear", {}).size()
	summary += "  Stored: %d seconds ago\n" % get_state_age()
	return summary

# --- Private Methods ---

## Save state to Nakama storage
func _save_to_storage() -> void:
	if not _network_manager or not _network_manager.has_method("get_storage_sync"):
		return

	var storage = _network_manager.get_storage_sync()
	if not storage:
		print("Warning: MatchTransitionManager: Could not access storage")
		return

	storage.put(STORAGE_KEY, JSON.stringify(_pending_pvp_state))
	print("MatchTransitionManager: State saved to storage")

## Load state from Nakama storage
func _load_from_storage() -> void:
	if not _network_manager or not _network_manager.has_method("get_storage_sync"):
		return

	var storage = _network_manager.get_storage_sync()
	if not storage:
		return

	var stored_data = storage.get(STORAGE_KEY)
	if stored_data is String:
		var json = JSON.new()
		var error = json.parse(stored_data)
		if error == OK:
			_pending_pvp_state = json.data
			print("MatchTransitionManager: Loaded state from storage: ", _pending_pvp_state)

## Update existing state with new values
func _update_state_with(update_data: Dictionary) -> bool:
	if _pending_pvp_state.is_empty():
		return false

	for key in update_data:
		_pending_pvp_state[key] = update_data[key]

	_save_to_storage()
	pvp_state_stored.emit(_pending_pvp_state)
	return true
