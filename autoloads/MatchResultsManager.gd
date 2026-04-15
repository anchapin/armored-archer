## Match Results Manager autoload
##
## Manages displaying PvP match results including XP gains, rank changes,
## season progression, and rewards after a match completes.
##
## Signals:
## - results_shown(): Emitted when match results are displayed
## - results_closed(): Emitted when player closes results

extends Node

# --- Signals ---
signal results_shown(result_data: Dictionary)
signal results_closed()

# --- Scene Reference ---
var _match_results_scene: PackedScene = preload("res://scenes/ui/pvp/match_results.tscn")
var _current_results_instance: Control = null

# --- Manager References ---
@onready var _matchmaker_manager: Node = get_node_or_null("/root/MatchmakerManager")
@onready var _transition_manager: Node = get_node_or_null("/root/MatchTransitionManager")

# --- Constants ---
const SCENE_NAME: String = "MatchResults"

## Initialize manager and connect to signals
func _ready() -> void:
	# Connect to MatchmakerManager match_completed signal
	if _matchmaker_manager and _matchmaker_manager.has_signal("match_completed"):
		_matchmaker_manager.match_completed.connect(_on_match_completed)

## Show match results with the provided data
##
## @param result_data: Dictionary containing match result data
## Expected format:
## {
##   "winner_id": "user_id",
##   "loser_id": "user_id",
##   "is_victory": bool,
##   "match_type": "ranked" | "casual",
##   "is_punch_up": bool,
##   "xp_gained": int,
##   "old_rank": int,
##   "new_rank": int,
##   "rank_delta": int,
##   "season_position": int,
##   "season_delta": int,
##   "match_duration": float,
##   "rewards": Array
## }
func show_match_results(result_data: Dictionary) -> void:
	print("MatchResultsManager: Showing match results")

	# Remove existing instance if any
	if _current_results_instance:
		_hide_results()

	# Create new instance
	_current_results_instance = _match_results_scene.instantiate() as Control

	if not _current_results_instance:
		push_error("MatchResultsManager: Failed to instantiate MatchResults scene")
		return

	# Set scene name for easy reference
	_current_results_instance.name = SCENE_NAME

	# Connect to results signals
	if _current_results_instance.has_signal("results_closed"):
		_current_results_instance.results_closed.connect(_on_results_closed)
	if _current_results_instance.has_signal("continue_to_menu"):
		_current_results_instance.continue_to_menu.connect(_on_results_closed)

	# Add to current scene tree
	var current_scene = get_tree().current_scene
	if current_scene:
		current_scene.add_child(_current_results_instance)

	# Show results with data
	if _current_results_instance.has_method("show_match_results"):
		_current_results_instance.show_match_results(result_data)

	# Store results for reference
	_store_results(result_data)

	# Emit signal
	results_shown.emit(result_data)

## Hide currently displayed match results
func hide_match_results() -> void:
	if _current_results_instance:
		_hide_results()

## Check if match results are currently displayed
func is_showing_results() -> bool:
	return _current_results_instance != null and _current_results_instance.visible

## Handle match completed signal from MatchmakerManager
func _on_match_completed(result_data: Dictionary) -> void:
	print("MatchResultsManager: Match completed, showing results")
	show_match_results(result_data)

## Handle results closed event
func _on_results_closed() -> void:
	print("MatchResultsManager: Results closed")
	_hide_results()

## Remove and cleanup current results instance
func _hide_results() -> void:
	if not _current_results_instance:
		return

	# Disconnect signals
	if _current_results_instance.has_signal("results_closed"):
		if _current_results_instance.results_closed.is_connected(_on_results_closed):
			_current_results_instance.results_closed.disconnect(_on_results_closed)
	if _current_results_instance.has_signal("continue_to_menu"):
		if _current_results_instance.continue_to_menu.is_connected(_on_results_closed):
			_current_results_instance.continue_to_menu.disconnect(_on_results_closed)

	# Remove from scene tree
	_current_results_instance.queue_free()
	_current_results_instance = null

	# Emit signal
	results_closed.emit()

	# Clear pending PvP state
	if _transition_manager:
		_transition_manager.clear_pending_state()

## Store match results for history/replay
##
## @param result_data: Match result data to store
func _store_results(result_data: Dictionary) -> void:
	var match_id: String = result_data.get("match_id", "")
	if match_id.is_empty():
		# Generate ID if not provided
		match_id = "match_%d" % Time.get_unix_time_from_system()

	var network_manager = get_node_or_null("/root/NetworkManager")
	if not network_manager:
		return

	var storage_key: String = "match_results_%s" % match_id
	var json_string: String = JSON.stringify(result_data)

	# Use NetworkManager storage if available
	if network_manager.has_method("get_storage_sync"):
		var storage = network_manager.get_storage_sync()
		if storage and storage.has_method("put"):
			storage.put(storage_key, json_string)
			print("MatchResultsManager: Stored results for match %s" % match_id)

## Load match results from storage
##
## @param match_id: Match ID to load results for
## @return: Dictionary containing match results, or empty dict if not found
func load_match_results(match_id: String) -> Dictionary:
	var network_manager = get_node_or_null("/root/NetworkManager")
	if not network_manager:
		return {}

	var storage_key: String = "match_results_%s" % match_id

	if network_manager.has_method("get_storage_sync"):
		var storage = network_manager.get_storage_sync()
		if storage and storage.has_method("get"):
			var stored_data = storage.get(storage_key)
			if stored_data is String:
				var json = JSON.new()
				var error = json.parse(stored_data)
				if error == OK:
					return json.data

	return {}

## Clear stored match results
##
## @param match_id: Match ID to clear results for
func clear_stored_results(match_id: String) -> void:
	var network_manager = get_node_or_null("/root/NetworkManager")
	if not network_manager:
		return

	var storage_key: String = "match_results_%s" % match_id

	if network_manager.has_method("get_storage_sync"):
		var storage = network_manager.get_storage_sync()
		if storage and storage.has_method("erase"):
			storage.erase(storage_key)
			print("MatchResultsManager: Cleared results for match %s" % match_id)
