extends Resource
class_name GearData

@export var gear_id: String
@export var gear_name: String
@export var slot_type: GearSlot.SlotType
@export var base_texture: Texture2D
@export var stats: Dictionary = {
	"attack": 0,
	"defense": 0,
	"speed": 0,
	"health": 0
}
@export var rarity: String = "common"
