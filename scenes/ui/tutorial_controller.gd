## Tutorial Controller
## Manages the tutorial overlay and connects it to TutorialManager.
##
extends Node

# --- Node References ---
@onready var tutorial_overlay: Control = preload("res://scenes/ui/components/tutorial_overlay.tscn").instantiate()

# --- State ---
var is_initialized: bool = false

# --- Lifecycle ---
func _ready() -> void:
	_setup_overlay()
	_connect_signals()
	is_initialized = true

func _setup_overlay() -> void:
	add_child(tutorial_overlay)
	tutorial_overlay.hide_overlay()

func _connect_signals() -> void:
	# Connect TutorialManager signals
	if TutorialManager:
		TutorialManager.tutorial_overlay_requested.connect(_on_tutorial_overlay_requested)
		TutorialManager.tutorial_overlay_hidden.connect(_on_tutorial_overlay_hidden)
		TutorialManager.tutorial_step_started.connect(_on_tutorial_step_started)
		TutorialManager.tutorial_completed.connect(_on_tutorial_completed)
		TutorialManager.tutorial_skipped.connect(_on_tutorial_skipped)

	# Connect overlay signals
	tutorial_overlay.skip_requested.connect(_on_skip_requested)

# --- Input Handling ---

## Connects to the main scene's _input for detecting tutorial actions
func check_tutorial_input(event: InputEvent) -> void:
	"""Processes input events for tutorial completion."""
	if not is_initialized or not TutorialManager.is_tutorial_active:
		return

	if event.is_pressed():
		# Check for movement inputs
		if Input.is_action_just_pressed("move_left"):
			TutorialManager.on_input_action("move_left")
		elif Input.is_action_just_pressed("move_right"):
			TutorialManager.on_input_action("move_right")
		elif Input.is_action_just_pressed("move_up"):
			TutorialManager.on_input_action("move_up")
		elif Input.is_action_just_pressed("move_down"):
			TutorialManager.on_input_action("move_down")

		# Check for aim inputs
		elif Input.is_action_just_pressed("aim_left"):
			TutorialManager.on_input_action("aim_left")
		elif Input.is_action_just_pressed("aim_right"):
			TutorialManager.on_input_action("aim_right")
		elif Input.is_action_just_pressed("aim_up"):
			TutorialManager.on_input_action("aim_up")
		elif Input.is_action_just_pressed("aim_down"):
			TutorialManager.on_input_action("aim_down")

		# Check for shoot input
		elif Input.is_action_just_pressed("shoot"):
			TutorialManager.on_input_action("shoot")

# --- Signal Handlers ---

func _on_tutorial_overlay_requested(overlay_data: Dictionary) -> void:
	tutorial_overlay.show_overlay(overlay_data)

func _on_tutorial_overlay_hidden() -> void:
	tutorial_overlay.hide_overlay()

func _on_tutorial_step_started(step_id: String, step_index: int) -> void:
	# Step content is already updated via _on_tutorial_overlay_requested
	pass

func _on_tutorial_completed(tutorial_id: String) -> void:
	print("Tutorial completed: %s" % tutorial_id)

func _on_tutorial_skipped(tutorial_id: String) -> void:
	print("Tutorial skipped: %s" % tutorial_id)

func _on_skip_requested() -> void:
	TutorialManager.skip_current_tutorial()

# --- Public API ---

## Starts the welcome tutorial if this is a first-time player
func check_and_start_tutorial() -> void:
	"""Checks if player is new and starts the welcome tutorial."""
	if TutorialManager and TutorialManager.is_first_time_player():
		TutorialManager.start_tutorial("welcome")
