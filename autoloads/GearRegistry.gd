extends Node

class_name GearRegistry

# --- Base Gear Data ---
var base_gear_db: Dictionary = {}

# --- Cosmetic Skin Data ---
var skin_db: Dictionary = {}

func _ready() -> void:
	_initialize_base_gear()
	_initialize_skins()

func _initialize_base_gear() -> void:
	# Helms
	_register_base_gear("helm_basic", "Basic Helm", GearSlot.SlotType.HELM, 0, 0, 0, 5, "common", "res://assets/sprites/gear/base/helm/helm_basic.tres")
	_register_base_gear("helm_iron", "Iron Helm", GearSlot.SlotType.HELM, 0, 5, 0, 10, "uncommon", "res://assets/sprites/gear/base/helm/helm_iron.tres")
	_register_base_gear("helm_dragon", "Dragon Helm", GearSlot.SlotType.HELM, 5, 10, 0, 20, "legendary", "res://assets/sprites/gear/base/helm/helm_dragon.tres")
	
	# Armors
	_register_base_gear("armor_leather", "Leather Armor", GearSlot.SlotType.ARMOR, 0, 5, 0, 0, "common", "res://assets/sprites/gear/base/armor/armor_leather.tres")
	_register_base_gear("armor_chain", "Chain Mail", GearSlot.SlotType.ARMOR, 0, 15, 0, 10, "uncommon", "res://assets/sprites/gear/base/armor/armor_chain.tres")
	_register_base_gear("armor_plate", "Plate Armor", GearSlot.SlotType.ARMOR, 0, 30, 0, 25, "rare", "res://assets/sprites/gear/base/armor/armor_plate.tres")
	
	# Bows
	_register_base_gear("bow_wooden", "Wooden Bow", GearSlot.SlotType.BOW, 5, 0, 0, 0, "common", "res://assets/sprites/gear/base/bow/bow_wooden.tres")
	_register_base_gear("bow_composite", "Composite Bow", GearSlot.SlotType.BOW, 15, 0, 0, 0, "uncommon", "res://assets/sprites/gear/base/bow/bow_composite.tres")
	_register_base_gear("bow_crossbow", "Crossbow", GearSlot.SlotType.BOW, 25, 0, 0, 0, "rare", "res://assets/sprites/gear/base/bow/bow_crossbow.tres")
	
	# Arrows
	_register_base_gear("arrow_wooden", "Wooden Arrows", GearSlot.SlotType.ARROW, 0, 0, 5, 0, "common", "res://assets/sprites/gear/base/arrow/arrow_wooden.tres")
	_register_base_gear("arrow_iron", "Iron Arrows", GearSlot.SlotType.ARROW, 5, 0, 0, 0, "uncommon", "res://assets/sprites/gear/base/arrow/arrow_iron.tres")
	_register_base_gear("arrow_dragon", "Dragon Arrows", GearSlot.SlotType.ARROW, 15, 0, 10, 0, "legendary", "res://assets/sprites/gear/base/arrow/arrow_dragon.tres")

func _initialize_skins() -> void:
	# Helm Skins
	_register_skin("skin_helm_golden", "Golden Helm", GearSlot.SlotType.HELM, "helm_basic", 500, true, "res://assets/sprites/gear/skins/helm/skin_helm_golden.tres")
	_register_skin("skin_helm_crimson", "Crimson Helm", GearSlot.SlotType.HELM, "helm_iron", 300, false, "res://assets/sprites/gear/skins/helm/skin_helm_crimson.tres")
	_register_skin("skin_helm_shadow", "Shadow Helm", GearSlot.SlotType.HELM, "helm_dragon", 1000, true, "res://assets/sprites/gear/skins/helm/skin_helm_shadow.tres")
	
	# Armor Skins
	_register_skin("skin_armor_knight", "Knight Armor", GearSlot.SlotType.ARMOR, "armor_leather", 600, false, "res://assets/sprites/gear/skins/armor/skin_armor_knight.tres")
	_register_skin("skin_armor_royal", "Royal Armor", GearSlot.SlotType.ARMOR, "armor_plate", 1200, true, "res://assets/sprites/gear/skins/armor/skin_armor_royal.tres")
	_register_skin("skin_armor_shadow", "Shadow Armor", GearSlot.SlotType.ARMOR, "armor_chain", 800, false, "res://assets/sprites/gear/skins/armor/skin_armor_shadow.tres")
	
	# Bow Skins
	_register_skin("skin_bow_fire", "Fire Bow", GearSlot.SlotType.BOW, "bow_wooden", 400, false, "res://assets/sprites/gear/skins/bow/skin_bow_fire.tres")
	_register_skin("skin_bow_ice", "Ice Bow", GearSlot.SlotType.BOW, "bow_composite", 700, false, "res://assets/sprites/gear/skins/bow/skin_bow_ice.tres")
	_register_skin("skin_bow_lightning", "Lightning Bow", GearSlot.SlotType.BOW, "bow_crossbow", 1500, true, "res://assets/sprites/gear/skins/bow/skin_bow_lightning.tres")
	
	# Arrow Skins
	_register_skin("skin_arrow_fire", "Fire Arrows", GearSlot.SlotType.ARROW, "arrow_wooden", 200, false, "res://assets/sprites/gear/skins/arrow/skin_arrow_fire.tres")
	_register_skin("skin_arrow_ice", "Ice Arrows", GearSlot.SlotType.ARROW, "arrow_iron", 350, false, "res://assets/sprites/gear/skins/arrow/skin_arrow_ice.tres")
	_register_skin("skin_arrow_lightning", "Lightning Arrows", GearSlot.SlotType.ARROW, "arrow_dragon", 900, true, "res://assets/sprites/gear/skins/arrow/skin_arrow_lightning.tres")

func _register_base_gear(gear_id: String, name: String, slot: GearSlot.SlotType, 
	attack: int, defense: int, speed: int, health: int, rarity: String, texture_path: String) -> void:
	var gear_data = GearData.new()
	gear_data.gear_id = gear_id
	gear_data.gear_name = name
	gear_data.slot_type = slot
	gear_data.stats = {
		"attack": attack,
		"defense": defense,
		"speed": speed,
		"health": health
	}
	gear_data.rarity = rarity
	if ResourceLoader.exists(texture_path):
		gear_data.base_texture = load(texture_path)
	base_gear_db[gear_id] = gear_data

func _register_skin(skin_id: String, name: String, slot: GearSlot.SlotType, 
	base_required: String, price: int, is_premium: bool, texture_path: String) -> void:
	var skin_data = CosmeticSkinData.new()
	skin_data.skin_id = skin_id
	skin_data.skin_name = name
	skin_data.slot_type = slot
	skin_data.base_gear_required = base_required
	skin_data.price = price
	skin_data.is_premium = is_premium
	if ResourceLoader.exists(texture_path):
		skin_data.skin_texture = load(texture_path)
	skin_db[skin_id] = skin_data

func get_base_gear(gear_id: String) -> GearData:
	return base_gear_db.get(gear_id, null)

func get_skin(skin_id: String) -> CosmeticSkinData:
	return skin_db.get(skin_id, null)

func get_gear_by_slot(slot_type: GearSlot.SlotType) -> Array:
	var gear_list: Array = []
	for gear_data in base_gear_db.values():
		if gear_data.slot_type == slot_type:
			gear_list.append(gear_data)
	return gear_list

func get_skins_by_slot(slot_type: GearSlot.SlotType) -> Array:
	var skin_list: Array = []
	for skin_data in skin_db.values():
		if skin_data.slot_type == slot_type:
			skin_list.append(skin_data)
	return skin_list

func calculate_total_stats(loadout: Dictionary) -> Dictionary:
	var total_stats = {
		"attack": 0,
		"defense": 0,
		"speed": 0,
		"health": 0
	}
	
	var base_gear = loadout.get("base_gear", {})
	for gear_id in base_gear.values():
		var gear_data = get_base_gear(gear_id)
		if gear_data:
			for stat in total_stats:
				total_stats[stat] += gear_data.stats.get(stat, 0)
	
	return total_stats
