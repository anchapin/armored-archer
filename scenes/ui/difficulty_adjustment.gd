## UI scene for displaying current difficulty and performance metrics.
## Shows streak indicators, difficulty level, and visual feedback for changes.
##
extends Control

# --- UI References ---
@onready var difficulty_label: Label = $VBoxContainer/DifficultyPanel/DifficultyLabel
@onready var difficulty_value: Label = $VBoxContainer/DifficultyPanel/DifficultyValue
@onready var modifier_value: Label = $VBoxContainer/DifficultyPanel/ModifierValue
@onready var win_streak_label: Label = $VBoxContainer/StreaksPanel/WinStreakPanel/WinStreakLabel
@onready var win_streak_value: Label = $VBoxContainer/StreaksPanel/WinStreakPanel/WinStreakValue
@onready var lose_streak_label: Label = $VBoxContainer/StreaksPanel/LoseStreakPanel/LoseStreakLabel
@onready var lose_streak_value: Label = $VBoxContainer/StreaksPanel/LoseStreakPanel/LoseStreakValue
@onready var performance_label: Label = $VBoxContainer/PerformancePanel/PerformanceLabel
@onready var performance_value: Label = $VBoxContainer/PerformancePanel/PerformanceValue
@onready var win_rate_label: Label = $VBoxContainer/PerformancePanel/WinRateLabel
@onready var win_rate_value: Label = $VBoxContainer/PerformancePanel/WinRateValue
@onready var difficulty_indicator: ColorRect = $VBoxContainer/DifficultyPanel/DifficultyIndicator
@onready var animation_player: AnimationPlayer = $AnimationPlayer

# --- Manager References ---
var difficulty_manager: Node
var campaign_manager: Node

# --- Colors ---
const COLOR_EASY = Color("#4caf50")  # Green
const COLOR_NORMAL = Color("#ffffff")  # White
const COLOR_HARD = Color("#ff9800")  # Orange
const COLOR_EXTREME = Color("#f44336")  # Red

func _ready() -> void:
	"""Initializes UI and connects to manager signals."""
	difficulty_manager = get_node_or_null("/root/DynamicDifficultyManager")
	campaign_manager = get_node_or_null("/root/CampaignManager")

	# Connect to difficulty changes
	if difficulty_manager:
		if difficulty_manager.has_signal("difficulty_changed"):
			difficulty_manager.difficulty_changed.connect(_on_difficulty_changed)
		if difficulty_manager.has_signal("streak_updated"):
			difficulty_manager.streak_updated.connect(_on_streak_updated)

	# Initial UI update
	update_difficulty_display()

func _on_difficulty_changed(new_level: String, modifier: float) -> void:
	"""Handles difficulty change events and updates UI.

	Parameters:
		new_level: New difficulty level string
		modifier: Difficulty modifier value
	"""
	update_difficulty_display()

	# Play change animation
	if animation_player and animation_player.has_animation("difficulty_pulse"):
		animation_player.play("difficulty_pulse")

func _on_streak_updated(streak_type: String, count: int) -> void:
	"""Handles streak update events.

	Parameters:
		streak_type: Type of streak ("win" or "lose")
		count: Current streak count
	"""
	update_streak_display()

func update_difficulty_display() -> void:
	"""Updates all difficulty-related UI elements."""
	if not difficulty_manager:
		return

	var level = difficulty_manager.get_difficulty_level_string()
	var modifier = difficulty_manager.get_difficulty_modifier()

	if difficulty_value:
		difficulty_value.text = level

	if modifier_value:
		var modifier_str = str(int(modifier * 100)) + "%"
		if modifier > 0:
			modifier_value.text = "+" + modifier_str
		elif modifier < 0:
			modifier_value.text = modifier_str
		else:
			modifier_value.text = "0%"

	if difficulty_indicator:
		var indicator_color = get_difficulty_color(level)
		difficulty_indicator.color = indicator_color

func update_streak_display() -> void:
	"""Updates streak display indicators."""
	if not difficulty_manager:
		return

	var win_streak = difficulty_manager.get_win_streak()
	var lose_streak = difficulty_manager.get_lose_streak()

	if win_streak_value:
		win_streak_value.text = str(win_streak)
	if lose_streak_value:
		lose_streak_value.text = str(lose_streak)

	# Highlight active streak
	if win_streak_value and lose_streak_value:
		if win_streak >= 3:
			win_streak_value.modulate = COLOR_EASY
			lose_streak_value.modulate = COLOR_NORMAL
		elif lose_streak >= 3:
			lose_streak_value.modulate = COLOR_EXTREME
			win_streak_value.modulate = COLOR_NORMAL
		else:
			win_streak_value.modulate = COLOR_NORMAL
			lose_streak_value.modulate = COLOR_NORMAL

func update_performance_display() -> void:
	"""Updates performance metrics display."""
	if not difficulty_manager:
		return

	var rating = difficulty_manager.get_performance_rating()
	var win_rate = difficulty_manager.get_win_rate(10)

	if performance_value:
		performance_value.text = rating
	if win_rate_value:
		win_rate_value.text = str(int(win_rate * 100)) + "%"

func get_difficulty_color(level: String) -> Color:
	"""Returns the color associated with a difficulty level.

	Parameters:
		level: Difficulty level string

	Returns:
		Color: Corresponding color
	"""
	match level:
		"Easy":
			return COLOR_EASY
		"Normal":
			return COLOR_NORMAL
		"Hard":
			return COLOR_HARD
		"Extreme":
			return COLOR_EXTREME
		_:
			return COLOR_NORMAL

func _on_close_button_pressed() -> void:
	"""Closes the difficulty adjustment panel."""
	if animation_player and animation_player.has_animation("fade_out"):
		animation_player.play("fade_out")
	else:
		queue_free()

func _on_reset_button_pressed() -> void:
	"""Resets difficulty to normal level."""
	if difficulty_manager:
		difficulty_manager.reset_difficulty()
		update_difficulty_display()
		update_streak_display()

func _on_animation_finished(anim_name: StringName) -> void:
	"""Called when an animation finishes."""
	if anim_name == &"fade_out":
		queue_free()
