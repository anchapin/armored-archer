extends Control

signal gear_selected(gear_data: Dictionary)
signal compare_requested(gear_data1: Dictionary, gear_data2: Dictionary)

@onready var gear_list: ItemList = $VBoxContainer/GearList
@onready var gear_details: VBoxContainer = $VBoxContainer/GearDetails
@onready var gear_name_label: Label = $VBoxContainer/GearDetails/GearNameLabel
@onready var gear_rarity_label: Label = $VBoxContainer/GearDetails/GearRarityLabel
@onready var gear_type_label: Label = $VBoxContainer/GearDetails/GearTypeLabel
@onready var gear_stats_container: VBoxContainer = $VBoxContainer/GearDetails/GearStatsContainer
@onready var gear_modifiers_container: VBoxContainer = $VBoxContainer/GearDetails/GearModifiersContainer
@onready var equip_button: Button = $VBoxContainer/GearDetails/EquipButton
@onready var unequip_button: Button = $VBoxContainer/GearDetails/UnequipButton
@onready var compare_button: Button = $VBoxContainer/GearDetails/CompareButton
@onready var back_button: Button = $VBoxContainer/BackButton
@onready var loadout_button: Button = $VBoxContainer/LoadoutButton
@onready var filter_common: CheckBox = $VBoxContainer/FilterContainer/FilterCommon
@onready var filter_rare: CheckBox = $VBoxContainer/FilterContainer/FilterRare
@onready var filter_legendary: CheckBox = $VBoxContainer/FilterContainer/FilterLegendary

var gear_manager: GearManager
var current_gear: Dictionary = {}
var selected_gear_id: String = ""

var rarity_colors: Dictionary = {
	"common": Color.WHITE,
	"rare": Color(0, 0.49, 0.87),
	"legendary": Color(1, 0.5, 0)
}

var gear_types: Dictionary = {
	"helm": "Helm",
	"armor": "Armor",
	"bow": "Bow",
	"arrow": "Arrow",
	"amulet": "Amulet"
}

func _ready() -> void:
	gear_manager = get_node_or_null("/root/GearManager")

	if gear_manager:
		gear_manager.inventory_updated.connect(_on_inventory_updated)
		gear_manager.gear_equipped.connect(_on_gear_equipped)
		gear_manager.gear_unequipped.connect(_on_gear_unequipped)

		if gear_manager.player_inventory.size() > 0:
			_refresh_gear_list()

	_setup_button_connections()
	_setup_signal_connections()
	_update_button_states()

func _setup_signal_connections() -> void:
	compare_requested.connect(show_comparison)

func _setup_button_connections() -> void:
	equip_button.pressed.connect(_on_equip_button_pressed)
	unequip_button.pressed.connect(_on_unequip_button_pressed)
	compare_button.pressed.connect(_on_compare_button_pressed)
	back_button.pressed.connect(_on_back_button_pressed)
	loadout_button.pressed.connect(_on_loadout_button_pressed)
	gear_list.item_selected.connect(_on_gear_list_item_selected)
	filter_common.toggled.connect(_on_filter_toggled)
	filter_rare.toggled.connect(_on_filter_toggled)
	filter_legendary.toggled.connect(_on_filter_toggled)

func _refresh_gear_list() -> void:
	if not gear_manager:
		return

	gear_list.clear()

	var inventory: Dictionary = gear_manager._get_full_inventory()
	var gear_array: Array = inventory.get("gear", [])
	var equipped_gear: Dictionary = inventory.get("equipped_gear", {})

	var filters: Array = []
	if filter_common.button_pressed:
		filters.append("common")
	if filter_rare.button_pressed:
		filters.append("rare")
	if filter_legendary.button_pressed:
		filters.append("legendary")

	for gear_data in gear_array:
		var rarity: String = gear_data.get("rarity", "common")

		if filters.size() > 0 and not rarity in filters:
			continue

		var gear_name: String = gear_data.get("name", "Unknown")
		var gear_id: String = gear_data.get("id", "")

		var item_text: String = gear_name

		if equipped_gear.has(gear_data.get("type", "")) and equipped_gear[gear_data.get("type", "")] == gear_id:
			item_text += " [E]"

		gear_list.add_item(item_text)
		gear_list.set_item_metadata(gear_list.get_item_count() - 1, gear_data)

func _on_gear_list_item_selected(index: int) -> void:
	var gear_data: Dictionary = gear_list.get_item_metadata(index)
	current_gear = gear_data
	selected_gear_id = gear_data.get("id", "")

	_display_gear_details(gear_data)
	_update_button_states()

	gear_selected.emit(gear_data)

func _display_gear_details(gear_data: Dictionary) -> void:
	var rarity: String = gear_data.get("rarity", "common")
	var color: Color = rarity_colors.get(rarity, Color.WHITE)

	gear_name_label.text = gear_data.get("name", "Unknown")
	gear_name_label.modulate = color

	gear_rarity_label.text = rarity.capitalize()
	gear_rarity_label.modulate = color

	gear_type_label.text = gear_types.get(gear_data.get("type", ""), "Unknown")

	_clear_container(gear_stats_container)
	var stats: Array = gear_data.get("stats", [])
	for stat in stats:
		var stat_label: Label = Label.new()
		stat_label.text = "%s: %d" % [stat.get("name", ""), stat.get("value", 0)]
		gear_stats_container.add_child(stat_label)

	_clear_container(gear_modifiers_container)
	var modifiers: Array = gear_data.get("modifiers", [])
	for modifier in modifiers:
		var mod_container: HBoxContainer = HBoxContainer.new()

		var mod_name_label: Label = Label.new()
		mod_name_label.text = modifier.get("name", "Unknown")
		mod_name_label.add_theme_color_override("font_color", Color.YELLOW)

		var mod_desc_label: Label = Label.new()
		mod_desc_label.text = ": %s" % modifier.get("description", "")

		mod_container.add_child(mod_name_label)
		mod_container.add_child(mod_desc_label)
		gear_modifiers_container.add_child(mod_container)

func _clear_container(container: VBoxContainer) -> void:
	for child in container.get_children():
		child.queue_free()

func _update_button_states() -> void:
	if current_gear.is_empty():
		equip_button.disabled = true
		unequip_button.disabled = true
		compare_button.disabled = true
		return

	var gear_type: String = current_gear.get("type", "")
	var inventory: Dictionary = gear_manager._get_full_inventory()
	var equipped_gear: Dictionary = inventory.get("equipped_gear", {})

	var is_equipped: bool = equipped_gear.has(gear_type) and equipped_gear[gear_type] == selected_gear_id

	equip_button.disabled = is_equipped
	unequip_button.disabled = not is_equipped
	compare_button.disabled = is_equipped

func _on_equip_button_pressed() -> void:
	if not current_gear.is_empty() and gear_manager:
		var gear_type: String = current_gear.get("type", "")
		gear_manager.equip_gear(selected_gear_id, gear_type)

func _on_unequip_button_pressed() -> void:
	if not current_gear.is_empty() and gear_manager:
		var gear_type: String = current_gear.get("type", "")
		gear_manager.unequip_gear(gear_type)

func _on_compare_button_pressed() -> void:
	if not current_gear.is_empty():
		var inventory: Dictionary = gear_manager._get_full_inventory()
		var equipped_gear: Dictionary = inventory.get("equipped_gear", {})
		var gear_type: String = current_gear.get("type", "")

		if equipped_gear.has(gear_type) and equipped_gear[gear_type] != selected_gear_id:
			var equipped_gear_id: String = equipped_gear[gear_type]
			var equipped_gear_data: Dictionary = gear_manager.get_gear_by_id(equipped_gear_id)

			if not equipped_gear_data.is_empty():
				compare_requested.emit(current_gear, equipped_gear_data)

func _on_back_button_pressed() -> void:
	queue_free()

func _on_loadout_button_pressed() -> void:
	var loadout_scene = preload("res://scenes/ui/loadout.tscn")
	var loadout_instance = loadout_scene.instantiate()
	get_tree().root.add_child(loadout_instance)

func _on_inventory_updated( _inventory: Dictionary) -> void:
	_refresh_gear_list()

func _on_gear_equipped(_slot: String, _gear_id: String) -> void:
	_refresh_gear_list()
	_display_gear_details(current_gear)
	_update_button_states()

func _on_gear_unequipped( _slot: String) -> void:
	_refresh_gear_list()
	_display_gear_details(current_gear)
	_update_button_states()

func _on_filter_toggled( ) -> void:
	_refresh_gear_list()

func show_comparison(gear1: Dictionary, gear2: Dictionary) -> void:
	var comparison: Dictionary = gear_manager.compare_gear(gear1, gear2)

	var comparison_window: Control = preload("res://scenes/ui/gear_comparison.tscn").instantiate()
	add_child(comparison_window)

	if comparison_window.has_method("set_gear_comparison"):
		comparison_window.set_gear_comparison(gear1, gear2, comparison)

	if comparison_window.has_signal("comparison_closed"):
		comparison_window.comparison_closed.connect(_on_comparison_closed)

func _on_comparison_closed() -> void:
	pass
