extends Control

signal comparison_closed()

@onready var gear1_name: Label = $VBoxContainer/Container/Gear1Container/Gear1Name
@onready var gear1_rarity: Label = $VBoxContainer/Container/Gear1Container/Gear1Rarity
@onready var gear1_stats: VBoxContainer = $VBoxContainer/Container/Gear1Container/Gear1Stats
@onready var gear1_modifiers: VBoxContainer = $VBoxContainer/Container/Gear1Container/Gear1Modifiers

@onready var gear2_name: Label = $VBoxContainer/Container/Gear2Container/Gear2Name
@onready var gear2_rarity: Label = $VBoxContainer/Container/Gear2Container/Gear2Rarity
@onready var gear2_stats: VBoxContainer = $VBoxContainer/Container/Gear2Container/Gear2Stats
@onready var gear2_modifiers: VBoxContainer = $VBoxContainer/Container/Gear2Container/Gear2Modifiers

@onready var result_label: Label = $VBoxContainer/ResultLabel
@onready var close_button: Button = $VBoxContainer/CloseButton

# --- Theme Manager Reference ---
var theme_manager: Node

# --- Design Tokens Reference ---
var design_tokens: Node

# --- Rarity Colors (using DesignTokens) ---
var rarity_colors: Dictionary = {
	"common": Color("#9CA3AF"),    # DesignTokens.COLOR_RARITY_COMMON
	"rare": Color("#3B82F6"),       # DesignTokens.COLOR_RARITY_RARE
	"epic": Color("#8B5CF6"),      # DesignTokens.COLOR_RARITY_EPIC
	"legendary": Color("#F59E0B")  # DesignTokens.COLOR_RARITY_LEGENDARY
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

	# Get DesignTokens colors
	var success_color = DesignTokens.COLOR_SUCCESS if design_tokens else Color.GREEN
	var error_color = DesignTokens.COLOR_ERROR if design_tokens else Color.RED
	var warning_color = DesignTokens.COLOR_WARNING if design_tokens else Color.YELLOW
	var text_color = Color.WHITE
	
	if theme_manager:
		text_color = theme_manager.get_text_primary_color()

	# Build result text with stat differences
	var result_text: String = ""
	var differences: Array = comparison.get("differences", [])

	match better:
		"gear1":
			result_text = "[color=#22C55E]Left gear is better[/color]\n"  # Green
		"gear2":
			result_text = "[color=#22C55E]Right gear is better[/color]\n"  # Green
		"equal":
			result_text = "[color=#F59E0B]Both gear are equal[/color]\n"  # Yellow

	# Add stat differences to the result
	if differences.size() > 0:
		result_text += "\n[color=#FFFFFF]Stat Differences:[/color]\n"  # White
		for diff in differences:
			var stat: String = diff.get("stat", "")
			var gear1_val: int = diff.get("gear1_value", 0)
			var gear2_val: int = diff.get("gear2_value", 0)
			var diff_val: int = diff.get("difference", 0)
			var diff_better: String = diff.get("better", "equal")

			var diff_text: String = "%s: %d vs %d" % [stat, gear1_val, gear2_val]
			if diff_better == "gear1":
				diff_text += " [color=#22C55E](+%d)[/color]" % diff_val  # Green
			elif diff_better == "gear2":
				diff_text += " [color=#EF4444](%d)[/color]" % diff_val  # Red

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
	
	# Apply background color
	modulate = colors["background"]
	
	# Apply colors to labels
	if gear1_name:
		gear1_name.modulate = colors["text_primary"]
	if gear2_name:
		gear2_name.modulate = colors["text_primary"]
	if result_label:
		result_label.modulate = colors["text_primary"]

func _on_theme_changed(is_dark: bool) -> void:
	_apply_theme()
