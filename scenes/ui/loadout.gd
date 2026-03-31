## Loadout management UI for player equipment.
## Allows players to view and manage their equipped gear across 5 slots.
## Supports both tap-to-equip and drag-and-drop interactions.
##
extends Control

# Import gear enums for constant definitions
const GearEnums = preload("res://scripts/gear_enums.gd")

signal slot_clicked(slot_type: int)
signal gear_dragged(gear_data: Dictionary, from_slot: int)

@onready var slots_container: GridContainer = $VBoxContainer/SlotsContainer
@onready var stats_container: VBoxContainer = $VBoxContainer/StatsContainer
@onready var back_button: Button = $VBoxContainer/BackButton
@onready var inventory_button: Button = $VBoxContainer/InventoryButton

# --- Theme Manager Reference ---
var theme_manager: Node

var gear_manager: GearManager
var gear_registry: GearRegistry
var equipped_slots: Dictionary = {}
var slot_nodes: Dictionary = {}

const SLOT_SCENE: PackedScene = preload("res://scenes/ui/loadout_slot.tscn")

# Use GearEnums.GearType for compile-time constants
const SLOT_ORDER: Array = [
	GearEnums.GearType.HELM,
	GearEnums.GearType.ARMOR,
	GearEnums.GearType.BOW,
	GearEnums.GearType.ARROW,
	GearEnums.GearType.AMULET
]

const SLOT_NAMES: Dictionary = {
	GearEnums.GearType.HELM: "Helm",
	GearEnums.GearType.ARMOR: "Armor",
	GearEnums.GearType.BOW: "Bow",
	GearEnums.GearType.ARROW: "Arrow",
	GearEnums.GearType.AMULET: "Amulet"
}

var rarity_colors: Dictionary = {
	"common": Color.WHITE,
	"uncommon": Color(0, 0.8, 0),
	"rare": Color(0, 0.49, 0.87),
	"legendary": Color(1, 0.5, 0)
}

func _ready() -> void:
	# Get ThemeManager reference
	theme_manager = get_node_or_null("/root/ThemeManager")
	
	# Apply theme if available
	if theme_manager:
		_apply_theme()
		theme_manager.theme_changed.connect(_on_theme_changed)
	
	gear_manager = get_node_or_null("/root/GearManager")
	gear_registry = get_node_or_null("/root/GearRegistry")

	_setup_button_connections()
	_create_slot_nodes()

	if gear_manager:
		gear_manager.inventory_updated.connect(_on_inventory_updated)
		gear_manager.gear_equipped.connect(_on_gear_equipped)
		gear_manager.gear_unequipped.connect(_on_gear_unequipped)
		_refresh_loadout()

func _setup_button_connections() -> void:
	back_button.pressed.connect(_on_back_button_pressed)
	inventory_button.pressed.connect(_on_inventory_button_pressed)

func _create_slot_nodes() -> void:
	for slot_type in SLOT_ORDER:
		var slot_control: Control = SLOT_SCENE.instantiate()
		slot_control.slot_type = slot_type
		slot_control.slot_name = SLOT_NAMES[slot_type]
		slot_control.slot_clicked.connect(_on_slot_clicked)
		slot_control.gear_dropped.connect(_on_gear_dropped)
		slots_container.add_child(slot_control)
		slot_nodes[slot_type] = slot_control

func _refresh_loadout() -> void:
	if not gear_manager:
		return

	var inventory: Dictionary = gear_manager._get_full_inventory()
	equipped_slots = inventory.get("equipped_gear", {})

	for slot_type in SLOT_ORDER:
		var slot_control = slot_nodes.get(slot_type)
		if slot_control:
			var gear_id: String = equipped_slots.get(_get_slot_key(slot_type), "")
			if gear_id:
				var gear_data: Dictionary = gear_manager.get_gear_by_id(gear_id)
				slot_control.set_gear(gear_data)
			else:
				slot_control.clear_gear()

	_update_stats_display()

func _get_slot_key(slot_type: int) -> String:
	match slot_type:
		GearEnums.GearType.HELM:
			return "helm"
		GearEnums.GearType.ARMOR:
			return "armor"
		GearEnums.GearType.BOW:
			return "bow"
		GearEnums.GearType.ARROW:
			return "arrow"
		GearEnums.GearType.AMULET:
			return "amulet"
	return ""

func _update_stats_display() -> void:
	_clear_stats_container()

	if not gear_registry:
		return

	var total_stats: Dictionary = {"attack": 0, "defense": 0, "speed": 0, "health": 0}
	var inventory: Dictionary = gear_manager._get_full_inventory()
	var equipped: Dictionary = inventory.get("equipped_gear", {})

	for slot_key in equipped.keys():
		var gear_id: String = equipped[slot_key]
		var gear_data: Dictionary = gear_manager.get_gear_by_id(gear_id)

		if not gear_data.is_empty():
			# Get base gear ID from gear data
			var base_gear_id: String = gear_data.get("base_gear_id", "")
			if base_gear_id.is_empty():
				# Fallback: try using type as base_gear_id lookup
				base_gear_id = gear_data.get("type", "")

			var base_gear_data: GearData = gear_registry.get_base_gear(base_gear_id)
			if base_gear_data:
				var stats: Dictionary = base_gear_data.stats
				for stat_key in total_stats.keys():
					total_stats[stat_key] += stats.get(stat_key, 0)

			# Also add any direct stats from the gear item
			var direct_stats: Array = gear_data.get("stats", [])
			for stat_entry in direct_stats:
				var stat_name: String = stat_entry.get("name", "")
				var stat_value: int = stat_entry.get("value", 0)
				if stat_name in total_stats:
					total_stats[stat_name] += stat_value

	_add_stat_label("Attack", total_stats.get("attack", 0))
	_add_stat_label("Defense", total_stats.get("defense", 0))
	_add_stat_label("Speed", total_stats.get("speed", 0))
	_add_stat_label("Health", total_stats.get("health", 0))

func _clear_stats_container() -> void:
	for child in stats_container.get_children():
		child.queue_free()

func _add_stat_label(stat_name: String, stat_value: int) -> void:
	var label: Label = Label.new()
	label.text = "%s: %d" % [stat_name, stat_value]
	stats_container.add_child(label)

func _on_slot_clicked(slot_type: int) -> void:
	slot_clicked.emit(slot_type)

func _on_gear_dropped(gear_data: Dictionary, target_slot: int) -> void:
	if not gear_manager:
		return

	# Get the gear type as string (e.g., "helm", "armor", "bow", "arrow", "amulet")
	var gear_slot_str: String = _get_slot_key(target_slot)
	var gear_type_str: String = gear_data.get("type", "")

	if gear_type_str != gear_slot_str:
		return

	var gear_id: String = gear_data.get("id", "")
	if gear_id:
		gear_manager.equip_gear(gear_id, gear_slot_str)

func _on_back_button_pressed() -> void:
	# Show the main menu again
	var main_menu = get_tree().root.get_node_or_null("MainMenu")
	if main_menu:
		main_menu.visible = true
	queue_free()

func _on_inventory_button_pressed() -> void:
	var inventory_scene = load("res://scenes/ui/gear_inventory.tscn")
	if inventory_scene:
		var inventory: Control = inventory_scene.instantiate()
		add_child(inventory)

func _on_inventory_updated(_inventory: Dictionary) -> void:
	_refresh_loadout()

func _on_gear_equipped(_slot: String, _gear_id: String) -> void:
	_refresh_loadout()

func _on_gear_unequipped(_slot: String) -> void:
	_refresh_loadout()


func _exit_tree() -> void:
	# Disconnect signals to prevent memory leaks
	if gear_manager:
		if gear_manager.inventory_updated.is_connected(_on_inventory_updated):
			gear_manager.inventory_updated.disconnect(_on_inventory_updated)
		if gear_manager.gear_equipped.is_connected(_on_gear_equipped):
			gear_manager.gear_equipped.disconnect(_on_gear_equipped)
		if gear_manager.gear_unequipped.is_connected(_on_gear_unequipped):
			gear_manager.gear_unequipped.disconnect(_on_gear_unequipped)
	
	# Disconnect theme manager
	if theme_manager and theme_manager.theme_changed.is_connected(_on_theme_changed):
		theme_manager.theme_changed.disconnect(_on_theme_changed)

# --- Theme Support ---
func _apply_theme() -> void:
	if not theme_manager:
		return
	
	var colors = theme_manager.get_theme_colors()
	
	# Apply background color
	modulate = colors["background"]
	
	# Apply to stats container
	if stats_container:
		stats_container.modulate = colors["surface"]

func _on_theme_changed(is_dark: bool) -> void:
	_apply_theme()
