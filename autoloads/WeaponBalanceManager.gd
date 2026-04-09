## Weapon Balance Manager
## Centralizes weapon balance logic for PvP and PvE
## Provides damage calculations, power ratings, and balance adjustments
##
extends Node

# Note: Do NOT add class_name here as it conflicts with the autoload singleton

# Import gear enums
const GearEnums = preload("res://scripts/gear_enums.gd")

# --- Weapon Tiers ---
# Power multipliers for each weapon rarity tier
const TIER_MULTIPLIERS: Dictionary = {
	GearEnums.GearRarity.COMMON: 1.0,     # Baseline damage
	GearEnums.GearRarity.RARE: 1.3,       # 30% more damage
	GearEnums.GearRarity.EPIC: 1.6,       # 60% more damage
	GearEnums.GearRarity.LEGENDARY: 2.0   # 100% more damage (max tier)
}

# Base damage values for each gear slot type
const BASE_DAMAGES: Dictionary = {
	GearEnums.GearType.HELM: 0,       # Helm provides no direct damage
	GearEnums.GearType.ARMOR: 0,      # Armor provides no direct damage
	GearEnums.GearType.BOW: 10,       # Base bow damage
	GearEnums.GearType.ARROW: 5,       # Base arrow damage
	GearEnums.GearType.AMULET: 2      # Base amulet damage (small boost)
}

# PvP-specific damage reduction coefficient
# Reduces overall damage in PvP to extend match length and increase tactical depth
const PVP_DAMAGE_REDUCTION: float = 0.85  # 15% damage reduction in PvP

# Maximum allowed damage as percentage of tier average (anti-one-shot protection)
const MAX_DAMAGE_PERCENTAGE: float = 2.0  # 200% of tier average

# --- Balance Adjustments ---
# Hotfix multipliers applied to specific weapons (weapon_id -> multiplier)
var _balance_adjustments: Dictionary = {}

# --- Signals ---
signal balance_adjustment_applied(weapon_id: String, multiplier: float)
signal balance_adjustment_reverted(weapon_id: String)

# --- Profiling Reference ---
@onready var _profiler: Node = get_node_or_null("/root/ProfilingInstrumentation")

# --- Network Reference ---
var network_manager: Node

# --- Gear Registry Reference ---
var gear_registry: Node

func _ready() -> void:
	"""Initialize weapon balance manager."""
	network_manager = get_node_or_null("/root/NetworkManager")
	gear_registry = get_node_or_null("/root/GearRegistry")

	# Load balance adjustments from server if connected
	if network_manager and network_manager.is_connected:
		_fetch_balance_adjustments()

# --- Damage Calculations ---

func get_pvp_damage(base_damage: float, tier: int, weapon_stats: Dictionary = {}) -> float:
	"""Calculates PvP-optimized damage for a weapon.

	Parameters:
		base_damage: Base damage value from weapon definition
		tier: Weapon tier (GearRarity enum value)
		weapon_stats: Optional dictionary with stat bonuses

	Returns:
		PvP-optimized damage value
	"""
	var profiling_block = _profiler.create_profile_block("WeaponBalanceManager.get_pvp_damage") if _profiler else null

	# Start with base damage
	var pvp_damage: float = base_damage

	# Apply tier multiplier if valid
	if TIER_MULTIPLIERS.has(tier):
		pvp_damage *= TIER_MULTIPLIERS[tier]
	else:
		push_warning("Unknown weapon tier: %d, using COMMON multiplier" % tier)
		pvp_damage *= TIER_MULTIPLIERS[GearEnums.GearRarity.COMMON]

	# Apply damage curve with diminishing returns
	# Higher base damage gets less benefit from multipliers to prevent exponential scaling
	pvp_damage = _apply_damage_curve(pvp_damage, tier)

	# Add stat-based damage if provided
	if weapon_stats.has("attack"):
		pvp_damage += weapon_stats.attack * 0.5  # Attack stat contributes 50% to damage

	if weapon_stats.has("ability_power"):
		pvp_damage += weapon_stats.ability_power * 0.3  # Ability power contributes 30%

	# Apply PvP damage reduction
	pvp_damage *= PVP_DAMAGE_REDUCTION

	# Enforce maximum damage cap (anti-one-shot protection)
	var max_allowed: float = _get_tier_average_damage(tier) * MAX_DAMAGE_PERCENTAGE
	if pvp_damage > max_allowed:
		pvp_damage = max_allowed

	# Apply balance adjustment hotfix if exists
	# (Weapon ID is needed for this - handled by caller)

	if profiling_block:
		profiling_block.end()

	return max(0.0, pvp_damage)  # Never return negative damage


func get_pve_damage(base_damage: float, tier: int, weapon_stats: Dictionary = {}) -> float:
	"""Calculates PvE-optimized damage for a weapon.

	Parameters:
		base_damage: Base damage value from weapon definition
		tier: Weapon tier (GearRarity enum value)
		weapon_stats: Optional dictionary with stat bonuses

	Returns:
		PvE-optimized damage value
	"""
	var profiling_block = _profiler.create_profile_block("WeaponBalanceManager.get_pve_damage") if _profiler else null

	# Start with base damage
	var pve_damage: float = base_damage

	# Apply tier multiplier
	if TIER_MULTIPLIERS.has(tier):
		pve_damage *= TIER_MULTIPLIERS[tier]
	else:
		pve_damage *= TIER_MULTIPLIERS[GearEnums.GearRarity.COMMON]

	# PvE uses full damage curve (no reduction for match length)
	pve_damage = _apply_damage_curve(pve_damage, tier)

	# Add stat-based damage
	if weapon_stats.has("attack"):
		pve_damage += weapon_stats.attack * 0.6  # Higher contribution in PvE

	if weapon_stats.has("ability_power"):
		pve_damage += weapon_stats.ability_power * 0.4

	if profiling_block:
		profiling_block.end()

	return max(0.0, pve_damage)


func _apply_damage_curve(damage: float, tier: int) -> float:
	"""Applies diminishing returns to high damage values.

	Uses a logarithmic curve to prevent exponential scaling:
	- Low damage: Linear scaling
	- Medium damage: Sub-linear scaling
	- High damage: Heavily diminishing returns

	Parameters:
		damage: Input damage value
		tier: Weapon tier for curve tuning

	Returns:
		Curve-adjusted damage value
	"""
	# Diminishing returns factor increases with tier
	# Higher tiers get slightly better curves (less diminishing returns)
	var curve_factor: float = 0.1 + (tier * 0.025)

	# Apply logarithmic diminishing returns
	# This creates a curve where initial damage scales well, but high power has reduced returns
	if damage > 0:
		damage = damage * (1.0 - curve_factor * log(1.0 + damage / 20.0))

	return damage


func _get_tier_average_damage(tier: int) -> float:
	"""Calculates the average expected damage for a weapon tier.

	Parameters:
		tier: Weapon tier (GearRarity enum value)

	Returns:
		Average damage value for the tier
	"""
	var avg_bow_damage: float = BASE_DAMAGES[GearEnums.GearType.BOW] * TIER_MULTIPLIERS.get(tier, 1.0)
	var avg_arrow_damage: float = BASE_DAMAGES[GearEnums.GearType.ARROW] * TIER_MULTIPLIERS.get(tier, 1.0)

	return (avg_bow_damage + avg_arrow_damage) / 2.0

# --- Weapon Power Rating ---

func get_weapon_power_rating(weapon_data: Dictionary) -> int:
	"""Calculates weapon power rating for matchmaking.

	This rating is used by the matchmaking system to estimate player power
	based on their equipped gear.

	Parameters:
		weapon_data: Dictionary containing weapon information
			- gear_id: Weapon identifier
			- gear_type: Equipment slot type
			- rarity: Gear rarity tier
			- stats: Dictionary of stat bonuses

	Returns:
		Power rating (higher = more powerful)
	"""
	var profiling_block = _profiler.create_profile_block("WeaponBalanceManager.get_weapon_power_rating") if _profiler else null

	var power_rating: int = 0

	# Base power from tier
	var tier: int = weapon_data.get("rarity", GearEnums.GearRarity.COMMON)
	var base_power: int = 100 * (tier + 1)  # COMMON=100, RARE=200, EPIC=300, LEGENDARY=400
	power_rating += base_power

	# Add power from stats
	if weapon_data.has("stats"):
		var stats: Dictionary = weapon_data.stats
		if stats.has("attack"):
			power_rating += int(stats.attack * 2)
		if stats.has("ability_power"):
			power_rating += int(stats.ability_power * 2)
		if stats.has("critical_chance"):
			power_rating += int(stats.critical_chance * 5)
		if stats.has("critical_damage"):
			power_rating += int(stats.critical_damage * 2)
		if stats.has("defense"):
			power_rating += int(stats.defense)  # Defense contributes less to offense power

	# Apply balance adjustment if exists
	var gear_id: String = weapon_data.get("gear_id", "")
	if not gear_id.is_empty() and _balance_adjustments.has(gear_id):
		var multiplier: float = _balance_adjustments[gear_id]
		power_rating = int(power_rating * multiplier)

	if profiling_block:
		profiling_block.end()

	return max(0, power_rating)


func get_loadout_power_rating(loadout_data: Dictionary) -> int:
	"""Calculates total power rating for a complete loadout.

	Parameters:
		loadout_data: Dictionary with equipment for all 5 slots
			- helm_gear_id, armor_gear_id, bow_gear_id, arrow_gear_id, amulet_gear_id

	Returns:
		Total power rating for the loadout
	"""
	var total_power: int = 0
	var slot_types: Array = ["helm", "armor", "bow", "arrow", "amulet"]

	for slot in slot_types:
		var gear_id_key: String = slot + "_gear_id"
		if loadout_data.has(gear_id_key) and gear_registry:
			var gear_id: String = loadout_data[gear_id_key]
			if not gear_id.is_empty():
				var gear_data = gear_registry.get_base_gear(gear_id)
				if gear_data:
					var weapon_dict: Dictionary = {
						"gear_id": gear_id,
						"gear_type": gear_data.slot_type,
						"rarity": _string_to_rarity(gear_data.rarity),
						"stats": gear_data.stats
					}
					total_power += get_weapon_power_rating(weapon_dict)

	return total_power

# --- Balance Adjustments ---

func apply_balance_adjustment(weapon_id: String, multiplier: float) -> void:
	"""Applies a balance adjustment to a specific weapon.

	This allows for hotfixes without code deployment. Changes are logged to
	the server for audit purposes.

	Parameters:
		weapon_id: Unique weapon identifier
		multiplier: Damage multiplier (0.5 = -50%, 1.5 = +50%)
	"""
	var profiling_block = _profiler.create_profile_block("WeaponBalanceManager.apply_balance_adjustment") if _profiler else null

	if multiplier <= 0:
		push_error("Balance multiplier must be positive, got: %s" % multiplier)
		if profiling_block:
			profiling_block.end()
		return

	_balance_adjustments[weapon_id] = multiplier
	balance_adjustment_applied.emit(weapon_id, multiplier)

	# Report to server for logging
	if network_manager and network_manager.is_connected:
		_report_balance_adjustment(weapon_id, multiplier)

	if profiling_block:
		profiling_block.end()


func revert_balance_adjustment(weapon_id: String) -> void:
	"""Removes a balance adjustment from a weapon.

	Parameters:
		weapon_id: Unique weapon identifier
	"""
	if _balance_adjustments.has(weapon_id):
		_balance_adjustments.erase(weapon_id)
		balance_adjustment_reverted.emit(weapon_id)

		# Report to server for logging
		if network_manager and network_manager.is_connected:
			_report_balance_adjustment(weapon_id, 1.0)  # 1.0 = revert to default


func get_balance_adjustment(weapon_id: String) -> float:
	"""Gets the current balance adjustment for a weapon.

	Parameters:
		weapon_id: Unique weapon identifier

	Returns:
		Current multiplier (1.0 = no adjustment)
	"""
	return _balance_adjustments.get(weapon_id, 1.0)


func _fetch_balance_adjustments() -> void:
	"""Fetches current balance adjustments from the server.

	This is called on initialization to ensure client has latest hotfixes.
	"""
	if not network_manager:
		return

	# TODO: Implement RPC to fetch balance adjustments
	# For now, adjustments are stored locally


func _report_balance_adjustment(weapon_id: String, multiplier: float) -> void:
	"""Reports a balance adjustment to the server for audit logging.

	Parameters:
		weapon_id: Unique weapon identifier
		multiplier: Applied multiplier
	"""
	if not network_manager or not network_manager.is_connected:
		return

	# TODO: Implement RPC to report balance adjustments
	# This should log: admin_id, weapon_id, multiplier, timestamp, reason


# --- Helper Functions ---

func _string_to_rarity(rarity_str: String) -> int:
	"""Converts rarity string to enum value.

	Parameters:
		rarity_str: String like "common", "rare", etc.

	Returns:
		GearRarity enum value
	"""
	match rarity_str.to_lower():
		"common": return GearEnums.GearRarity.COMMON
		"rare": return GearEnums.GearRarity.RARE
		"epic": return GearEnums.GearRarity.EPIC
		"legendary": return GearEnums.GearRarity.LEGENDARY
		_: return GearEnums.GearRarity.COMMON


func get_tier_multiplier(tier: int) -> float:
	"""Gets the damage multiplier for a weapon tier.

	Parameters:
		tier: Weapon tier (GearRarity enum value)

	Returns:
		Damage multiplier
	"""
	return TIER_MULTIPLIERS.get(tier, 1.0)


func get_pvp_damage_reduction() -> float:
	"""Gets the current PvP damage reduction coefficient.

	Returns:
		Damage reduction multiplier (0.0 to 1.0)
	"""
	return PVP_DAMAGE_REDUCTION


func validate_weapon_damage(base_damage: float, tier: int) -> bool:
	"""Validates that a weapon's damage falls within acceptable range.

	Used by the server to prevent overpowered weapons from being registered.

	Parameters:
		base_damage: Weapon's base damage
		tier: Weapon tier

	Returns:
		True if damage is valid, false otherwise
	"""
	var max_allowed: float = _get_tier_average_damage(tier) * MAX_DAMAGE_PERCENTAGE

	if base_damage > max_allowed:
		push_error("Weapon damage %s exceeds maximum allowed %s for tier %s" % [base_damage, max_allowed, tier])
		return false

	return true
