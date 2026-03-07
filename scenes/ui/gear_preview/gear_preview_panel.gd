extends Control

class_name GearPreviewPanel

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
var _preview_mode_connection: Callable = Callable()
var _slot_selector_connection: Callable = Callable()
var _item_selector_connection: Callable = Callable()
var _equip_button_connection: Callable = Callable()
var _unequip_skin_connection: Callable = Callable()

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
	_cleanup_signal_connection(preview_mode, "item_selected", _preview_mode_connection)
	_cleanup_signal_connection(slot_selector, "item_selected", _slot_selector_connection)
	_cleanup_signal_connection(item_selector, "item_selected", _item_selector_connection)
	_cleanup_signal_connection(equip_button, "pressed", _equip_button_connection)
	_cleanup_signal_connection(unequip_skin_button, "pressed", _unequip_skin_connection)

## Helper to safely disconnect signals
func _cleanup_signal_connection(node: Node, signal_name: String, connection: Callable) -> void:
	if node and connection.is_valid() and node.is_connected(signal_name, connection):
		node.disconnect(signal_name, connection)

func _setup_ui() -> void:
	preview_mode.clear()
	preview_mode.add_item("Base Gear", PreviewMode.BASE_GEAR)
	preview_mode.add_item("Skin", PreviewMode.SKIN)

	slot_selector.clear()
	slot_selector.add_item("Helm")
	slot_selector.add_item("Armor")
	slot_selector.add_item("Bow")
	slot_selector.add_item("Arrow")

	## Connect signals with Callable references for proper cleanup
	_preview_mode_connection = preview_mode.item_selected.connect(_on_preview_mode_changed)
	_slot_selector_connection = slot_selector.item_selected.connect(_on_slot_changed)
	_item_selector_connection = item_selector.item_selected.connect(_on_item_changed)
	_equip_button_connection = equip_button.pressed.connect(_on_equip_pressed)
	_unequip_skin_connection = unequip_skin_button.pressed.connect(_on_unequip_skin_pressed)

	_on_preview_mode_changed(0)
	_on_slot_changed(0)

func _on_preview_mode_changed(index: int) -> void:
	show_skin = (index == PreviewMode.SKIN)
	if unequip_skin_button:
		unequip_skin_button.visible = show_skin
	_update_item_selector()
	_update_preview()

func _on_slot_changed(index: int) -> void:
	var slots: Array[String] = ["helm", "armor", "bow", "arrow"]
	if index >= 0 and index < slots.size():
		current_slot = slots[index]
		_update_item_selector()
		_update_preview()

func _on_item_changed(index: int) -> void:
	if index == 0:
		current_item_id = ""
	else:
		var items: Array = _get_available_items()
		if index - 1 < items.size():
			current_item_id = items[index - 1]
	_update_preview()

func _get_available_items() -> Array:
	var items: Array = []
	var slot_type: GearSlot.SlotType = _get_slot_type()

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
	if not item_selector:
		return

	item_selector.clear()
	item_selector.add_item("None")

	var items: Array = _get_available_items()
	for item_id in items:
		var item_name: String = ""
		if show_skin:
			var skin_data = null
			if gear_registry:
				skin_data = gear_registry.get_skin(item_id)
			item_name = skin_data.skin_name if skin_data else item_id
		else:
			var gear_data = null
			if gear_registry:
				gear_data = gear_registry.get_base_gear(item_id)
			item_name = gear_data.gear_name if gear_data else item_id
		item_selector.add_item(item_name)

	item_selector.select(0)
	current_item_id = ""

func _update_preview() -> void:
	if not character_sprite:
		return

	var slot_type = _get_slot_type()

	if not show_skin:
		var gear_data = gear_registry.get_base_gear(current_item_id)
		if gear_data:
			character_sprite.equip_base_gear(current_slot, current_item_id, gear_data.base_texture)
			_show_stats(gear_data.stats, gear_data.rarity)
			title_label.text = gear_data.gear_name
		else:
			character_sprite.equip_base_gear(current_slot, "", null)
			_show_stats({}, "")
			title_label.text = "No Item Selected"
	else:
		var skin_data = gear_registry.get_skin(current_item_id)
		if skin_data:
			var base_gear = gear_registry.get_base_gear(skin_data.base_gear_required)
			if base_gear:
				character_sprite.equip_base_gear(current_slot, skin_data.base_gear_required, base_gear.base_texture)
			character_sprite.equip_skin(current_slot, current_item_id, skin_data.skin_texture)
			_show_skin_info(skin_data)
			title_label.text = skin_data.skin_name
		else:
			_clear_skin_preview()

func _show_stats(stats: Dictionary, rarity: String) -> void:
	if stats.is_empty():
		stats_label.text = "No stats"
	else:
		var stats_text = "Stats:\n"
		for stat in stats:
			var value = stats[stat]
			if value != 0:
				stats_text += "%s: +%d\n" % [stat.capitalize(), value]
		stats_text += "Rarity: %s" % rarity.capitalize()
		stats_label.text = stats_text

func _show_skin_info(skin_data: CosmeticSkinData) -> void:
	var base_gear = gear_registry.get_base_gear(skin_data.base_gear_required)
	var info_text = "Cosmetic Skin (Purely Visual)\n"
	info_text += "Requires: %s\n" % (base_gear.gear_name if base_gear else "Unknown")
	info_text += "Price: %d gold" % skin_data.price
	if skin_data.is_premium:
		info_text += " (Premium)"
	stats_label.text = info_text

func _clear_skin_preview() -> void:
	character_sprite.unequip_skin(current_slot)
	stats_label.text = "No skin selected"
	title_label.text = "No Item Selected"

func _get_slot_type() -> GearSlot.SlotType:
	match current_slot:
		"helm": return GearSlot.SlotType.HELM
		"armor": return GearSlot.SlotType.ARMOR
		"bow": return GearSlot.SlotType.BOW
		"arrow": return GearSlot.SlotType.ARROW
		_: return GearSlot.SlotType.HELM

func _on_equip_pressed() -> void:
	if current_item_id.is_empty():
		return

	var loadout = character_sprite.get_equipped_loadout()

func _on_unequip_skin_pressed() -> void:
	character_sprite.unequip_skin(current_slot)
	_update_preview()
