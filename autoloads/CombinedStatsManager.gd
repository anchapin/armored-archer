## Manages combined player statistics from base stats and gear.
## Provides unified stat calculations for gameplay.
##
## This manager combines:
## - Base stats from PlayerStatsManager (allocated ability points)
## - Gear stats from GearManager (equipped equipment with diminishing returns)
##
## Signals:
## - combined_stats_updated(stats: Dictionary): Emitted when combined stats change
extends Node

# --- References ---
var player_stats_manager: Node
var gear_manager: Node

# --- Base Stat Values (per point allocated) ---
const BASE_HEALTH_PER_POINT: int = 10
const BASE_SPEED_PER_POINT: float = 2.0
const BASE_ATTACK_PER_POINT: int = 3
const BASE_DEFENSE_PER_POINT: int = 2
const BASE_DODGE_PER_POINT: int = 1
const BASE_CRIT_RATE_PER_POINT: float = 0.5

# --- Base Health Formula ---
const BASE_HEALTH: int = 100  # Base health at level 1
const HEALTH_PER_LEVEL: int = 20  # Additional health per level

# --- Signals ---
signal combined_stats_updated(stats: Dictionary)

# --- Cached Combined Stats ---
var _cached_stats: Dictionary = {}
var _is_dirty: bool = true

func _ready() -> void:
	"""Initialize manager and connect to stat update signals."""
	player_stats_manager = get_node_or_null("/root/PlayerStatsManager")
	gear_manager = get_node_or_null("/root/GearManager")

	# Connect to PlayerStatsManager signals
	if player_stats_manager:
		if player_stats_manager.has_signal("stats_updated"):
			player_stats_manager.stats_updated.connect(_on_base_stats_updated)
		if player_stats_manager.has_signal("level_up"):
			player_stats_manager.level_up.connect(_on_level_up)
		if player_stats_manager.has_signal("stat_allocated"):
			player_stats_manager.stat_allocated.connect(_on_stat_allocated)

	# Connect to GearManager signals
	if gear_manager:
		if gear_manager.has_signal("inventory_updated"):
			gear_manager.inventory_updated.connect(_on_gear_inventory_updated)
		if gear_manager.has_signal("gear_equipped"):
			gear_manager.gear_equipped.connect(_on_gear_equipped)
		if gear_manager.has_signal("gear_unequipped"):
			gear_manager.gear_unequipped.connect(_on_gear_unequipped)

	# Initial calculation
	_calculate_combined_stats()

# --- Public API ---

## Gets the combined stat value for a specific stat.
## Parameters:
##   stat_name: Name of the stat to get (attack, defense, dodge, crit_rate, speed, health)
## Returns:
##   int/float: Combined stat value (base + gear)
func get_stat(stat_name: String) -> float:
	"""Gets combined stat value for a specific stat."""
	if _is_dirty:
		_calculate_combined_stats()

	return _cached_stats.get(stat_name, 0.0)

## Gets all combined stats as a dictionary.
## Returns:
##   Dictionary: All combined stats
func get_all_stats() -> Dictionary:
	"""Gets all combined stats."""
	if _is_dirty:
		_calculate_combined_stats()

	return _cached_stats.duplicate()

## Gets the player's total attack power (base + gear).
## Used for damage calculations in combat.
## Returns:
##   float: Total attack power
func get_attack_power() -> float:
	"""Gets total attack power for damage calculations."""
	return get_stat("attack")

## Gets the player's total defense (base + gear).
## Used for damage reduction calculations.
## Returns:
##   float: Total defense
func get_defense() -> float:
	"""Gets total defense for damage reduction."""
	return get_stat("defense")

## Gets the player's total dodge chance (base + gear).
## Returns:
##   float: Dodge chance as percentage (0-100)
func get_dodge_chance() -> float:
	"""Gets total dodge chance."""
	return get_stat("dodge")

## Gets the player's total critical hit rate (base + gear).
## Returns:
##   float: Crit rate as percentage (0-100)
func get_crit_rate() -> float:
	"""Gets total crit rate."""
	return get_stat("crit_rate")

## Gets the player's total health (base + gear).
## Used for setting max health in combat.
## Returns:
##   int: Total max health
func get_max_health() -> int:
	"""Gets total max health from stats."""
	return int(get_stat("health"))

## Gets the player's total movement speed (base + gear).
## Returns:
##   float: Movement speed
func get_speed() -> float:
	"""Gets total movement speed."""
	return get_stat("speed")

## Forces a recalculation of combined stats.
## Call this if you've updated stats directly.
func recalculate_stats() -> void:
	"""Forces a recalculation of combined stats."""
	_is_dirty = true
	_calculate_combined_stats()

# --- Private Methods ---

## Calculates combined stats from base and gear sources.
func _calculate_combined_stats() -> void:
	"""Calculates combined stats from base allocation and gear."""
	var combined: Dictionary = {
		"attack": 0.0,
		"defense": 0.0,
		"dodge": 0.0,
		"crit_rate": 0.0,
		"speed": 200.0,  # Base movement speed
		"health": 0.0
	}

	# --- Add Base Stats from PlayerStatsManager ---
	if player_stats_manager:
		var level: int = player_stats_manager.get_level()
		var base_attack: int = player_stats_manager.get_attack()
		var base_defense: int = player_stats_manager.get_defense()
		var base_dodge: int = player_stats_manager.get_dodge()
		var base_crit_rate: int = player_stats_manager.get_crit_rate()

		# Calculate base stat contributions
		combined.attack += float(base_attack) * BASE_ATTACK_PER_POINT
		combined.defense += float(base_defense) * BASE_DEFENSE_PER_POINT
		combined.dodge += float(base_dodge) * BASE_DODGE_PER_POINT
		combined.crit_rate += float(base_crit_rate) * BASE_CRIT_RATE_PER_POINT

		# Calculate base health (level-based + stat-based)
		combined.health += float(BASE_HEALTH + (level * HEALTH_PER_LEVEL))
		# Health can also come from defense stat (some games use defense for HP)
		combined.health += float(base_defense) * BASE_HEALTH_PER_POINT

	# --- Add Gear Stats from GearManager ---
	if gear_manager and gear_manager.has_method("get_total_equipped_stats"):
		var gear_stats: Dictionary = gear_manager.get_total_equipped_stats()

		combined.attack += gear_stats.get("attack", 0.0)
		combined.defense += gear_stats.get("defense", 0.0)
		combined.dodge += gear_stats.get("dodge", 0.0)
		combined.crit_rate += gear_stats.get("crit_rate", 0.0)
		combined.speed += gear_stats.get("speed", 0.0)
		combined.health += gear_stats.get("health", 0.0)

	# Apply caps
	combined.crit_rate = min(combined.crit_rate, 100.0)  # Max 100% crit
	combined.dodge = min(combined.dodge, 75.0)  # Max 75% dodge
	combined.speed = max(combined.speed, 50.0)  # Minimum speed

	_cached_stats = combined
	_is_dirty = false

	combined_stats_updated.emit(_cached_stats)

# --- Signal Handlers ---

func _on_base_stats_updated(_stats: Dictionary) -> void:
	"""Handle base stats updated from PlayerStatsManager."""
	_is_dirty = true
	_calculate_combined_stats()

func _on_level_up(_new_level: int, _ability_points_gained: int) -> void:
	"""Handle player level up."""
	_is_dirty = true
	_calculate_combined_stats()

func _on_stat_allocated(_stat_name: String, _amount: int) -> void:
	"""Handle stat point allocation."""
	_is_dirty = true
	_calculate_combined_stats()

func _on_gear_inventory_updated(_inventory: Dictionary) -> void:
	"""Handle gear inventory updated."""
	_is_dirty = true
	_calculate_combined_stats()

func _on_gear_equipped(_slot: String, _gear_id: String) -> void:
	"""Handle gear equipped."""
	_is_dirty = true
	_calculate_combined_stats()

func _on_gear_unequipped(_slot: String) -> void:
	"""Handle gear unequipped."""
	_is_dirty = true
	_calculate_combined_stats()
