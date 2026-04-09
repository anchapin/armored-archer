## Manages enemy AI for PvE combat with difficulty-based tactics.
## Provides enemy decision logic for different difficulty tiers and AI behaviors.
##
## AI Behaviors:
## - AGGRESSIVE: Rush player with 1.5x speed, engage at 60% range
## - DEFENSIVE: Hold position with 0.8x speed, engage at 40% range
## - PACK_HUNT: Coordinate 2-4 enemies, flank player
## - AMBUSH: Hide/teleport, strike at 30% range
##
## Signals:
## - enemy_action_decided(action: Dictionary): Emitted when enemy chooses an action
## - enemy_spawned(enemy: Node): Emitted when enemy is spawned
## - enemy_died(enemy: Node): Emitted when enemy dies

extends Node

# --- Signals ---
signal enemy_action_decided(action: Dictionary)
signal enemy_spawned(enemy: Node)
signal enemy_died(enemy: Node)

# --- Enums ---
enum Difficulty { EASY = 1, MEDIUM = 2, HARD = 3, BOSS = 4 }

enum AIBehavior {
	AGGRESSIVE,    # 1.5x speed, engage at 60% range
	DEFENSIVE,     # 0.8x speed, engage at 40% range, hold position
	PACK_HUNT,     # Coordinate 2-4 enemies, flank player
	AMBUSH         # Hide/teleport, strike at 30% range
}

# --- State ---
var _enemy_stats: Dictionary = {}
var _difficulty: int = 1
var _turn_count: int = 0
var _last_action: String = ""
var _ai_behavior: AIBehavior = AIBehavior.AGGRESSIVE

# --- Pack Hunting State ---
var _pack_members: Array = []  # Array of enemies in the pack
var _pack_target: Vector2 = Vector2.ZERO
var _is_flanking: bool = false

# --- Boss State ---
var _boss_damage_multiplier: float = 1.0

# --- Public API ---

## Initialize enemy for a PvE encounter
##
## Parameters:
##   enemy_data: Dictionary with type, health, attack, defense, speed
##   difficulty: Difficulty tier (1-4)
##   ai_behavior: AI behavior pattern
func setup_enemy(enemy_data: Dictionary, difficulty: int, ai_behavior: AIBehavior = AIBehavior.AGGRESSIVE) -> void:
	_enemy_stats = enemy_data.duplicate()
	_enemy_stats["max_health"] = enemy_data.get("health", 100)
	_difficulty = difficulty
	_ai_behavior = ai_behavior
	_turn_count = 0
	_last_action = ""
	_boss_damage_multiplier = 1.0

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

## Get difficulty modifier for enemy stats
##
## Parameters:
##   enemy_type: Type of enemy (for specific modifiers)
##
## Returns:
##   float: Stat multiplier based on difficulty
func get_difficulty_modifier(enemy_type: int = 0) -> float:
	match _difficulty:
		1:
			return 0.8  # Easy: slightly weaker
		2:
			return 1.0  # Normal: base stats
		3:
			return 1.3  # Hard: significantly stronger
		4:
			return 2.0  # Boss: 2x multiplier
		_:
			return 1.0

## Apply difficulty to enemy instance
##
## Parameters:
##   enemy: Enemy node instance
##   difficulty: Difficulty tier (1-4)
func apply_difficulty_to_enemy(enemy: Node, difficulty: int) -> void:
	var multiplier = get_difficulty_modifier()

	if enemy.has_property("max_health"):
		var base_health = enemy.max_health
		enemy.max_health = int(base_health * multiplier)
		enemy.current_health = enemy.max_health

	if enemy.has_property("damage"):
		var base_damage = enemy.damage
		enemy.damage = int(base_damage * multiplier)

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

## Decide enemy action based on difficulty, behavior, and current state
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

	# Apply behavior-based AI
	match _ai_behavior:
		AIBehavior.AGGRESSIVE:
			action = _aggressive_behavior_ai(player_health, player_defense)
		AIBehavior.DEFENSIVE:
			action = _defensive_behavior_ai(player_health, player_defense)
		AIBehavior.PACK_HUNT:
			action = _pack_hunt_behavior_ai(player_health, player_defense)
		AIBehavior.AMBUSH:
			action = _ambush_behavior_ai(player_health, player_defense)
		_:
			action = _aggressive_behavior_ai(player_health, player_defense)

	_last_action = action.get("action", "attack")
	enemy_action_decided.emit(action)
	return action

## Get base behavior for enemy type
##
## Parameters:
##   enemy_type: Type identifier for enemy
##
## Returns:
##   AIBehavior: Default behavior for enemy type
func get_base_behavior(enemy_type: int) -> AIBehavior:
	# Scout, speed, swarmer = aggressive
	# Tank, guardian = defensive
	# Brute = pack hunt
	# Necromancer = ambush
	match enemy_type:
		1, 2, 3:  # Scout, speed, swarmer
			return AIBehavior.AGGRESSIVE
		4:  # Tank
			return AIBehavior.DEFENSIVE
		5:  # Guardian
			return AIBehavior.DEFENSIVE
		6:  # Brute
			return AIBehavior.PACK_HUNT
		7:  # Necromancer
			return AIBehavior.AMBUSH
		_:
			return AIBehavior.AGGRESSIVE

## Select AI behavior dynamically
##
## Parameters:
##   ai_behavior: Desired behavior type
func select_behavior(ai_behavior: AIBehavior) -> void:
	_ai_behavior = ai_behavior

## Register enemy for pack hunting
##
## Parameters:
##   enemy: Enemy node to add to pack
func register_pack_member(enemy: Node) -> void:
	if not _pack_members.has(enemy):
		_pack_members.append(enemy)

## Unregister enemy from pack hunting
##
## Parameters:
##   enemy: Enemy node to remove from pack
func unregister_pack_member(enemy: Node) -> void:
	_pack_members.erase(enemy)
	_update_pack_targets()

## Update pack hunting targets for flanking
func _update_pack_targets() -> void:
	if _pack_members.size() < 2:
		return

	# Simple flanking: split pack members
	for i in range(_pack_members.size()):
		var enemy = _pack_members[i]
		if enemy and enemy.has_method("set_flank_target"):
			var flank_dir = 1 if i % 2 == 0 else -1
			enemy.set_flank_target(flank_dir)

## Apply boss damage multiplier (for phase bonuses)
##
## Parameters:
##   multiplier: Damage multiplier (1.0-1.5)
func apply_boss_damage_multiplier(multiplier: float) -> void:
	_boss_damage_multiplier = multiplier

# --- AI Behavior Implementations ---

## Aggressive Behavior: 1.5x speed, engage at 60% range
##
## Parameters:
##   player_health: Current player health
##   player_defense: Current player defense
##
## Returns:
##   Dictionary: Action with damage value
func _aggressive_behavior_ai(player_health: int, player_defense: int) -> Dictionary:
	# Always attack when in range
	return {"action": "attack", "damage": _calculate_damage()}

## Defensive Behavior: 0.8x speed, engage at 40% range, hold position
##
## Parameters:
##   player_health: Current player health
##   player_defense: Current player defense
##
## Returns:
##   Dictionary: Action with damage value
func _defensive_behavior_ai(player_health: int, player_defense: int) -> Dictionary:
	var health_ratio = float(player_health) / 100.0

	# Defend when player health is high (wait for opening)
	if health_ratio > 0.6:
		return {"action": "defend", "damage": 0}
	# Counter-attack when player health is low
	elif health_ratio < 0.3:
		return {"action": "power_attack", "damage": _calculate_damage() * 1.2}
	else:
		return {"action": "attack", "damage": _calculate_damage()}

## Pack Hunt Behavior: Coordinate 2-4 enemies, flank player
##
## Parameters:
##   player_health: Current player health
##   player_defense: Current player defense
##
## Returns:
##   Dictionary: Action with damage value
func _pack_hunt_behavior_ai(player_health: int, player_defense: int) -> Dictionary:
	# Coordinate with pack members
	if _pack_members.size() >= 2:
		# Flanking attack
		if randf() < 0.5:
			return {"action": "flank_attack", "damage": _calculate_damage() * 1.1}

	# Pack rush attack
	return {"action": "attack", "damage": _calculate_damage()}

## Ambush Behavior: Hide/teleport, strike at 30% range
##
## Parameters:
##   player_health: Current player health
##   player_defense: Current player defense
##
## Returns:
##   Dictionary: Action with damage value
func _ambush_behavior_ai(player_health: int, player_defense: int) -> Dictionary:
	var health_ratio = float(player_health) / 100.0

	# Ambush when player is healthy (unexpected attack)
	if health_ratio > 0.5:
		return {"action": "ambush_attack", "damage": _calculate_damage() * 1.3}

	# Retreat and re-ambush when player is low
	return {"action": "defend", "damage": 0}

# --- Legacy AI Implementations (for compatibility) ---

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
	var damage = base_atk * _boss_damage_multiplier
	var variance = randi_range(-2, 2)
	return max(1, int(damage + variance))
