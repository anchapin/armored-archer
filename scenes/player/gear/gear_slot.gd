extends Node2D

class_name GearSlot

signal gear_updated(slot_type: int, gear_data: Dictionary)

enum SlotType {
	HELM,
	ARMOR,
	BOW,
	ARROW,
	AMULET
}

@export var slot_type: SlotType = SlotType.HELM
@onready var base_sprite: Sprite2D = $BaseSprite
@onready var skin_sprite: Sprite2D = $SkinSprite

var gear_manager: Node
var gear_registry: Node

var base_gear_id: String = ""
var skin_id: String = ""

# Map slot enum to string for GearManager
var slot_type_strings: Dictionary = {
	SlotType.HELM: "helm",
	SlotType.ARMOR: "armor",
	SlotType.BOW: "bow",
	SlotType.ARROW: "arrow",
	SlotType.AMULET: "amulet"
}

func _ready() -> void:
	skin_sprite.visible = false

	# Get references to managers
	gear_manager = get_node_or_null("/root/GearManager")
	gear_registry = get_node_or_null("/root/GearRegistry")

	# Connect to gear manager signals if available
	if gear_manager:
		var _err1 = gear_manager.inventory_updated.connect(_on_inventory_updated)
		var _err2 = gear_manager.gear_equipped.connect(_on_gear_equipped)
		var _err3 = gear_manager.gear_unequipped.connect(_on_gear_unequipped)

		# Load initial equipped gear
		_refresh_equipped_gear()

func _on_inventory_updated(_inventory: Dictionary) -> void:
	_refresh_equipped_gear()

func _on_gear_equipped(slot: String, _gear_id: String) -> void:
	var expected_slot: String = slot_type_strings.get(slot_type, "")
	if slot == expected_slot:
		_refresh_equipped_gear()

func _on_gear_unequipped(slot: String) -> void:
	var expected_slot: String = slot_type_strings.get(slot_type, "")
	if slot == expected_slot:
		_refresh_equipped_gear()

func _refresh_equipped_gear() -> void:
	if not gear_manager:
		return

	var slot_string: String = slot_type_strings.get(slot_type, "")
	if slot_string.is_empty():
		return

	var equipped_gear: Dictionary = gear_manager.get_equipped_gear(slot_string)

	if not equipped_gear.is_empty():
		var gear_id: String = equipped_gear.get("id", "")
		base_gear_id = gear_id

		# Try to get texture from GearRegistry if available
		if gear_registry and gear_registry.has_method("get_gear_texture"):
			var texture = gear_registry.get_gear_texture(gear_id, slot_type)
			if texture:
				_set_base_sprite_texture(texture)
				return

		# Show the base sprite without texture (fallback)
		if base_sprite:
			base_sprite.visible = true
	else:
		# Clear gear
		base_gear_id = ""
		if base_sprite:
			base_sprite.visible = false

	gear_updated.emit(slot_type, equipped_gear)

func _set_base_sprite_texture(texture: Texture2D) -> void:
	if base_sprite:
		base_sprite.texture = texture
		base_sprite.visible = true

func set_skin(p_skin_id: String, p_texture: Texture2D) -> void:
	"""Updates the slot with a specific cosmetic skin.

	Parameters:
		p_skin_id: Identifier of the skin to apply
		p_texture: Texture resource for the skin
	"""
	skin_id = p_skin_id
	if skin_sprite:
		skin_sprite.texture = p_texture
		skin_sprite.visible = true

func clear_skin() -> void:
	skin_id = ""
	if skin_sprite:
		skin_sprite.visible = false

func get_equipped_gear() -> Dictionary:
	return {
		"base_gear_id": base_gear_id,
		"skin_id": skin_id,
		"slot_type": slot_type
	}
