extends Control

class_name GearPreviewPanel
const GearEnums = preload("res://scripts/gear_enums.gd")

## Panel for previewing gear and cosmetic skins.
## Allows users to browse gear, preview items, and equip them.

# --- Node References ---
@onready var character_sprite: ModularCharacterSprite = $CenterContainer/CharacterPreview
@onready var title_label: Label = $TitleLabel
@onready var stats_label: Label = $StatsLabel
@onready var preview_mode: OptionButton = $PreviewModeButton
@onready var slot_selector: OptionButton = $SlotSelector
@onready var item_selector: OptionButton = $ItemSelector
@onready var equip_button: Button = $EquipButton
@onready var unequip_skin_button: Button = $UnequipSkinButton

# --- State ---
var current_slot: String = "helm"
var current_item_id: String = ""
var show_skin: bool = false
var gear_registry: GearRegistry

# --- Signal connections for cleanup ---
var _preview_mode_connection: int = -1
var _slot_selector_connection: int = -1
var _item_selector_connection: int = -1
var _equip_button_connection: int = -1
var _unequip_skin_connection: int = -1

var _slot_handlers: Dictionary = {}

enum PreviewMode {
	BASE_GEAR,
	SKIN
}

func _ready() -> void:
	gear_registry = GearRegistry.new()
	gear_registry._ready()

	_setup_ui()
	_update_preview()

func _exit_tree() -> void:
	## Clean up all signal connections to prevent memory leaks
	_disconnect_signal(preview_mode, "item_selected")
	_disconnect_signal(slot_selector, "item_selected")
	_disconnect_signal(item_selector, "item_selected")
	_disconnect_signal(equip_button, "pressed")
	_disconnect_signal(unequip_skin_button, "pressed")

## Helper to safely disconnect signals
func _disconnect_signal(node: Node, signal_name: String) -> void:
	if node:
		node.disconnect(signal_name, _on_preview_mode_changed)
		node.disconnect(signal_name, _on_slot_changed)
		node.disconnect(signal_name, _on_item_changed)
		node.disconnect(signal_name, _on_equip_pressed)
		node.disconnect(signal_name, _on_unequip_skin_pressed)

func _setup_ui() -> void:
	preview_mode.clear()
	preview_mode.add_item("Base Gear", PreviewMode.BASE_GEAR)
	preview_mode.add_item("Skin", PreviewMode.SKIN)

	slot_selector.clear()
	slot_selector.add_item("Helm")
	slot_selector.add_item("Armor")
	slot_selector.add_item("Bow")
	slot_selector.add_item("Arrow")
	slot_selector.add_item("Amulet")

	# Initialize slot handlers with Callable references
	_slot_handlers[GearEnums.SlotType.HELM] = _on_helm_selected
	_slot_handlers[GearEnums.SlotType.ARMOR] = _on_armor_selected
	_slot_handlers[GearEnums.SlotType.BOW] = _on_bow_selected
	_slot_handlers[GearEnums.SlotType.ARROW] = _on_arrow_selected
	_slot_handlers[GearEnums.SlotType.AMULET] = _on_amulet_selected

	# Connect signals - connect() returns int connection ID so we need to store it
	var _preview_conn = preview_mode.item_selected.connect(_on_preview_mode_changed)
	var _slot_conn = slot_selector.item_selected.connect(_on_slot_changed)
	var _item_conn = item_selector.item_selected.connect(_on_item_changed)
	var _equip_conn = equip_button.pressed.connect(_on_equip_pressed)
	var _unequip_conn = unequip_skin_button.pressed.connect(_on_unequip_skin_pressed)

	_on_preview_mode_changed(0)
	_on_slot_changed(0)

func _on_preview_mode_changed(index: int) -> void:
	show_skin = (index == PreviewMode.SKIN)
	if unequip_skin_button:
		unequip_skin_button.visible = show_skin
	_update_item_selector()
	_update_preview()

func _on_slot_changed(index: int) -> void:
	match index:
		0: current_slot = "helm"
		1: current_slot = "armor"
		2: current_slot = "bow"
		3: current_slot = "arrow"
		4: current_slot = "amulet"

	var _st = _get_slot_type()
	if _slot_handlers.has(_st):
		_slot_handlers[_st].call()

	_update_item_selector()
	_update_preview()

func _on_helm_selected() -> void: pass
func _on_armor_selected() -> void: pass
func _on_bow_selected() -> void: pass
func _on_arrow_selected() -> void: pass
func _on_amulet_selected() -> void: pass

func _on_item_changed(index: int) -> void:
	if index == 0:
		current_item_id = ""
	else:
		var items: Array = _get_available_items()
		if index - 1 < items.size():
			current_item_id = items[index - 1]
	_update_preview()

func _on_slot_selected(_slot_type: GearEnums.SlotType) -> void:
	if _slot_handlers.has(_slot_type):
		_slot_handlers[_slot_type].call()

func _get_available_items() -> Array:
	var items: Array = []
	var slot_type = _get_slot_type()

	if show_skin:
		if gear_registry and gear_registry.skin_db:
			for skin_data in gear_registry.skin_db.values():
				if skin_data and skin_data.slot_type == slot_type:
					items.append(skin_data.skin_id)
	else:
		if gear_registry and gear_registry.base_gear_db:
			for gear_data in gear_registry.base_gear_db.values():
				if gear_data and gear_data.slot_type == slot_type:
					items.append(gear_data.gear_id)

	return items

func _update_item_selector() -> void:
	item_selector.clear()
	item_selector.add_item("None")

	var items: Array = _get_available_items()
	for id in items:
		var data = GearRegistry.get_gear_data(id) if not show_skin else GearRegistry.get_skin_data(id)
		if data:
			item_selector.add_item(data.gear_name)

	item_selector.select(0)
	current_item_id = ""

func _update_preview() -> void:
	if not character_sprite:
		return

	var slot_type = _get_slot_type()

	if not show_skin:
		var gear_data = GearRegistry.get_gear_data(current_item_id)
		if gear_data:
			character_sprite.equip_base_gear(current_slot, current_item_id, gear_data.base_texture if "base_texture" in gear_data else null)
			_show_stats(gear_data.stats if "stats" in gear_data else {}, gear_data.rarity if "rarity" in gear_data else "")
			title_label.text = gear_data.gear_name
		else:
			character_sprite.equip_base_gear(current_slot, "", null)
			_show_stats({}, "")
			title_label.text = "No Item Selected"
	else:
		var skin_data = GearRegistry.get_skin_data(current_item_id)
		if skin_data:
			character_sprite.equip_skin(current_slot, current_item_id, skin_data.skin_texture if "skin_texture" in skin_data else null)
			_show_skin_info(skin_data)
			title_label.text = skin_data.skin_name
		else:
			_clear_skin_preview()

func _show_stats(stats: Dictionary, rarity: String) -> void:
	var stats_text = ""
	if not stats.is_empty():
		stats_text += "Stats:\n"
		for stat_name in stats.keys():
			stats_text += "  %s: %s\n" % [stat_name.capitalize(), stats[stat_name]]

	if not rarity.is_empty():
		stats_text += "Rarity: %s\n" % rarity.capitalize()

	stats_label.text = stats_text

func _show_skin_info(skin_data: Dictionary) -> void:
	var info_text = "Skin:\n"
	info_text += "  Name: %s\n" % skin_data.skin_name
	info_text += "  ID: %s\n" % skin_data.skin_id
	stats_label.text = info_text

func _clear_skin_preview() -> void:
	character_sprite.unequip_skin(current_slot)
	title_label.text = "No Skin Selected"
	stats_label.text = ""

func _get_slot_type() -> GearEnums.SlotType:
	match current_slot:
		"helm": return GearEnums.SlotType.HELM
		"armor": return GearEnums.SlotType.ARMOR
		"bow": return GearEnums.SlotType.BOW
		"arrow": return GearEnums.SlotType.ARROW
		"amulet": return GearEnums.SlotType.AMULET
		_: return GearEnums.SlotType.HELM

func _on_equip_pressed() -> void:
	if current_item_id.is_empty():
		return

	# Logic to equip would go here
	pass

func _on_unequip_skin_pressed() -> void:
	character_sprite.unequip_skin(current_slot)
	current_item_id = ""
	item_selector.select(0)
	_update_preview()
