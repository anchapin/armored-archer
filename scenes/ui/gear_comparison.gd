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

var rarity_colors: Dictionary = {
	"common": Color.WHITE,
	"rare": Color(0, 0.49, 0.87),
	"legendary": Color(1, 0.5, 0)
}

func _ready() -> void:
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

	match better:
		"gear1":
			result_label.text = "Left gear is better"
			result_label.modulate = Color.GREEN
		"gear2":
			result_label.text = "Right gear is better"
			result_label.modulate = Color.GREEN
		"equal":
			result_label.text = "Both gear are equal"
			result_label.modulate = Color.YELLOW

func _on_close_button_pressed() -> void:
	comparison_closed.emit()
	queue_free()
