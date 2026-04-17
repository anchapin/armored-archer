## Seasonal Leaderboard UI
## Displays top 100 players with rating decay info, season countdown, and filters
##
## Features:
## - Top 100 players list with ranking
## - Rating display (original vs decayed)
## - Season countdown timer
## - Mode filter (1v1/2v2)
## - Player highlight when viewing own entry
## - Historical season access
## - Decay warning for inactive players
##

extends Control

# --- Design Token Reference ---
@onready var design_tokens: Node = get_node_or_null("/root/ArcherDesignTokens")

# --- Manager References ---
@onready var season_manager: Node = get_node_or_null("/root/SeasonManager")
@onready var network_manager: Node = get_node_or_null("/root/NetworkManager")

# --- UI Node References (to be set in scene) ---
@export var scroll_container: ScrollContainer
@export var leaderboard_container: VBoxContainer
@export var season_label: Label
@export var countdown_label: Label
@export var mode_filter_container: HBoxContainer
@export var refresh_button: Button
@export var history_button: Button
@export var loading_indicator: Control
@export var empty_state: Control

# --- UI Component References ---
var _player_entry_scene: PackedScene = preload("res://scenes/pvp/components/leaderboard_entry.tscn")
var history_dialog: Control

# --- State ---
var current_mode: String = "1v1"  # "1v1", "2v2", "all"
var leaderboard_data: Array = []
var my_player_id: String = ""
var is_loading: bool = false
var countdown_timer: Timer
var auto_refresh_timer: Timer

# --- Constants ---
const REFRESH_INTERVAL_SEC: int = 30  # Auto-refresh every 30 seconds
const ENTRIES_PER_PAGE: int = 25
const MAX_ENTRIES: int = 100

# --- Signals ---
signal entry_selected(entry_data: Dictionary)
signal mode_changed(new_mode: String)

# --- Initialization ---
func _ready() -> void:
	_setup_ui()
	_connect_signals()
	_setup_countdown_timer()

	# Get player ID
	if network_manager:
		my_player_id = network_manager.user_id

	# Load initial leaderboard
	refresh_leaderboard()

func _setup_ui() -> void:
	"""Initialize UI components and apply design tokens."""
	if not design_tokens:
		return

	# Apply theme colors from design tokens
	var theme = Theme.new()
	theme.set_color("font_color", "Label", design_tokens.get_ra_surface_tier_color("base"))
	theme.set_color("font_color", "Title", design_tokens.get_ra_primary_color())

	# Setup mode filter buttons
	_setup_mode_filter()

	# Hide loading and empty state initially
	if loading_indicator:
		loading_indicator.visible = false
	if empty_state:
		empty_state.visible = false

	# Create season history dialog
	_create_history_dialog()

func _create_history_dialog() -> void:
	"""Create the season history dialog."""
	var dialog_scene = preload("res://scenes/ui/season_history_dialog.tscn")
	history_dialog = dialog_scene.instantiate()
	add_child(history_dialog)
	history_dialog.visible = false

func _setup_mode_filter() -> void:
	"""Create mode filter buttons (1v1, 2v2, All)."""
	if not mode_filter_container:
		return

	mode_filter_container.queue_free_children()

	var modes: Array = ["1v1", "2v2", "All"]

	for mode in modes:
		var button: Button = Button.new()
		button.text = str(mode).to_upper()
		button.custom_minimum_size = Vector2(80, 36)

		# Apply design token styling
		if design_tokens:
			var radius = design_tokens.get_ra_button_radius()
			button.add_theme_constant_override("corner_radius_top_left", radius)
			button.add_theme_constant_override("corner_radius_top_right", radius)
			button.add_theme_constant_override("corner_radius_bottom_left", radius)
			button.add_theme_constant_override("corner_radius_bottom_right", radius)

		# Set toggle state
		button.toggle_mode = true
		button.set_pressed_no_signal(current_mode == str(mode).to_lower())

		button.pressed.connect(_on_mode_button_pressed.bind(str(mode).to_lower()))
		mode_filter_container.add_child(button)

func _connect_signals() -> void:
	"""Connect to manager signals."""
	if season_manager:
		season_manager.leaderboard_loaded.connect(_on_leaderboard_loaded)
		season_manager.decay_info_updated.connect(_on_decay_info_updated)
		season_manager.season_history_loaded.connect(_on_season_history_loaded)

	if refresh_button:
		refresh_button.pressed.connect(refresh_leaderboard)

	if history_button:
		history_button.pressed.connect(_show_season_history)

func _setup_countdown_timer() -> void:
	"""Create countdown timer for season end."""
	countdown_timer = Timer.new()
	countdown_timer.wait_time = 1.0  # Update every second
	countdown_timer.autostart = true
	countdown_timer.timeout.connect(_update_countdown)
	add_child(countdown_timer)

	# Create auto-refresh timer
	auto_refresh_timer = Timer.new()
	auto_refresh_timer.wait_time = float(REFRESH_INTERVAL_SEC)  # Refresh every 30 seconds
	auto_refresh_timer.autostart = true
	auto_refresh_timer.timeout.connect(refresh_leaderboard)
	add_child(auto_refresh_timer)

# --- Leaderboard Loading ---

## Refresh the leaderboard with current filter
func refresh_leaderboard() -> void:
	"""Reloads the leaderboard data from the server."""
	if is_loading:
		return

	is_loading = true
	_show_loading(true)
	_hide_empty_state()

	# Update player activity to prevent decay
	if season_manager:
		season_manager.update_player_activity()

	# Request leaderboard from server
	if season_manager:
		var limit: int = min(MAX_ENTRIES, leaderboard_data.size() + ENTRIES_PER_PAGE)
		season_manager.get_leaderboard(limit)

## Load more entries when scrolling
func _load_more_entries() -> void:
	"""Load additional entries when reaching bottom of list."""
	if leaderboard_data.size() >= MAX_ENTRIES or is_loading:
		return

	var next_batch: int = min(ENTRIES_PER_PAGE, MAX_ENTRIES - leaderboard_data.size())
	if season_manager:
		season_manager.get_leaderboard(leaderboard_data.size() + next_batch)

# --- UI Updates ---

## Update countdown display
func _update_countdown() -> void:
	"""Updates the season countdown timer."""
	if not season_manager or not countdown_label:
		return

	var time_remaining_ms: int = season_manager.get_time_remaining()
	countdown_label.text = _format_countdown(time_remaining_ms)

## Update leaderboard display with new data
func _update_leaderboard_display(data: Array) -> void:
	"""Refreshes the leaderboard UI with new data."""
	if not leaderboard_container:
		return

	# Clear existing entries
	leaderboard_container.queue_free_children()

	leaderboard_data = data

	# Create entries
	var rank_counter: int = 1
	for entry in data:
		var entry_data: Dictionary = entry if entry is Dictionary else {}

		# Skip entries not matching current mode filter
		if current_mode != "all":
			var entry_mode: String = entry_data.get("mode", "1v1")
			if entry_mode.to_lower() != current_mode:
				continue

		# Create entry UI
		var entry_node = _create_leaderboard_entry(entry_data, rank_counter)
		leaderboard_container.add_child(entry_node)
		rank_counter += 1

	# Check if we have any entries
	if leaderboard_container.get_child_count() == 0:
		_show_empty_state()
	else:
		_hide_empty_state()

## Create a single leaderboard entry
func _create_leaderboard_entry(entry_data: Dictionary, rank: int) -> Control:
	"""Creates a UI element for a leaderboard entry.

	Parameters:
		entry_data: Dictionary with player data
		rank: Display rank

	Returns:
		Control: The entry UI node
	"""
	var is_my_entry: bool = entry_data.get("owner_id", "") == my_player_id

	var container: HBoxContainer = HBoxContainer.new()
	container.custom_minimum_size = Vector2(0, 64)

	# Apply styling based on rank tier
	var tier_color: Color = _get_rank_tier_color(rank)

	# Rank number
	var rank_label: Label = Label.new()
	rank_label.text = str(rank)
	rank_label.custom_minimum_size = Vector2(50, 0)
	rank_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	rank_label.add_theme_color_override("font_color", tier_color)
	if design_tokens:
		rank_label.add_theme_font_size_override("font_size", design_tokens.FONT_SIZE_LG)
	container.add_child(rank_label)

	# Player name
	var name_label: Label = Label.new()
	name_label.text = entry_data.get("username", "Unknown")
	name_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	name_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT
	if design_tokens:
		name_label.add_theme_font_size_override("font_size", design_tokens.FONT_SIZE_BASE)
	if is_my_entry:
		name_label.add_theme_color_override("font_color", design_tokens.get_ra_primary_color())
	container.add_child(name_label)

	# Rating display
	var rating_container: VBoxContainer = VBoxContainer.new()
	rating_container.custom_minimum_size = Vector2(120, 0)

	# Decayed rating (displayed)
	var rating_label: Label = Label.new()
	rating_label.text = str(entry_data.get("decayed_rating", entry_data.get("score", 0)))
	rating_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	if design_tokens:
		rating_label.add_theme_font_size_override("font_size", design_tokens.FONT_SIZE_XL)
	rating_container.add_child(rating_label)

	# Original rating (if decayed)
	var original_rating: int = entry_data.get("rating", 0)
	var decayed_rating: int = entry_data.get("decayed_rating", original_rating)

	if original_rating > decayed_rating:
		var original_label: Label = Label.new()
		original_label.text = str(original_rating)
		original_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		original_label.modulate = Color(0.6, 0.6, 0.6, 1)
		original_label.add_theme_font_size_override("font_size", 10)
		rating_container.add_child(original_label)

	container.add_child(rating_container)

	# Stats (wins/losses)
	var stats_label: Label = Label.new()
	var wins: int = entry_data.get("wins", 0)
	var losses: int = entry_data.get("losses", 0)
	stats_label.text = "%dW - %dL" % [wins, losses]
	stats_label.custom_minimum_size = Vector2(100, 0)
	stats_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	if design_tokens:
		stats_label.add_theme_font_size_override("font_size", design_tokens.FONT_SIZE_SM)
	container.add_child(stats_label)

	# Win rate
	var win_rate: float = entry_data.get("win_rate", 0.0) * 100.0
	var win_rate_label: Label = Label.new()
	win_rate_label.text = "%.1f%%" % win_rate
	win_rate_label.custom_minimum_size = Vector2(80, 0)
	win_rate_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	if design_tokens:
		win_rate_label.add_theme_font_size_override("font_size", design_tokens.FONT_SIZE_SM)
	container.add_child(win_rate_label)

	# Rank tier badge
	var tier_badge: Label = Label.new()
	tier_badge.text = season_manager.get_rank_tier(rank) if season_manager else ""
	tier_badge.custom_minimum_size = Vector2(100, 0)
	tier_badge.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	tier_badge.add_theme_color_override("font_color", tier_color)
	if design_tokens:
		tier_badge.add_theme_font_size_override("font_size", design_tokens.FONT_SIZE_SM)
	container.add_child(tier_badge)

	# Highlight if it's the player's entry
	if is_my_entry:
		container.add_theme_color_override("modulate", Color(1.0, 0.8, 0.4, 0.3))
		var background: ColorRect = ColorRect.new()
		background.color = Color(1.0, 0.8, 0.4, 0.1)
		background.mouse_filter = Control.MOUSE_FILTER_IGNORE
		background.z_index = -1
		background.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
		container.add_child(background)

	return container

## Get color for rank tier
func _get_rank_tier_color(rank: int) -> Color:
	"""Returns the color for a given rank tier.

	Parameters:
		rank: Player rank

	Returns:
		Color: Color for this rank
	"""
	if rank <= 10:
		return Color(1.0, 0.77, 0.22, 1)  # Gold/Orange - Legendary
	elif rank <= 50:
		return Color(0.95, 0.3, 0.2, 1)  # Red - Epic
	elif rank <= 100:
		return Color(0.2, 0.6, 0.95, 1)  # Blue - Rare
	elif rank <= 500:
		return Color(0.3, 0.9, 0.2, 1)  # Green - Uncommon
	else:
		return Color(0.6, 0.6, 0.6, 1)  # Gray - Common

# --- Formatting ---

## Format countdown timer string
func _format_countdown(time_ms: int) -> String:
	"""Formats time remaining into a human-readable string.

	Parameters:
		time_ms: Time in milliseconds

	Returns:
		String: Formatted countdown
	"""
	var total_seconds: int = time_ms / 1000
	var days: int = total_seconds / 86400
	var hours: int = (total_seconds % 86400) / 3600
	var minutes: int = (total_seconds % 3600) / 60
	var seconds: int = total_seconds % 60

	if days > 0:
		return "%dd %dh %dm" % [days, hours, minutes]
	elif hours > 0:
		return "%dh %dm %ds" % [hours, minutes, seconds]
	else:
		return "%dm %ds" % [minutes, seconds]

# --- Event Handlers ---

## Handle leaderboard data loaded
func _on_leaderboard_loaded(data: Array) -> void:
	"""Called when leaderboard data is received from server.

	Parameters:
		data: Array of leaderboard entries
	"""
	is_loading = false
	_show_loading(false)
	_update_leaderboard_display(data)

## Handle decay info updated
func _on_decay_info_updated(decay_info: Dictionary) -> void:
	"""Called when player's decay information is updated.

	Parameters:
		decay_info: Dictionary with decay data
	"""
	# Update UI to show decay warning if applicable
	if decay_info.get("can_decay", false):
		var points_at_risk: int = decay_info.get("points_at_risk", 0)
		var days_inactive: int = decay_info.get("days_inactive", 0)

		# Show decay warning (could be implemented as toast/badge)
		print("Decay warning: %d points at risk after %d days inactive" % [points_at_risk, days_inactive])

## Handle mode filter button press
func _on_mode_button_pressed(mode: String) -> void:
	"""Called when a mode filter button is pressed.

	Parameters:
		mode: Selected mode ("1v1", "2v2", "all")
	"""
	if current_mode == mode:
		return

	current_mode = mode
	_update_mode_button_states()
	_update_leaderboard_display(leaderboard_data)
	mode_changed.emit(mode)

## Update mode button states
func _update_mode_button_states() -> void:
	"""Updates the pressed state of mode filter buttons."""
	if not mode_filter_container:
		return

	for child in mode_filter_container.get_children():
		if child is Button:
			var button_text: String = child.text.to_lower()
			button.set_pressed_no_signal(button_text == current_mode)

## Show season history
func _show_season_history() -> void:
	"""Displays historical season data."""
	if season_manager:
		season_manager.get_season_history()

## Handle season history loaded
func _on_season_history_loaded(history: Array) -> void:
	"""Called when season history data is received from server.

	Parameters:
		history: Array of historical season data
	"""
	if history_dialog:
		history_dialog.show_history(history)

# --- Loading States ---

## Show/hide loading indicator
func _show_loading(show: bool) -> void:
	"""Sets the visibility of the loading indicator.

	Parameters:
		show: Whether to show loading state
	"""
	if loading_indicator:
		loading_indicator.visible = show

## Show empty state
func _show_empty_state() -> void:
	"""Displays the empty state when no data is available."""
	if empty_state:
		empty_state.visible = true

## Hide empty state
func _hide_empty_state() -> void:
	"""Hides the empty state."""
	if empty_state:
		empty_state.visible = false

# --- Cleanup ---
func _exit_tree() -> void:
	"""Clean up resources when node is removed."""
	if countdown_timer:
		countdown_timer.stop()
		countdown_timer.queue_free()
	if auto_refresh_timer:
		auto_refresh_timer.stop()
		auto_refresh_timer.queue_free()
