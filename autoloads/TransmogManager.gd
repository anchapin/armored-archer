extends Node

class_name TransmogManager

signal transmog_applied(slot: String, base_gear_id: String, skin_id: String)

var current_loadout: Dictionary = {
	"base_gear": {
		"helm": "helm_basic",
		"armor": "armor_leather",
		"bow": "bow_wooden",
		"arrow": "arrow_wooden"
	},
	"skins": {
		"helm": "",
		"armor": "",
		"bow": "",
		"arrow": ""
	}
}

var gear_registry: GearRegistry
var character_sprite: ModularCharacterSprite

func _ready() -> void:
	gear_registry = GearRegistry.new()
	gear_registry._ready()

func set_character_sprite(sprite: ModularCharacterSprite) -> void:
	character_sprite = sprite
	_apply_current_loadout()

func equip_base_gear(slot: String, gear_id: String) -> bool:
	var gear_data = gear_registry.get_base_gear(gear_id)
	if not gear_data:
		return false
	current_loadout.base_gear[slot] = gear_id
	if character_sprite:
		character_sprite.equip_base_gear(slot, gear_id, gear_data.base_texture)
	transmog_applied.emit(slot, gear_id, current_loadout.skins.get(slot, ""))
	return true

func equip_skin(slot: String, skin_id: String) -> bool:
	var skin_data = gear_registry.get_skin(skin_id)
	if not skin_data:
		return false
	var current_base_gear = current_loadout.base_gear.get(slot, "")
	if current_base_gear != skin_data.base_gear_required:
		push_warning("Cannot equip skin %s: requires base gear %s, currently have %s" % [skin_id, skin_data.base_gear_required, current_base_gear])
		return false
	current_loadout.skins[slot] = skin_id
	if character_sprite:
		character_sprite.equip_skin(slot, skin_id, skin_data.skin_texture)
	transmog_applied.emit(slot, current_loadout.base_gear.get(slot, ""), skin_id)
	return true

func unequip_skin(slot: String) -> void:
	current_loadout.skins[slot] = ""
	if character_sprite:
		character_sprite.unequip_skin(slot)
	transmog_applied.emit(slot, current_loadout.base_gear.get(slot, ""), "")

func get_current_loadout() -> Dictionary:
	return current_loadout.duplicate(true)

func get_total_stats() -> Dictionary:
	return gear_registry.calculate_total_stats(current_loadout)

func get_visual_combination(slot: String) -> Dictionary:
	var base_gear_id = current_loadout.base_gear.get(slot, "")
	var skin_id = current_loadout.skins.get(slot, "")
	var base_gear_data = gear_registry.get_base_gear(base_gear_id)
	var skin_data = gear_registry.get_skin(skin_id)
	return {
		"slot": slot,
		"base_gear": base_gear_data,
		"skin": skin_data,
		"base_texture": base_gear_data.base_texture if base_gear_data else null,
		"skin_texture": skin_data.skin_texture if skin_data else null
	}

func preview_combination(slot: String, base_gear_id: String, skin_id: String) -> Dictionary:
	var base_gear_data = gear_registry.get_base_gear(base_gear_id)
	var skin_data = gear_registry.get_skin(skin_id)
	return {
		"slot": slot,
		"base_gear": base_gear_data,
		"skin": skin_data,
		"base_texture": base_gear_data.base_texture if base_gear_data else null,
		"skin_texture": skin_data.skin_texture if skin_data else null
	}

func _apply_current_loadout() -> void:
	for slot in ["helm", "armor", "bow", "arrow"]:
		var base_gear_id = current_loadout.base_gear.get(slot, "")
		var skin_id = current_loadout.skins.get(slot, "")
		if base_gear_id:
			var gear_data = gear_registry.get_base_gear(base_gear_id)
			if gear_data and character_sprite:
				character_sprite.equip_base_gear(slot, base_gear_id, gear_data.base_texture)
		if skin_id:
			var skin_data = gear_registry.get_skin(skin_id)
			if skin_data and character_sprite:
				character_sprite.equip_skin(slot, skin_id, skin_data.skin_texture)

func can_equip_skin(slot: String, skin_id: String) -> bool:
	var skin_data = gear_registry.get_skin(skin_id)
	if not skin_data:
		return false
	var current_base_gear = current_loadout.base_gear.get(slot, "")
	return current_base_gear == skin_data.base_gear_required

func get_available_skins_for_slot(slot: String) -> Array:
	var available_skins: Array = []
	var current_base_gear = current_loadout.base_gear.get(slot, "")
	for skin_data in gear_registry.skin_db.values():
		if skin_data.base_gear_required == current_base_gear:
			available_skins.append(skin_data)
	return available_skins
