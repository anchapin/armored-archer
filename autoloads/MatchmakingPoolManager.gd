## Matchmaking Pool Manager autoload for rating-based matchmaking.
## Manages player pools with rating brackets and wait time expansion.
## Provides queue position and estimated wait time for UI.
##
## Signals:
## - queue_joined(mode: String, estimated_wait: float): Emitted when player joins queue
## - queue_left(mode: String): Emitted when player leaves queue
## - queue_position_updated(position: int, estimated_wait: float): Emitted on periodic updates
## - match_found(opponent_data: Dictionary): Emitted when a match is found
##
extends Node

# --- Constants ---
const INITIAL_BRACKET_SIZE: int = 100
const EXPANDED_BRACKET_SIZE: int = 200
const WIDE_BRACKET_SIZE: int = 300
const EXPANSION_TIME_1: float = 30.0  # 30 seconds
const EXPANSION_TIME_2: float = 60.0  # 60 seconds
const MAX_WAIT_TIME: float = 90.0  # 90 seconds to any rating
const UPDATE_INTERVAL: float = 2.0  # Update queue position every 2 seconds

# --- Match Modes ---
enum MatchMode {
	ONE_V_ONE,
	TWO_V_TWO
}

# --- Signals ---
signal queue_joined(mode: MatchMode, estimated_wait: float)
signal queue_left(mode: MatchMode)
signal queue_position_updated(position: int, estimated_wait: float)
signal match_found(opponent_data: Dictionary)

# --- State ---
var _in_queue: Dictionary = {MatchMode.ONE_V_ONE: false, MatchMode.TWO_V_TWO: false}
var _queue_join_time: Dictionary = {MatchMode.ONE_V_ONE: 0.0, MatchMode.TWO_V_TWO: 0.0}
var _current_rating: Dictionary = {MatchMode.ONE_V_ONE: 1200, MatchMode.TWO_V_TWO: 1200}
var _queue_position: Dictionary = {MatchMode.ONE_V_ONE: 0, MatchMode.TWO_V_TWO: 0}
var _estimated_wait: Dictionary = {MatchMode.ONE_V_ONE: 0.0, MatchMode.TWO_V_TWO: 0.0}
var _active_mode: MatchMode = MatchMode.ONE_V_ONE
var _update_timer: Timer
var _network_manager: Node
var _player_rating_manager: Node

# --- RPC IDs ---
const RPC_JOIN_POOL = "armored_archer/join_matchmaking_pool"
const RPC_LEAVE_POOL = "armored_archer/leave_matchmaking_pool"
const RPC_GET_QUEUE_STATUS = "armored_archer/get_queue_status"

# --- Initialization ---
func _ready() -> void:
	_network_manager = get_node_or_null("/root/NetworkManager")
	_player_rating_manager = get_node_or_null("/root/PlayerRatingManager")

	# Set up update timer
	_update_timer = Timer.new()
	_update_timer.wait_time = UPDATE_INTERVAL
	_update_timer.autostart = false
	_update_timer.timeout.connect(_on_update_timer_timeout)
	add_child(_update_timer)

	# Load current ratings
	if _player_rating_manager:
		_current_rating[MatchMode.ONE_V_ONE] = _player_rating_manager.get_current_rating(PlayerRatingManager.RatingMode.ONE_V_ONE)
		_current_rating[MatchMode.TWO_V_TWO] = _player_rating_manager.get_current_rating(PlayerRatingManager.RatingMode.TWO_V_TWO)

	# Subscribe to rating updates
	if _player_rating_manager:
		_player_rating_manager.rating_updated.connect(_on_rating_updated)

## Join matchmaking pool for specified mode
func join_queue(mode: MatchMode = MatchMode.ONE_V_ONE) -> void:
	if not _network_manager or not _network_manager.is_connected:
		push_error("Not connected to server")
		return

	if _in_queue[mode]:
		push_warning("Already in queue for mode: %d" % mode)
		return

	var rating: int = _current_rating.get(mode, 1200)
	var mode_str: String = "1v1" if mode == MatchMode.ONE_V_ONE else "2v2"

	var payload: Dictionary = {
		"mode": mode_str,
		"rating": rating
	}

	var json: JSON = JSON.new()
	var response: Dictionary = await _network_manager.send_rpc(RPC_JOIN_POOL, json.stringify(payload))

	if response.has("error"):
		push_error("Failed to join queue: %s" % response.error)
		return

	if response.get("success", false):
		_in_queue[mode] = true
		_queue_join_time[mode] = Time.get_unix_time_from_system()
		_active_mode = mode
		_queue_position[mode] = response.get("queue_position", 0)
		_estimated_wait[mode] = response.get("estimated_wait", 0.0)

		# Start update timer
		if not _update_timer.autostart:
			_update_timer.start()

		queue_joined.emit(mode, _estimated_wait[mode])

## Leave matchmaking pool for specified mode
func leave_queue(mode: MatchMode = MatchMode.ONE_V_ONE) -> void:
	if not _network_manager or not _network_manager.is_connected:
		push_error("Not connected to server")
		return

	if not _in_queue[mode]:
		push_warning("Not in queue for mode: %d" % mode)
		return

	var mode_str: String = "1v1" if mode == MatchMode.ONE_V_ONE else "2v2"

	var payload: Dictionary = {
		"mode": mode_str
	}

	var json: JSON = JSON.new()
	var response: Dictionary = await _network_manager.send_rpc(RPC_LEAVE_POOL, json.stringify(payload))

	if response.has("error"):
		push_error("Failed to leave queue: %s" % response.error)
		return

	if response.get("success", false):
		_in_queue[mode] = false
		_queue_join_time[mode] = 0.0
		_queue_position[mode] = 0
		_estimated_wait[mode] = 0.0

		# Stop timer if no longer in any queue
		if not is_in_any_queue():
			_update_timer.stop()

		queue_left.emit(mode)

## Get current queue position for active mode
func get_queue_position() -> int:
	return _queue_position.get(_active_mode, 0)

## Get estimated wait time for active mode
func get_estimated_wait() -> float:
	return _estimated_wait.get(_active_mode, 0.0)

## Check if player is in any queue
func is_in_any_queue() -> bool:
	return _in_queue[MatchMode.ONE_V_ONE] or _in_queue[MatchMode.TWO_V_TWO]

## Check if player is in queue for specific mode
func is_in_queue(mode: MatchMode) -> bool:
	return _in_queue.get(mode, false)

## Get current queue status from server
func get_queue_status() -> Dictionary:
	if not _network_manager or not _network_manager.is_connected:
		return {"error": "Not connected to server"}

	var mode_str: String = "1v1" if _active_mode == MatchMode.ONE_V_ONE else "2v2"

	var payload: Dictionary = {
		"mode": mode_str
	}

	var json: JSON = JSON.new()
	var response: Dictionary = await _network_manager.send_rpc(RPC_GET_QUEUE_STATUS, json.stringify(payload))

	return response

## Get current rating for mode
func get_current_rating(mode: MatchMode = MatchMode.ONE_V_ONE) -> int:
	return _current_rating.get(mode, 1200)

## Get current bracket size based on wait time
func get_current_bracket_size(mode: MatchMode = MatchMode.ONE_V_ONE) -> int:
	if not _in_queue[mode]:
		return INITIAL_BRACKET_SIZE

	var wait_time: float = Time.get_unix_time_from_system() - _queue_join_time[mode]

	if wait_time >= MAX_WAIT_TIME:
		return -1  # -1 indicates any rating
	elif wait_time >= EXPANSION_TIME_2:
		return WIDE_BRACKET_SIZE
	elif wait_time >= EXPANSION_TIME_1:
		return EXPANDED_BRACKET_SIZE
	else:
		return INITIAL_BRACKET_SIZE

## Handle rating updates from PlayerRatingManager
func _on_rating_updated(new_rating: int, old_rating: int, mode: PlayerRatingManager.RatingMode) -> void:
	var pool_mode: MatchMode = MatchMode.ONE_V_ONE if mode == PlayerRatingManager.RatingMode.ONE_V_ONE else MatchMode.TWO_V_TWO
	_current_rating[pool_mode] = new_rating

## Handle periodic queue updates
func _on_update_timer_timeout() -> void:
	if not is_in_any_queue():
		_update_timer.stop()
		return

	var status_response: Dictionary = await get_queue_status()

	if status_response.get("success", false):
		_queue_position[_active_mode] = status_response.get("queue_position", 0)
		_estimated_wait[_active_mode] = status_response.get("estimated_wait", 0.0)
		queue_position_updated.emit(_queue_position[_active_mode], _estimated_wait[_active_mode])
