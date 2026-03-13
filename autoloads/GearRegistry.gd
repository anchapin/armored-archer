## Central registry for all gear and cosmetic skin definitions.
## Provides lookup and statistics calculation for equipment and cosmetics.
##
extends Node

# Note: Do NOT add class_name here as it conflicts with the autoload singleton



var base_gear_db: Dictionary = {}
var skin_db: Dictionary = {}

func _ready() -> void:
	"""Initializes the gear and skin databases."""
	_initialize_base_gear()
	_initialize_skins()

func _initialize_base_gear() -> void:
	"""Populates the base gear database with all available gear items."""
	_register_base_gear("helm_basic", "Basic Helm", GearSlot.SlotType.HELM, 0, 0, 0, 5, "common", "")
	_register_base_gear("helm_iron", "Iron Helm", GearSlot.SlotType.HELM, 0, 5, 0, 10, "uncommon", "")
	_register_base_gear("helm_dragon", "Dragon Helm", GearSlot.SlotType.HELM, 5, 10, 0, 20, "legendary", "")
	_register_base_gear("armor_leather", "Leather Armor", GearSlot.SlotType.ARMOR, 0, 5, 0, 0, "common", "")
	_register_base_gear("armor_chain", "Chain Mail", GearSlot.SlotType.ARMOR, 0, 15, 0, 10, "uncommon", "")
	_register_base_gear("armor_plate", "Plate Armor", GearSlot.SlotType.ARMOR, 0, 30, 0, 25, "rare", "")
	_register_base_gear("bow_wooden", "Wooden Bow", GearSlot.SlotType.BOW, 5, 0, 0, 0, "common", "")
	_register_base_gear("bow_composite", "Composite Bow", GearSlot.SlotType.BOW, 15, 0, 0, 0, "uncommon", "")
	_register_base_gear("bow_crossbow", "Crossbow", GearSlot.SlotType.BOW, 25, 0, 0, 0, "rare", "")
	_register_base_gear("arrow_wooden", "Wooden Arrows", GearSlot.SlotType.ARROW, 0, 0, 5, 0, "common", "")
	_register_base_gear("arrow_iron", "Iron Arrows", GearSlot.SlotType.ARROW, 5, 0, 0, 0, "uncommon", "")
	_register_base_gear("arrow_dragon", "Dragon Arrows", GearSlot.SlotType.ARROW, 15, 0, 10, 0, "legendary", "")
	_register_base_gear("amulet_protection", "Protection Amulet", GearSlot.SlotType.AMULET, 0, 10, 0, 10, "common", "")
	_register_base_gear("amulet_power", "Power Amulet", GearSlot.SlotType.AMULET, 10, 0, 0, 5, "uncommon", "")
	_register_base_gear("amulet_dragon", "Dragon Amulet", GearSlot.SlotType.AMULET, 15, 5, 5, 15, "legendary", "")

func _initialize_skins() -> void:
	"""Populates the skin database with all available cosmetic skins."""
	_register_skin("skin_helm_golden", "Golden Helm", GearSlot.SlotType.HELM, "helm_basic", 500, true, "")
	_register_skin("skin_helm_crimson", "Crimson Helm", GearSlot.SlotType.HELM, "helm_iron", 300, false, "")
	_register_skin("skin_helm_shadow", "Shadow Helm", GearSlot.SlotType.HELM, "helm_dragon", 1000, true, "")
	_register_skin("skin_armor_knight", "Knight Armor", GearSlot.SlotType.ARMOR, "armor_leather", 600, false, "")
	_register_skin("skin_armor_royal", "Royal Armor", GearSlot.SlotType.ARMOR, "armor_plate", 1200, true, "")
	_register_skin("skin_armor_shadow", "Shadow Armor", GearSlot.SlotType.ARMOR, "armor_chain", 800, false, "")
	_register_skin("skin_bow_fire", "Fire Bow", GearSlot.SlotType.BOW, "bow_wooden", 400, false, "")
	_register_skin("skin_bow_ice", "Ice Bow", GearSlot.SlotType.BOW, "bow_composite", 700, false, "")
	_register_skin("skin_bow_lightning", "Lightning Bow", GearSlot.SlotType.BOW, "bow_crossbow", 1500, true, "")
	_register_skin("skin_arrow_fire", "Fire Arrows", GearSlot.SlotType.ARROW, "arrow_wooden", 200, false, "")
	_register_skin("skin_arrow_ice", "Ice Arrows", GearSlot.SlotType.ARROW, "arrow_iron", 350, false, "")
	_register_skin("skin_arrow_lightning", "Lightning Arrows", GearSlot.SlotType.ARROW, "arrow_dragon", 900, true, "")
	_register_skin("skin_amulet_golden", "Golden Amulet", GearSlot.SlotType.AMULET, "amulet_protection", 400, false, "")
	_register_skin("skin_amulet_crystal", "Crystal Amulet", GearSlot.SlotType.AMULET, "amulet_power", 600, false, "")
	_register_skin("skin_amulet_legendary", "Legendary Amulet", GearSlot.SlotType.AMULET, "amulet_dragon", 1200, true, "")

func _register_base_gear(gear_id: String, gear_name: String, slot: GearSlot.SlotType, attack: int, defense: int, speed: int, health: int, rarity: String, _texture_path: String) -> void:
	"""Registers a base gear item in the database (internal).

	Parameters:
		gear_id: Unique identifier
		gear_name: Display name
		slot: Equipment slot type
		attack: Attack stat value
		defense: Defense stat value
		speed: Speed stat value
		health: Health stat bonus
		rarity: Rarity tier (common, uncommon, rare, legendary)
		texture_path: Path to texture resource (currently unused)
	"""
	var gear_data = GearData.new()
	gear_data.gear_id = gear_id
	gear_data.gear_name = gear_name
	gear_data.slot_type = slot
	gear_data.stats = { "attack": attack, "defense": defense, "speed": speed, "health": health }
	gear_data.rarity = rarity
	base_gear_db[gear_id] = gear_data

func _register_skin(skin_id: String, skin_name: String, slot: GearSlot.SlotType, base_required: String, price: int, is_premium: bool, _texture_path: String) -> void:
	"""Registers a cosmetic skin in the database (internal).

	Parameters:
		skin_id: Unique identifier
		skin_name: Display name
		slot: Equipment slot type
		base_required: Base gear ID required to use this skin
		price: Gem cost to purchase
		is_premium: True if this is a premium (paid) skin
		texture_path: Path to texture resource (currently unused)
	"""
	var skin_data = CosmeticSkinData.new()
	skin_data.skin_id = skin_id
	skin_data.skin_name = skin_name
	skin_data.slot_type = slot
	skin_data.base_gear_required = base_required
	skin_data.price = price
	skin_data.is_premium = is_premium
	skin_db[skin_id] = skin_data

func get_base_gear(gear_id: String) -> GearData:
	"""Retrieves base gear data by ID.

	Parameters:
		gear_id: Gear identifier to look up

	Returns:
		GearData: Gear data object or null if not found
	"""
	return base_gear_db.get(gear_id, null)

func get_skin(skin_id: String) -> CosmeticSkinData:
	"""Retrieves skin data by ID.

	Parameters:
		skin_id: Skin identifier to look up

	Returns:
		CosmeticSkinData: Skin data object or null if not found
	"""
	return skin_db.get(skin_id, null)

func get_gear_by_slot(slot_type: GearSlot.SlotType) -> Array:
	"""Gets all base gear items for a specific slot.

	Parameters:
		slot_type: GearSlot.SlotType to filter by

	Returns:
		Array: List of GearData objects for the slot
	"""
	var gear_list: Array = []
	for gear_data in base_gear_db.values():
		if gear_data.slot_type == slot_type:
			gear_list.append(gear_data)
	return gear_list

func get_skins_by_slot(slot_type: GearSlot.SlotType) -> Array:
	"""Gets all skins for a specific slot type.

	Parameters:
		slot_type: GearSlot.SlotType to filter by

	Returns:
		Array: List of CosmeticSkinData objects for the slot
	"""
	var skin_list: Array = []
	for skin_data in skin_db.values():
		if skin_data.slot_type == slot_type:
			skin_list.append(skin_data)
	return skin_list

func calculate_total_stats(loadout: Dictionary) -> Dictionary:
	"""Calculates combined stats from all equipped base gear.

	Parameters:
		loadout: Dictionary with "base_gear" mapping slots to gear IDs

	Returns:
		Dictionary: Summed stats (attack, defense, speed, health)
	"""
	var total_stats = { "attack": 0, "defense": 0, "speed": 0, "health": 0 }
	var base_gear = loadout.get("base_gear", {})
	for gear_id in base_gear.values():
		var gear_data = get_base_gear(gear_id)
		if gear_data:
			for stat in total_stats:
				total_stats[stat] += gear_data.stats.get(stat, 0)
	return total_stats
