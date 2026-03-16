## Gear system enums for Armored Archer
## Defines gear types and rarities used throughout the game

# Gear equipment slot types
enum SlotType {
	HELM,      # Head equipment
	ARMOR,     # Body equipment
	BOW,       # Weapon
	ARROW,     # Ammunition
	AMULET     # Accessory
}

# Gear equipment slot types (alias for backwards compatibility)
enum GearType {
	HELM,      # Head equipment
	ARMOR,     # Body equipment
	BOW,       # Weapon
	ARROW,     # Ammunition
	AMULET     # Accessory
}

# Gear rarity levels
enum GearRarity {
	COMMON,    # Basic gear (white)
	RARE,      # Uncommon gear (green)
	EPIC,      # Rare gear (purple)
	LEGENDARY  # Legendary gear (orange)
}

# Gear modifier types
enum ModifierType {
	STAT_BONUS,       # Direct stat increase
	ABILITY_MODIFIER, # Ability enhancement
	SET_BONUS,        # Multi-piece set bonus
	SOCKET,           # Gem socket
	PASSIVE           # Passive effect
}

# Stat types that gear can modify
enum StatType {
	HEALTH,
	ATTACK,
	DEFENSE,
	SPEED,
	CRITICAL_CHANCE,
	CRITICAL_DAMAGE,
	ABILITY_POWER,
	ABILITY_HASTE,
	ARMOR_PENETRATION,
	LIFE_STEAL
}

# Helper functions for enum conversions

static func gear_type_to_string(type: int) -> String:
	match type:
		SlotType.HELM: return "helm"
		SlotType.ARMOR: return "armor"
		SlotType.BOW: return "bow"
		SlotType.ARROW: return "arrow"
		SlotType.AMULET: return "amulet"
		_: return "unknown"

static func string_to_gear_type(type_str: String) -> int:
	match type_str.to_lower():
		"helm": return SlotType.HELM
		"armor": return SlotType.ARMOR
		"bow": return SlotType.BOW
		"arrow": return SlotType.ARROW
		"amulet": return SlotType.AMULET
		_: return SlotType.HELM

static func gear_rarity_to_string(rarity: int) -> String:
	match rarity:
		GearRarity.COMMON: return "common"
		GearRarity.RARE: return "rare"
		GearRarity.EPIC: return "epic"
		GearRarity.LEGENDARY: return "legendary"
		_: return "unknown"

static func string_to_gear_rarity(rarity_str: String) -> int:
	match rarity_str.to_lower():
		"common": return GearRarity.COMMON
		"rare": return GearRarity.RARE
		"epic": return GearRarity.EPIC
		"legendary": return GearRarity.LEGENDARY
		_: return GearRarity.COMMON

static func get_rarity_color(rarity: int) -> Color:
	match rarity:
		GearRarity.COMMON: return Color.WHITE
		GearRarity.RARE: return Color(0.2, 0.8, 0.2)  # Green
		GearRarity.EPIC: return Color(0.6, 0.2, 0.8)  # Purple
		GearRarity.LEGENDARY: return Color(1.0, 0.6, 0.0)  # Orange
		_: return Color.WHITE

static func get_rarity_display_name(rarity: int) -> String:
	match rarity:
		GearRarity.COMMON: return "Common"
		GearRarity.RARE: return "Rare"
		GearRarity.EPIC: return "Epic"
		GearRarity.LEGENDARY: return "Legendary"
		_: return "Unknown"
