extends Resource
class_name CosmeticSkinData

@export var skin_id: String
@export var skin_name: String
@export var slot_type: int # GearEnums.SlotType
@export var skin_texture: Texture2D
@export var base_gear_required: String = ""
@export var price: int = 0
@export var is_premium: bool = false
