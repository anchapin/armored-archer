## Level requirement gate component that displays level requirements
## and blocks access to content until requirements are met.
##
## Features:
## - Displays level requirement with progress
## - Blocks access to locked content
## - Shows progress to requirement
## - Visual feedback when requirement is met
##
extends Control

# --- State ---
var required_level: int = 1
var current_level: int = 1
var is_unlocked: bool = false
var gate_name: String = "Level Gate"

# --- Design Tokens Reference ---
var design_tokens: Node

# --- Player Stats Manager Reference ---
var player_stats_manager: Node

# --- Progression Indicator Manager Reference ---
var progression_manager: Node

# --- Theme Manager Reference ---
var theme_manager: Node

# --- Signals ---
signal gate_unlocked(gate_name: String)
signal gate_blocked(gate_name: String, required_level: int)

# --- Node References ---
@onready var gate_panel: PanelContainer = $GatePanel
@onready var gate_title: Label = $GatePanel/GateLayout/GateTitle
@onready var level_label: Label = $GatePanel/GateLayout/LevelLabel
@onready var progress_bar: ProgressBar = $GatePanel/GateLayout/ProgressBar
@onready var progress_text: Label = $GatePanel/GateLayout/ProgressText
@onready var lock_icon: TextureRect = $GatePanel/GateLayout/LockIcon
@onready var unlock_button: Button = $GatePanel/GateLayout/UnlockButton
@onready var requirement_info: Label = $GatePanel/GateLayout/RequirementInfo

func _ready() -> void:
	# Get DesignTokens reference
	design_tokens = get_node_or_null("/root/DesignTokens")

	# Get PlayerStatsManager reference
	player_stats_manager = get_node_or_null("/root/PlayerStatsManager")

	# Get ProgressionIndicatorManager reference
	progression_manager = get_node_or_null("/root/ProgressionIndicatorManager")

	# Get ThemeManager reference
	theme_manager = get_node_or_null("/root/ThemeManager")

	# Apply theme if available
	if theme_manager:
		_apply_theme()
		theme_manager.theme_changed.connect(_on_theme_changed)

	# Connect to player stats updates
	if player_stats_manager:
		player_stats_manager.level_up.connect(_on_level_up)
		player_stats_manager.stats_updated.connect(_on_stats_updated)
		current_level = player_stats_manager.get_level()

	# Connect to progression manager
	if progression_manager:
		progression_manager.level_requirement_met.connect(_on_level_requirement_met)

	# Connect unlock button
	unlock_button.pressed.connect(_on_unlock_pressed)

	# Update display
	update_display()

func _on_theme_changed(is_dark: bool) -> void:
	_apply_theme()

func _apply_theme() -> void:
	if not theme_manager:
		return

	var colors = theme_manager.get_theme_colors()

	# Apply colors to labels
	if gate_title:
		gate_title.modulate = colors["on_surface"]
	if level_label:
		level_label.modulate = colors["on_surface"]
	if progress_text:
		progress_text.modulate = colors["on_surface_variant"]
	if requirement_info:
		requirement_info.modulate = colors["on_surface_variant"]

## Sets the gate configuration.
##
## Parameters:
##   name: Name of the gate
##   level: Required level
func set_gate_config(name: String, level: int) -> void:
	"""Sets the gate configuration."""
	gate_name = name
	required_level = level
	update_display()

## Updates the gate display based on current state.
func update_display() -> void:
	"""Updates the gate display."""
	# Check if requirement is met
	is_unlocked = current_level >= required_level

	# Update level label
	level_label.text = "Level %d Required" % required_level

	# Update progress
	var progress = float(current_level) / float(required_level)
	progress_bar.value = clampf(progress, 0.0, 1.0)
	progress_text.text = "Current: Level %d" % current_level

	# Update visibility based on unlock state
	if is_unlocked:
		lock_icon.visible = false
		unlock_button.visible = false
		requirement_info.text = "Requirement Met!"
		requirement_info.modulate = ArcherDesignTokens.COLOR_SUCCESS if design_tokens else Color("#22C55E")
	else:
		lock_icon.visible = true
		unlock_button.visible = true
		requirement_info.text = "Reach level %d to unlock" % required_level
		requirement_info.modulate = ArcherDesignTokens.COLOR_WARNING if design_tokens else Color("#F59E0B")

	# Update gate panel color
	var warning_color = ArcherDesignTokens.COLOR_WARNING if design_tokens else Color("#F59E0B")
	var success_color = ArcherDesignTokens.COLOR_SUCCESS if design_tokens else Color("#22C55E")

	if is_unlocked:
		gate_panel.modulate = success_color
	else:
		gate_panel.modulate = warning_color

## Handles level up event.
##
## Parameters:
##   new_level: New player level
##   ability_points_gained: Ability points gained
func _on_level_up(new_level: int, ability_points_gained: int) -> void:
	"""Handles player level up."""
	current_level = new_level
	update_display()

	# Check if this unlocked the gate
	if not is_unlocked and new_level >= required_level:
		is_unlocked = true
		gate_unlocked.emit(gate_name)
		_play_unlock_effect()

## Handles stats updated event.
##
## Parameters:
##   stats: Updated player stats
func _on_stats_updated(stats: Dictionary) -> void:
	"""Handles stats update."""
	current_level = stats.get("level", current_level)
	update_display()

## Handles level requirement met event from progression manager.
##
## Parameters:
##   level: Level that was met
func _on_level_requirement_met(level: int) -> void:
	"""Handles level requirement met."""
	if level >= required_level:
		current_level = level
		is_unlocked = true
		update_display()
		gate_unlocked.emit(gate_name)
		_play_unlock_effect()

## Handles unlock button press.
func _on_unlock_pressed() -> void:
	"""Handles unlock button press."""
	if not is_unlocked:
		gate_blocked.emit(gate_name, required_level)

## Checks if the gate can be passed.
##
## Returns:
##   bool: True if gate is unlocked
func can_pass() -> bool:
	"""Checks if the gate can be passed."""
	return is_unlocked

## Returns progress toward the requirement as a percentage.
##
## Returns:
##   float: Progress percentage (0.0 to 1.0)
func get_progress() -> float:
	"""Returns progress toward the requirement."""
	return float(current_level) / float(required_level)

## Plays an unlock effect animation.
func _play_unlock_effect() -> void:
	"""Plays a visual effect when the gate is unlocked."""
	# Create a flash effect
	var flash = ColorRect.new()
	flash.color = ArcherDesignTokens.COLOR_SUCCESS if design_tokens else Color("#22C55E")
	flash.color.a = 0.5
	flash.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(flash)

	var tween = create_tween()
	tween.tween_property(flash, "modulate:a", 0.0, 0.5)
	tween.tween_callback(func(): flash.queue_free())

	# Play unlock sound if audio manager is available
	var audio_manager = get_node_or_null("/root/AudioManager")
	if audio_manager and audio_manager.has_method("play_sfx"):
		audio_manager.play_sfx("level_up")

func _exit_tree() -> void:
	# Disconnect signals to prevent memory leaks
	if player_stats_manager:
		if player_stats_manager.level_up.is_connected(_on_level_up):
			player_stats_manager.level_up.disconnect(_on_level_up)
		if player_stats_manager.stats_updated.is_connected(_on_stats_updated):
			player_stats_manager.stats_updated.disconnect(_on_stats_updated)

	if progression_manager:
		if progression_manager.level_requirement_met.is_connected(_on_level_requirement_met):
			progression_manager.level_requirement_met.disconnect(_on_level_requirement_met)

	if theme_manager and theme_manager.theme_changed.is_connected(_on_theme_changed):
		theme_manager.theme_changed.disconnect(_on_theme_changed)
