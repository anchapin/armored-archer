## Individual equipment slot for loadout UI.
## Supports tap-to-select and drag-and-drop for equipping gear.
##
extends Control

signal slot_clicked(slot_type: int)
signal gear_dropped(gear_data: Dictionary, target_slot: int)

var slot_type: int = 0
var slot_name: String = ""
var current_gear: Dictionary = {}

@onready var slot_button: Button = $SlotButton
@onready var slot_label: Label = $SlotLabel
@onready var gear_name_label: Label = $GearNameLabel
@onready var gear_icon: TextureRect = $GearIcon

func _ready() -> void:
	slot_button.pressed.connect(_on_slot_button_pressed)
	slot_button.drag_started.connect(_on_drag_started)
	slot_button.drag_ended.connect(_on_drag_ended)
	slot_button.drop_ended.connect(_on_drop_ended)

	# Enable drop on the slot button
	slot_button.set_drag_forwarding(_get_drag_data, _can_drop_data, _drop_data)

	_update_display()

func _update_display() -> void:
	slot_label.text = slot_name

	if current_gear.is_empty():
		gear_name_label.text = "Empty"
		gear_name_label.modulate = Color(0.5, 0.5, 0.5)
		gear_icon.texture = null
	else:
		var gear_name: String = current_gear.get("name", "Unknown")
		gear_name_label.text = gear_name

		var rarity: String = current_gear.get("rarity", "common")
		var rarity_colors: Dictionary = {
			"common": Color.WHITE,
			"uncommon": Color(0, 0.8, 0),
			"rare": Color(0, 0.49, 0.87),
			"legendary": Color(1, 0.5, 0)
		}
		gear_name_label.modulate = rarity_colors.get(rarity, Color.WHITE)

func set_gear(gear_data: Dictionary) -> void:
	current_gear = gear_data
	_update_display()

func clear_gear() -> void:
	current_gear = {}
	_update_display()

func _on_slot_button_pressed() -> void:
	slot_clicked.emit(slot_type)

func _get_drag_data(_at_position: Vector2) -> Variant:
	if current_gear.is_empty():
		return null

	var preview: Control = Control.new()
	var label: Label = Label.new()
	label.text = current_gear.get("name", "Gear")
	preview.add_child(label)
	preview.set_anchors_preset(Control.PRESET_CENTER)

	current_gear["_drag_source_slot"] = slot_type

	return current_gear

func _can_drop_data(_at_position: Vector2, data: Variant) -> bool:
	if typeof(data) != TYPE_DICTIONARY:
		return false

	var gear_data: Dictionary = data
	var gear_slot_str: String = gear_data.get("type", "")
	var target_slot_str: String = _get_slot_key(slot_type)

	return gear_slot_str == target_slot_str

func _drop_data(_at_position: Vector2, data: Variant) -> void:
	gear_dropped.emit(data, slot_type)

func _on_drag_started() -> void:
	pass

func _on_drag_ended(_bool: bool) -> void:
	pass

func _on_drop_ended(_bool: bool) -> void:
	pass

func _get_slot_key(type_val: int) -> String:
	match type_val:
		GearRegistry.GearSlot.SlotType.HELM:
			return "helm"
		GearRegistry.GearSlot.SlotType.ARMOR:
			return "armor"
		GearRegistry.GearSlot.SlotType.BOW:
			return "bow"
		GearRegistry.GearSlot.SlotType.ARROW:
			return "arrow"
		GearRegistry.GearSlot.SlotType.AMULET:
			return "amulet"
	return ""
