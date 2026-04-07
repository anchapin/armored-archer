## Manages enemy AI for PvE combat with difficulty-based tactics.
## Provides enemy decision logic for different difficulty tiers.
##
## Signals:
## - enemy_action_decided(action: Dictionary): Emitted when enemy chooses an action
##
extends Node

# --- Signals ---
signal enemy_action_decided(action: Dictionary)

# --- Enums ---
enum Difficulty { EASY = 1, MEDIUM = 2, HARD = 3 }

# --- State ---
var _enemy_stats: Dictionary = {}
var _difficulty: int = 1
var _turn_count: int = 0
var _last_action: String = ""

# --- Public API ---

## Initialize enemy for a PvE encounter
##
## Parameters:
##   enemy_data: Dictionary with type, health, attack, defense, speed
##   difficulty: Difficulty tier (1-3)
func setup_enemy(enemy_data: Dictionary, difficulty: int) -> void:
	_enemy_stats = enemy_data.duplicate()
	_enemy_stats["max_health"] = enemy_data.get("health", 100)
	_difficulty = difficulty
	_turn_count = 0
	_last_action = ""

## Get enemy stats
##
## Returns:
##   Dictionary: Current enemy stats
func get_enemy_stats() -> Dictionary:
	return _enemy_stats

## Get current enemy health
##
## Returns:
##   int: Current enemy health value
func get_enemy_health() -> int:
	return _enemy_stats.get("health", 0)

## Reduce enemy health by damage amount
##
## Parameters:
##   damage: Amount of damage to apply
func take_damage(damage: int) -> void:
	_enemy_stats["health"] = max(0, _enemy_stats.get("health", 0) - damage)

## Check if enemy is defeated
##
## Returns:
##   bool: True if enemy health is 0 or less
func is_defeated() -> bool:
	return get_enemy_health() <= 0

## Decide enemy action based on difficulty and current state
##
## Parameters:
##   player_health: Current player health for tactical decisions
##   player_defense: Current player defense for damage calculations
##
## Returns:
##   Dictionary: {"action": "attack"|"defend"|"power_attack", "damage": int}
func decide_action(player_health: int, player_defense: int) -> Dictionary:
	_turn_count += 1
	var action: Dictionary = {}

	match _difficulty:
		1:
			action = _easy_ai()
		2:
			action = _medium_ai(player_health)
		3:
			action = _hard_ai(player_health, player_defense)
		_:
			action = _easy_ai()

	_last_action = action.get("action", "attack")
	enemy_action_decided.emit(action)
	return action

# --- AI Implementations ---

## Difficulty 1: Random — 60% attack, 40% defend
##
## Returns:
##   Dictionary: Action with damage value
func _easy_ai() -> Dictionary:
	var roll = randf()
	if roll < 0.6:
		return {"action": "attack", "damage": _calculate_damage()}
	else:
		return {"action": "defend", "damage": 0}

## Difficulty 2: Basic — aggressive when player healthy, defensive when player low
##
## Parameters:
##   player_health: Current player health for decision logic
##
## Returns:
##   Dictionary: Action with damage value
func _medium_ai(player_health: int) -> Dictionary:
	var health_ratio = float(player_health) / 100.0
	if health_ratio > 0.6:
		return {"action": "attack", "damage": _calculate_damage()}
	elif health_ratio < 0.3:
		return {"action": "power_attack", "damage": _calculate_damage() * 1.5}
	else:
		return {"action": "defend", "damage": 0}

## Difficulty 3: Adaptive — considers player defense, self health, turn pattern
##
## Parameters:
##   player_health: Current player health for decision logic
##   player_defense: Current player defense for tactical decisions
##
## Returns:
##   Dictionary: Action with damage value
func _hard_ai(player_health: int, player_defense: int) -> Dictionary:
	var self_ratio = float(get_enemy_health()) / float(_enemy_stats.get("max_health", 100))

	# Low self health? Defend or power attack
	if self_ratio < 0.3:
		if _last_action != "defend":
			return {"action": "defend", "damage": 0}
		else:
			return {"action": "power_attack", "damage": _calculate_damage() * 1.5}

	# Player has high defense? Power attack to break through
	if player_defense > 15:
		return {"action": "power_attack", "damage": _calculate_damage() * 1.5}

	# Repeat last action if it worked (adaptive)
	if _last_action == "attack":
		return {"action": "attack", "damage": _calculate_damage()}

	# Default: attack
	return {"action": "attack", "damage": _calculate_damage()}

# --- Helpers ---

## Calculate damage from enemy attack stat
##
## Returns:
##   int: Damage value with small variance
func _calculate_damage() -> int:
	var base_atk = _enemy_stats.get("attack", 10)
	var variance = randi_range(-2, 2)
	return max(1, base_atk + variance)
