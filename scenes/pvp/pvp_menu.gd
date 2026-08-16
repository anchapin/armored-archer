## PvP Menu Scene
## Main PvP hub with matchmaking, leaderboard access, and season info
##
## Features:
## - Matchmaking controls
## - Leaderboard button/view
## - Player rating display
## - Season countdown
## - Mode selection (1v1, 2v2)
##

extends Control

# --- Design Token Reference ---
@onready var design_tokens: Node = get_node_or_null("/root/ArcherDesignTokens")

# --- Manager References ---
@onready var season_manager: Node = get_node_or_null("/root/SeasonManager")
@onready var network_manager: Node = get_node_or_null("/root/NetworkManager")
@onready var matchmaking_manager: Node = get_node_or_null("/root/MatchmakingManager")

# --- UI Node References ---
@export var matchmaking_button: Button
@export var leaderboard_button: Button
@export var rating_label: Label
@export var rank_label: Label
@export var season_label: Label
@export var countdown_label: Label
@export var mode_container: HBoxContainer
@export var back_button: Button

# --- Scenes ---
var _leaderboard_scene: PackedScene = preload("res://scenes/pvp/leaderboard_ui.tscn")

# --- State ---
var current_mode: String = "1v1"  # "1v1" or "2v2"
var season_info_loaded: bool = false

# --- Signals ---
signal mode_selected(mode: String)
signal matchmaking_requested(mode: String)

# --- Initialization ---
func _ready() -> void:
	_setup_ui()
	_connect_signals()

	# Load season info
	if season_manager:
		season_manager.get_season_info()

func _setup_ui() -> void:
	"""Initialize UI components and apply design tokens."""
	if not design_tokens:
		return

	# Create mode selection buttons
	_setup_mode_buttons()

func _setup_mode_buttons() -> void:
	"""Create mode selection buttons for 1v1 and 2v2."""
	if not mode_container:
		return

	mode_container.queue_free_children()

	var modes: Array = ["1v1", "2v2"]

	for mode in modes:
		var button: Button = Button.new()
		button.text = str(mode)
		button.custom_minimum_size = Vector2(100, 44)
		button.toggle_mode = true
		button.set_pressed_no_signal(current_mode == str(mode).to_lower())

		# Apply design token styling
		if design_tokens:
			var radius = design_tokens.get_ra_button_radius()
			button.add_theme_constant_override("corner_radius_top_left", radius)
			button.add_theme_constant_override("corner_radius_top_right", radius)
			button.add_theme_constant_override("corner_radius_bottom_left", radius)
			button.add_theme_constant_override("corner_radius_bottom_right", radius)

		button.pressed.connect(_on_mode_button_pressed.bind(str(mode).to_lower()))
		mode_container.add_child(button)

func _connect_signals() -> void:
	"""Connect to manager signals."""
	if season_manager:
		season_manager.season_info_loaded.connect(_on_season_info_loaded)
		season_manager.leaderboard_loaded.connect(_on_leaderboard_loaded)
		season_manager.decay_info_updated.connect(_on_decay_info_updated)
		season_manager.season_transitioned.connect(_on_season_transitioned)

	if matchmaking_button:
		matchmaking_button.pressed.connect(_on_matchmaking_pressed)

	if leaderboard_button:
		leaderboard_button.pressed.connect(_on_leaderboard_pressed)

	if back_button:
		back_button.pressed.connect(_on_back_pressed)

# --- Event Handlers ---

## Handle season info loaded from server
func _on_season_info_loaded(season_data: Dictionary) -> void:
	"""Update UI with season information.

	Parameters:
		season_data: Dictionary containing season info, Standing, Ladder Rating, time_remaining
	"""
	season_info_loaded = true

	var season: Dictionary = season_data.get("season", {})
	var player_rank: int = season_data.get("player_rank", 0)
	var player_score: int = season_data.get("player_score", 0)
	var time_remaining: int = season_data.get("time_remaining", 0)

	# Update labels
	if season_label and season.has("season_number"):
		season_label.text = "SEASON %d" % season.season_number

	if countdown_label:
		countdown_label.text = _format_time_remaining(time_remaining)

	# Ladder Rating (Elo)
	if rating_label:
		rating_label.text = str(player_score)

	# Season Standing (leaderboard position)
	if rank_label and player_rank > 0:
		rank_label.text = "#%d" % player_rank
	elif rank_label:
		rank_label.text = "No Standing"

## Handle leaderboard data loaded
func _on_leaderboard_loaded(leaderboard: Array) -> void:
	"""Called when leaderboard data is received.

	Parameters:
		leaderboard: Array of leaderboard entries
	"""
	# Could update mini leaderboard display here
	print("Leaderboard loaded with %d entries" % leaderboard.size())

## Handle decay info updated
func _on_decay_info_updated(decay_info: Dictionary) -> void:
	"""Called when player's decay information is updated.

	Parameters:
		decay_info: Dictionary with decay data
	"""
	if decay_info.get("can_decay", false):
		var points_at_risk: int = decay_info.get("points_at_risk", 0)
		var days_inactive: int = decay_info.get("days_inactive", 0)

		# Show decay warning
		print("WARNING: %d rating points at risk (%d days inactive)" % [points_at_risk, days_inactive])

		# Could add a warning label to the UI
		if rating_label:
			rating_label.modulate = Color(1.0, 0.6, 0.4, 1)

## Handle season transition
func _on_season_transitioned(old_season: Dictionary, new_season: Dictionary) -> void:
	"""Called when a season ends and a new one begins.

	Parameters:
		old_season: The season that just ended
		new_season: The new active season
	"""
	# Reload season info
	if season_manager:
		season_manager.get_season_info()

## Handle matchmaking button press
func _on_matchmaking_pressed() -> void:
	"""Start matchmaking for selected mode."""
	if not matchmaking_manager:
		push_error("MatchmakingManager not available")
		return

	print("Starting matchmaking for %s" % current_mode)
	matchmaking_requested.emit(current_mode)

## Handle leaderboard button press
func _on_leaderboard_pressed() -> void:
	"""Show the leaderboard UI."""
	var leaderboard_ui = _leaderboard_scene.instantiate()
	get_tree().current_scene.add_child(leaderboard_ui)

## Handle back button press
func _on_back_pressed() -> void:
	"""Return to previous menu."""
	queue_free()

## Handle mode button press
func _on_mode_button_pressed(mode: String) -> void:
	"""Handle mode selection change.

	Parameters:
		mode: Selected mode ("1v1" or "2v2")
	"""
	if current_mode == mode:
		return

	current_mode = mode

	# Update button states
	for child in mode_container.get_children():
		if child is Button:
			var button_text: String = child.text.to_lower()
			child.set_pressed_no_signal(button_text == current_mode)

	mode_selected.emit(mode)

# --- Formatting ---

## Format time remaining as readable string
func _format_time_remaining(time_ms: int) -> String:
	"""Format time remaining into a human-readable string.

	Parameters:
		time_ms: Time in milliseconds

	Returns:
		String: Formatted time
	"""
	var total_seconds: int = time_ms / 1000
	var days: int = total_seconds / 86400
	var hours: int = (total_seconds % 86400) / 3600
	var minutes: int = (total_seconds % 3600) / 60

	if days > 0:
		return "%dd %dh" % [days, hours]
	elif hours > 0:
		return "%dh %dm" % [hours, minutes]
	else:
		return "%dm" % minutes
