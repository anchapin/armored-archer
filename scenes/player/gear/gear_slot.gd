extends Node2D

class_name GearSlot

enum SlotType {
	HELM,
	ARMOR,
	BOW,
	ARROW
}

@export var slot_type: SlotType = SlotType.HELM
@onready var base_sprite: Sprite2D = $BaseSprite
@onready var skin_sprite: Sprite2D = $SkinSprite

var base_gear_id: String = ""
var skin_id: String = ""

func _ready() -> void:
	skin_sprite.visible = false

func set_base_gear(gear_id: String, texture: Texture2D) -> void:
	base_gear_id = gear_id
	if base_sprite:
		base_sprite.texture = texture
		base_sprite.visible = true

func set_skin(skin_id: String, texture: Texture2D) -> void:
	self.skin_id = skin_id
	if skin_sprite:
		skin_sprite.texture = texture
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
