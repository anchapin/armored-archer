extends Control

signal comparison_closed()

@onready var gear1_name: Label = $SafeAreaContainer/VBoxContainer/Container/Gear1Container/Gear1Name
@onready var gear1_rarity: Label = $SafeAreaContainer/VBoxContainer/Container/Gear1Container/Gear1Rarity
@onready var gear1_stats: VBoxContainer = $SafeAreaContainer/VBoxContainer/Container/Gear1Container/Gear1Stats
@onready var gear1_modifiers: VBoxContainer = $SafeAreaContainer/VBoxContainer/Container/Gear1Container/Gear1Modifiers

@onready var gear2_name: Label = $SafeAreaContainer/VBoxContainer/Container/Gear2Container/Gear2Name
@onready var gear2_rarity: Label = $SafeAreaContainer/VBoxContainer/Container/Gear2Container/Gear2Rarity
@onready var gear2_stats: VBoxContainer = $SafeAreaContainer/VBoxContainer/Container/Gear2Container/Gear2Stats
@onready var gear2_modifiers: VBoxContainer = $SafeAreaContainer/VBoxContainer/Container/Gear2Container/Gear2Modifiers

@onready var result_label: Label = $SafeAreaContainer/VBoxContainer/ResultLabel
@onready var close_button: Button = $SafeAreaContainer/VBoxContainer/CloseButton

# --- Theme Manager Reference ---
var theme_manager: Node

# --- Design Tokens Reference ---
var design_tokens: Node

# --- Rarity Colors (using DesignTokens) ---
var rarity_colors: Dictionary = {
	"common": Color("#9CA3AF"),    # ArcherDesignTokens.COLOR_RARITY_COMMON
	"rare": Color("#3B82F6"),       # ArcherDesignTokens.COLOR_RARITY_RARE
	"epic": Color("#8B5CF6"),      # ArcherDesignTokens.COLOR_RARITY_EPIC
	"legendary": Color("#F59E0B")  # ArcherDesignTokens.COLOR_RARITY_LEGENDARY
}

# --- Difference rows ---
# The comparison result is rendered with plain Labels (no BBCode): the result
# label carries the headline and every stat difference is its own row of plain
# Labels. The rows live in their own container, inserted right below the
# result label, so each row can carry its own font colour (issue #1836).
var _difference_rows: VBoxContainer = null

func _ready() -> void:
	# Get ThemeManager reference
	theme_manager = get_node_or_null("/root/ThemeManager")
	
	# Get DesignTokens reference
	design_tokens = get_node_or_null("/root/ArcherDesignTokens")
	
	# Apply theme if available
	if theme_manager:
		_apply_theme()
		theme_manager.theme_changed.connect(_on_theme_changed)
	
	close_button.pressed.connect(_on_close_button_pressed)

func set_gear_comparison(gear1: Dictionary, gear2: Dictionary, comparison: Dictionary) -> void:
	_display_gear(gear1, gear1_name, gear1_rarity, gear1_stats, gear1_modifiers)
	_display_gear(gear2, gear2_name, gear2_rarity, gear2_stats, gear2_modifiers)
	_display_comparison_result(comparison)

func _display_gear(gear: Dictionary, name_label: Label, rarity_label: Label, stats_container: VBoxContainer, modifiers_container: VBoxContainer) -> void:
	var rarity: String = gear.get("rarity", "common")
	var color: Color = rarity_colors.get(rarity, Color.WHITE)

	name_label.text = gear.get("name", "Unknown")
	name_label.modulate = color

	rarity_label.text = rarity.capitalize()
	rarity_label.modulate = color

	_clear_container(stats_container)
	var stats: Array = gear.get("stats", [])
	for stat in stats:
		var stat_label: Label = Label.new()
		stat_label.text = "%s: %d" % [stat.get("name", ""), stat.get("value", 0)]
		stats_container.add_child(stat_label)

	_clear_container(modifiers_container)
	var modifiers: Array = gear.get("modifiers", [])
	for modifier in modifiers:
		var mod_container: HBoxContainer = HBoxContainer.new()

		var mod_name_label: Label = Label.new()
		mod_name_label.text = modifier.get("name", "Unknown")
		mod_name_label.add_theme_color_override("font_color", Color.YELLOW)

		var mod_desc_label: Label = Label.new()
		mod_desc_label.text = ": %s" % modifier.get("description", "")

		mod_container.add_child(mod_name_label)
		mod_container.add_child(mod_desc_label)
		modifiers_container.add_child(mod_container)

func _clear_container(container: VBoxContainer) -> void:
	for child in container.get_children():
		child.queue_free()

func _display_comparison_result(comparison: Dictionary) -> void:
	var better: String = comparison.get("better", "equal")

	# Semantic colors. The result is a plain Label, so the colors are applied
	# through theme font color overrides instead of BBCode markup that a plain
	# Label would print verbatim (issue #1836). The colors are the same ones
	# the old markup used (success green, error red, warning yellow, white).
	var success_color: Color = ArcherDesignTokens.COLOR_SUCCESS if design_tokens else Color.GREEN
	var error_color: Color = ArcherDesignTokens.COLOR_ERROR if design_tokens else Color.RED
	var warning_color: Color = ArcherDesignTokens.COLOR_WARNING if design_tokens else Color.YELLOW

	_clear_difference_rows()

	# Result headline (plain text, colored through the theme font color).
	var headline: String = ""
	var headline_color: Color = success_color
	match better:
		"gear1":
			headline = "Left gear is better"
		"gear2":
			headline = "Right gear is better"
		"equal":
			headline = "Both gear are equal"
			headline_color = warning_color

	result_label.text = headline
	# The font color override carries the semantic color, so the label must
	# not be tinted by a modulate any more.
	result_label.modulate = Color.WHITE
	result_label.add_theme_color_override("font_color", headline_color)

	# Stat differences, one plain row per difference.
	var differences: Array = comparison.get("differences", [])
	if differences.is_empty():
		return

	_difference_rows = _create_difference_rows()
	_difference_rows.add_child(_make_difference_heading())

	for diff in differences:
		_difference_rows.add_child(_make_difference_row(diff, success_color, error_color))

func _create_difference_rows() -> VBoxContainer:
	## Creates the container that holds the stat difference rows and places it
	## right below the result label.
	var container: VBoxContainer = VBoxContainer.new()
	container.name = "DifferenceRows"

	var parent: Node = result_label.get_parent()
	if parent == null:
		return container

	parent.add_child(container)
	parent.move_child(container, result_label.get_index() + 1)
	return container

func _make_difference_heading() -> Label:
	## The "Stat Differences:" header, white like the old markup.
	var heading: Label = Label.new()
	heading.text = "Stat Differences:"
	heading.horizontal_alignment = result_label.horizontal_alignment
	heading.add_theme_color_override("font_color", Color.WHITE)
	return heading

func _make_difference_row(diff: Dictionary, success_color: Color, error_color: Color) -> HBoxContainer:
	## One stat difference: the values in the default label color and the
	## difference itself in the color of the gear that wins the stat.
	var stat: String = diff.get("stat", "")
	var gear1_val: int = diff.get("gear1_value", 0)
	var gear2_val: int = diff.get("gear2_value", 0)
	var diff_val: int = diff.get("difference", 0)
	var diff_better: String = diff.get("better", "equal")

	var row: HBoxContainer = HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER

	var stat_label: Label = Label.new()
	stat_label.text = "%s: %d vs %d" % [stat, gear1_val, gear2_val]
	row.add_child(stat_label)

	var delta_label: Label = null
	if diff_better == "gear1":
		delta_label = Label.new()
		delta_label.text = " (+%d)" % diff_val
		delta_label.add_theme_color_override("font_color", success_color)
	elif diff_better == "gear2":
		delta_label = Label.new()
		delta_label.text = " (%d)" % diff_val
		delta_label.add_theme_color_override("font_color", error_color)

	if delta_label != null:
		row.add_child(delta_label)

	return row

func _clear_difference_rows() -> void:
	## Removes the stat difference rows of a previous comparison.
	if _difference_rows == null:
		return

	if is_instance_valid(_difference_rows):
		var parent: Node = _difference_rows.get_parent()
		if parent != null:
			parent.remove_child(_difference_rows)
		_difference_rows.queue_free()

	_difference_rows = null

func _on_close_button_pressed() -> void:
	comparison_closed.emit()
	queue_free()

# --- Theme Support ---
func _apply_theme() -> void:
	if not theme_manager:
		return
	
	var colors = theme_manager.get_theme_colors()
	
	# Apply background color
	theme_manager.apply_background(self)
	
	# Apply colors to labels
	if gear1_name:
		gear1_name.modulate = colors["on_surface"]
	if gear2_name:
		gear2_name.modulate = colors["on_surface"]
	if result_label:
		# The comparison result carries its own semantic font colors, so it must
		# not be tinted by the theme modulate (issue #1836).
		result_label.modulate = Color.WHITE

func _on_theme_changed(is_dark: bool) -> void:
	_apply_theme()
