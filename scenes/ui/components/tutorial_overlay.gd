## Tutorial Overlay UI component.
## Displays tutorial step information and provides skip functionality.
##
extends Control

# --- Node References ---
@onready var title_label: Label = $VBoxContainer/TitleLabel
@onready var description_label: Label = $VBoxContainer/DescriptionLabel
@onready var progress_label: Label = $VBoxContainer/ProgressLabel
@onready var skip_button: Button = $VBoxContainer/SkipButton
@onready var panel: PanelContainer = $PanelContainer
@onready var content_container: VBoxContainer = $PanelContainer/VBoxContainer

# --- State ---
var overlay_data: Dictionary = {}
var is_visible: bool = false

# --- Signals ---
signal skip_requested()
signal next_requested()

# --- Constants ---
const ANIMATION_DURATION: float = 0.3

# --- Lifecycle ---
func _ready() -> void:
	_connect_signals()
	hide()
	mouse_filter = MOUSE_FILTER_PASS  # Allow clicks through when hidden

func _connect_signals() -> void:
	skip_button.pressed.connect(_on_skip_pressed)

# --- Public API ---

## Shows the tutorial overlay with the given data
func show_overlay(data: Dictionary) -> void:
	"""Displays the tutorial overlay with step information.

	Parameters:
		data: Dictionary with title, description, position, current_step, total_steps, can_skip
	"""
	overlay_data = data
	_update_content()
	_update_position()
	show()

	# Fade in animation
	modulate.a = 0.0
	var tween := create_tween()
	tween.tween_property(self, "modulate:a", 1.0, ANIMATION_DURATION)
	tween.set_ease(Tween.EASE_OUT)
	tween.set_trans(Tween.TRANS_CUBIC)

	is_visible = true
	mouse_filter = MOUSE_FILTER_STOP  # Capture clicks

## Hides the tutorial overlay
func hide_overlay() -> void:
	"""Hides the tutorial overlay with fade-out animation."""
	if not is_visible:
		return

	var tween := create_tween()
	tween.tween_property(self, "modulate:a", 0.0, ANIMATION_DURATION)
	tween.set_ease(Tween.EASE_IN)
	tween.set_trans(Tween.TRANS_CUBIC)

	await tween.finished

	hide()
	is_visible = false
	mouse_filter = MOUSE_FILTER_PASS  # Allow clicks through

## Updates the overlay content
func update_content(data: Dictionary) -> void:
	"""Updates the overlay with new step data.

	Parameters:
		data: Dictionary with title, description, position, current_step, total_steps, can_skip
	"""
	if not is_visible:
		show_overlay(data)
	else:
		overlay_data = data
		_update_content()
		_update_position()

# --- Private Methods ---

func _update_content() -> void:
	title_label.text = overlay_data.get("title", "")
	description_label.text = overlay_data.get("description", "")

	var current_step: int = overlay_data.get("current_step", 1)
	var total_steps: int = overlay_data.get("total_steps", 1)
	progress_label.text = "%d / %d" % [current_step, total_steps]

	var can_skip: bool = overlay_data.get("can_skip", false)
	skip_button.visible = can_skip

func _update_position() -> void:
	var position: String = overlay_data.get("position", "center")

	# Reset anchors
	anchor_left = 0.0
	anchor_top = 0.0
	anchor_right = 1.0
	anchor_bottom = 1.0
	offset_left = 0.0
	offset_top = 0.0
	offset_right = 0.0
	offset_bottom = 0.0

	match position:
		"center":
			panel.anchor_left = 0.5
			panel.anchor_top = 0.5
			panel.anchor_right = 0.5
			panel.anchor_bottom = 0.5
			panel.offset_left = -150.0
			panel.offset_top = -100.0
			panel.offset_right = 150.0
			panel.offset_bottom = 100.0
		"top_left":
			panel.anchor_left = 0.0
			panel.anchor_top = 0.0
			panel.anchor_right = 0.0
			panel.anchor_bottom = 0.0
			panel.offset_left = 20.0
			panel.offset_top = 20.0
			panel.offset_right = 200.0
			panel.offset_bottom = 150.0
		"top_right":
			panel.anchor_left = 1.0
			panel.anchor_top = 0.0
			panel.anchor_right = 1.0
			panel.anchor_bottom = 0.0
			panel.offset_left = -200.0
			panel.offset_top = 20.0
			panel.offset_right = -20.0
			panel.offset_bottom = 150.0
		"bottom_left":
			panel.anchor_left = 0.0
			panel.anchor_top = 1.0
			panel.anchor_right = 0.0
			panel.anchor_bottom = 1.0
			panel.offset_left = 20.0
			panel.offset_top = -150.0
			panel.offset_right = 200.0
			panel.offset_bottom = -20.0
		"bottom_right":
			panel.anchor_left = 1.0
			panel.anchor_top = 1.0
			panel.anchor_right = 1.0
			panel.anchor_bottom = 1.0
			panel.offset_left = -200.0
			panel.offset_top = -150.0
			panel.offset_right = -20.0
			panel.offset_bottom = -20.0
		"center_bottom":
			panel.anchor_left = 0.5
			panel.anchor_top = 0.85
			panel.anchor_right = 0.5
			panel.anchor_bottom = 0.85
			panel.offset_left = -150.0
			panel.offset_top = -100.0
			panel.offset_right = 150.0
			panel.offset_bottom = 0.0
		_:
			panel.anchor_left = 0.5
			panel.anchor_top = 0.5
			panel.anchor_right = 0.5
			panel.anchor_bottom = 0.5
			panel.offset_left = -150.0
			panel.offset_top = -100.0
			panel.offset_right = 150.0
			panel.offset_bottom = 100.0

func _on_skip_pressed() -> void:
	skip_requested.emit()
