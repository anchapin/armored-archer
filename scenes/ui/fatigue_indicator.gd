## Displays player fatigue level and pacing recommendations.
## Shows a visual fatigue meter (0-100%) and break recommendations.
##
## Signals:
## - break_requested(duration: float): Emitted when player requests a break
##
extends Control

@onready var fatigue_bar: ProgressBar = $FatigueBar
@onready var fatigue_label: Label = $FatigueLabel
@onready var break_button: Button = $BreakButton
@onready var recommendation_label: Label = $RecommendationLabel
@onready var stamina_container: HBoxContainer = $StaminaContainer

# --- Manager References ---
var pacing_manager: Node
var design_tokens: Node

# --- Configuration ---
var auto_pause_on_fatigue: bool = true
var show_recommendations: bool = true

func _ready() -> void:
	"""Initializes the fatigue indicator."""
	pacing_manager = get_node_or_null("/root/PacingManager")
	design_tokens = get_node_or_null("/root/ArcherDesignTokens")

	if pacing_manager and pacing_manager.has_signal("fatigue_warning"):
		pacing_manager.fatigue_warning.connect(_on_fatigue_warning)

	if pacing_manager and pacing_manager.has_signal("pacing_break_recommended"):
		pacing_manager.pacing_break_recommended.connect(_on_pacing_break_recommended)

	if pacing_manager and pacing_manager.has_signal("pacing_metrics_updated"):
		pacing_manager.pacing_metrics_updated.connect(_on_pacing_metrics_updated)

	# Setup break button
	if break_button:
		break_button.pressed.connect(_on_break_button_pressed)

	# Initial update
	_update_display()

func _process(_delta: float) -> void:
	"""Updates the fatigue indicator every frame."""
	if pacing_manager:
		_update_fatigue_bar()

func _update_fatigue_bar() -> void:
	"""Updates the fatigue bar display."""
	if not fatigue_bar or not pacing_manager:
		return

	var fatigue_level: float = pacing_manager.current_fatigue
	fatigue_bar.value = fatigue_level

	# Update bar color
	if design_tokens:
		fatigue_bar.modulate = pacing_manager.get_fatigue_color()

	# Update label
	if fatigue_label:
		fatigue_label.text = "Fatigue: %.0f%%" % fatigue_level

func _update_display() -> void:
	"""Updates all display elements."""
	_update_fatigue_bar()
	_update_stamina_display()
	_update_recommendation()

func _update_stamina_display() -> void:
	"""Updates the stamina display."""
	if not stamina_container or not pacing_manager:
		return

	# Clear existing stamina indicators
	for child in stamina_container.get_children():
		child.queue_free()

	var metrics = pacing_manager.get_pacing_metrics()
	var fatigue_level: String = metrics.get("fatigue_level", "None")

	# Create stamina indicators based on fatigue level
	var max_stamina: int = 5
	var current_stamina: int = max_stamina

	match fatigue_level:
		"Critical":
			current_stamina = 1
		"High":
			current_stamina = 2
		"Medium":
			current_stamina = 3
		"Low":
			current_stamina = 4
		"None":
			current_stamina = 5

	for i in range(max_stamina):
		var stamina_icon = TextureRect.new()
		stamina_icon.custom_minimum_size = Vector2(16, 16)

		if i < current_stamina:
			# Active stamina
			if design_tokens:
				stamina_icon.modulate = design_tokens.COLOR_PRIMARY
			else:
				stamina_icon.modulate = Color.GREEN
		else:
			# Depleted stamina
			stamina_icon.modulate = Color.GRAY

		stamina_container.add_child(stamina_icon)

func _update_recommendation() -> void:
	"""Updates the recommendation display."""
	if not recommendation_label or not pacing_manager:
		return

	var recommendation = pacing_manager.suggest_break()

	if recommendation.should_break:
		recommendation_label.text = "Recommendation: " + recommendation.reason
		recommendation_label.modulate = Color.ORANGE
		if break_button:
			break_button.visible = true
			break_button.text = "Take Break (%ds)" % recommendation.break_duration
	else:
		recommendation_label.text = "Pacing is good"
		recommendation_label.modulate = Color.GREEN
		if break_button:
			break_button.visible = false

func _on_fatigue_warning(level: int) -> void:
	"""Handles fatigue warning signal.

	Parameters:
		level: Fatigue warning level (1=High, 2=Critical)
	"""
	_show_fatigue_warning(level)

	if level == 2 and auto_pause_on_fatigue:
		_pause_for_fatigue()

func _on_pacing_break_recommended(reason: String) -> void:
	"""Handles pacing break recommendation signal.

	Parameters:
		reason: Reason for break recommendation
	"""
	if show_recommendations:
		_show_break_popup(reason)

func _on_pacing_metrics_updated(metrics: Dictionary) -> void:
	"""Handles pacing metrics update signal.

	Parameters:
		metrics: Updated pacing metrics
	"""
	_update_display()

func _on_break_button_pressed() -> void:
	"""Handles break button press."""
	var recommendation = pacing_manager.suggest_break()

	if recommendation.should_break:
		break_requested.emit(recommendation.break_duration)
		_show_break_confirmation(recommendation.break_duration)

func _show_fatigue_warning(level: int) -> void:
	"""Shows fatigue warning to the player.

	Parameters:
		level: Fatigue warning level
	"""
	var warning_message: String

	match level:
		1:
			warning_message = "Your fatigue is getting high. Consider taking a break soon."
		2:
			warning_message = "Critical fatigue! You should take a break now."

	if GameManager and GameManager.has_method("show_message"):
		GameManager.show_message(warning_message, 5.0)

func _pause_for_fatigue() -> void:
	"""Pauses the game due to critical fatigue."""
	if get_tree():
		get_tree().paused = true

	if GameManager and GameManager.has_method("show_message"):
		GameManager.show_message("Game paused due to fatigue. Take a break!", 0.0)

func _show_break_popup(reason: String) -> void:
	"""Shows a break recommendation popup.

	Parameters:
		reason: Reason for break recommendation
	"""
	# Create a simple popup dialog
	var popup = AcceptDialog.new()
	popup.title = "Pacing Break Recommended"
	popup.dialog_text = reason + "\n\nWould you like to take a short break?"

	popup.confirmed.connect(_on_break_confirmed)
	popup.canceled.connect(_on_break_declined)

	get_tree().root.add_child(popup)
	popup.popup_centered()

func _show_break_confirmation(duration: float) -> void:
	"""Shows break confirmation dialog.

	Parameters:
		duration: Break duration in seconds
	"""
	var popup = AcceptDialog.new()
	popup.title = "Taking a Break"
	popup.dialog_text = "Great! Take a %d minute break.\n\nYour fatigue will recover." % [duration / 60]

	popup.confirmed.connect(func():
		_start_break_timer(duration)
	)

	get_tree().root.add_child(popup)
	popup.popup_centered()

func _on_break_confirmed() -> void:
	"""Handles break confirmation dialog confirm."""
	var recommendation = pacing_manager.suggest_break()

	if recommendation.should_break:
		_start_break_timer(recommendation.break_duration)

func _on_break_declined() -> void:
	"""Handles break confirmation dialog cancel."""
	if GameManager and GameManager.has_method("show_message"):
		GameManager.show_message("Be sure to rest when you can!", 3.0)

func _start_break_timer(duration: float) -> void:
	"""Starts a break timer to recover fatigue.

	Parameters:
		duration: Break duration in seconds
	"""
	if not pacing_manager:
		return

	# Recover fatigue during break
	var recovery_per_second: float = 100.0 / duration

	# Create a timer for break duration
	var break_timer = Timer.new()
	break_timer.wait_time = duration
	break_timer.one_shot = true
	add_child(break_timer)
	break_timer.start()

	break_timer.timeout.connect(func():
		_on_break_complete()
		break_timer.queue_free()
	)

	# Update fatigue during break
	var update_timer = Timer.new()
	update_timer.wait_time = 1.0
	update_timer.autostart = true
	add_child(update_timer)

	update_timer.timeout.connect(func():
		if pacing_manager:
			pacing_manager.current_fatigue = max(0, pacing_manager.current_fatigue - recovery_per_second)
			_update_display()
	)

	break_timer.timeout.connect(func():
		update_timer.stop()
		update_timer.queue_free()
	)

	if GameManager and GameManager.has_method("show_message"):
		GameManager.show_message("Taking a %d minute break..." % [duration / 60], duration)

func _on_break_complete() -> void:
	"""Handles break completion."""
	if get_tree():
		get_tree().paused = false

	if GameManager and GameManager.has_method("show_message"):
		GameManager.show_message("Break complete! Ready to continue!", 3.0)

## Sets whether to auto-pause on critical fatigue.
##
## Parameters:
##   enabled: True to auto-pause, false otherwise
func set_auto_pause(enabled: bool) -> void:
	"""Sets whether to auto-pause on critical fatigue.

	Parameters:
		enabled: True to auto-pause, false otherwise
	"""
	auto_pause_on_fatigue = enabled

## Sets whether to show break recommendations.
##
## Parameters:
##   enabled: True to show recommendations, false otherwise
func set_show_recommendations(enabled: bool) -> void:
	"""Sets whether to show break recommendations.

	Parameters:
		enabled: True to show recommendations, false otherwise
	"""
	show_recommendations = enabled

## Signal emitted when player requests a break
signal break_requested(duration: float)
