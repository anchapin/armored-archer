extends Node
## Manages real-time combat synchronization with opponent state polling.
## Handles turn management, move sending, and opponent state updates.
## Uses NetworkManager RPC for opponent move polling (500ms interval).
##
## Signals:
## - opponent_moved(move_data: Dictionary): Emitted when opponent makes a move
## - health_changed(player_health: int, opponent_health: int): Emitted when health changes
## - combat_ended(winner: String): Emitted when combat session ends
## - combat_started(match_id: String): Emitted when combat begins

# --- Signals ---
signal opponent_moved(move_data: Dictionary)
signal health_changed(player_health: int, opponent_health: int)
signal combat_ended(winner: String)
signal combat_started(match_id: String)

# --- Properties ---
var player_health: int = 100
var opponent_health: int = 100
var combat_log: Array[Dictionary] = []
var is_my_turn: bool = false

# --- State ---
var current_match_id: String = ""
var current_opponent_id: String = ""
var is_combat_active: bool = false
var _polling_timer: Timer = null
var _poll_interval: float = 0.5  # 500ms polling interval

# --- Initialization ---
func _ready() -> void:
	print("[CombatSyncManager] Initialized")

# --- Combat Lifecycle ---

## Starts a combat session with the given match ID
func start_combat(match_id: String) -> void:
	print("[CombatSyncManager] Starting combat with match_id: %s" % match_id)
	
	current_match_id = match_id
	is_combat_active = true
	player_health = 100
	opponent_health = 100
	combat_log.clear()
	is_my_turn = true
	
	combat_started.emit(match_id)
	
	# Start polling for opponent moves
	_start_polling()

## Sends a move to the opponent via Nakama
func send_move(angle: float, power: float) -> void:
	if not is_combat_active:
		push_warning("[CombatSyncManager] Cannot send move: combat not active")
		return
	
	if not is_my_turn:
		push_warning("[CombatSyncManager] Cannot send move: not your turn")
		return
	
	print("[CombatSyncManager] Sending move - angle: %.2f, power: %.2f" % [angle, power])
	
	# TODO: RPC to Nakama - call rpc_send_move with match_id, angle, power
	# Expected payload: { "match_id": current_match_id, "angle": angle, "power": power }
	var rpc_payload: String = JSON.stringify({
		"match_id": current_match_id,
		"angle": angle,
		"power": power,
		"timestamp": Time.get_ticks_msec()
	})
	
	# Fire and forget - don't block on response
	if has_node("/root/NetworkManager"):
		NetworkManager.send_rpc_async("rpc_send_move", rpc_payload)
	
	# Record in combat log
	var move_entry: Dictionary = {
		"type": "player_move",
		"angle": angle,
		"power": power,
		"timestamp": Time.get_ticks_msec()
	}
	combat_log.append(move_entry)
	
	# Switch turn
	is_my_turn = false

## Updates opponent state from polling response
func update_opponent_state(opponent_move_data: Dictionary) -> void:
	if not opponent_move_data.is_empty():
		print("[CombatSyncManager] Opponent moved - angle: %.2f, power: %.2f" % [
			opponent_move_data.get("angle", 0.0),
			opponent_move_data.get("power", 0.0)
		])
		
		# Record opponent move
		combat_log.append({
			"type": "opponent_move",
			"angle": opponent_move_data.get("angle", 0.0),
			"power": opponent_move_data.get("power", 0.0),
			"damage": opponent_move_data.get("damage", 0),
			"timestamp": Time.get_ticks_msec()
		})
		
		# Apply damage if present
		if opponent_move_data.has("damage"):
			player_health = max(0, player_health - opponent_move_data["damage"])
			health_changed.emit(player_health, opponent_health)
		
		opponent_moved.emit(opponent_move_data)
		is_my_turn = true

## Gets current turn indicator
func get_current_turn() -> String:
	return "player" if is_my_turn else "opponent"

# --- Polling Logic ---

## Starts the polling timer for opponent moves
func _start_polling() -> void:
	if _polling_timer:
		_polling_timer.stop()
		_polling_timer.queue_free()
	
	_polling_timer = Timer.new()
	_polling_timer.wait_time = _poll_interval
	add_child(_polling_timer)
	
	var _err = _polling_timer.timeout.connect(_on_poll_tick)
	_polling_timer.start()
	print("[CombatSyncManager] Started polling opponent moves (%.0fms interval)" % (_poll_interval * 1000))

## Polling tick - checks for opponent moves
func _on_poll_tick() -> void:
	if not is_combat_active or current_match_id.is_empty():
		return
	
	# TODO: RPC to Nakama - call rpc_poll_opponent_move with match_id
	# Expected response: { "move_data": {...} } or empty if no move
	var rpc_payload: String = JSON.stringify({
		"match_id": current_match_id
	})
	
	if has_node("/root/NetworkManager"):
		var response = await NetworkManager.send_rpc("rpc_poll_opponent_move", rpc_payload)
		
		if response.has("error"):
			print("[CombatSyncManager] Poll error: %s" % response.error)
		elif response.has("move_data") and not response.move_data.is_empty():
			update_opponent_state(response.move_data)

## Stops combat and cleanup
func end_combat(winner: String) -> void:
	print("[CombatSyncManager] Combat ended - Winner: %s" % winner)
	
	is_combat_active = false
	
	# Stop polling
	if _polling_timer:
		_polling_timer.stop()
		_polling_timer.queue_free()
		_polling_timer = null
	
	# Record end state
	combat_log.append({
		"type": "combat_end",
		"winner": winner,
		"final_player_health": player_health,
		"final_opponent_health": opponent_health,
		"timestamp": Time.get_ticks_msec()
	})
	
	combat_ended.emit(winner)

# --- Damage Application ---

## Apply damage to opponent (called when attack hits)
func apply_opponent_damage(damage: int) -> void:
	opponent_health = max(0, opponent_health - damage)
	health_changed.emit(player_health, opponent_health)
	
	if opponent_health <= 0:
		end_combat("player")

## Apply damage to player (called from opponent move)
func apply_player_damage(damage: int) -> void:
	player_health = max(0, player_health - damage)
	health_changed.emit(player_health, opponent_health)
	
	if player_health <= 0:
		end_combat("opponent")

# --- Cleanup ---
func _exit_tree() -> void:
	if _polling_timer:
		_polling_timer.queue_free()
		_polling_timer = null
	print("[CombatSyncManager] Cleanup complete")
