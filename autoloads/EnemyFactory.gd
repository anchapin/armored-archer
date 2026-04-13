## Enemy Factory autoload for enemy instantiation and configuration.
## Provides enemy type registry, spawn configuration, and difficulty scaling.
##
## Usage:
## - Call spawn_enemy() to instantiate and configure enemies
## - Enemy types are registered in enemy_type_registry
## - Difficulty modifiers applied automatically via EnemyAIManager
##
## Signals:
## - enemy_spawned(enemy: BaseEnemy): Emitted when enemy is spawned

extends Node

# --- Signals ---
signal enemy_spawned(enemy: BaseEnemy)

# --- Enums ---
enum EnemyType {
	GOBLIN,
	SKELETON,
	ARCHER,
	SCOUT,
	BRUTE,
	GUARDIAN,
	SPEED,
	TANK,
	NECROMANCER,
	ELEMENTAL_FIRE,
	ELEMENTAL_ICE,
	ELEMENTAL_LIGHTNING,
	FLYING_HARPY,
	SWARMER_RUSHER
}

# --- Enemy Scene Registry ---
var enemy_scenes: Dictionary = {
	EnemyType.GOBLIN: "res://scenes/enemies/enemy_spawner.tscn",  # TODO: Create proper goblin scene
	EnemyType.SKELETON: "res://scenes/enemies/enemy_spawner.tscn",  # TODO: Create proper skeleton scene
	EnemyType.ARCHER: "res://scenes/enemies/enemy_spawner.tscn",  # TODO: Create proper archer scene
	EnemyType.SCOUT: "res://scenes/enemies/scout_enemy.tscn",
	EnemyType.BRUTE: "res://scenes/enemies/brute_enemy.tscn",
	EnemyType.GUARDIAN: "res://scenes/enemies/guardian_enemy.tscn",
	EnemyType.SPEED: "res://scenes/enemies/speed_enemy.tscn",
	EnemyType.TANK: "res://scenes/enemies/tank_enemy.tscn",
	EnemyType.NECROMANCER: "res://scenes/enemies/necromancer_enemy.tscn",
	EnemyType.SWARMER_RUSHER: "res://scenes/enemies/swarmer_enemy.tscn"
}

# --- Base Spawn Parameters ---
var spawn_parameters: Dictionary = {
	EnemyType.GOBLIN: {"health": 40, "damage": 8, "speed": 180, "xp": 15},
	EnemyType.SKELETON: {"health": 50, "damage": 10, "speed": 150, "xp": 20},
	EnemyType.ARCHER: {"health": 35, "damage": 12, "speed": 120, "xp": 25},
	EnemyType.SCOUT: {"health": 30, "damage": 6, "speed": 220, "xp": 15},
	EnemyType.BRUTE: {"health": 80, "damage": 15, "speed": 100, "xp": 35},
	EnemyType.GUARDIAN: {"health": 100, "damage": 12, "speed": 80, "xp": 40},
	EnemyType.SPEED: {"health": 25, "damage": 8, "speed": 250, "xp": 20},
	EnemyType.TANK: {"health": 120, "damage": 8, "speed": 70, "xp": 45},
	EnemyType.NECROMANCER: {"health": 60, "damage": 14, "speed": 90, "xp": 50},
	EnemyType.SWARMER_RUSHER: {"health": 20, "damage": 5, "speed": 200, "xp": 10}
}

# --- Enemy AI Behaviors ---
enum AIBehavior {
	AGGRESSIVE,
	DEFENSIVE,
	PACK_HUNT,
	AMBUSH
}

var ai_behavior_descriptions: Dictionary = {
	AIBehavior.AGGRESSIVE: "rush player with 1.5x speed, engage at 60% range",
	AIBehavior.DEFENSIVE: "hold position with 0.8x speed, engage at 40% range",
	AIBehavior.PACK_HUNT: "coordinate 2-4 enemies, flank player",
	AIBehavior.AMBUSH: "hide/teleport, strike at 30% range"
}

# --- State ---
var _ai_manager: Node

# --- Initialization ---
func _ready() -> void:
	_ai_manager = get_node_or_null("/root/EnemyAIManager")
	if not _ai_manager:
		push_error("EnemyFactory: EnemyAIManager not found")

# --- Public API ---

## Get scene path for enemy type
##
## Parameters:
##   enemy_type: EnemyType enum value
##
## Returns:
##   String: Scene file path
func get_enemy_scene(enemy_type: EnemyType) -> String:
	if enemy_scenes.has(enemy_type):
		return enemy_scenes[enemy_type]
	return ""

## Get base spawn parameters for enemy type
##
## Parameters:
##   enemy_type: EnemyType enum value
##
## Returns:
##   Dictionary: Base health, damage, speed, xp values
func get_base_parameters(enemy_type: EnemyType) -> Dictionary:
	if spawn_parameters.has(enemy_type):
		return spawn_parameters[enemy_type].duplicate()
	return {"health": 50, "damage": 10, "speed": 150, "xp": 20}

## Spawn enemy with configuration
##
## Parameters:
##   enemy_type: EnemyType enum value
##   position: Vector2 spawn position
##   difficulty: Difficulty tier (1-3)
##   ai_behavior: AIBehavior enum value
##
## Returns:
##   BaseEnemy: Configured enemy instance
func spawn_enemy(enemy_type: EnemyType, position: Vector2, difficulty: int = 1, ai_behavior: AIBehavior = AIBehavior.AGGRESSIVE) -> BaseEnemy:
	var scene_path: String = get_enemy_scene(enemy_type)
	if scene_path.is_empty():
		push_error("EnemyFactory: No scene registered for enemy type %d" % enemy_type)
		return null

	var scene = load(scene_path)
	if not scene:
		push_error("EnemyFactory: Failed to load scene: %s" % scene_path)
		return null

	var enemy: BaseEnemy = scene.instantiate()
	if not enemy:
		push_error("EnemyFactory: Failed to instantiate enemy from scene: %s" % scene_path)
		return null

	# Set spawn position
	enemy.global_position = position

	# Apply base parameters
	var base_params = get_base_parameters(enemy_type)
	enemy.max_health = base_params.get("health", 50)
	enemy.damage = base_params.get("damage", 10)
	enemy.move_speed = base_params.get("speed", 150.0)
	enemy.xp_reward = base_params.get("xp", 20)

	# Apply difficulty modifier
	apply_difficulty_modifier(enemy, difficulty)

	# Set initial AI state
	if _ai_manager:
		_setup_ai_state(enemy, ai_behavior)

	# Enable collision
	if enemy.has_method("enable_collision"):
		enemy.enable_collision()

	# Emit signal
	enemy_spawned.emit(enemy)

	return enemy

## Apply difficulty modifier to enemy stats
##
## Parameters:
##   enemy: BaseEnemy instance
##   difficulty: Difficulty tier (1-3)
func apply_difficulty_modifier(enemy: BaseEnemy, difficulty: int) -> void:
	var multiplier: float = 1.0
	match difficulty:
		1:
			multiplier = 0.8  # Easy: slightly weaker
		2:
			multiplier = 1.0  # Normal: base stats
		3:
			multiplier = 1.3  # Hard: significantly stronger
		_:
			multiplier = 1.0

	enemy.max_health = int(enemy.max_health * multiplier)
	enemy.damage = int(enemy.damage * multiplier)

## Get AI behavior description
##
## Parameters:
##   behavior: AIBehavior enum value
##
## Returns:
##   String: Human-readable description
func get_behavior_description(behavior: AIBehavior) -> String:
	if ai_behavior_descriptions.has(behavior):
		return ai_behavior_descriptions[behavior]
	return "Unknown behavior"

## Get base behavior for enemy type
##
## Parameters:
##   enemy_type: EnemyType enum value
##
## Returns:
##   AIBehavior: Default behavior for enemy type
func get_base_behavior(enemy_type: EnemyType) -> AIBehavior:
	match enemy_type:
		EnemyType.SCOUT, EnemyType.SPEED, EnemyType.SWARMER_RUSHER:
			return AIBehavior.AGGRESSIVE
		EnemyType.TANK, EnemyType.GUARDIAN:
			return AIBehavior.DEFENSIVE
		EnemyType.BRUTE:
			return AIBehavior.PACK_HUNT
		EnemyType.NECROMANCER:
			return AIBehavior.AMBUSH
		_:
			return AIBehavior.AGGRESSIVE

# --- Private Methods ---

## Setup AI state for enemy
##
## Parameters:
##   enemy: BaseEnemy instance
##   ai_behavior: AIBehavior enum value
func _setup_ai_state(enemy: BaseEnemy, ai_behavior: AIBehavior) -> void:
	match ai_behavior:
		AIBehavior.AGGRESSIVE:
			enemy.move_speed *= 1.5
		AIBehavior.DEFENSIVE:
			enemy.move_speed *= 0.8
		AIBehavior.PACK_HUNT:
			# Pack hunting handled by EnemyAIManager coordination
			pass
		AIBehavior.AMBUSH:
			# Ambush behavior handled by enemy script
			pass
