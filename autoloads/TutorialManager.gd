## Manages player onboarding and tutorial progression.
## Tracks tutorial completion state and provides step-by-step guidance.
##
## Signals:
## - tutorial_started(tutorial_id: String): Emitted when a tutorial begins
## - tutorial_step_started(step_id: String): Emitted when a tutorial step starts
## - tutorial_step_completed(step_id: String): Emitted when a step is completed
## - tutorial_completed(tutorial_id: String): Emitted when a tutorial is finished
## - tutorial_skipped(tutorial_id: String): Emitted when a tutorial is skipped
## - tutorial_progress_changed(progress: float): Emitted when progress updates
##
extends Node

# --- References ---
var analytics: Node
var network_manager: Node

# --- Storage Configuration ---
const TUTORIAL_SAVE_FILE := "user://tutorial_data.json"

# --- Tutorial State ---
var tutorial_data: Dictionary = {}
var current_tutorial_id: String = ""
var current_step_index: int = 0
var is_tutorial_active: bool = false
var is_tutorial_overlay_visible: bool = false

# --- Tutorial Definitions ---
const TUTORIALS := {
	"welcome": {
		"title": "Welcome, Archer!",
		"description": "Learn the basics of combat and survival.",
		"steps": [
			{
				"id": "movement",
				"title": "Movement",
				"description": "Use the left joystick to move your archer. On keyboard: WASD or Arrow keys.",
				"action": "move",
				"position": "bottom_left",
				"duration": 0,
				"input_actions": ["move_left", "move_right", "move_up", "move_down"]
			},
			{
				"id": "aiming",
				"title": "Aiming",
				"description": "Use the right joystick to aim. Auto-aim targets nearby enemies. On keyboard: Arrow keys.",
				"action": "aim",
				"position": "top_right",
				"duration": 0,
				"input_actions": ["aim_left", "aim_right", "aim_up", "aim_down"]
			},
			{
				"id": "shooting",
				"title": "Shooting",
				"description": "Tap the shoot button to fire arrows. Auto-aim helps you hit! On keyboard: Space or Enter.",
				"action": "shoot",
				"position": "center_bottom",
				"duration": 0,
				"input_actions": ["shoot"]
			},
			{
				"id": "health",
				"title": "Health",
				"description": "Watch your health bar at the top left. Avoid enemy attacks!",
				"action": "wait",
				"position": "top_left",
				"duration": 3.0
			},
			{
				"id": "victory",
				"title": "Defeat Enemies",
				"description": "Eliminate all enemies to complete the level. Good luck!",
				"action": "complete_level",
				"position": "center",
				"duration": 0
			}
		]
	},
	"beta_features": {
		"title": "Beta Features",
		"description": "Quick tour of beta-specific features.",
		"steps": [
			{
				"id": "feedback_button",
				"title": "Feedback",
				"description": "Tap the feedback button to report bugs or suggest features.",
				"action": "wait",
				"position": "top_right",
				"duration": 3.0
			},
			{
				"id": "beta_hub",
				"title": "Beta Hub",
				"description": "Check the beta hub for known issues and upcoming features.",
				"action": "wait",
				"position": "center",
				"duration": 3.0
			}
		]
	}
}

# --- Signals ---
signal tutorial_started(tutorial_id: String)
signal tutorial_step_started(step_id: String, step_index: int)
signal tutorial_step_completed(step_id: String)
signal tutorial_completed(tutorial_id: String)
signal tutorial_skipped(tutorial_id: String)
signal tutorial_progress_changed(progress: float)
signal tutorial_overlay_requested(overlay_data: Dictionary)
signal tutorial_overlay_hidden()

# --- Constants ---
enum TutorialState {
	NOT_STARTED,
	IN_PROGRESS,
	COMPLETED,
	SKIPPED
}

# --- Initialization ---
func _ready() -> void:
	# Get references to autoloads
	analytics = get_node_or_null("/root/AnalyticsManager")
	network_manager = get_node_or_null("/root/NetworkManager")

	_load_tutorial_data()
	_connect_signals()

func _connect_signals() -> void:
	# Connect to input event for action tracking
	if not Input.is_action_just_pressed("ui_accept"):  # Test input system
		pass

# --- Public API ---

## Starts a tutorial by ID
func start_tutorial(tutorial_id: String) -> bool:
	"""Starts a tutorial if it exists and hasn't been completed.

	Parameters:
		tutorial_id: ID of the tutorial to start

	Returns:
		bool: True if tutorial started successfully
	"""
	if not TUTORIALS.has(tutorial_id):
		push_error("Tutorial not found: %s" % tutorial_id)
		return false

	var tutorial_state: int = get_tutorial_state(tutorial_id)
	if tutorial_state == TutorialState.COMPLETED:
		return false  # Already completed

	current_tutorial_id = tutorial_id
	current_step_index = 0
	is_tutorial_active = true

	# Track in analytics
	if analytics and analytics.has_method("log_custom_event"):
		analytics.log_custom_event("tutorial_started", {
			"tutorial_id": tutorial_id
		})

	tutorial_started.emit(tutorial_id)
	_start_current_step()

	return true

## Completes the current tutorial step
func complete_current_step() -> void:
	"""Advances to the next tutorial step or completes the tutorial."""
	if not is_tutorial_active:
		return

	var tutorial: Dictionary = TUTORIALS.get(current_tutorial_id, {})
	var steps: Array = tutorial.get("steps", [])

	if current_step_index < steps.size():
		var step: Dictionary = steps[current_step_index]
		var step_id: String = step.get("id", "")

		# Mark step as completed
		_mark_step_completed(current_tutorial_id, step_id)
		tutorial_step_completed.emit(step_id)

		# Track in analytics
		if analytics and analytics.has_method("log_custom_event"):
			analytics.log_custom_event("tutorial_step_completed", {
				"tutorial_id": current_tutorial_id,
				"step_id": step_id,
				"step_index": current_step_index
			})

		current_step_index += 1

		# Check if tutorial is complete
		if current_step_index >= steps.size():
			_complete_tutorial()
		else:
			_start_current_step()
			_update_progress()

## Skips the current tutorial
func skip_current_tutorial() -> void:
	"""Skips the currently active tutorial."""
	if not is_tutorial_active:
		return

	_mark_tutorial_skipped(current_tutorial_id)
	is_tutorial_active = false
	current_tutorial_id = ""

	hide_tutorial_overlay()
	tutorial_skipped.emit(current_tutorial_id)

	# Track in analytics
	if analytics and analytics.has_method("log_custom_event"):
		analytics.log_custom_event("tutorial_skipped", {
			"tutorial_id": current_tutorial_id
		})

## Gets the current tutorial step
func get_current_step() -> Dictionary:
	"""Returns the current tutorial step data.

	Returns:
		Dictionary: Current step data or empty dict if no active tutorial
	"""
	if not is_tutorial_active:
		return {}

	var tutorial: Dictionary = TUTORIALS.get(current_tutorial_id, {})
	var steps: Array = tutorial.get("steps", [])

	if current_step_index >= steps.size():
		return {}

	return steps[current_step_index]

## Shows the tutorial overlay with current step data
func show_tutorial_overlay() -> void:
	"""Displays the tutorial overlay with current step information."""
	if not is_tutorial_active:
		return

	var step: Dictionary = get_current_step()
	if step.is_empty():
		return

	var overlay_data: Dictionary = {
		"title": step.get("title", ""),
		"description": step.get("description", ""),
		"position": step.get("position", "center"),
		"current_step": current_step_index + 1,
		"total_steps": TUTORIALS.get(current_tutorial_id, {}).get("steps", []).size(),
		"can_skip": current_step_index > 0  # Allow skipping after first step
	}

	is_tutorial_overlay_visible = true
	tutorial_overlay_requested.emit(overlay_data)

## Hides the tutorial overlay
func hide_tutorial_overlay() -> void:
	"""Hides the tutorial overlay."""
	is_tutorial_overlay_visible = false
	tutorial_overlay_hidden.emit()

## Checks if a specific tutorial is complete
func is_tutorial_complete(tutorial_id: String) -> bool:
	"""Returns whether a tutorial has been completed.

	Parameters:
		tutorial_id: ID of the tutorial to check

	Returns:
		bool: True if tutorial is completed
	"""
	return get_tutorial_state(tutorial_id) == TutorialState.COMPLETED

## Gets the state of a tutorial
func get_tutorial_state(tutorial_id: String) -> int:
	"""Returns the state of a tutorial.

	Parameters:
		tutorial_id: ID of the tutorial to check

	Returns:
		int: TutorialState enum value
	"""
	if not tutorial_data.has(tutorial_id):
		return TutorialState.NOT_STARTED

	var state: String = tutorial_data[tutorial_id].get("state", "not_started")
	match state:
		"not_started":
			return TutorialState.NOT_STARTED
		"in_progress":
			return TutorialState.IN_PROGRESS
		"completed":
			return TutorialState.COMPLETED
		"skipped":
			return TutorialState.SKIPPED
		_:
			return TutorialState.NOT_STARTED

## Gets the overall tutorial progress (0.0 to 1.0)
func get_overall_progress() -> float:
	"""Returns the overall tutorial completion progress.

	Returns:
		float: Progress value from 0.0 to 1.0
	"""
	var total_tutorials: int = TUTORIALS.size()
	if total_tutorials == 0:
		return 0.0

	var completed: int = 0
	for tutorial_id in TUTORIALS:
		if is_tutorial_complete(tutorial_id):
			completed += 1

	return float(completed) / float(total_tutorials)

## Checks if this is the first time playing
func is_first_time_player() -> bool:
	"""Returns true if player hasn't completed the welcome tutorial.

	Returns:
		bool: True if player is new
	"""
	return not is_tutorial_complete("welcome")

# --- Input Handling ---

## Called when an input action occurs
func on_input_action(action_name: String) -> void:
	"""Processes input actions for tutorial completion.

	Parameters:
		action_name: Name of the input action that occurred
	"""
	if not is_tutorial_active or not is_tutorial_overlay_visible:
		return

	var step: Dictionary = get_current_step()
	if step.is_empty():
		return

	var required_actions: Array = step.get("input_actions", [])

	# Check if this action is required for current step
	if action_name in required_actions:
		complete_current_step()

# --- Private Methods ---

func _start_current_step() -> void:
	var step: Dictionary = get_current_step()
	if step.is_empty():
		return

	var step_id: String = step.get("id", "")
	var step_action: String = step.get("action", "")

	tutorial_step_started.emit(step_id, current_step_index)

	# Handle different step types
	match step_action:
		"wait":
			# Wait for duration then auto-complete
			var duration: float = step.get("duration", 3.0)
			await get_tree().create_timer(duration).timeout
			complete_current_step()
		_:
			# Show overlay and wait for action
			show_tutorial_overlay()

func _complete_tutorial() -> void:
	_mark_tutorial_completed(current_tutorial_id)
	is_tutorial_active = false
	var completed_id = current_tutorial_id
	current_tutorial_id = ""

	hide_tutorial_overlay()
	tutorial_completed.emit(completed_id)
	tutorial_progress_changed.emit(get_overall_progress())

	# Track in analytics
	if analytics and analytics.has_method("log_custom_event"):
		analytics.log_custom_event("tutorial_completed", {
			"tutorial_id": completed_id
		})

func _update_progress() -> void:
	var tutorial: Dictionary = TUTORIALS.get(current_tutorial_id, {})
	var total_steps: int = tutorial.get("steps", []).size()
	var progress: float = float(current_step_index) / float(total_steps)

	tutorial_progress_changed.emit(progress)

func _mark_step_completed(tutorial_id: String, step_id: String) -> void:
	if not tutorial_data.has(tutorial_id):
		tutorial_data[tutorial_id] = {
			"state": "in_progress",
			"completed_steps": []
		}

	var completed_steps: Array = tutorial_data[tutorial_id].get("completed_steps", [])
	if step_id not in completed_steps:
		completed_steps.append(step_id)
		tutorial_data[tutorial_id]["completed_steps"] = completed_steps

	_save_tutorial_data()

func _mark_tutorial_completed(tutorial_id: String) -> void:
	if not tutorial_data.has(tutorial_id):
		tutorial_data[tutorial_id] = {}

	tutorial_data[tutorial_id]["state"] = "completed"
	tutorial_data[tutorial_id]["completed_at"] = Time.get_unix_time_from_system()

	_save_tutorial_data()

func _mark_tutorial_skipped(tutorial_id: String) -> void:
	if not tutorial_data.has(tutorial_id):
		tutorial_data[tutorial_id] = {}

	tutorial_data[tutorial_id]["state"] = "skipped"
	tutorial_data[tutorial_id]["skipped_at"] = Time.get_unix_time_from_system()

	_save_tutorial_data()

func _save_tutorial_data() -> void:
	var file := FileAccess.open(TUTORIAL_SAVE_FILE, FileAccess.WRITE)
	if file:
		file.store_string(JSON.stringify(tutorial_data))
		file.close()

func _load_tutorial_data() -> void:
	var file := FileAccess.open(TUTORIAL_SAVE_FILE, FileAccess.READ)
	if file:
		var content: String = file.get_as_text()
		file.close()

		var json := JSON.new()
		var error := json.parse(content)

		if error == OK:
			tutorial_data = json.data
		else:
			push_error("Failed to parse tutorial data: %s" % json.get_error_message())

# --- Reset (for testing) ---

## Resets all tutorial progress (debug only)
func reset_tutorial_progress() -> void:
	"""Resets all tutorial progress. For testing purposes only."""
	tutorial_data.clear()
	_save_tutorial_data()
	is_tutorial_active = false
	current_tutorial_id = ""
	current_step_index = 0
