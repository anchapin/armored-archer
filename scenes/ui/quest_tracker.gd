## Quest tracker UI component displaying active quests and objectives.
## Shows progress indicators and allows navigation to quest locations.
##
## Features:
## - Displays active quest list with objectives
## - Shows progress indicators for each objective
## - Auto-navigation to quest targets
## - Quest completion feedback
##
extends Control

# --- State ---
var current_quests: Array = []
var expanded_quest_id: String = ""

# --- Design Tokens Reference ---
var design_tokens: Node

# --- Progression Indicator Manager Reference ---
var progression_manager: Node

# --- Theme Manager Reference ---
var theme_manager: Node

# --- Node References ---
@onready var quest_list_container: VBoxContainer = $QuestListContainer
@onready var quest_title: Label = $QuestTitle
@onready var no_quests_label: Label = $NoQuestsLabel

# --- Quest Tracker Constants ---
const QUEST_PANEL_SCENE = preload("res://scenes/ui/components/quest_panel.tscn")

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
		progression_manager.map_markers_updated.connect(_on_map_markers_updated)

	# Load and display current quests
	refresh_quests()

func _on_theme_changed(is_dark: bool) -> void:
	_apply_theme()

func _apply_theme() -> void:
	if not theme_manager:
		return

	var colors = theme_manager.get_theme_colors()

	# Apply background color
	theme_manager.apply_background(self)

	# Apply colors to labels
	if quest_title:
		quest_title.modulate = colors["on_surface"]
	if no_quests_label:
		no_quests_label.modulate = colors["on_surface_variant"]

	# Rebuild quest list to apply new theme colors
	refresh_quests()

## Refreshes the quest list with current active quests.
func refresh_quests() -> void:
	"""Refreshes the quest list display."""
	# Clear existing quest panels
	for child in quest_list_container.get_children():
		child.queue_free()

	# Get active quests
	if progression_manager:
		current_quests = progression_manager.get_active_quests()
	else:
		current_quests = []

	# Update UI based on quest count
	if current_quests.is_empty():
		quest_title.visible = false
		no_quests_label.visible = true
		return

	quest_title.visible = true
	no_quests_label.visible = false

	# Sort quests by priority
	current_quests.sort_custom(func(a, b): return a.get("priority", 0) > b.get("priority", 0))

	# Create quest panels for each active quest
	for quest in current_quests:
		var quest_panel = _create_quest_panel(quest)
		quest_list_container.add_child(quest_panel)

## Creates a quest panel for the given quest data.
##
## Parameters:
##   quest_data: Dictionary containing quest information
##
## Returns:
##   Control: Quest panel control
func _create_quest_panel(quest_data: Dictionary) -> Control:
	"""Creates a quest panel for the given quest data."""
	var quest_id = quest_data.get("id", "")
	var quest_name = quest_data.get("name", "Unknown Quest")
	var quest_type = quest_data.get("type", 0)
	var is_locked = quest_data.get("is_locked", false)
	var level_requirement = quest_data.get("level_requirement", 1)

	# Get colors from DesignTokens
	var primary_color = ArcherDesignTokens.COLOR_PRIMARY if design_tokens else Color("#4A90D9")
	var warning_color = ArcherDesignTokens.COLOR_WARNING if design_tokens else Color("#F59E0B")
	var success_color = ArcherDesignTokens.COLOR_SUCCESS if design_tokens else Color("#22C55E")
	var text_color = Color.WHITE

	if theme_manager:
		text_color = theme_manager.get_text_color()

	# Create quest panel container
	var quest_panel = PanelContainer.new()
	quest_panel.custom_minimum_size = Vector2(400, 100)

	# Set panel color based on state
	if is_locked:
		quest_panel.modulate = warning_color
	else:
		quest_panel.modulate = primary_color

	# Create panel layout
	var panel_layout = VBoxContainer.new()
	panel_layout.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	panel_layout.add_theme_constant_override("separation", 8)
	quest_panel.add_child(panel_layout)

	# Create quest header
	var header = HBoxContainer.new()
	header.add_theme_constant_override("separation", 12)
	panel_layout.add_child(header)

	# Quest type icon
	var type_icon = _create_quest_type_icon(quest_type)
	header.add_child(type_icon)

	# Quest name label
	var name_label = Label.new()
	name_label.text = quest_name
	name_label.add_theme_font_size_override("font_size", 16)
	name_label.modulate = text_color
	name_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT
	name_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	header.add_child(name_label)

	# Level requirement badge if locked
	if is_locked:
		var level_badge = _create_level_badge(level_requirement)
		header.add_child(level_badge)

	# Create objectives container
	var objectives_container = VBoxContainer.new()
	objectives_container.add_theme_constant_override("separation", 4)
	panel_layout.add_child(objectives_container)

	# Get objectives for this quest
	var objectives = []
	if progression_manager:
		objectives = progression_manager.get_quest_objectives(quest_id)

	for objective in objectives:
		var objective_row = _create_objective_row(objective)
		objectives_container.add_child(objective_row)

	# Add expand/collapse toggle
	var expand_button = Button.new()
	expand_button.text = "Details"
	expand_button.custom_minimum_size = Vector2(80, 24)
	expand_button.pressed.connect(_on_expand_pressed.bind(quest_id))
	panel_layout.add_child(expand_button)

	return quest_panel

## Creates an icon for the quest type.
##
## Parameters:
##   quest_type: Type of quest
##
## Returns:
##   Label: Icon label
func _create_quest_type_icon(quest_type: int) -> Label:
	"""Creates an icon label for the quest type."""
	var icon = Label.new()
	match quest_type:
		ProgressionIndicatorManager.QuestType.STAGE_COMPLETION:
			icon.text = "\u2691"  # Flag
		ProgressionIndicatorManager.QuestType.BOSS_DEFEAT:
			icon.text = "\u2620"  # Skull
		ProgressionIndicatorManager.QuestType.STAT_TARGET:
			icon.text = "\u26A1"  # Lightning
		ProgressionIndicatorManager.QuestType.LEVEL_TARGET:
			icon.text = "\u2605"  # Star
		ProgressionIndicatorManager.QuestType.COLLECT_ITEM:
			icon.text = "\u270E"  # Pencil (for collect)
		ProgressionIndicatorManager.QuestType.SURVIVAL:
			icon.text = "\u231B"  # Hourglass
		_:
			icon.text = "?"

	icon.add_theme_font_size_override("font_size", 20)
	return icon

## Creates a level requirement badge.
##
## Parameters:
##   level: Required level
##
## Returns:
##   Label: Level badge label
func _create_level_badge(level: int) -> Label:
	"""Creates a level requirement badge."""
	var badge = Label.new()
	badge.text = "Lv.%d" % level
	badge.add_theme_font_size_override("font_size", 12)
	badge.add_theme_color_override("font_color", Color.WHITE)
	badge.add_theme_color_override("font_outline_color", Color.BLACK)
	badge.add_theme_constant_override("outline_size", 2)
	return badge

## Creates an objective row with progress indicator.
##
## Parameters:
##   objective: Dictionary containing objective data
##
## Returns:
##   HBoxContainer: Objective row container
func _create_objective_row(objective: Dictionary) -> HBoxContainer:
	"""Creates an objective row with progress indicator."""
	var objective_state = objective.get("state", ProgressionIndicatorManager.ObjectiveState.NOT_STARTED)
	var description = objective.get("description", "")
	var target = objective.get("target", 1)
	var current = objective.get("current", 0)

	var row = HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)

	# State icon
	var state_icon = Label.new()
	match objective_state:
		ProgressionIndicatorManager.ObjectiveState.NOT_STARTED:
			state_icon.text = "\u2610"  # Empty checkbox
			state_icon.modulate = Color.GRAY
		ProgressionIndicatorManager.ObjectiveState.IN_PROGRESS:
			state_icon.text = "\u2612"  # X mark (in progress)
			state_icon.modulate = ArcherDesignTokens.COLOR_INFO if design_tokens else Color("#3B82F6")
		ProgressionIndicatorManager.ObjectiveState.COMPLETED:
			state_icon.text = "\u2713"  # Checkmark
			state_icon.modulate = ArcherDesignTokens.COLOR_SUCCESS if design_tokens else Color("#22C55E")
		ProgressionIndicatorManager.ObjectiveState.FAILED:
			state_icon.text = "\u2717"  # X mark
			state_icon.modulate = ArcherDesignTokens.COLOR_ERROR if design_tokens else Color("#EF4444")

	state_icon.add_theme_font_size_override("font_size", 16)
	row.add_child(state_icon)

	# Description label
	var desc_label = Label.new()
	desc_label.text = description
	desc_label.add_theme_font_size_override("font_size", 12)
	desc_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT
	desc_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(desc_label)

	# Progress indicator
	var progress_label = Label.new()
	if target > 1:
		progress_label.text = "%d/%d" % [current, target]
	else:
		progress_label.text = ""
	progress_label.add_theme_font_size_override("font_size", 12)
	row.add_child(progress_label)

	return row

## Handles expand button press.
##
## Parameters:
##   quest_id: ID of the quest to expand/collapse
func _on_expand_pressed(quest_id: String) -> void:
	"""Handles expand button press for quest details."""
	if expanded_quest_id == quest_id:
		expanded_quest_id = ""
	else:
		expanded_quest_id = quest_id

	refresh_quests()

## Handles quest updated signal.
##
## Parameters:
##   quest_id: ID of the updated quest
##   progress: Progress percentage (0.0 to 1.0)
func _on_quest_updated(quest_id: String, progress: float) -> void:
	"""Handles quest progress update."""
	refresh_quests()

## Handles objective completed signal.
##
## Parameters:
##   quest_id: ID of the quest
##   objective_id: ID of the completed objective
func _on_objective_completed(quest_id: String, objective_id: String) -> void:
	"""Handles objective completion."""
	# Play completion effect
	_play_completion_effect()

	refresh_quests()

## Handles map markers updated signal.
func _on_map_markers_updated() -> void:
	"""Handles map markers update."""
	refresh_quests()

## Plays a visual completion effect.
func _play_completion_effect() -> void:
	"""Plays a visual effect for objective completion."""
	# Create a flash effect
	var flash = ColorRect.new()
	flash.color = Color(1, 1, 1, 0.3)
	flash.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(flash)

	var tween = create_tween()
	tween.tween_property(flash, "modulate:a", 0.0, 0.3)
	tween.tween_callback(func(): flash.queue_free())

## Navigates to the quest target location.
##
## Parameters:
##   quest_id: ID of the quest to navigate to
func navigate_to_quest(quest_id: String) -> void:
	"""Navigates to the quest target location."""
	if not progression_manager:
		return

	var objectives = progression_manager.get_quest_objectives(quest_id)
	if objectives.is_empty():
		return

	for objective in objectives:
		var stage_id = objective.get("stage_id", "")
		if stage_id != "":
			# Navigate to campaign map with stage selected
			_navigate_to_stage(stage_id)
			return

## Navigates to a specific stage on the campaign map.
##
## Parameters:
##   stage_id: ID of the stage to navigate to
func _navigate_to_stage(stage_id: String) -> void:
	"""Navigates to a specific stage on the campaign map."""
	# This would typically switch to the campaign map scene
	# For now, just log the navigation
	print("Navigating to stage: %s" % stage_id)

func _exit_tree() -> void:
	# Disconnect signals to prevent memory leaks
	if progression_manager:
		if progression_manager.quest_updated.is_connected(_on_quest_updated):
			progression_manager.quest_updated.disconnect(_on_quest_updated)
		if progression_manager.objective_completed.is_connected(_on_objective_completed):
			progression_manager.objective_completed.disconnect(_on_objective_completed)
		if progression_manager.map_markers_updated.is_connected(_on_map_markers_updated):
			progression_manager.map_markers_updated.disconnect(_on_map_markers_updated)

	if theme_manager and theme_manager.theme_changed.is_connected(_on_theme_changed):
		theme_manager.theme_changed.disconnect(_on_theme_changed)
