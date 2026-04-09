## Quest objective display component for HUD.
## Shows current quest objectives and progress during gameplay.
##
extends Control

# --- State ---
var current_objectives: Array = []
var objective_labels: Array = []

# --- Design Tokens Reference ---
var design_tokens: Node

# --- Progression Manager Reference ---
var progression_manager: Node

# --- Theme Manager Reference ---
var theme_manager: Node

# --- Node References ---
@onready var objectives_container: VBoxContainer = $ObjectivesContainer
@onready var title_label: Label = $TitleLabel

func _ready() -> void:
	# Get DesignTokens reference
	design_tokens = get_node_or_null("/root/DesignTokens")

	# Get ProgressionIndicatorManager reference
	progression_manager = get_node_or_null("/root/ProgressionIndicatorManager")

	# Get ThemeManager reference
	theme_manager = get_node_or_null("/root/ThemeManager")

	# Apply theme if available
	if theme_manager:
		_apply_theme()
		theme_manager.theme_changed.connect(_on_theme_changed)

	# Connect to progression manager signals
	if progression_manager:
		progression_manager.quest_updated.connect(_on_quest_updated)
		progression_manager.objective_completed.connect(_on_objective_completed)

	# Initial update
	refresh_objectives()

func _on_theme_changed(is_dark: bool) -> void:
	_apply_theme()

func _apply_theme() -> void:
	if not theme_manager:
		return

	var colors = theme_manager.get_theme_colors()

	# Apply colors to labels
	if title_label:
		title_label.modulate = colors["on_surface"]

	# Update objective labels
	for label in objective_labels:
		label.modulate = colors["on_surface_variant"]

## Refreshes the objective display with current objectives.
func refresh_objectives() -> void:
	"""Refreshes the objective display with current objectives."""
	# Clear existing labels
	for label in objective_labels:
		label.queue_free()
	objective_labels.clear()

	# Get current stage from GameManager
	var stage_id = ""
	if "GameManager" in get_tree() and "current_stage_id" in GameManager:
		stage_id = GameManager.current_stage_id

	if stage_id.is_empty() or not progression_manager:
		title_label.text = "No Active Quest"
		return

	# Get objectives for current stage
	var quest_id = "stage_%s" % stage_id
	current_objectives = progression_manager.get_quest_objectives(quest_id)

	if current_objectives.is_empty():
		title_label.text = "No Active Quest"
		return

	title_label.text = "Current Objective"

	# Create labels for each objective
	for objective in current_objectives:
		var state = objective.get("state", ProgressionIndicatorManager.ObjectiveState.NOT_STARTED)

		# Skip completed objectives (only show in-progress ones)
		if state == ProgressionIndicatorManager.ObjectiveState.COMPLETED:
			continue

		var label = _create_objective_label(objective)
		objectives_container.add_child(label)
		objective_labels.append(label)

## Creates a label for an objective.
##
## Parameters:
##   objective: Dictionary containing objective data
##
## Returns:
##   Label: Objective label
func _create_objective_label(objective: Dictionary) -> Label:
	"""Creates a label for an objective."""
	var description = objective.get("description", "")
	var current = objective.get("current", 0)
	var target = objective.get("target", 1)
	var state = objective.get("state", ProgressionIndicatorManager.ObjectiveState.NOT_STARTED)

	var label = Label.new()

	# Build label text with progress
	if target > 1:
		label.text = "- %s (%d/%d)" % [description, current, target]
	else:
		label.text = "- %s" % description

	label.add_theme_font_size_override("font_size", 14)
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT

	# Set color based on state
	var state_color = ArcherDesignTokens.COLOR_INFO if design_tokens else Color("#3B82F6")

	match state:
		ProgressionIndicatorManager.ObjectiveState.IN_PROGRESS:
			state_color = ArcherDesignTokens.COLOR_INFO if design_tokens else Color("#3B82F6")
		ProgressionIndicatorManager.ObjectiveState.NOT_STARTED:
			state_color = ArcherDesignTokens.COLOR_WARNING if design_tokens else Color("#F59E0B")
		ProgressionIndicatorManager.ObjectiveState.COMPLETED:
			state_color = ArcherDesignTokens.COLOR_SUCCESS if design_tokens else Color("#22C55E")
		ProgressionIndicatorManager.ObjectiveState.FAILED:
			state_color = ArcherDesignTokens.COLOR_ERROR if design_tokens else Color("#EF4444")

	label.modulate = state_color

	return label

## Handles quest updated signal.
##
## Parameters:
##   quest_id: ID of the updated quest
##   progress: Progress percentage (0.0 to 1.0)
func _on_quest_updated(quest_id: String, progress: float) -> void:
	"""Handles quest progress update."""
	refresh_objectives()

## Handles objective completed signal.
##
## Parameters:
##   quest_id: ID of the quest
##   objective_id: ID of the completed objective
func _on_objective_completed(quest_id: String, objective_id: String) -> void:
	"""Handles objective completion."""
	refresh_objectives()

## Updates the display for a specific stage.
##
## Parameters:
##   stage_id: ID of the stage to show objectives for
func update_for_stage(stage_id: String) -> void:
	"""Updates the display for a specific stage."""
	refresh_objectives()

func _exit_tree() -> void:
	# Disconnect signals to prevent memory leaks
	if progression_manager:
		if progression_manager.quest_updated.is_connected(_on_quest_updated):
			progression_manager.quest_updated.disconnect(_on_quest_updated)
		if progression_manager.objective_completed.is_connected(_on_objective_completed):
			progression_manager.objective_completed.disconnect(_on_objective_completed)

	if theme_manager and theme_manager.theme_changed.is_connected(_on_theme_changed):
		theme_manager.theme_changed.disconnect(_on_theme_changed)
