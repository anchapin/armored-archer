extends Node2D

class_name ModularCharacterSprite

@onready var helm_slot: GearSlot = $HelmSlot
@onready var armor_slot: GearSlot = $ArmorSlot
@onready var bow_slot: GearSlot = $BowSlot
@onready var arrow_slot: GearSlot = $ArrowSlot

var equipped_base_gear: Dictionary = {
	"helm": "",
	"armor": "",
	"bow": "",
	"arrow": ""
}

var equipped_skins: Dictionary = {
	"helm": "",
	"armor": "",
	"bow": "",
	"arrow": ""
}

func _ready() -> void:
	if helm_slot:
		helm_slot.slot_type = GearSlot.SlotType.HELM
	if armor_slot:
		armor_slot.slot_type = GearSlot.SlotType.ARMOR
	if bow_slot:
		bow_slot.slot_type = GearSlot.SlotType.BOW
	if arrow_slot:
		arrow_slot.slot_type = GearSlot.SlotType.ARROW

func equip_base_gear(slot: String, gear_id: String, texture: Texture2D) -> void:
	var slot_node = _get_slot_node(slot)
	if slot_node:
		slot_node.set_base_gear(gear_id, texture)
		equipped_base_gear[slot] = gear_id

func equip_skin(slot: String, skin_id: String, texture: Texture2D) -> void:
	var slot_node = _get_slot_node(slot)
	if slot_node:
		slot_node.set_skin(skin_id, texture)
		equipped_skins[slot] = skin_id

func unequip_skin(slot: String) -> void:
	var slot_node = _get_slot_node(slot)
	if slot_node:
		slot_node.clear_skin()
		equipped_skins[slot] = ""

func get_equipped_loadout() -> Dictionary:
	return {
		"base_gear": equipped_base_gear.duplicate(),
		"skins": equipped_skins.duplicate()
	}

func _get_slot_node(slot: String) -> GearSlot:
	match slot.to_lower():
		"helm": return helm_slot
		"armor": return armor_slot
		"bow": return bow_slot
		"arrow": return arrow_slot
		_: return null
# Hit reactions to append to modular_character_sprite.gd
