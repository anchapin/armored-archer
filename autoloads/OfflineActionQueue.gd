extends Node

## Queues actions to be executed when connection is restored
## Provides automatic retry mechanism for network operations

# --- Queue Storage ---
var pending_actions: Array = []
var is_processing: bool = false

# --- Constants ---
const QUEUE_FILE: String = "user://offline_actions.json"
const MAX_QUEUE_SIZE: int = 50

# --- Signals ---
signal action_queued(action: Dictionary)
signal action_processed(action: Dictionary, success: bool)
signal action_failed(action: Dictionary, error: String)
signal queue_synced()

# --- Network Reference ---
@onready var network_manager: Node = get_node_or_null("/root/NetworkManager")

func _ready() -> void:
	_load_queue_from_file()
	
	# Listen for connection status changes
	if network_manager:
		network_manager.connection_status_changed.connect(_on_connection_status_changed)

# --- Queue Management ---
func queue_action(action_type: String, rpc_id: String, payload: Dictionary, metadata: Dictionary = {}) -> void:
	"""Queues an action for later execution.
	
	Parameters:
		action_type: Type of action (e.g., "combat_action", "purchase", "gear_equip")
		rpc_id: Nakama RPC ID to call
		payload: RPC payload dictionary
		metadata: Additional metadata for context (optional)
	"""
	if pending_actions.size() >= MAX_QUEUE_SIZE:
		push_warning("Offline action queue is full, dropping oldest action")
		pending_actions.pop_front()
	
	var action: Dictionary = {
		"action_type": action_type,
		"rpc_id": rpc_id,
		"payload": payload,
		"metadata": metadata,
		"timestamp": Time.get_ticks_msec(),
		"retry_count": 0,
		"max_retries": 3
	}
	
	pending_actions.append(action)
	action_queued.emit(action)
	
	_save_queue_to_file()
	print("Action queued: %s (queue size: %d)" % [action_type, pending_actions.size()])

func process_queue() -> void:
	"""Processes all queued actions in order."""
	if is_processing or pending_actions.is_empty():
		return
	
	if not network_manager or not network_manager.is_connected:
		push_warning("Cannot process offline queue: not connected")
		return
	
	is_processing = true
	
	var actions_to_remove: Array = []
	
	for i in range(pending_actions.size()):
		var action: Dictionary = pending_actions[i]
		var success: bool = await _execute_action(action)
		
		if success:
			actions_to_remove.append(i)
			action_processed.emit(action, true)
		else:
			action["retry_count"] += 1
			
			if action["retry_count"] >= action["max_retries"]:
				actions_to_remove.append(i)
				action_failed.emit(action, "Max retries exceeded")
				push_error("Action failed after max retries: %s" % action["action_type"])
			else:
				action_processed.emit(action, false)
	
	# Remove successful/failed actions (in reverse order to maintain indices)
	for i in range(actions_to_remove.size() - 1, -1, -1):
		pending_actions.remove_at(actions_to_remove[i])
	
	is_processing = false
	
	if actions_to_remove.size() > 0:
		_save_queue_to_file()
		queue_synced.emit()

func _execute_action(action: Dictionary) -> bool:
	"""Executes a single queued action.
	
	Returns:
		true if action succeeds, false otherwise
	"""
	if not network_manager or not network_manager.is_connected:
		return false
	
	var json: JSON = JSON.new()
	var response: Dictionary = await network_manager.send_rpc_with_retry(
		action["rpc_id"],
		json.stringify(action["payload"]),
		30.0,
		action["max_retries"] - action["retry_count"]
	)
	
	if response.has("error"):
		push_warning("Failed to execute queued action %s: %s" % [action["action_type"], response["error"]])
		return false
	
	return true

# --- File Persistence ---
func _save_queue_to_file() -> void:
	"""Saves offline action queue to persistent storage."""
	var file: FileAccess = FileAccess.open(QUEUE_FILE, FileAccess.WRITE)
	if file:
		var json: JSON = JSON.new()
		file.store_string(json.stringify(pending_actions))
		file.close()

func _load_queue_from_file() -> void:
	"""Loads offline action queue from persistent storage."""
	if not FileAccess.file_exists(QUEUE_FILE):
		return
	
	var file: FileAccess = FileAccess.open(QUEUE_FILE, FileAccess.READ)
	if file:
		var json_string: String = file.get_as_text()
		file.close()
		
		var json: JSON = JSON.new()
		if json.parse(json_string) == OK:
			pending_actions = json.data

# --- Signal Handlers ---
func _on_connection_status_changed(is_online: bool) -> void:
	"""Called when network connection status changes."""
	if is_online and not pending_actions.is_empty():
		print("Connection restored, processing %d queued actions" % pending_actions.size())
		await get_tree().process_frame  # Allow a frame for initialization
		process_queue()

# --- Utility Methods ---
func get_pending_action_count() -> int:
	"""Returns the number of pending offline actions."""
	return pending_actions.size()

func clear_queue() -> void:
	"""Clears all pending actions."""
	pending_actions.clear()
	_save_queue_to_file()

func get_queue_snapshot() -> Array:
	"""Returns a copy of the current queue."""
	return pending_actions.duplicate()
