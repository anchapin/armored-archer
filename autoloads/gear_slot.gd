extends Node2D
class_name GearSlot

## Gear slot for modular character sprite equipment.
## Handles displaying base gear and cosmetic skins for a specific slot.
##
## Usage:
## - Add to ModularCharacterSprite scene
## - Set slot_type to appropriate enum value
## - Call set_base_gear() and set_skin() to update visuals

# Import gear enums for type definitions
const GearEnums = preload("res://scripts/gear_enums.gd")

# --- Slot Configuration ---
@export var slot_type: GearEnums.GearType = GearEnums.GearType.HELM

# --- Visual Elements ---
@onready var sprite: Sprite2D = $Sprite2D

# --- Current Equipment ---
var current_gear_id: String = ""
var current_skin_id: String = ""
var current_base_texture: Texture2D
var current_skin_texture: Texture2D

func _ready() -> void:
	if not sprite:
		sprite = Sprite2D.new()
		add_child(sprite)

func set_base_gear(gear_id: String, texture: Texture2D) -> void:
	"""Sets the base gear for this slot (stats only, skin may override).

	Parameters:
		gear_id: Gear identifier
		texture: Base gear texture
	"""
	current_gear_id = gear_id
	current_base_texture = texture
	_update_sprite()

func set_skin(skin_id: String, texture: Texture2D) -> void:
	"""Sets a cosmetic skin over the base gear.

	Parameters:
		skin_id: Skin identifier
		texture: Skin texture (overrides base)
	"""
	current_skin_id = skin_id
	current_skin_texture = texture
	_update_sprite()

func clear_skin() -> void:
	"""Removes the cosmetic skin, showing only base gear."""
	current_skin_id = ""
	current_skin_texture = null
	_update_sprite()

func _update_sprite() -> void:
	"""Updates the sprite texture based on current base gear and skin (internal)."""
	if current_skin_texture:
		sprite.texture = current_skin_texture
	elif current_base_texture:
		sprite.texture = current_base_texture
	else:
		sprite.texture = null

func get_equipment_info() -> Dictionary:
	"""Returns information about currently equipped gear and skin.

	Returns:
		Dictionary: With gear_id, skin_id, slot_type, and texture info
	"""
	return {
		"gear_id": current_gear_id,
		"skin_id": current_skin_id,
		"slot_type": slot_type,
		"current_texture": sprite.texture
	}
