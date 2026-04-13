## Matchmaking Queue UI for displaying queue position and estimated wait time.
## Shows current bracket size and provides cancel button.
##
extends Control

# --- UI References ---
@onready var container: VBoxContainer = $SafeAreaContainer
@onready var mode_label: Label = $SafeAreaContainer/VBoxContainer/ModeLabel
@onready var position_label: Label = $SafeAreaContainer/VBoxContainer/PositionLabel
@onready var wait_time_label: Label = $SafeAreaContainer/VBoxContainer/WaitTimeLabel
@onready var bracket_label: Label = $SafeAreaContainer/VBoxContainer/BracketLabel
@onready var progress_bar: ProgressBar = $SafeAreaContainer/VBoxContainer/ProgressBar
@onready var cancel_button: ArcheryBaseButton = $SafeAreaContainer/VBoxContainer/CancelButton
@onready var animation_player: AnimationPlayer = $AnimationPlayer

# --- Manager References ---
var matchmaking_pool_manager: Node
var player_rating_manager: Node

# --- State ---
var current_mode: int = MatchmakingPoolManager.MatchMode.ONE_V_ONE
var is_in_queue: bool = false

# --- Constants ---
const BRACKET_COLORS = {
	100: Color.GREEN,
	200: Color.YELLOW,
	300: Color.ORANGE,
	-1: Color.RED  # Any rating
}

# --- Initialization ---
func _ready() -> void:
	matchmaking_pool_manager = get_node_or_null("/root/MatchmakingPoolManager")
	player_rating_manager = get_node_or_null("/root/PlayerRatingManager")

	if matchmaking_pool_manager:
		matchmaking_pool_manager.queue_joined.connect(_on_queue_joined)
		matchmaking_pool_manager.queue_left.connect(_on_queue_left)
		matchmaking_pool_manager.queue_position_updated.connect(_on_position_updated)
		matchmaking_pool_manager.match_found.connect(_on_match_found)

	cancel_button.pressed.connect(_on_cancel_pressed)

	# Set initial mode
	_set_mode_display()

## Set the match mode for the queue
func set_mode(mode: int) -> void:
	current_mode = mode
	_set_mode_display()

func _set_mode_display() -> void:
	if mode_label:
		var mode_str: String = "1v1 Ranked" if current_mode == MatchmakingPoolManager.MatchMode.ONE_V_ONE else "2v2 Ranked"
		mode_label.text = mode_str

## Join the matchmaking queue
func join_queue() -> void:
	if not matchmaking_pool_manager:
		push_error("MatchmakingPoolManager not available")
		return

	if is_in_queue:
		return

	is_in_queue = true
	_set_queue_ui_state(true)
	matchmaking_pool_manager.join_queue(current_mode)

## Cancel and leave the queue
func cancel_queue() -> void:
	if not matchmaking_pool_manager:
		return

	if not is_in_queue:
		return

	is_in_queue = false
	matchmaking_pool_manager.leave_queue(current_mode)

## Update UI based on queue state
func _set_queue_ui_state(in_queue: bool) -> void:
	if in_queue:
		cancel_button.text = "Cancel Queue"
		if animation_player:
			animation_player.play("searching")
	else:
		cancel_button.text = "Join Queue"
		position_label.text = "Position: --"
		wait_time_label.text = "Estimated Wait: --"
		bracket_label.text = "Rating Bracket: --"
		progress_bar.value = 0

func _update_position_display(position: int, estimated_wait: float, bracket_size: int) -> void:
	position_label.text = "Position: %d" % position

	var wait_str: String
	if estimated_wait < 60:
		wait_str = "~%d seconds" % estimated_wait
	else:
		wait_str = "~%.1f minutes" % (estimated_wait / 60.0)
	wait_time_label.text = "Estimated Wait: %s" % wait_str

	var bracket_text: String = "Any Rating" if bracket_size == -1 else "+-%d" % bracket_size
	bracket_label.text = "Rating Bracket: %s" % bracket_text

	# Update bracket label color
	if bracket_size in BRACKET_COLORS:
		bracket_label.modulate = BRACKET_COLORS[bracket_size]

	# Update progress bar (max 90 seconds)
	progress_bar.max_value = 90.0
	progress_bar.value = min(estimated_wait, 90.0)

# --- Signal Handlers ---
func _on_queue_joined(mode: int, estimated_wait: float) -> void:
	print("Queue joined for mode: %d, estimated wait: %f" % [mode, estimated_wait])
	var bracket_size: int = matchmaking_pool_manager.get_current_bracket_size(mode)
	_update_position_display(1, estimated_wait, bracket_size)

func _on_queue_left(mode: int) -> void:
	print("Queue left for mode: %d" % mode)
	is_in_queue = false
	_set_queue_ui_state(false)

func _on_position_updated(position: int, estimated_wait: float) -> void:
	var bracket_size: int = matchmaking_pool_manager.get_current_bracket_size(current_mode)
	_update_position_display(position, estimated_wait, bracket_size)

func _on_match_found(opponent_data: Dictionary) -> void:
	print("Match found! Opponent: %s" % opponent_data)
	is_in_queue = false
	_set_queue_ui_state(false)

	# Show match found dialog
	_show_match_found_dialog(opponent_data)

func _on_cancel_pressed() -> void:
	if is_in_queue:
		cancel_queue()

func _show_match_found_dialog(opponent_data: Dictionary) -> void:
	var dialog: AcceptDialog = AcceptDialog.new()
	dialog.title = "Match Found!"
	dialog.dialog_text = "An opponent has been found!\nGood luck!"
	dialog.unresizable = true

	get_tree().current_scene.add_child(dialog)
	dialog.show()

	dialog.confirmed.connect(_on_match_confirmed.bind(opponent_data))
	back_button_pressed.connect(dialog.queue_free.unbind(1), CONNECT_DEFERRED)

var back_button_pressed = Signal()

func _on_match_confirmed(opponent_data: Dictionary) -> void:
	# Navigate to combat menu with match data
	var combat_scene = load("res://scenes/ui/combat_menu.tscn")
	var combat_ui = combat_scene.instantiate()
	combat_ui.set_opponent_data(opponent_data)
	get_tree().current_scene.add_child(combat_ui)

# --- Cleanup ---
func _exit_tree() -> void:
	# Disconnect signals
	if matchmaking_pool_manager:
		if matchmaking_pool_manager.queue_joined.is_connected(_on_queue_joined):
			matchmaking_pool_manager.queue_joined.disconnect(_on_queue_joined)
		if matchmaking_pool_manager.queue_left.is_connected(_on_queue_left):
			matchmaking_pool_manager.queue_left.disconnect(_on_queue_left)
		if matchmaking_pool_manager.queue_position_updated.is_connected(_on_position_updated):
			matchmaking_pool_manager.queue_position_updated.disconnect(_on_position_updated)
		if matchmaking_pool_manager.match_found.is_connected(_on_match_found):
			matchmaking_pool_manager.match_found.disconnect(_on_match_found)

	if cancel_button:
		cancel_button.pressed.disconnect(_on_cancel_pressed)
