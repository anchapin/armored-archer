## Central registry for all gear and cosmetic skin definitions.
## Provides lookup and statistics calculation for equipment and cosmetics.
##
extends Node

# Note: Do NOT add class_name here as it conflicts with the autoload singleton

# Import gear enums for GearType enum
const GearEnums = preload("res://scripts/gear_enums.gd")

var base_gear_db: Dictionary = {}
var skin_db: Dictionary = {}

# Soft cap values for gear stats (used for diminishing returns)
const GEAR_SOFT_CAPS: Dictionary = {
	"helm": {"defense": 70, "health": 350},
	"armor": {"defense": 105, "health": 420},
	"bow": {"attack": 105, "crit_rate": 21},
	"arrow": {"attack": 70, "crit_rate": 18},
	"amulet": {"dodge": 21, "crit_rate": 14}
}

# Synergy groups for set bonuses
const SYNERGY_GROUPS: Dictionary = {
	"dragon_set": {
		"pieces": ["helm_dragon", "armor_plate", "bow_crossbow", "arrow_dragon", "amulet_dragon"],
		"bonuses": {
			2: {"stat": "attack", "value": 5},
			3: {"stat": "crit_rate", "value": 3},
			4: {"stat": "health", "value": 50},
			5: {"stat": "all", "value": 10}
		}
	},
	"iron_set": {
		"pieces": ["helm_iron", "armor_chain", "bow_composite", "arrow_iron", "amulet_power"],
		"bonuses": {
			2: {"stat": "defense", "value": 5},
			3: {"stat": "health", "value": 30},
			4: {"stat": "dodge", "value": 2},
			5: {"stat": "defense", "value": 15}
		}
	}
}

# Maximum stat values for validation
const MAX_STATS: Dictionary = {
	"helm": {"defense": 100, "health": 500},
	"armor": {"defense": 150, "health": 600},
	"bow": {"attack": 150, "crit_rate": 30},
	"arrow": {"attack": 100, "crit_rate": 25},
	"amulet": {"dodge": 30, "crit_rate": 20}
}

func _ready() -> void:
	"""Initializes the gear and skin databases."""
	_initialize_base_gear()
	_initialize_skins()

func _initialize_base_gear() -> void:
	"""Populates the base gear database with all available gear items."""
	_register_base_gear("helm_basic", "Basic Helm", GearEnums.GearType.HELM, 0, 0, 0, 5, "common", "res://assets/sprites/equipment/helms/leather.png")
	_register_base_gear("helm_iron", "Iron Helm", GearEnums.GearType.HELM, 0, 5, 0, 10, "rare", "res://assets/sprites/equipment/helms/chain.png")
	_register_base_gear("helm_dragon", "Dragon Helm", GearEnums.GearType.HELM, 5, 10, 0, 20, "legendary", "res://assets/sprites/equipment/helms/dragon.png")
	_register_base_gear("armor_leather", "Leather Armor", GearEnums.GearType.ARMOR, 0, 5, 0, 0, "common", "res://assets/sprites/equipment/armor/leather.png")
	_register_base_gear("armor_chain", "Chain Mail", GearEnums.GearType.ARMOR, 0, 15, 0, 10, "rare", "res://assets/sprites/equipment/armor/chain.png")
	_register_base_gear("armor_plate", "Plate Armor", GearEnums.GearType.ARMOR, 0, 30, 0, 25, "rare", "res://assets/sprites/equipment/armor/plate.png")
	_register_base_gear("bow_wooden", "Wooden Bow", GearEnums.GearType.BOW, 5, 0, 0, 0, "common", "res://assets/sprites/equipment/bows/wooden.png")
	_register_base_gear("bow_composite", "Composite Bow", GearEnums.GearType.BOW, 15, 0, 0, 0, "rare", "res://assets/sprites/equipment/bows/composite.png")
	_register_base_gear("bow_crossbow", "Crossbow", GearEnums.GearType.BOW, 25, 0, 0, 0, "rare", "res://assets/sprites/equipment/bows/elven.png")
	_register_base_gear("arrow_wooden", "Wooden Arrows", GearEnums.GearType.ARROW, 0, 0, 5, 0, "common", "res://assets/sprites/equipment/arrows/wooden.png")
	_register_base_gear("arrow_iron", "Iron Arrows", GearEnums.GearType.ARROW, 5, 0, 0, 0, "rare", "res://assets/sprites/equipment/arrows/iron.png")
	_register_base_gear("arrow_dragon", "Dragon Arrows", GearEnums.GearType.ARROW, 15, 0, 10, 0, "legendary", "res://assets/sprites/equipment/arrows/enchanted.png")
	_register_base_gear("amulet_protection", "Protection Amulet", GearEnums.GearType.AMULET, 0, 10, 0, 10, "common", "res://assets/sprites/equipment/amulets/health.png")
	_register_base_gear("amulet_power", "Power Amulet", GearEnums.GearType.AMULET, 10, 0, 0, 5, "rare", "res://assets/sprites/equipment/amulets/strength.png")
	_register_base_gear("amulet_dragon", "Dragon Amulet", GearEnums.GearType.AMULET, 15, 5, 5, 15, "legendary", "res://assets/sprites/equipment/amulets/speed.png")

func _initialize_skins() -> void:
	"""Populates the skin database with all available cosmetic skins."""
	_register_skin("skin_helm_golden", "Golden Helm", GearEnums.GearType.HELM, "helm_basic", 500, true, "")
	_register_skin("skin_helm_crimson", "Crimson Helm", GearEnums.GearType.HELM, "helm_iron", 300, false, "")
	_register_skin("skin_helm_shadow", "Shadow Helm", GearEnums.GearType.HELM, "helm_dragon", 1000, true, "")
	_register_skin("skin_armor_knight", "Knight Armor", GearEnums.GearType.ARMOR, "armor_leather", 600, false, "")
	_register_skin("skin_armor_royal", "Royal Armor", GearEnums.GearType.ARMOR, "armor_plate", 1200, true, "")
	_register_skin("skin_armor_shadow", "Shadow Armor", GearEnums.GearType.ARMOR, "armor_chain", 800, false, "")
	_register_skin("skin_bow_fire", "Fire Bow", GearEnums.GearType.BOW, "bow_wooden", 400, false, "")
	_register_skin("skin_bow_ice", "Ice Bow", GearEnums.GearType.BOW, "bow_composite", 700, false, "")
	_register_skin("skin_bow_lightning", "Lightning Bow", GearEnums.GearType.BOW, "bow_crossbow", 1500, true, "")
	_register_skin("skin_arrow_fire", "Fire Arrows", GearEnums.GearType.ARROW, "arrow_wooden", 200, false, "")
	_register_skin("skin_arrow_ice", "Ice Arrows", GearEnums.GearType.ARROW, "arrow_iron", 350, false, "")
	_register_skin("skin_arrow_lightning", "Lightning Arrows", GearEnums.GearType.ARROW, "arrow_dragon", 900, true, "")
	_register_skin("skin_amulet_golden", "Golden Amulet", GearEnums.GearType.AMULET, "amulet_protection", 400, false, "")
	_register_skin("skin_amulet_crystal", "Crystal Amulet", GearEnums.GearType.AMULET, "amulet_power", 600, false, "")
	_register_skin("skin_amulet_legendary", "Legendary Amulet", GearEnums.GearType.AMULET, "amulet_dragon", 1200, true, "")
	_register_skin("skin_helm_founders", "Founder's Helm", GearEnums.GearType.HELM, "helm_basic", 400, false, "")
	_register_skin("skin_armor_founders", "Founder's Armor", GearEnums.GearType.ARMOR, "armor_leather", 500, false, "")
	_register_skin("skin_bow_founders", "Founder's Bow", GearEnums.GearType.BOW, "bow_wooden", 450, false, "")
	_register_skin("skin_arrow_founders", "Founder's Arrows", GearEnums.GearType.ARROW, "arrow_wooden", 250, false, "")
	_register_skin("skin_amulet_founders", "Founder's Amulet", GearEnums.GearType.AMULET, "amulet_protection", 350, false, "")

func _register_base_gear(gear_id: String, gear_name: String, slot: GearEnums.GearType, attack: int, defense: int, speed: int, health: int, rarity: String, texture_path: String) -> void:
	"""Registers a base gear item in the database (internal).

	Parameters:
		gear_id: Unique identifier
		gear_name: Display name
		slot: Equipment slot type
		attack: Attack stat value
		defense: Defense stat value
		speed: Speed stat value
		health: Health stat bonus
		rarity: Rarity tier (common, rare, epic, legendary)
		texture_path: Path to texture resource
	"""
	var gear_data = GearData.new()
	gear_data.gear_id = gear_id
	gear_data.gear_name = gear_name
	gear_data.slot_type = slot
	gear_data.stats = { "attack": attack, "defense": defense, "speed": speed, "health": health }
	gear_data.rarity = rarity

	# Load texture if path is provided
	if not texture_path.is_empty():
		var texture = load(texture_path)
		if texture is Texture2D:
			gear_data.base_texture = texture

	base_gear_db[gear_id] = gear_data

func _register_skin(skin_id: String, skin_name: String, slot: GearEnums.GearType, base_required: String, price: int, is_premium: bool, _texture_path: String) -> void:
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

func get_gear_by_slot(slot_type: GearEnums.GearType) -> Array:
	"""Gets all base gear items for a specific slot.

	Parameters:
		slot_type: GearEnums.GearType to filter by

	Returns:
		Array: List of GearData objects for the slot
	"""
	var gear_list: Array = []
	for gear_data in base_gear_db.values():
		if gear_data.slot_type == slot_type:
			gear_list.append(gear_data)
	return gear_list

func get_skins_by_slot(slot_type: GearEnums.GearType) -> Array:
	"""Gets all skins for a specific slot type.

	Parameters:
		slot_type: GearEnums.GearType to filter by

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

func get_synergy_groups() -> Dictionary:
	"""Returns the synergy groups configuration.

	Returns:
		Dictionary: Synergy groups with pieces and bonuses
	"""
	return SYNERGY_GROUPS

func get_gear_soft_caps() -> Dictionary:
	"""Returns soft cap values for gear stats.

	Returns:
		Dictionary: Soft caps by gear type and stat
	"""
	return GEAR_SOFT_CAPS

func get_gear_texture(gear_id: String, slot_type: GearSlot.SlotType) -> Texture2D:
	"""Gets the texture for a specific gear item.

	Parameters:
		gear_id: Gear identifier to look up
		slot_type: GearSlot.SlotType (for future use, filtering)

	Returns:
		Texture2D: Gear texture or null if not found
	"""
	var gear_data: GearData = base_gear_db.get(gear_id, null)
	if gear_data:
		return gear_data.base_texture
	return null

func get_max_stats() -> Dictionary:
	"""Returns maximum stat values for gear validation.

	Returns:
		Dictionary: Max values by gear type and stat
	"""
	return MAX_STATS

func validate_gear_stats(gear_type: String, stats: Dictionary) -> Dictionary:
	"""Validates that gear stats do not exceed maximum values.

	Parameters:
		gear_type: Type of gear (helm, armor, bow, arrow, amulet)
		stats: Dictionary of stat names to values

	Returns:
		Dictionary: {"valid": bool, "reason": String}
	"""
	var max_values: Dictionary = MAX_STATS.get(gear_type, {})

	for stat_name in stats.keys():
		var stat_value: int = int(stats[stat_name])
		var max_allowed: int = max_values.get(stat_name, 100)

		if stat_value > max_allowed:
			return {
				"valid": false,
				"reason": "Stat %s value %d exceeds maximum %d for %s" % [stat_name, stat_value, max_allowed, gear_type]
			}

	return {"valid": true, "reason": ""}

func get_synergy_bonus_for_set(equipped_gear_ids: Array) -> Dictionary:
	"""Calculates synergy bonuses from equipped gear.

	Parameters:
		equipped_gear_ids: Array of base gear IDs currently equipped

	Returns:
		Dictionary: Synergy bonuses by stat name
	"""
	var bonuses: Dictionary = {}

	for synergy_name in SYNERGY_GROUPS.keys():
		var synergy_data: Dictionary = SYNERGY_GROUPS[synergy_name]
		var pieces: Array = synergy_data["pieces"]
		var bonus_tiers: Dictionary = synergy_data["bonuses"]

		# Count how many pieces from this set are equipped
		var equipped_count: int = 0
		for gear_id in equipped_gear_ids:
			if pieces.has(gear_id):
				equipped_count += 1

		# Apply bonuses based on count
		for tier_count in bonus_tiers.keys():
			if equipped_count >= tier_count:
				var bonus: Dictionary = bonus_tiers[tier_count]
				var stat: String = bonus["stat"]
				var value: float = float(bonus["value"])

				if stat == "all":
					# Apply bonus to all stats
					bonuses["all_multiplier"] = max(bonuses.get("all_multiplier", 0.0), value / 100.0)
				else:
					# Stack with existing bonus
					bonuses[stat] = bonuses.get(stat, 0.0) + value

	return bonuses
