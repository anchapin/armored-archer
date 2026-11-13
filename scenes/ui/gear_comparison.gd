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

func _ready() -> void:
	# Get ThemeManager reference
	theme_manager = get_node_or_null("/root/ThemeManager")
	
	# Get DesignTokens reference
	design_tokens = get_node_or_null("/root/DesignTokens")
	
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
	var color: Color = theme_manager.get_text_color() if theme_manager else rarity_colors.get(rarity, Color.WHITE)

	name_label.text = gear.get("name", "Unknown")
	name_label.modulate = Color.WHITE
	name_label.add_theme_color_override("font_color", color)

	rarity_label.text = rarity.capitalize()
	rarity_label.modulate = Color.WHITE
	rarity_label.add_theme_color_override("font_color", color)

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
		mod_name_label.add_theme_color_override("font_color", theme_manager.get_text_color() if theme_manager else Color.YELLOW)

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

	# Build result text with stat differences
	var result_text: String = ""
	var differences: Array = comparison.get("differences", [])

	match better:
		"gear1":
			result_text = "Left gear is better\n"
		"gear2":
			result_text = "Right gear is better\n"
		"equal":
			result_text = "Both gear are equal\n"

	# Add stat differences to the result
	if differences.size() > 0:
		result_text += "\nStat Differences:\n"
		for diff in differences:
			var stat: String = diff.get("stat", "")
			var gear1_val: int = diff.get("gear1_value", 0)
			var gear2_val: int = diff.get("gear2_value", 0)
			var diff_val: int = diff.get("difference", 0)
			var diff_better: String = diff.get("better", "equal")

			var diff_text: String = "%s: %d vs %d" % [stat, gear1_val, gear2_val]
			if diff_better == "gear1":
				diff_text += " (+%d)" % diff_val
			elif diff_better == "gear2":
				diff_text += " (%d)" % diff_val

			result_text += diff_text + "\n"

	result_label.text = result_text

func _on_close_button_pressed() -> void:
	comparison_closed.emit()
	queue_free()

# --- Theme Support ---
func _apply_theme() -> void:
	if not theme_manager:
		return
	
	var colors = theme_manager.get_theme_colors()
	# Keep this screen's existing Label widgets readable on its parchment canvas.
	if not theme:
		theme = Theme.new()
	theme.set_color("font_color", "Label", colors["on_surface"])
	
	# Apply background color
	theme_manager.apply_background(self)
	# This local background is created after parent layout; anchors alone leave it zero-sized.
	var background := get_node_or_null("_theme_background") as ColorRect
	if background:
		background.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	
	# Apply colors to labels
	if gear1_name:
		gear1_name.modulate = Color.WHITE
		gear1_name.add_theme_color_override("font_color", colors["on_surface"])
	if gear2_name:
		gear2_name.modulate = Color.WHITE
		gear2_name.add_theme_color_override("font_color", colors["on_surface"])
	if result_label:
		result_label.modulate = Color.WHITE
		result_label.add_theme_color_override("font_color", colors["on_surface"])

func _on_theme_changed(is_dark: bool) -> void:
	_apply_theme()
