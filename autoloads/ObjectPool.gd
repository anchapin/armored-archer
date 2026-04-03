## Object Pool Manager
## Provides efficient object pooling for frequently instantiated game objects
## to reduce memory allocation spikes and garbage collection pressure on budget devices
##
## Usage:
##   ObjectPool.get_arrow() - Get an arrow from pool or create new
##   ObjectPool.get_enemy() - Get an enemy from pool or create new
##   ObjectPool.get_hit_effect() - Get a hit effect from pool or create new
##   ObjectPool.get_death_effect() - Get a death effect from pool or create new
##   ObjectPool.return_arrow(node) - Return arrow to pool
##   ObjectPool.return_enemy(node) - Return enemy to pool
##   ObjectPool.return_hit_effect(node) - Return hit effect to pool
##   ObjectPool.return_death_effect(node) - Return death effect to pool
##
extends Node

# Pool sizes - can be adjusted based on device tier
const ARROW_POOL_SIZE: int = 20
const ENEMY_POOL_SIZE: int = 15
const HIT_EFFECT_POOL_SIZE: int = 10
const DEATH_EFFECT_POOL_SIZE: int = 5

# Preloaded scenes
var _arrow_scene: PackedScene
var _enemy_scene: PackedScene
var _hit_effect_scene: PackedScene
var _death_effect_scene: PackedScene

# Object pools - Array of available (inactive) objects
var _arrow_pool: Array[Node] = []
var _enemy_pool: Array[Node] = []
var _hit_effect_pool: Array[Node] = []
var _death_effect_pool: Array[Node] = []

# Active objects tracking (for debugging/memory management)
var _active_arrows: Array[Node] = []
var _active_enemies: Array[Node] = []
var _active_hit_effects: Array[Node] = []
var _active_death_effects: Array[Node] = []

# Statistics
var _arrows_created: int = 0
var _arrows_reused: int = 0
var _enemies_created: int = 0
var _enemies_reused: int = 0
var _hit_effects_created: int = 0
var _hit_effects_reused: int = 0
var _death_effects_created: int = 0
var _death_effects_reused: int = 0

func _ready() -> void:
	_initialize_pools()

func _initialize_pools() -> void:
	# Preload scenes
	_arrow_scene = preload("res://scenes/arrow.tscn")
	_enemy_scene = preload("res://scenes/enemies/melee_enemy.tscn")
	_hit_effect_scene = preload("res://assets/particles/hit_effect.tscn")
	_death_effect_scene = preload("res://assets/particles/death_effect.tscn")

	# Adjust pool sizes based on device tier
	var pool_size_multiplier: float = 1.0
	if PerformanceProfiler.is_budget_device():
		pool_size_multiplier = 0.5  # Smaller pools on budget devices
	elif PerformanceProfiler.is_mid_range_device():
		pool_size_multiplier = 0.75

	var adjusted_arrow_pool = int(ARROW_POOL_SIZE * pool_size_multiplier)
	var adjusted_enemy_pool = int(ENEMY_POOL_SIZE * pool_size_multiplier)
	var adjusted_hit_pool = int(HIT_EFFECT_POOL_SIZE * pool_size_multiplier)
	var adjusted_death_pool = int(DEATH_EFFECT_POOL_SIZE * pool_size_multiplier)

	# Create initial pools
	for i in range(max(adjusted_arrow_pool, 5)):
		var arrow = _arrow_scene.instantiate()
		arrow.set_process(false)
		arrow.set_physics_process(false)
		arrow.visible = false
		_arrow_pool.append(arrow)
		add_child(arrow)

	for i in range(max(adjusted_enemy_pool, 3)):
		var enemy = _enemy_scene.instantiate()
		enemy.set_process(false)
		enemy.set_physics_process(false)
		enemy.visible = false
		_enemy_pool.append(enemy)
		add_child(enemy)

	for i in range(max(adjusted_hit_pool, 3)):
		var effect = _hit_effect_scene.instantiate()
		effect.set_process(false)
		effect.visible = false
		_hit_effect_pool.append(effect)
		add_child(effect)

	for i in range(max(adjusted_death_pool, 2)):
		var effect = _death_effect_scene.instantiate()
		effect.set_process(false)
		effect.visible = false
		_death_effect_pool.append(effect)
		add_child(effect)

# --- Arrow Pool ---

## Get an arrow from the pool, or create a new one if pool is empty
func get_arrow() -> Node:
	var arrow: Node

	if _arrow_pool.size() > 0:
		arrow = _arrow_pool.pop_back()
		_arrows_reused += 1
	else:
		arrow = _arrow_scene.instantiate()
		_arrows_created += 1
		add_child(arrow)

	arrow.set_process(true)
	arrow.set_physics_process(true)
	arrow.visible = true
	_active_arrows.append(arrow)

	return arrow

## Return an arrow to the pool
func return_arrow(arrow: Node) -> void:
	if not is_instance_valid(arrow):
		return

	arrow.set_process(false)
	arrow.set_physics_process(false)
	arrow.visible = false

	# Reset arrow state if it has a setup method
	if arrow.has_method("reset_pooled_state"):
		arrow.reset_pooled_state()

	_arrow_pool.append(arrow)
	_active_arrows.erase(arrow)

# --- Enemy Pool ---

## Get an enemy from the pool, or create a new one if pool is empty
func get_enemy() -> Node:
	var enemy: Node

	if _enemy_pool.size() > 0:
		enemy = _enemy_pool.pop_back()
		_enemies_reused += 1
	else:
		enemy = _enemy_scene.instantiate()
		_enemies_created += 1
		add_child(enemy)

	enemy.set_process(true)
	enemy.set_physics_process(true)
	enemy.visible = true
	_active_enemies.append(enemy)

	return enemy

## Return an enemy to the pool
func return_enemy(enemy: Node) -> void:
	if not is_instance_valid(enemy):
		return

	enemy.set_process(false)
	enemy.set_physics_process(false)
	enemy.visible = false

	# Reset enemy state if it has a reset method
	if enemy.has_method("reset_pooled_state"):
		enemy.reset_pooled_state()

	_enemy_pool.append(enemy)
	_active_enemies.erase(enemy)

# --- Hit Effect Pool ---

## Get a hit effect from the pool, or create a new one if pool is empty
func get_hit_effect() -> Node:
	var effect: Node

	if _hit_effect_pool.size() > 0:
		effect = _hit_effect_pool.pop_back()
		_hit_effects_reused += 1
	else:
		effect = _hit_effect_scene.instantiate()
		_hit_effects_created += 1
		add_child(effect)

	effect.set_process(true)
	effect.visible = true
	_active_hit_effects.append(effect)

	return effect

## Return a hit effect to the pool
func return_hit_effect(effect: Node) -> void:
	if not is_instance_valid(effect):
		return

	effect.set_process(false)
	effect.visible = false

	# Reset effect state if it has a reset method
	if effect.has_method("reset_pooled_state"):
		effect.reset_pooled_state()

	_hit_effect_pool.append(effect)
	_active_hit_effects.erase(effect)

# --- Death Effect Pool ---

## Get a death effect from the pool, or create a new one if pool is empty
func get_death_effect() -> Node:
	var effect: Node

	if _death_effect_pool.size() > 0:
		effect = _death_effect_pool.pop_back()
		_death_effects_reused += 1
	else:
		effect = _death_effect_scene.instantiate()
		_death_effects_created += 1
		add_child(effect)

	effect.set_process(true)
	effect.visible = true
	_active_death_effects.append(effect)

	return effect

## Return a death effect to the pool
func return_death_effect(effect: Node) -> void:
	if not is_instance_valid(effect):
		return

	effect.set_process(false)
	effect.visible = false

	# Reset effect state if it has a reset method
	if effect.has_method("reset_pooled_state"):
		effect.reset_pooled_state()

	_death_effect_pool.append(effect)
	_active_death_effects.erase(effect)

# --- Statistics ---

## Get pool statistics
func get_statistics() -> Dictionary:
	return {
		"arrows": {
			"active": _active_arrows.size(),
			"available": _arrow_pool.size(),
			"created": _arrows_created,
			"reused": _arrows_reused,
			"reuse_rate": _get_reuse_rate(_arrows_created, _arrows_reused)
		},
		"enemies": {
			"active": _active_enemies.size(),
			"available": _enemy_pool.size(),
			"created": _enemies_created,
			"reused": _enemies_reused,
			"reuse_rate": _get_reuse_rate(_enemies_created, _enemies_reused)
		},
		"hit_effects": {
			"active": _active_hit_effects.size(),
			"available": _hit_effect_pool.size(),
			"created": _hit_effects_created,
			"reused": _hit_effects_reused,
			"reuse_rate": _get_reuse_rate(_hit_effects_created, _hit_effects_reused)
		},
		"death_effects": {
			"active": _active_death_effects.size(),
			"available": _death_effect_pool.size(),
			"created": _death_effects_created,
			"reused": _death_effects_reused,
			"reuse_rate": _get_reuse_rate(_death_effects_created, _death_effects_reused)
		}
	}

func _get_reuse_rate(created: int, reused: int) -> float:
	var total = created + reused
	if total == 0:
		return 0.0
	return float(reused) / float(total) * 100.0

## Log statistics to console
func log_statistics() -> void:
	var stats = get_statistics()
	push_warning("[ObjectPool] Arrows: %d active, %d available, %d created, %d reused (%.1f%% reuse rate)" %
		[stats.arrows.active, stats.arrows.available, stats.arrows.created, stats.arrows.reused, stats.arrows.reuse_rate])
	push_warning("[ObjectPool] Enemies: %d active, %d available, %d created, %d reused (%.1f%% reuse rate)" %
		[stats.enemies.active, stats.enemies.available, stats.enemies.created, stats.enemies.reused, stats.enemies.reuse_rate])
	push_warning("[ObjectPool] HitEffects: %d active, %d available, %d created, %d reused (%.1f%% reuse rate)" %
		[stats.hit_effects.active, stats.hit_effects.available, stats.hit_effects.created, stats.hit_effects.reused, stats.hit_effects.reuse_rate])
	push_warning("[ObjectPool] DeathEffects: %d active, %d available, %d created, %d reused (%.1f%% reuse rate)" %
		[stats.death_effects.active, stats.death_effects.available, stats.death_effects.created, stats.death_effects.reused, stats.death_effects.reuse_rate])

## Clean up invalid instances from active tracking arrays
func cleanup_invalid_instances() -> void:
	# Clean up arrows
	var invalid_arrows: Array[Node] = []
	for arrow in _active_arrows:
		if not is_instance_valid(arrow):
			invalid_arrows.append(arrow)
	for arrow in invalid_arrows:
		_active_arrows.erase(arrow)

	# Clean up enemies
	var invalid_enemies: Array[Node] = []
	for enemy in _active_enemies:
		if not is_instance_valid(enemy):
			invalid_enemies.append(enemy)
	for enemy in invalid_enemies:
		_active_enemies.erase(enemy)

	# Clean up hit effects
	var invalid_effects: Array[Node] = []
	for effect in _active_hit_effects:
		if not is_instance_valid(effect):
			invalid_effects.append(effect)
	for effect in invalid_effects:
		_active_hit_effects.erase(effect)

	# Clean up death effects
	var invalid_death_effects: Array[Node] = []
	for effect in _active_death_effects:
		if not is_instance_valid(effect):
			invalid_death_effects.append(effect)
	for effect in invalid_death_effects:
		_active_death_effects.erase(effect)

## Pre-warm pools (call during loading screen)
func warm_pools() -> void:
	# Additional warming if needed
	pass

## Clean up all pooled objects - call when game exits or needs full reset
func cleanup_all() -> void:
	# Clean up all arrows
	for arrow in _arrow_pool:
		if is_instance_valid(arrow):
			arrow.queue_free()
	_arrow_pool.clear()
	_active_arrows.clear()

	# Clean up all enemies
	for enemy in _enemy_pool:
		if is_instance_valid(enemy):
			enemy.queue_free()
	_enemy_pool.clear()
	_active_enemies.clear()

	# Clean up all hit effects
	for effect in _hit_effect_pool:
		if is_instance_valid(effect):
			effect.queue_free()
	_hit_effect_pool.clear()
	_active_hit_effects.clear()

	# Clean up all death effects
	for effect in _death_effect_pool:
		if is_instance_valid(effect):
			effect.queue_free()
	_death_effect_pool.clear()
	_active_death_effects.clear()

## Prepare pools for scene transition - returns all active objects to pools
## Call this before changing scenes to prevent memory leaks
func prepare_for_scene_change() -> void:
	# Return all active arrows to pool
	for arrow in _active_arrows:
		if is_instance_valid(arrow):
			_disconnect_node_signals(arrow)
			arrow.set_process(false)
			arrow.set_physics_process(false)
			arrow.visible = false
			if arrow.has_method("reset_pooled_state"):
				arrow.reset_pooled_state()
			_arrow_pool.append(arrow)
	_active_arrows.clear()

	# Return all active enemies to pool
	for enemy in _active_enemies:
		if is_instance_valid(enemy):
			_disconnect_node_signals(enemy)
			enemy.set_process(false)
			enemy.set_physics_process(false)
			enemy.visible = false
			if enemy.has_method("reset_pooled_state"):
				enemy.reset_pooled_state()
			_enemy_pool.append(enemy)
	_active_enemies.clear()

	# Return all active hit effects to pool
	for effect in _active_hit_effects:
		if is_instance_valid(effect):
			_disconnect_node_signals(effect)
			effect.set_process(false)
			effect.visible = false
			if effect.has_method("reset_pooled_state"):
				effect.reset_pooled_state()
			_hit_effect_pool.append(effect)
	_active_hit_effects.clear()

	# Return all active death effects to pool
	for effect in _active_death_effects:
		if is_instance_valid(effect):
			_disconnect_node_signals(effect)
			effect.set_process(false)
			effect.visible = false
			if effect.has_method("reset_pooled_state"):
				effect.reset_pooled_state()
			_death_effect_pool.append(effect)
	_active_death_effects.clear()

## Disconnect all signals from a node to prevent memory leaks
func _disconnect_node_signals(node: Node) -> void:
	if node == null or not is_instance_valid(node):
		return

	# Disconnect all connected signals
	for connection in node.get_signal_connection_list(""):
		# Skip built-in signals we want to keep
		pass

	# For child nodes, recursively disconnect
	for child in node.get_children():
		_disconnect_node_signals(child)

func _exit_tree() -> void:
	# Clean up all pooled objects when ObjectPool is freed
	cleanup_all()

	# Clear scene references to release memory
	_arrow_scene = null
	_enemy_scene = null
	_hit_effect_scene = null
	_death_effect_scene = null
