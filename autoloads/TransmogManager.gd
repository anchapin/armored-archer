## Manages visual transmog system combining base gear with cosmetic skins.
## Controls character appearance independent of equipment stats.
##
## Signals:
## - transmog_applied(slot: String, base_gear_id: String, skin_id: String): Emitted when visual appearance changes
##
extends Node

# Autoload singleton - access methods directly via TransmogManager.method_name()
# Note: Do NOT add class_name here as it conflicts with the autoload singleton

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

var gear_registry_instance: Node
var character_sprite: ModularCharacterSprite

func _ready() -> void:
	"""Initializes the gear registry."""
	# GearRegistry is an autoload but we can't use class_name on autoloads
	# Get reference to the singleton via get_node
	gear_registry_instance = get_node("/root/GearRegistry")

func set_character_sprite(sprite: ModularCharacterSprite) -> void:
	"""Sets the character sprite to apply transmog visuals to.

	Parameters:
		sprite: ModularCharacterSprite node to control
	"""
	character_sprite = sprite
	_apply_current_loadout()

func equip_base_gear(slot: String, gear_id: String) -> bool:
	"""Equips base gear for a slot (stats only, visuals may differ with skins).

	Parameters:
		slot: Equipment slot ("helm", "armor", "bow", "arrow")
		gear_id: Base gear identifier

	Returns:
		bool: True if equip succeeded
	"""
	var gear_data = gear_registry_instance.get_base_gear(gear_id)
	if not gear_data:
		return false
	current_loadout.base_gear[slot] = gear_id
	if character_sprite:
		character_sprite.equip_base_gear(slot, gear_id, gear_data.base_texture)
	transmog_applied.emit(slot, gear_id, current_loadout.skins.get(slot, ""))
	return true

func equip_skin(slot: String, skin_id: String) -> bool:
	"""Equips a cosmetic skin over base gear.

	Parameters:
		slot: Equipment slot
		skin_id: Skin identifier

	Returns:
		bool: True if skin can be equipped
	"""
	var skin_data = gear_registry_instance.get_skin(skin_id)
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
	"""Removes skin from slot, showing only base gear.

	Parameters:
		slot: Equipment slot to unequip skin from
	"""
	current_loadout.skins[slot] = ""
	if character_sprite:
		character_sprite.unequip_skin(slot)
	transmog_applied.emit(slot, current_loadout.base_gear.get(slot, ""), "")

func get_current_loadout() -> Dictionary:
	"""Returns current gear and skin configuration.

	Returns:
		Dictionary: Complete loadout with base_gear and skins
	"""
	return current_loadout.duplicate(true)

func get_total_stats() -> Dictionary:
	"""Calculates total stats from equipped base gear.

	Returns:
		Dictionary: Summed stats (attack, defense, speed, health)
	"""
	return gear_registry_instance.calculate_total_stats(current_loadout)

func get_visual_combination(slot: String) -> Dictionary:
	"""Gets visual data for a specific slot.

	Parameters:
		slot: Equipment slot to query

	Returns:
		Dictionary: Visual combination with base gear, skin, and textures
	"""
	var base_gear_id = current_loadout.base_gear.get(slot, "")
	var skin_id = current_loadout.skins.get(slot, "")
	var base_gear_data = gear_registry_instance.get_base_gear(base_gear_id)
	var skin_data = gear_registry_instance.get_skin(skin_id)
	return {
		"slot": slot,
		"base_gear": base_gear_data,
		"skin": skin_data,
		"base_texture": base_gear_data.base_texture if base_gear_data else null,
		"skin_texture": skin_data.skin_texture if skin_data else null
	}

func preview_combination(slot: String, base_gear_id: String, skin_id: String) -> Dictionary:
	"""Preview what a gear/skin combination would look like without equipping.

	Parameters:
		slot: Equipment slot
		base_gear_id: Base gear ID
		skin_id: Skin ID

	Returns:
		Dictionary: Visual combination data
	"""
	var base_gear_data = gear_registry_instance.get_base_gear(base_gear_id)
	var skin_data = gear_registry_instance.get_skin(skin_id)
	return {
		"slot": slot,
		"base_gear": base_gear_data,
		"skin": skin_data,
		"base_texture": base_gear_data.base_texture if base_gear_data else null,
		"skin_texture": skin_data.skin_texture if skin_data else null
	}

func _apply_current_loadout() -> void:
	"""Applies all current loadout to character sprite (internal)."""
	for slot in ["helm", "armor", "bow", "arrow"]:
		var base_gear_id = current_loadout.base_gear.get(slot, "")
		var skin_id = current_loadout.skins.get(slot, "")
		if base_gear_id:
			var gear_data = gear_registry_instance.get_base_gear(base_gear_id)
			if gear_data and character_sprite:
				character_sprite.equip_base_gear(slot, base_gear_id, gear_data.base_texture)
		if skin_id:
			var skin_data = gear_registry_instance.get_skin(skin_id)
			if skin_data and character_sprite:
				character_sprite.equip_skin(slot, skin_id, skin_data.skin_texture)

func can_equip_skin(slot: String, skin_id: String) -> bool:
	"""Checks if a skin can be equipped with current base gear.

	Parameters:
		slot: Equipment slot
		skin_id: Skin identifier

	Returns:
		bool: True if skin is compatible with current base gear
	"""
	var skin_data = gear_registry_instance.get_skin(skin_id)
	if not skin_data:
		return false
	var current_base_gear = current_loadout.base_gear.get(slot, "")
	return current_base_gear == skin_data.base_gear_required

func get_available_skins_for_slot(slot: String) -> Array:
	"""Gets all skins compatible with current base gear in slot.

	Parameters:
		slot: Equipment slot to query

	Returns:
		Array: List of compatible skin data
	"""
	var available_skins: Array = []
	var current_base_gear = current_loadout.base_gear.get(slot, "")
	for skin_data in gear_registry_instance.skin_db.values():
		if skin_data.base_gear_required == current_base_gear:
			available_skins.append(skin_data)
	return available_skins
